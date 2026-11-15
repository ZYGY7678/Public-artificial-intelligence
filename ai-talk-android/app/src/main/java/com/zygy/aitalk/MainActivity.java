package com.zygy.aitalk;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.content.Intent;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.widget.*;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity implements TextToSpeech.OnInitListener {
    private LinearLayout messages;
    private ScrollView chatScroll;
    private EditText input;
    private TextToSpeech tts;
    private static final int SPEECH_REQUEST = 41;
    private LocalAssistant assistant;
    private int screenWidth;
    private String geminiApiKey = "";
    private TextView aiStatus;
    private TextView privacyHint;
    private boolean cloudBusy = false;
    private final ArrayList<GeminiApiClient.ChatTurn> cloudHistory = new ArrayList<GeminiApiClient.ChatTurn>();

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        assistant = new LocalAssistant(this);
        geminiApiKey = getSharedPreferences("ai_talk_settings", MODE_PRIVATE).getString("gemini_api_key", "");
        tts = new TextToSpeech(this, this);
        screenWidth = getResources().getDisplayMetrics().widthPixels;
        buildUi();
        addMessage("AI Talk", "שלום! אני העוזר המקומי שלך. אפשר לכתוב לי הודעה או ללחוץ על המיקרופון. כתוב „עזרה” כדי לראות מה אני יודע לעשות.", false);
    }

    private int dp(float value) {
        return (int)(value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private GradientDrawable shape(int color, int radius) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(radius));
        return d;
    }

    private TextView text(String value, int size, int color) {
        TextView t = new TextView(this);
        t.setText(value);
        t.setTextSize(size);
        t.setTextColor(color);
        return t;
    }

    private void buildUi() {
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setBackgroundColor(Color.rgb(244, 247, 249));

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(12), dp(8), dp(10), dp(8));
        header.setBackgroundColor(Color.rgb(16, 42, 55));

        TextView logo = text("AI", 17, Color.WHITE);
        logo.setTypeface(Typeface.DEFAULT_BOLD);
        logo.setGravity(Gravity.CENTER);
        logo.setBackground(shape(Color.rgb(0, 150, 136), 14));
        header.addView(logo, new LinearLayout.LayoutParams(dp(38), dp(38)));

        LinearLayout heading = new LinearLayout(this);
        heading.setOrientation(LinearLayout.VERTICAL);
        heading.setPadding(dp(9), 0, 0, 0);
        TextView title = text("AI Talk", 19, Color.WHITE);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        heading.addView(title);
        TextView subtitle = text("מקומי או AI מקוון", 10, 0xffb9cbd2);
        heading.addView(subtitle);
        header.addView(heading, new LinearLayout.LayoutParams(0, -2, 1));

        aiStatus = text(geminiApiKey.length() > 0 ? "● AI ⚙" : "● מקומי ⚙", 10, 0xff80cbc4);
        header.addView(aiStatus);
        aiStatus.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) { openAiSettings(); }
        });
        page.addView(header, new LinearLayout.LayoutParams(-1, -2));

        chatScroll = new ScrollView(this);
        chatScroll.setFillViewport(true);
        chatScroll.setVerticalScrollBarEnabled(false);
        messages = new LinearLayout(this);
        messages.setOrientation(LinearLayout.VERTICAL);
        messages.setPadding(dp(9), dp(10), dp(9), dp(10));
        chatScroll.addView(messages, new ScrollView.LayoutParams(-1, -2));
        page.addView(chatScroll, new LinearLayout.LayoutParams(-1, 0, 1));

        privacyHint = text(geminiApiKey.length() > 0 ? "הודעות נשלחות ל-Google AI" : "השיחה נשארת במכשיר", 10, 0xff81939b);
        privacyHint.setGravity(Gravity.CENTER);
        privacyHint.setPadding(0, dp(3), 0, dp(4));
        page.addView(privacyHint, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout composer = new LinearLayout(this);
        composer.setOrientation(LinearLayout.HORIZONTAL);
        composer.setGravity(Gravity.CENTER_VERTICAL);
        composer.setPadding(dp(7), dp(6), dp(7), dp(7));
        composer.setBackgroundColor(Color.WHITE);

        input = new EditText(this);
        input.setSingleLine(true);
        input.setTextSize(14);
        input.setTextColor(0xff20323a);
        input.setHintTextColor(0xff91a1a8);
        input.setHint("כתיבת הודעה...");
        input.setPadding(dp(12), 0, dp(8), 0);
        input.setBackground(shape(0xfff0f4f5, 20));
        composer.addView(input, new LinearLayout.LayoutParams(0, dp(42), 1));

        TextView mic = actionButton("🎙", 0xffe7f3f2, 0xff087e75);
        LinearLayout.LayoutParams micLp = new LinearLayout.LayoutParams(dp(42), dp(42));
        micLp.setMargins(dp(5), 0, dp(5), 0);
        composer.addView(mic, micLp);
        mic.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) { startSpeech(); }
        });

        TextView send = actionButton("➤", 0xff087e75, Color.WHITE);
        composer.addView(send, new LinearLayout.LayoutParams(dp(42), dp(42)));
        send.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) { sendText(); }
        });
        input.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            public boolean onEditorAction(TextView v, int actionId, android.view.KeyEvent event) {
                sendText();
                return true;
            }
        });
        page.addView(composer, new LinearLayout.LayoutParams(-1, -2));
        setContentView(page);
    }

    private TextView actionButton(String label, int background, int foreground) {
        TextView b = text(label, 18, foreground);
        b.setGravity(Gravity.CENTER);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setBackground(shape(background, 21));
        return b;
    }

    private void sendText() {
        final String value = input.getText().toString().trim();
        if (value.length() == 0) return;
        if (geminiApiKey != null && geminiApiKey.trim().length() > 0 && cloudBusy) {
            Toast.makeText(this, "המתן לתשובת ה-AI הקודמת", Toast.LENGTH_SHORT).show();
            return;
        }
        input.setText("");
        addMessage("אתה", value, true);
        try {
            ((InputMethodManager)getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(input.getWindowToken(), 0);
        } catch (Exception ignored) {}

        if (geminiApiKey == null || geminiApiKey.trim().length() == 0) {
            String answer = assistant.reply(value);
            addMessage("AI Talk • מקומי", answer, false);
            speak(answer);
            return;
        }

        cloudHistory.add(new GeminiApiClient.ChatTurn("user", value));
        trimCloudHistory();
        cloudBusy = true;
        final TextView responseBubble = addMessage("AI Talk • מודל מקוון", "חושב...", false);
        ArrayList<GeminiApiClient.ChatTurn> requestHistory = new ArrayList<GeminiApiClient.ChatTurn>(cloudHistory);
        new GeminiApiClient(geminiApiKey).ask(requestHistory, new GeminiApiClient.Callback() {
            public void onSuccess(final String answer) {
                runOnUiThread(new Runnable() {
                    public void run() {
                        cloudBusy = false;
                        responseBubble.setText(answer);
                        cloudHistory.add(new GeminiApiClient.ChatTurn("model", answer));
                        trimCloudHistory();
                        speak(answer);
                    }
                });
            }
            public void onError(final String error) {
                runOnUiThread(new Runnable() {
                    public void run() {
                        cloudBusy = false;
                        if (cloudHistory.size() > 0 && cloudHistory.get(cloudHistory.size() - 1).role.equals("user")) {
                            cloudHistory.remove(cloudHistory.size() - 1);
                        }
                        String localAnswer = assistant.reply(value);
                        responseBubble.setText("המודל המקוון לא זמין כרגע. עברתי לתשובה מקומית.\n\n" + localAnswer + "\n\nפרטים: " + error);
                        speak(localAnswer);
                    }
                });
            }
        });
    }

    private void trimCloudHistory() {
        while (cloudHistory.size() > 12) {
            if (cloudHistory.size() > 1) {
                cloudHistory.remove(0);
                cloudHistory.remove(0);
            } else {
                cloudHistory.clear();
            }
        }
    }

    private void openAiSettings() {
        final EditText keyField = new EditText(this);
        keyField.setSingleLine(true);
        keyField.setTextSize(13);
        keyField.setHint("הדבק מפתח Gemini API");
        keyField.setInputType(129);
        keyField.setText(geminiApiKey);
        keyField.setSelection(keyField.length());

        new AlertDialog.Builder(this)
            .setTitle("חיבור למודל AI אמיתי")
            .setMessage("אפשר להפעיל תשובות חכמות דרך האינטרנט. הדבק מפתח מ-Google AI Studio. בלי מפתח האפליקציה תמשיך לפעול במצב המקומי. הבקשות נשלחות ל-Google. במסלול החינמי ייתכן שימוש בתוכן לשיפור השירות.")
            .setView(keyField)
            .setPositiveButton("שמור", new android.content.DialogInterface.OnClickListener() {
                public void onClick(android.content.DialogInterface dialog, int which) {
                    geminiApiKey = keyField.getText().toString().trim();
                    getSharedPreferences("ai_talk_settings", MODE_PRIVATE).edit()
                        .putString("gemini_api_key", geminiApiKey).commit();
                    cloudHistory.clear();
                    if (aiStatus != null) aiStatus.setText(geminiApiKey.length() > 0 ? "● AI ⚙" : "● מקומי ⚙");
                    if (privacyHint != null) privacyHint.setText(geminiApiKey.length() > 0 ? "הודעות נשלחות ל-Google AI" : "השיחה נשארת במכשיר");
                    Toast.makeText(MainActivity.this,
                        geminiApiKey.length() > 0 ? "המודל המקוון הופעל" : "הוחזר מצב מקומי",
                        Toast.LENGTH_LONG).show();
                }
            })
            .setNegativeButton("ביטול", null)
            .setNeutralButton("יצירת מפתח", new android.content.DialogInterface.OnClickListener() {
                public void onClick(android.content.DialogInterface dialog, int which) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, android.net.Uri.parse("https://aistudio.google.com/apikey")));
                    } catch (Exception ignored) {
                        Toast.makeText(MainActivity.this, "לא ניתן לפתוח את הדפדפן", Toast.LENGTH_SHORT).show();
                    }
                }
            })
            .show();
    }

    private void startSpeech() {
        try {
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "he-IL");
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "he-IL");
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra("android.speech.extra.PREFER_OFFLINE", true);
            intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "דבר ברור בעברית");
            startActivityForResult(intent, SPEECH_REQUEST);
        } catch (Exception e) {
            addMessage("מערכת", "לא נמצא שירות זיהוי דיבור. בדוק שמותקן במכשיר שירות קלט קולי שתומך בעברית.", false);
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == SPEECH_REQUEST && result == RESULT_OK && data != null) {
            ArrayList<String> results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (results != null && results.size() > 0) {
                String recognized = results.get(0);
                input.setText(recognized);
                input.setSelection(input.length());
                input.requestFocus();
                Toast.makeText(this, "בדוק את התמלול וגע בשליחה", Toast.LENGTH_LONG).show();
            } else {
                Toast.makeText(this, "לא זוהה דיבור. נסה לדבר קרוב יותר ובמשפט קצר.", Toast.LENGTH_LONG).show();
            }
        } else if (request == SPEECH_REQUEST) {
            Toast.makeText(this, "זיהוי הדיבור בוטל או נכשל. בדוק הרשאת מיקרופון ושירות עברית.", Toast.LENGTH_LONG).show();
        }
    }

    private TextView addMessage(String who, String value, boolean user) {
        LinearLayout line = new LinearLayout(this);
        line.setOrientation(LinearLayout.VERTICAL);
        line.setGravity(user ? Gravity.RIGHT : Gravity.LEFT);
        LinearLayout.LayoutParams lineLp = new LinearLayout.LayoutParams(-1, -2);
        lineLp.setMargins(0, dp(3), 0, dp(5));

        TextView bubble = text(value, 13, user ? Color.WHITE : 0xff20343d);
        bubble.setGravity(Gravity.RIGHT);
        bubble.setPadding(dp(11), dp(8), dp(11), dp(8));
        bubble.setBackground(shape(user ? 0xff087e75 : Color.WHITE, 15));
        bubble.setMaxWidth((int)(screenWidth * 0.84f));
        bubble.setTextDirection(View.TEXT_DIRECTION_RTL);
        LinearLayout.LayoutParams bubbleLp = new LinearLayout.LayoutParams(-2, -2);
        bubbleLp.gravity = user ? Gravity.RIGHT : Gravity.LEFT;
        line.addView(bubble, bubbleLp);

        TextView name = text(who, 9, 0xff82939a);
        name.setPadding(dp(4), dp(2), dp(4), 0);
        LinearLayout.LayoutParams nameLp = new LinearLayout.LayoutParams(-2, -2);
        nameLp.gravity = user ? Gravity.RIGHT : Gravity.LEFT;
        line.addView(name, nameLp);
        messages.addView(line, lineLp);
        chatScroll.post(new Runnable() {
            public void run() { chatScroll.fullScroll(View.FOCUS_DOWN); }
        });
        return bubble;
    }

    private void speak(String value) {
        if (tts != null) tts.speak(value, TextToSpeech.QUEUE_FLUSH, null);
    }

    @Override public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS && tts != null) {
            tts.setLanguage(new Locale("he", "IL"));
        }
    }

    @Override protected void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (assistant != null) assistant.close();
        super.onDestroy();
    }
}
