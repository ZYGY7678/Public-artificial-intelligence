#!/usr/bin/env python3
"""Train a compact offline Hebrew k-nearest-example text classifier."""
import collections
import math
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "app", "src", "main", "java", "com", "zygy", "aitalk", "LocalAssistant.java")
OUTPUT = os.path.join(ROOT, "app", "src", "main", "assets", "intent_model.tsv")


def normalize(text):
    text = text.lower().translate(str.maketrans({"ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ"}))
    text = re.sub(r"[\u0591-\u05c7]", "", text)
    return " ".join(re.findall(r"[\w]+", text, flags=re.UNICODE))


def grams(text):
    result = collections.Counter()
    words = normalize(text).split()
    for word in words:
        if not word:
            continue
        result["w:" + word] += 3
        padded = "^" + word + "$"
        for size in (2, 3, 4):
            for i in range(0, len(padded) - size + 1):
                result["c:" + padded[i:i + size]] += 1
    for left, right in zip(words, words[1:]):
        if left and right:
            result["b:" + left + "_" + right] += 2
    return result


def read_examples():
    with open(SOURCE, "r", encoding="utf-8") as source:
        code = source.read()
    pattern = re.compile(r'add\("([^"]+)"((?:\s*,\s*"[^"]*")*)\);', re.S)
    examples = []
    seen = set()
    for match in pattern.finditer(code):
        label = match.group(1)
        for phrase in re.findall(r'"([^"]*)"', match.group(2)):
            phrase = phrase.strip()
            key = (label, normalize(phrase))
            if phrase and key not in seen and len(normalize(phrase)) >= 2:
                seen.add(key)
                examples.append((label, phrase))
    if not examples:
        raise RuntimeError("No labeled intent examples found in LocalAssistant.java.")
    return examples


def fit(examples):
    labels = sorted(set(label for label, _ in examples))
    label_index = {label: index for index, label in enumerate(labels)}
    documents = [grams(text) for _, text in examples]
    document_frequency = collections.Counter()
    for doc in documents:
        document_frequency.update(doc.keys())
    total = max(1, len(documents))
    idf = {feature: math.log((total + 1.0) / (count + 1.0)) + 1.0
           for feature, count in document_frequency.items()}
    feature_names = sorted(idf)
    feature_index = {feature: index for index, feature in enumerate(feature_names)}

    vectors = []
    for doc in documents:
        values = {feature_index[f]: (1.0 + math.log(count)) * idf[f]
                  for f, count in doc.items()}
        norm = math.sqrt(sum(value * value for value in values.values())) or 1.0
        vectors.append({index: value / norm for index, value in values.items()})
    encoded = [(label_index[label], vector) for (label, _), vector in zip(examples, vectors)]
    return labels, feature_names, idf, encoded


def evaluate(examples):
    correct = 0
    tested = 0
    for held_index, (held_label, held_text) in enumerate(examples):
        train = examples[:held_index] + examples[held_index + 1:]
        if not any(label == held_label for label, _ in train):
            continue
        labels, feature_names, idf, encoded = fit(train)
        index_of = {feature: index for index, feature in enumerate(feature_names)}
        query_counts = grams(held_text)
        query = {}
        for feature, count in query_counts.items():
            if feature in index_of:
                query[index_of[feature]] = (1.0 + math.log(count)) * idf[feature]
        qnorm = math.sqrt(sum(value * value for value in query.values())) or 1.0
        query = {key: value / qnorm for key, value in query.items()}
        best_by_label = [0.0] * len(labels)
        for label_index, vector in encoded:
            score = sum(query.get(index, 0.0) * value for index, value in vector.items())
            if score > best_by_label[label_index]:
                best_by_label[label_index] = score
        predicted = labels[max(range(len(labels)), key=lambda index: best_by_label[index])]
        tested += 1
        if predicted == held_label:
            correct += 1
    return (100.0 * correct / tested) if tested else 0.0, tested


def write_model(labels, feature_names, idf, encoded):
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8", newline="\n") as out:
        out.write("# AI Talk offline Hebrew kNN model v2\n")
        out.write("V\t2\n")
        for label in labels:
            out.write("C\t" + label + "\n")
        for index, feature in enumerate(feature_names):
            out.write("F\t%d\t%s\t%.6f\n" % (index, feature, idf[feature]))
        for label_index, vector in encoded:
            pairs = ",".join("%d:%.6f" % (index, value) for index, value in sorted(vector.items()))
            out.write("E\t%d\t%s\n" % (label_index, pairs))


def main():
    examples = read_examples()
    labels, feature_names, idf, encoded = fit(examples)
    accuracy, tested = evaluate(examples)
    write_model(labels, feature_names, idf, encoded)
    size = os.path.getsize(OUTPUT)
    print("Trained offline Hebrew word/character n-gram kNN classifier")
    print("Examples: %d | intents: %d | features: %d" % (len(examples), len(labels), len(feature_names)))
    print("Leave-one-out accuracy: %.1f%% (%d examples)" % (accuracy, tested))
    print("Model size: %d bytes" % size)
    if len(labels) < 10 or len(examples) < 70 or size <= 100:
        raise RuntimeError("Training set or model is unexpectedly small.")


if __name__ == "__main__":
    main()
