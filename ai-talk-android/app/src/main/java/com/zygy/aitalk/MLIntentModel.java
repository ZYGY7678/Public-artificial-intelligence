package com.zygy.aitalk;

import android.content.Context;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Offline k-nearest-example Hebrew text classifier trained at build time.
 * The compact model uses word and character n-grams; no network or native code.
 */
public final class MLIntentModel {
    private final Map<String, Integer> featureIds = new HashMap<String, Integer>();
    private String[] intents = new String[0];
    private float[] idf = new float[0];
    private final ArrayList<Example> examples = new ArrayList<Example>();

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
            ArrayList<String> featureRows = new ArrayList<String>();
            ArrayList<String> exampleRows = new ArrayList<String>();
            while ((line = reader.readLine()) != null) {
                if (line.length() == 0 || line.startsWith("#")) continue;
                if (line.startsWith("C\t")) {
                    String[] parts = line.split("\\t");
                    if (parts.length >= 2) labels.add(parts[1]);
                } else if (line.startsWith("F\t")) {
                    featureRows.add(line);
                } else if (line.startsWith("E\t")) {
                    exampleRows.add(line);
                }
            }
            intents = labels.toArray(new String[labels.size()]);
            idf = new float[featureRows.size()];
            for (String row : featureRows) {
                String[] parts = row.split("\\t");
                if (parts.length < 4) continue;
                int index = Integer.parseInt(parts[1]);
                if (index < 0 || index >= idf.length) continue;
                featureIds.put(parts[2], Integer.valueOf(index));
                idf[index] = Float.parseFloat(parts[3]);
            }
            for (String row : exampleRows) {
                String[] parts = row.split("\\t");
                if (parts.length < 3) continue;
                int label = Integer.parseInt(parts[1]);
                if (label < 0 || label >= intents.length) continue;
                String[] pairs = parts[2].split(",");
                int[] indexes = new int[pairs.length];
                float[] values = new float[pairs.length];
                int used = 0;
                for (String pair : pairs) {
                    String[] kv = pair.split(":");
                    if (kv.length != 2) continue;
                    indexes[used] = Integer.parseInt(kv[0]);
                    values[used] = Float.parseFloat(kv[1]);
                    used++;
                }
                if (used > 0) examples.add(new Example(label, trim(indexes, used), trim(values, used)));
            }
        } catch (Exception ignored) {
            featureIds.clear();
            examples.clear();
            intents = new String[0];
            idf = new float[0];
        } finally {
            if (reader != null) {
                try { reader.close(); } catch (Exception ignored) {}
            }
        }
    }

    private int[] trim(int[] source, int count) {
        int[] result = new int[count];
        System.arraycopy(source, 0, result, 0, count);
        return result;
    }
    private float[] trim(float[] source, int count) {
        float[] result = new float[count];
        System.arraycopy(source, 0, result, 0, count);
        return result;
    }

    public Prediction predict(String input) {
        if (intents.length == 0 || examples.size() == 0 || input == null) return null;
        Map<String, Integer> counts = extractFeatures(input);
        HashMap<Integer, Float> query = new HashMap<Integer, Float>();
        double normSquared = 0.0;
        for (Map.Entry<String, Integer> entry : counts.entrySet()) {
            Integer index = featureIds.get(entry.getKey());
            if (index == null) continue;
            double value = (1.0 + Math.log(entry.getValue().intValue())) * idf[index.intValue()];
            if (value == 0) continue;
            query.put(index, Float.valueOf((float)value));
            normSquared += value * value;
        }
        if (normSquared <= 0.0000001) return null;
        double norm = Math.sqrt(normSquared);
        for (Map.Entry<Integer, Float> entry : query.entrySet()) {
            entry.setValue(Float.valueOf((float)(entry.getValue().floatValue() / norm)));
        }

        double[] bestByIntent = new double[intents.length];
        for (int i = 0; i < bestByIntent.length; i++) bestByIntent[i] = 0.0;
        for (Example example : examples) {
            double score = 0.0;
            for (int i = 0; i < example.indexes.length; i++) {
                Float value = query.get(Integer.valueOf(example.indexes[i]));
                if (value != null) score += value.floatValue() * example.values[i];
            }
            if (score > bestByIntent[example.label]) bestByIntent[example.label] = score;
        }
        int best = -1;
        double bestScore = -1.0;
        double second = -1.0;
        for (int i = 0; i < bestByIntent.length; i++) {
            if (bestByIntent[i] > bestScore) {
                second = bestScore;
                bestScore = bestByIntent[i];
                best = i;
            } else if (bestByIntent[i] > second) {
                second = bestByIntent[i];
            }
        }
        if (best < 0) return null;
        if (second < 0) second = 0.0;
        return new Prediction(intents[best], bestScore, bestScore - second);
    }

    private Map<String, Integer> extractFeatures(String input) {
        String normalized = normalize(input);
        String[] words = normalized.length() == 0 ? new String[0] : normalized.split(" ");
        Map<String, Integer> result = new HashMap<String, Integer>();
        for (String word : words) {
            if (word.length() == 0) continue;
            increment(result, "w:" + word, 3);
            String padded = "^" + word + "$";
            for (int n = 2; n <= 4; n++) {
                for (int i = 0; i + n <= padded.length(); i++) {
                    increment(result, "c:" + padded.substring(i, i + n), 1);
                }
            }
        }
        for (int i = 0; i + 1 < words.length; i++) {
            if (words[i].length() > 0 && words[i + 1].length() > 0) {
                increment(result, "b:" + words[i] + "_" + words[i + 1], 2);
            }
        }
        return result;
    }

    private void increment(Map<String, Integer> map, String key, int amount) {
        Integer old = map.get(key);
        map.put(key, Integer.valueOf((old == null ? 0 : old.intValue()) + amount));
    }

    private String normalize(String value) {
        return value.toLowerCase(new Locale("he", "IL"))
            .replace('ך', 'כ').replace('ם', 'מ').replace('ן', 'נ')
            .replace('ף', 'פ').replace('ץ', 'צ')
            .replaceAll("[\\u0591-\\u05C7]", "")
            .replaceAll("[^\\p{L}\\p{N}]", " ")
            .replaceAll("\\s+", " ").trim();
    }

    private static final class Example {
        final int label;
        final int[] indexes;
        final float[] values;
        Example(int l, int[] i, float[] v) { label = l; indexes = i; values = v; }
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
