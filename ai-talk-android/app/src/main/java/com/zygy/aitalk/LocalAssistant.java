package com.zygy.aitalk;

import android.content.Context;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Tiny offline Hebrew dialogue engine for very constrained Android devices.
 *
 * This is deliberately not advertised as a generative LLM. It uses compact
 * intent matching and deterministic responses, has no model weights, network,
 * native runtime, or third-party dependencies, and keeps only a tiny amount
 * of conversation state in RAM.
 */
public final class LocalAssistant {
    private String userName = "";

    public LocalAssistant(Context context) { }

    public String reply(String prompt) {
        if (prompt == null) return "לא קיבלתי הודעה. אפשר לכתוב לי שוב?";
        String raw = prompt.trim();
        if (raw.length() == 0) return "כתוב לי משהו ואנסה לעזור.";
        String s = normalize(raw);

        String math = calculate(raw);
        if (math != null) return math;

        if (containsAny(s, "שלום", "היי", "אהלן", "בוקר טוב", "ערב טוב", "מה נשמע", "מה קורה")) {
            return userName.length() > 0
                ? "שלום " + userName + "! טוב לשמוע ממך. במה אפשר לעזור?"
                : "שלום! שמח לדבר איתך. איך קוראים לך?";
        }

        if (s.matches(".*(קוראים לי|שמי הוא|השם שלי הוא)\\s+.+")) {
            String candidate = raw.replaceAll(".*(?:קוראים לי|שמי הוא|השם שלי הוא)\\s*", "").trim();
            if (candidate.length() > 0 && candidate.length() < 32) {
                userName = candidate;
                return "נעים להכיר, " + userName + "! אזכור את השם שלך כל עוד האפליקציה פתוחה.";
            }
        }

        if (containsAny(s, "איך קוראים לי", "מה השם שלי")) {
            return userName.length() > 0 ? "אמרת לי שקוראים לך " + userName + "." : "עוד לא סיפרת לי איך קוראים לך.";
        }

        if (containsAny(s, "מי אתה", "מה אתה", "מי זאת", "מה השם שלך")) {
            return "אני AI Talk, עוזר מקומי קטן שפועל בתוך המכשיר בלי אינטרנט. אני מבין כמה סוגי בקשות בעברית, אבל אני לא מודל שפה גדול ולכן הידע והשיחה שלי מוגבלים.";
        }

        if (containsAny(s, "מה אתה יודע לעשות", "במה אתה יכול לעזור", "עזרה", "מה האפשרויות")) {
            return "אני יכול לנהל שיחה בסיסית בעברית, לזהות ברכות ותודות, לזכור את שמך בזמן שהאפליקציה פתוחה, לענות על שאלות פשוטות ולחשב תרגילים כמו 12*7. אין לי גישה לאינטרנט או למידע עדכני.";
        }

        if (containsAny(s, "מה השעה", "כמה השעה")) {
            return "השעה במכשיר: " + new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date()) + ".";
        }

        if (containsAny(s, "מה התאריך", "איזה יום היום", "מה היום")) {
            return "לפי שעון המכשיר: " + new SimpleDateFormat("EEEE, d בMMMM yyyy", new Locale("he", "IL")).format(new Date()) + ".";
        }

        if (containsAny(s, "תודה", "תודה רבה", "יישר כח", "אחלה")) {
            return "בשמחה! אני כאן אם תרצה לשאול עוד משהו.";
        }

        if (containsAny(s, "להתראות", "ביי", "לילה טוב", "אני הולך")) {
            return "להתראות! השיחה המקומית נשמרת רק בזיכרון של האפליקציה.";
        }

        if (containsAny(s, "מי יצר אותך", "מי בנה אותך", "מי פיתח אותך")) {
            return "האפליקציה AI Talk נבנתה כפרויקט Android קל למכשיר Qin 1S. מנוע השיחה הזה נכתב במיוחד כדי לצרוך מעט זיכרון.";
        }

        if (containsAny(s, "אתה מחובר לאינטרנט", "יש לך אינטרנט", "אתה עובד בלי אינטרנט")) {
            return "מנוע השיחה שלי פועל מקומית ואינו שולח הודעות לרשת. זיהוי דיבור והקראה הם שירותים נפרדים של Android, והם עשויים לדרוש שירות מותקן או חיבור.";
        }

        if (containsAny(s, "ספר בדיחה", "תספר בדיחה", "בדיחה")) {
            return "למה המחשב הלך לרופא? כי היה לו וירוס... והוא לא רצה להדביק את כל הרשת!";
        }

        if (containsAny(s, "מה מזג האוויר", "מזג האוויר", "האם ירד גשם")) {
            return "אין לי חיבור לשירות מזג אוויר, ולכן איני יכול לבדוק תחזית. אני מעדיף לא להמציא לך תשובה.";
        }

        if (s.endsWith("?") || containsAny(s, "למה", "איך", "מתי", "איפה", "כמה", "האם")) {
            return "אני עדיין מנוע קטן עם הבנה מוגבלת, ולא יודע לענות בביטחון על השאלה הזאת בלי להמציא. אפשר לנסח אותה בצורה פשוטה יותר, או לשאול אותי על השעה, התאריך, חישוב או שימוש באפליקציה.";
        }

        return "קראתי: "" + raw + "". אני עדיין לומד לזהות סוגי הודעות. נסה לכתוב שאלה קצרה, לבקש חישוב, או לכתוב „עזרה” כדי לראות מה אני יודע לעשות.";
    }

    private static String normalize(String value) {
        return value.toLowerCase(new Locale("he", "IL"))
            .replaceAll("[\\u0591-\\u05C7]", "")
            .replaceAll("[,!.;:׳״\\\"'()\\[\\]{}]", " ")
            .replaceAll("\\s+", " ").trim();
    }

    private static boolean containsAny(String text, String... values) {
        for (String value : values) if (text.contains(value)) return true;
        return false;
    }

    // Deliberately limited to a single two-number arithmetic expression.
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
        } catch (Exception ignored) {
            return null;
        }
    }

    public void close() { userName = ""; }
}
