package com.zygy.aitalk;

import android.content.Context;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lightweight offline Hebrew intent engine for Android 4.4 devices.
 * It uses normalization, phrase variants and tolerant token matching.
 * It is not a generative language model.
 */
public final class LocalAssistant {
    private String userName = "";
    private String lastTopic = "";

    public LocalAssistant(Context context) { }

    public String reply(String prompt) {
        if (prompt == null) return "לא שמעתי הודעה. אפשר לנסות שוב?";
        String raw = prompt.trim();
        if (raw.length() == 0) return "לא התקבלה הודעה. כתוב או אמור משפט קצר.";
        String s = normalize(raw);

        String math = calculate(raw);
        if (math != null) return math;

        if (is(s, "שלום", "היי", "אהלן", "בוקר טוב", "ערב טוב", "מה נשמע", "מה קורה", "הלו")) {
            lastTopic = "greeting";
            return userName.length() > 0
                ? "שלום " + userName + "! טוב לשמוע ממך. מה תרצה לעשות?"
                : "שלום! אני מקשיב. איך קוראים לך?";
        }

        if (containsAny(s, "קוראים לי", "שמי", "השם שלי")) {
            String candidate = raw.replaceAll(".*(?:קוראים לי|שמי הוא|שמי|השם שלי הוא|השם שלי)\\s*", "").trim();
            candidate = candidate.replaceAll("[.!?,]+$", "").trim();
            if (candidate.length() > 0 && candidate.length() < 32) {
                userName = candidate;
                lastTopic = "name";
                return "נעים להכיר, " + userName + ". אזכור את השם שלך כל עוד האפליקציה פתוחה.";
            }
        }

        if (is(s, "איך קוראים לי", "מה השם שלי", "אתה זוכר את השם שלי")) {
            return userName.length() > 0 ? "אמרת לי שקוראים לך " + userName + "." : "עוד לא סיפרת לי את שמך. אפשר לומר: קוראים לי...";
        }

        if (is(s, "מי אתה", "מה אתה", "מה השם שלך", "מי בנה אותך", "מי יצר אותך")) {
            lastTopic = "identity";
            return "אני AI Talk, עוזר מקומי קטן שרץ במכשיר בלי אינטרנט. אני מזהה בקשות נפוצות בעברית, אבל איני מודל שפה גדול כמו ChatGPT.";
        }

        if (is(s, "עזרה", "מה אתה יודע לעשות", "במה אתה יכול לעזור", "מה האפשרויות", "מה אפשר לעשות")) {
            lastTopic = "help";
            return "אפשר לדבר איתי על השעה והתאריך, לבצע חישובים, לספר בדיחה, לשמור את שמך בזמן שהאפליקציה פתוחה ולשאול שאלות בסיסיות. אפשר גם לנסח מחדש אם לא הבנתי. לדוגמה: כמה זה 25 כפול 4?";
        }

        if (is(s, "מה השעה", "כמה השעה", "תגיד לי מה השעה", "מה השעה עכשיו")) {
            lastTopic = "time";
            return "השעה במכשיר היא " + new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date()) + ".";
        }

        if (is(s, "מה התאריך", "איזה יום היום", "מה היום", "מה התאריך היום", "איזה תאריך היום")) {
            lastTopic = "date";
            return "לפי שעון המכשיר: " + new SimpleDateFormat("EEEE, d בMMMM yyyy", new Locale("he", "IL")).format(new Date()) + ".";
        }

        if (is(s, "תודה", "תודה רבה", "יישר כוח", "אחלה", "מעולה", "מצוין")) {
            return "בשמחה! רוצה לשאול או לעשות משהו נוסף?";
        }

        if (is(s, "להתראות", "ביי", "לילה טוב", "אני הולך", "שלום ולהתראות")) {
            return "להתראות! שמחתי לדבר איתך.";
        }

        if (is(s, "ספר בדיחה", "תספר בדיחה", "בדיחה", "תגיד בדיחה")) {
            return "למה המחשב הלך לרופא? כי היה לו וירוס, והוא לא רצה להדביק את כל הרשת!";
        }

