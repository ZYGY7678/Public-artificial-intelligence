package com.zygy.aitalk;

import android.os.Build;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import org.json.JSONArray;
import org.json.JSONObject;

/** Minimal REST client for the hosted Gemini language model. */
public final class GeminiApiClient {
    public interface Callback {
        void onSuccess(String answer);
        void onError(String message);
    }

    public static final class ChatTurn {
        public final String role;
        public final String text;
        public ChatTurn(String r, String t) {
            role = r;
            text = t;
        }
    }

    private static final String MODEL = "gemini-3.5-flash-lite";
    private final String apiKey;

    public GeminiApiClient(String key) {
        apiKey = key == null ? "" : key.trim();
    }

    public void ask(final List<ChatTurn> history, final Callback callback) {
        Thread worker = new Thread(new Runnable() {
            public void run() {
                HttpURLConnection connection = null;
                try {
                    URL url = new URL("https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent");
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setRequestMethod("POST");
                    connection.setConnectTimeout(20000);
                    connection.setReadTimeout(45000);
                    connection.setUseCaches(false);
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                    connection.setRequestProperty("Accept", "application/json");
                    connection.setRequestProperty("x-goog-api-key", apiKey);

                    if (connection instanceof HttpsURLConnection && Build.VERSION.SDK_INT < 20) {
                        try {
                            SSLContext tls = SSLContext.getInstance("TLSv1.2");
                            tls.init(null, null, new java.security.SecureRandom());
                            ((HttpsURLConnection) connection).setSSLSocketFactory(tls.getSocketFactory());
                        } catch (Exception ignored) {}
                    }

                    JSONObject body = new JSONObject();
                    JSONObject system = new JSONObject();
                    JSONArray systemParts = new JSONArray();
                    systemParts.put(new JSONObject().put("text",
                        "אתה AI Talk, עוזר אישי חכם. ענה בעברית טבעית וברורה. " +
                        "הבן גם שגיאות כתיב, ניסוחים קצרים ומשפטים לא מדויקים. " +
                        "השתמש בהקשר השיחה, אל תמציא עובדות, וכשאין מספיק מידע שאל שאלת הבהרה קצרה. " +
                        "העדף תשובות מועילות ותמציתיות."));
                    system.put("parts", systemParts);
                    body.put("system_instruction", system);

                    JSONArray contents = new JSONArray();
                    for (ChatTurn turn : history) {
                        JSONObject item = new JSONObject();
                        item.put("role", turn.role);
                        JSONArray parts = new JSONArray();
                        parts.put(new JSONObject().put("text", turn.text));
                        item.put("parts", parts);
                        contents.put(item);
                    }
                    body.put("contents", contents);
                    JSONObject generation = new JSONObject();
                    generation.put("temperature", 0.65);
                    generation.put("maxOutputTokens", 512);
                    body.put("generationConfig", generation);

                    byte[] payload = body.toString().getBytes("UTF-8");
                    connection.setFixedLengthStreamingMode(payload.length);
                    OutputStream output = connection.getOutputStream();
                    output.write(payload);
                    output.flush();
                    output.close();

                    int status = connection.getResponseCode();
                    InputStream responseStream = status >= 200 && status < 300
                        ? connection.getInputStream() : connection.getErrorStream();
                    String response = readAll(responseStream);
                    if (status < 200 || status >= 300) {
                        String detail = response;
                        try {
                            JSONObject errorRoot = new JSONObject(response);
                            JSONObject error = errorRoot.optJSONObject("error");
                            if (error != null) detail = error.optString("message", response);
                        } catch (Exception ignored) {}
                        callback.onError("HTTP " + status + ": " + detail);
                        return;
                    }

                    JSONObject root = new JSONObject(response);
                    JSONArray candidates = root.optJSONArray("candidates");
                    if (candidates == null || candidates.length() == 0) {
                        callback.onError("המודל לא החזיר תשובה. ייתכן שהבקשה נחסמה.");
                        return;
                    }
                    JSONObject content = candidates.getJSONObject(0).optJSONObject("content");
                    JSONArray parts = content == null ? null : content.optJSONArray("parts");
                    StringBuilder answer = new StringBuilder();
                    if (parts != null) {
                        for (int i = 0; i < parts.length(); i++) {
                            String text = parts.getJSONObject(i).optString("text", "");
                            if (text.length() > 0) {
                                if (answer.length() > 0) answer.append("\n");
                                answer.append(text);
                            }
                        }
                    }
                    if (answer.length() == 0) callback.onError("המודל החזיר תשובה ריקה.");
                    else callback.onSuccess(answer.toString().trim());
                } catch (Exception e) {
                    String message = e.getMessage();
                    callback.onError(message == null ? "שגיאת רשת לא ידועה" : message);
                } finally {
                    if (connection != null) connection.disconnect();
                }
            }
        });
        worker.setName("Gemini-AI-Talk");
        worker.start();
    }

    private String readAll(InputStream stream) throws Exception {
        if (stream == null) return "";
        BufferedReader reader = new BufferedReader(new InputStreamReader(stream, "UTF-8"));
        StringBuilder result = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) result.append(line);
        reader.close();
        return result.toString();
    }
}
