#!/usr/bin/env python3
"""Train a tiny offline Hebrew intent model using only Python's standard library."""
import collections
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "app", "src", "main", "java", "com", "zygy", "aitalk", "LocalAssistant.java")
OUTPUT = os.path.join(ROOT, "app", "src", "main", "assets", "intent_model.tsv")
MAX_FEATURES_PER_INTENT = 120


def normalize(text):
    text = text.lower().translate(str.maketrans({"ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ"}))
    text = re.sub(r"[\u0591-\u05c7]", "", text)
    return " ".join(re.findall(r"[\w]+", text, flags=re.UNICODE))


def grams(text):
    result = collections.Counter()
    for word in normalize(text).split():
        padded = "^" + word + "$"
        for size in (2, 3, 4):
            for i in range(0, len(padded) - size + 1):
                result[padded[i:i + size]] += 1
    return result


def read_examples():
    with open(SOURCE, "r", encoding="utf-8") as source:
        code = source.read()
    pattern = re.compile(r'add\("([^"]+)"((?:\s*,\s*"[^"]*")*)\);', re.S)
    examples = []
    seen = set()
    for match in pattern.finditer(code):
        label = match.group(1)
        phrases = re.findall(r'"([^"]*)"', match.group(2))
        for phrase in phrases:
            phrase = phrase.strip()
            key = (label, normalize(phrase))
            if phrase and key not in seen and len(normalize(phrase)) >= 2:
                seen.add(key)
                examples.append((label, phrase))
    if not examples:
        raise RuntimeError("No labeled add(intent, phrase...) examples were found.")
    return examples


def train(examples):
    labels = sorted(set(label for label, _ in examples))
    label_index = {label: i for i, label in enumerate(labels)}
    docs = [grams(text) for _, text in examples]
    df = collections.Counter()
    for doc in docs:
        df.update(doc.keys())
    total = max(1, len(docs))
    idf = {feature: math.log((total + 1.0) / (count + 1.0)) + 1.0
           for feature, count in df.items()}

    vectors = []
    for doc in docs:
        vector = {feature: (1.0 + math.log(count)) * idf[feature]
                  for feature, count in doc.items()}
        norm = math.sqrt(sum(value * value for value in vector.values())) or 1.0
        vectors.append({feature: value / norm for feature, value in vector.items()})

    sums = [collections.defaultdict(float) for _ in labels]
    counts = [0] * len(labels)
    for (label, _), vector in zip(examples, vectors):
        index = label_index[label]
        counts[index] += 1
        for feature, value in vector.items():
            sums[index][feature] += value

    prototypes = []
    selected_features = set()
    for index, values in enumerate(sums):
        averaged = {feature: value / max(1, counts[index]) for feature, value in values.items()}
        ranked = sorted(averaged.items(), key=lambda item: (-item[1], item[0]))[:MAX_FEATURES_PER_INTENT]
        norm = math.sqrt(sum(value * value for _, value in ranked)) or 1.0
        prototype = {feature: value / norm for feature, value in ranked}
        prototypes.append(prototype)
        selected_features.update(prototype.keys())
    return labels, idf, prototypes, selected_features, label_index


def evaluate(examples, labels):
    # Leave-one-example-out check. Each test phrase is compared with class
    # centroids built from the other phrases, so the reported value is not
    # simply training-set accuracy.
    label_index = {label: i for i, label in enumerate(labels)}
    correct = 0
    tested = 0
    for held_index, (held_label, held_text) in enumerate(examples):
        remaining = examples[:held_index] + examples[held_index + 1:]
        if not any(label == held_label for label, _ in remaining):
            continue
        docs = [grams(text) for _, text in remaining]
        df = collections.Counter()
        for doc in docs:
            df.update(doc.keys())
        idf = {feature: math.log((len(docs) + 1.0) / (count + 1.0)) + 1.0
               for feature, count in df.items()}
        sums = [collections.defaultdict(float) for _ in labels]
        counts = [0] * len(labels)
        for (label, _), doc in zip(remaining, docs):
            index = label_index[label]
            vector = {f: (1.0 + math.log(c)) * idf[f] for f, c in doc.items()}
            norm = math.sqrt(sum(v * v for v in vector.values())) or 1.0
            counts[index] += 1
            for feature, value in vector.items():
                sums[index][feature] += value / norm
        query = grams(held_text)
        q = {f: (1.0 + math.log(c)) * idf[f] for f, c in query.items() if f in idf}
        qnorm = math.sqrt(sum(v * v for v in q.values())) or 1.0
        scores = []
        for index in range(len(labels)):
            proto = dict(sums[index])
            pnorm = math.sqrt(sum(v * v for v in proto.values())) or 1.0
            score = sum(value * proto.get(feature, 0.0) for feature, value in q.items())
            scores.append(score / (qnorm * pnorm))
        predicted = labels[max(range(len(scores)), key=lambda i: scores[i])]
        tested += 1
        if predicted == held_label:
            correct += 1
    return (100.0 * correct / tested) if tested else 0.0, tested


def write_model(labels, idf, prototypes, selected_features):
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8", newline="\n") as out:
        out.write("# AI Talk compact Hebrew character-ngram model v1\n")
        out.write("V\t1\n")
        for label in labels:
            out.write("C\t" + label + "\n")
        for feature in sorted(selected_features):
            pairs = []
            for index, prototype in enumerate(prototypes):
                weight = prototype.get(feature, 0.0)
                if weight > 0.000001:
                    pairs.append(str(index) + ":" + ("%.6f" % weight))
            out.write("F\t" + feature + "\t" + ("%.6f" % idf[feature]) + "\t" + ",".join(pairs) + "\n")


def main():
    examples = read_examples()
    labels, idf, prototypes, selected, _ = train(examples)
    accuracy, tested = evaluate(examples, labels)
    write_model(labels, idf, prototypes, selected)
    size = os.path.getsize(OUTPUT)
    print("Trained offline Hebrew character-ngram classifier")
    print("Examples: %d | intents: %d | features: %d" % (len(examples), len(labels), len(selected)))
    print("Leave-one-out accuracy: %.1f%% (%d examples)" % (accuracy, tested))
    print("Model size: %d bytes" % size)
    if len(labels) < 10 or len(examples) < 70 or size <= 100:
        raise RuntimeError("Training set or generated model is unexpectedly small.")


if __name__ == "__main__":
    main()
