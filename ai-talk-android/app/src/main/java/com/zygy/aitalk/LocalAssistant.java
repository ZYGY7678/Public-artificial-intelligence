package com.zygy.aitalk;

import android.content.Context;

/*
 * Explicit placeholder: no language model is bundled yet.
 * The Qin 1S has very limited RAM/storage; model feasibility must be measured
 * on the actual firmware before choosing a native runtime and weights.
 */
public class LocalAssistant {
    public LocalAssistant(Context context) { }
    public String reply(String prompt) {
        return "הודעתך התקבלה: " + prompt + "\n\nזו בדיקת ממשק בלבד. עדיין אין באפליקציה מודל AI שמייצר תשובות.";
    }
    public void close() { }
}