        if (is(s, "אתה מחובר לאינטרנט", "יש לך אינטרנט", "אתה עובד בלי אינטרנט", "אתה פועל בלי רשת")) {
            return "מנוע השיחה פועל מקומית. זיהוי הדיבור עצמו נעשה על ידי שירות Android נפרד, והוא עשוי לדרוש שירות מתאים או חיבור לרשת.";
        }

        if (containsAny(s, "מזג האוויר", "יהיה גשם", "ירד גשם")) {
            return "אין לי חיבור לתחזית מזג אוויר, ולכן לא אנחש.";
        }

        if (is(s, "תחזור על זה", "לא הבנתי", "מה אמרת", "תחזור")) {
            return "אין לי הקלטה של התשובה הקודמת. אפשר לשאול שוב במילים אחרות.";
        }

        if (s.length() <= 3) return "שמעתי רק מילה קצרה: " + raw + ". אפשר להרחיב קצת?";
        if (lastTopic.equals("greeting") && containsAny(s, "בסדר", "טוב", "מצוין", "ברוך השם")) {
            return "יופי! במה תרצה שאעזור?";
        }

        return "אני רוצה להבין אותך נכון, אבל המשפט לא מתאים עדיין לפקודות שאני מכיר. נסה לומר את זה במשפט קצר וברור, או כתוב 'עזרה' לדוגמאות.";
    }

    private static String normalize(String value) {
        return value.toLowerCase(new Locale("he", "IL"))
            .replace('ך', 'כ').replace('ם', 'מ').replace('ן', 'נ').replace('ף', 'פ').replace('ץ', 'צ')
            .replaceAll("[\\u0591-\\u05C7]", "")
            .replaceAll("[,!.;:׳״\\\"'()\\[\\]{}?]", " ")
            .replaceAll("\\s+", " ").trim();
    }

    private static boolean is(String text, String... phrases) {
        for (String phrase : phrases) {
            String p = normalize(phrase);
            if (text.equals(p) || text.contains(p)) return true;
            if (nearPhrase(text, p)) return true;
        }
        return false;
    }

    // Tolerates one omitted/extra word in short spoken requests without
    // matching unrelated long sentences.
    private static boolean nearPhrase(String text, String phrase) {
        String[] a = text.split(" ");
        String[] b = phrase.split(" ");
        if (a.length < 2 || b.length < 2 || a.length > b.length + 1 || b.length > a.length + 1) return false;
        int matched = 0;
        for (String word : b) {
            for (String candidate : a) {
                if (word.equals(candidate) || (word.length() >= 4 && candidate.length() >= 4 &&
                    (word.startsWith(candidate) || candidate.startsWith(word)))) {
                    matched++;
                    break;
                }
            }
        }
        return matched >= Math.max(2, b.length - 1);
    }

    private static boolean containsAny(String text, String... values) {
        for (String value : values) if (text.contains(normalize(value))) return true;
        return false;
    }

    private static String calculate(String input) {
        Matcher m = Pattern.compile(".*?(-?\\d+(?:[.,]\\d+)?)\\s*([+*/xX×÷-])\\s*(-?\\d+(?:[.,]\\d+)?).*").matcher(input);
        if (!m.matches()) return null;
        try {
            double a = Double.parseDouble(m.group(1).replace(',', '.'));
            double b = Double.parseDouble(m.group(3).replace(',', '.'));
            double result;
            String op = m.group(2);
            if ("+".equals(op)) result = a + b;
            else if ("-".equals(op)) result = a - b;
            else if ("*".equals(op) || "x".equalsIgnoreCase(op) || "×".equals(op)) result = a * b;
            else {
                if (b == 0) return "אי אפשר לחלק באפס.";
                result = a / b;
            }
            if (Double.isNaN(result) || Double.isInfinite(result)) return null;
            String shown = result == Math.rint(result) && Math.abs(result) < 9.0e15
                ? Long.toString((long) result) : Double.toString(result);
            return "התוצאה היא " + shown + ".";
        } catch (Exception ignored) { return null; }
    }

    public void close() { userName = ""; lastTopic = ""; }
}
