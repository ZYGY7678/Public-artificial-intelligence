package com.zygy.aitalk;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.widget.*;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity implements TextToSpeech.OnInitListener {
    private LinearLayout messages;
    private EditText input;
    private TextToSpeech tts;
    private static final int SPEECH_REQUEST = 41;
    private LocalAssistant assistant;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        assistant = new LocalAssistant(this);
        tts = new TextToSpeech(this, this);
        buildUi();
        addMessage("AI Talk", "ברוך הבא ל-AI Talk! אני עוזר מקומי קטן שעובד בלי אינטרנט. כתוב „עזרה” כדי לראות מה אני יודע לעשות.", false);
    }

    private void buildUi() {
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(8, 8, 8, 8);
        page.setBackgroundColor(0xff101820);
        TextView title = new TextView(this);
        title.setText("AI Talk");
        title.setTextColor(0xffffffff);
        title.setTextSize(22);
        title.setGravity(Gravity.CENTER);
        title.setPadding(4, 8, 4, 10);
        page.addView(title, new LinearLayout.LayoutParams(-1, -2));
        ScrollView scroll = new ScrollView(this);
        messages = new LinearLayout(this);
        messages.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(messages);
        page.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        LinearLayout controls = new LinearLayout(this);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        input = new EditText(this);
        input.setSingleLine(true);
        input.setTextColor(0xff111111);
        input.setHint("כתוב הודעה...");
        controls.addView(input, new LinearLayout.LayoutParams(0, 48, 1));
        Button send = new Button(this);
        send.setText("שלח");
        controls.addView(send, new LinearLayout.LayoutParams(-2, 48));
        send.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { sendText(); }});
        Button mic = new Button(this);
        mic.setText("דבר");
        controls.addView(mic, new LinearLayout.LayoutParams(-2, 48));
        mic.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { startSpeech(); }});
        page.addView(controls);
        setContentView(page);
    }

    private void sendText() {
        String text = input.getText().toString().trim();
        if (text.length() == 0) return;
        input.setText("");
        addMessage("אתה", text, true);
        ((InputMethodManager)getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(input.getWindowToken(), 0);
        String answer = assistant.reply(text);
        addMessage("AI Talk", answer, false);
        speak(answer);
    }

    private void startSpeech() {
        try {
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "he-IL");
            intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "דבר בעברית");
            startActivityForResult(intent, SPEECH_REQUEST);
        } catch (Exception e) {
            addMessage("מערכת", "לא נמצא שירות זיהוי דיבור במכשיר.", false);
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == SPEECH_REQUEST && result == RESULT_OK && data != null) {
            ArrayList<String> results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (results != null && results.size() > 0) { input.setText(results.get(0)); sendText(); }
        }
    }

    private void addMessage(String who, String text, boolean user) {
        TextView bubble = new TextView(this);
        bubble.setText(who + "\n" + text);
        bubble.setTextSize(16);
        bubble.setTextColor(0xffffffff);
        bubble.setPadding(10, 9, 10, 9);
        bubble.setBackgroundColor(user ? 0xff245b78 : 0xff263746);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.setMargins(0, 4, 0, 4);
        messages.addView(bubble, lp);
    }

    private void speak(String text) {
        if (tts != null) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null);
    }

    @Override public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS && tts != null) tts.setLanguage(new Locale("he", "IL"));
    }

    @Override protected void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (assistant != null) assistant.close();
        super.onDestroy();
    }
}
