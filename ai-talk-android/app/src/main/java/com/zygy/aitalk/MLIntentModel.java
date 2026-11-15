package com.zygy.aitalk;

import android.content.Context;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Small offline Hebrew character-ngram classifier.
 * The model is trained during the GitHub Actions build from the assistant's
 * labeled examples, then loaded from assets. It uses no network or native libs.
 */
public final class MLIntentModel {
    private final Map<String, Feature> features = new HashMap<String, Feature>();
    private String[] intents = new String[0];

    public MLIntentModel(Context context) {
        load(context);
    }

    private void load(Context context) {
        BufferedReader reader = null;
        try {
            InputStream stream = context.getAssets().open("intent_model.tsv");
            reader = new BufferedReader(new InputStreamReader(stream, "UTF-8"));
            String line;
            ArrayList<String> labels = new ArrayList<String>();
            ArrayList<String> featureLines = new ArrayList<String>();
            while ((line = reader.readLine()) != null) {
                if (line.length() == 0 || line.startsWith("#")) continue;
                if (line.startsWith("C\t")) {
                    String[] parts = line.split("\\t");
                    if (parts.length >= 2) labels.add(parts[1]);
                } else if (line.startsWith("F\t")) {
                    featureLines.add(line);
                }
            }
            intents = labels.toArray(new String[labels.size()]);
            for (String row : featureLines) {
                String[] parts = row.split("\\t");
                if (parts.length < 4) continue;
                Feature f = new Feature(Float.parseFloat(parts[2]), intents.length);
                String[] entries = parts[3].split(",");
                for (String entry : entries) {
                    String[] pair = entry.split(":");
                    if (pair.length != 2) continue;
                    int index = Integer.parseInt(pair[0]);
                    if (index >= 0 && index < f.weights.length) {
                        f.weights[index] = Float.parseFloat(pair[1]);
                    }
                }
                features.put(parts[1], f);
            }
        } catch (Exception ignored) {
            features.clear();
            intents = new String[0];
        } finally {
            if (reader != null) {
                try { reader.close(); } catch (Exception ignored) {}
            }
        }
    }

    public Prediction predict(String input) {
        if (intents.length == 0 || features.size() == 0 || input == null) return null;
        Map<String, Integer> counts = extractFeatures(input);
        double[] scores = new double[intents.length];
        double normSquared = 0.0;
        for (Map.Entry<String, Integer> entry : counts.entrySet()) {
            Feature f = features.get(entry.getKey());
            if (f == null) continue;
            double value = entry.getValue().intValue() * f.idf;
            normSquared += value * value;
            for (int i = 0; i < scores.length; i++) {
                if (f.weights[i] != 0.0f) scores[i] += value * f.weights[i];
            }
        }
        if (normSquared <= 0.0000001) return null;
        double norm = Math.sqrt(normSquared);
        int best = -1;
        double bestScore = -1.0;
        double second = -1.0;
        for (int i = 0; i < scores.length; i++) {
            scores[i] /= norm;
            if (scores[i] > bestScore) {
                second = bestScore;
                bestScore = scores[i];
                best = i;
            } else if (scores[i] > second) {
                second = scores[i];
            }
        }
        if (best < 0) return null;
        if (second < 0) second = 0;
        return new Prediction(intents[best], bestScore, bestScore - second);
    }

    private Map<String, Integer> extractFeatures(String input) {
        String normalized = normalize(input);
        String[] words = normalized.split(" ");
        Map<String, Integer> result = new HashMap<String, Integer>();
        for (String word : words) {
            if (word.length() == 0) continue;
            String padded = "^" + word + "$";
            for (int n = 2; n <= 4; n++) {
                for (int i = 0; i + n <= padded.length(); i++) {
                    String gram = padded.substring(i, i + n);
                    Integer old = result.get(gram);
                    result.put(gram, Integer.valueOf(old == null ? 1 : old.intValue() + 1));
                }
            }
        }
        return result;
    }

    private String normalize(String value) {
        return value.toLowerCase(new Locale("he", "IL"))
            .replace('ך', 'כ').replace('ם', 'מ').replace('ן', 'נ')
            .replace('ף', 'פ').replace('ץ', 'צ')
            .replaceAll("[\\u0591-\\u05C7]", "")
            .replaceAll("[^\\p{L}\\p{N}]", " ")
            .replaceAll("\\s+", " ").trim();
    }

    private static final class Feature {
        final float idf;
        final float[] weights;
        Feature(float value, int classes) {
            idf = value;
            weights = new float[classes];
        }
    }

    public static final class Prediction {
        public final String intent;
        public final double score;
        public final double margin;
        Prediction(String label, double value, double difference) {
            intent = label;
            score = value;
            margin = difference;
        }
    }
}
