package com.zygy.aitalk;

import android.content.Context;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.regex.*;

/**
 * Offline Hebrew semantic model for very low-memory Android devices.
 * Local example corpus + synonym concepts + token normalization + weighted
 * similarity. No network calls, cloud services, or external model files.
 */
public final class LocalAssistant {
    private final Map<String, ArrayList<String[]>> model = new LinkedHashMap<String, ArrayList<String[]>>();
    private final Map<String, String> synonyms = new HashMap<String, String>();
    private String userName = "";
    private String lastIntent = "";

    public LocalAssistant(Context context) {
        concept("שלום","היי","הי","אהלן","שלומות","הלו");
        concept("זמן","שעה","שעון","כרגע","עכשיו","מתי");
        concept("תאריך","יום","היום","מחר","אתמול","לוח");
        concept("זהות","מי","אתה","רובוט","בינה","עוזר","תוכנה","יוצר","נוצר");
        concept("עזרה","עזור","לעזור","סיוע","אפשרויות","יכולת","מסוגל","יודע","תפריט");
        concept("תודה","מודה","מעריך","יישר","כוח","תבורכו");
        concept("פרידה","להתראות","ביי","נתראה","הולך","יוצא");
        concept("בדיחה","צחוק","מצחיק","הומור","תצחיק");
        concept("רשת","אינטרנט","מקוון","אונליין","וויפיי","wifi","חיבור");
        concept("מזג","אוויר","גשם","תחזית","עננים","מעלות","קר","חם");
        concept("חזרה","שוב","חזור","הסבר","קודם","להסביר");
        concept("מצב","שלומך","מרגיש","טוב","בסדר","מעולה","נהדר","סבבה","יופי");
        concept("שם","קוראים","שמי","כינוי");
        concept("זיכרון","זוכר","לזכור","שכחת","שכח");
        concept("מוזיקה","שיר","שירים","זמר","נגינה","מנגינה");
        concept("מקום","איפה","מיקום","עיר","מדינה","כתובת","נמצא");
        concept("אוכל","רעב","לאכול","ארוחה","שתייה","צמא");
        concept("עבודה","משימה","לבצע","לעשות","פרויקט","פעולה");
        concept("הבנה","מבין","הבנת","להבין","כוונה","התכוונתי","מפרש");
        concept("מחמאה","חכם","כל","הכבוד","מעולה","אהבתי");

        concept("מדע","ניסוי","חומר","אנרגיה","כוח","כבידה","אטום","מולקולה","חלל","כוכב","כדור הארץ");
        concept("היסטוריה","עבר","עתיק","מלחמה","מלך","תקופה","היסטורי");
        concept("בעלי חיים","חיה","חיות","כלב","חתול","ציפור","דג","תמנון","יונק","טבע");
        concept("ספורט","כדורגל","כדורסל","ריצה","אימון","משחק","קבוצה","שחקן");
        concept("תכנות","קוד","תכנות","תוכנית","ג'אווה","פייתון","תכנת","באג","שגיאה");
        concept("טלפון","מכשיר","סוללה","מסך","אנדרואיד","נייד","טעינה");
        concept("אפליקציה","יישום","התקנה","apk","אפליקציות");
        concept("כסף","מחיר","עלות","שקל","דולר","תקציב","תשלום","חינם");
        concept("כתיבה","כתוב","לכתוב","ניסוח","מכתב","הודעה","סיפור","טקסט");
        concept("שפה","עברית","אנגלית","תרגום","מילה","משפט","דקדוק","לשון");
        concept("בישול","לבשל","מתכון","תנור","סיר","אפייה");
        concept("כיוון","דרך","מסלול","לנסוע","הליכה","ניווט");
        concept("בטיחות","סכנה","זהירות","סיסמה","פרטיות","אבטחה");
        concept("השוואה","השווה","הבדל","לעומת","יתרון","חיסרון","דומה");

        add("greeting","שלום","היי מה נשמע","אהלן מה קורה","בוקר טוב","ערב טוב","מה העניינים","מה שלומך","הלו אתה שם","רציתי להגיד לך היי","שלום לך מה קורה");
        add("identity","מי אתה","מה אתה בעצם","איך קוראים לך","מה השם שלך","אתה בן אדם או מחשב","אתה רובוט","מי יצר אותך","מי בנה אותך","ספר לי על עצמך","מה התפקיד שלך");
        add("help","מה אתה יודע לעשות","במה אתה יכול לעזור לי","איזה דברים אפשר לשאול אותך","מה האפשרויות שלך","איך משתמשים בך","תן לי עזרה","מה היכולות שלך","תן דוגמאות");
        add("time","מה השעה","כמה השעה עכשיו","מה הזמן כרגע","תגיד לי מה השעה","תבדוק את השעון","אפשר לדעת מה השעה");
        add("date","איזה יום היום","מה התאריך של היום","תגיד לי מה התאריך","באיזה יום אנחנו","איזה תאריך היום");
        add("thanks","תודה","תודה רבה לך","אני מודה לך","יישר כוח","מעריך את העזרה שלך","תודה על הכל");
        add("bye","להתראות","ביי נדבר אחר כך","אני צריך ללכת","לילה טוב","נתראה בהמשך","סיימנו ביי");
        add("joke","ספר לי בדיחה","תצחיק אותי","יש לך משהו מצחיק","אני רוצה לשמוע בדיחה","תגיד משהו מצחיק");
        add("internet","אתה עובד בלי אינטרנט","יש לך חיבור לרשת","האם אתה מחובר לאינטרנט","אפשר לדבר איתך במצב טיסה","אתה צריך וויפיי");
        add("weather","מה מזג האוויר היום","האם ירד גשם מחר","יהיה קר בחוץ","תן לי תחזית מזג אוויר","כמה מעלות עכשיו");
        add("repeat","תחזור על מה שאמרת","לא הבנתי את התשובה","תגיד את זה שוב","אפשר הסבר נוסף","מה אמרת קודם","תסביר במילים אחרות");
        add("mood","מה שלומך היום","איך אתה מרגיש","מה מצבך","הכל טוב אצלך","אתה שמח");
        add("name_ask","איך קוראים לי","מה השם שלי","אתה זוכר איך קוראים לי","מה אמרתי שקוראים לי");
        add("memory","אתה זוכר אותי","מה אתה זוכר עלי","מה סיפרתי לך","אתה זוכר מה אמרתי קודם");
        add("music","בוא נדבר על מוזיקה","אני אוהב שירים","אתה מכיר שירים","אפשר לדבר על נגינה");
        add("location","איפה אני נמצא","מה המיקום שלי","באיזו עיר אני","אתה יודע איפה אני גר");
        add("food","אני רעב","מה אפשר לאכול","בוא נדבר על אוכל","בא לי ארוחה","אני צמא");
        add("work","תעזור לי במשימה","אני צריך לעשות משהו","בוא נתחיל לעבוד","יש לי פרויקט","אני רוצה שתבצע פעולה");
        add("understanding","אתה לא מבין אותי","למה אתה לא מבין מה אני אומר","לא לזה התכוונתי","אתה מפרש אותי לא נכון","הבנת מה ביקשתי");
        add("compliment","אתה חכם","כל הכבוד לך","עבודה טובה","אהבתי את התשובה","אתה מעולה","תשובה מצוינת","עזרת לי מאוד","אתה ממש טוב","כל הכבוד על העבודה");
        add("explain","תסביר לי","אפשר הסבר","מה המשמעות של זה","תפרט בבקשה","תסביר במילים פשוטות","אני רוצה להבין","תן לי פירוט","איך זה עובד","מה הכוונה","תסביר את הנושא");
        add("question","יש לי שאלה","אפשר לשאול משהו","רציתי לשאול אותך","תענה לי בבקשה","אני רוצה לדעת משהו","תוכל לענות לי","אפשר לקבל תשובה");
        add("opinion","מה דעתך","מה אתה חושב על זה","איך אתה רואה את הנושא","מה העמדה שלך","לדעתך זה טוב","אתה מסכים איתי");
        add("sad","אני עצוב","אני מרגיש רע","עבר עלי יום קשה","אני מבואס","אני מאוכזב","אין לי מצב רוח","קשה לי היום");
        add("happy","אני שמח","איזה יום נהדר","אני מרוצה","קרה לי משהו טוב","אני מאושר","יש לי חדשות טובות");
        add("bored","משעמם לי","אין לי מה לעשות","אני משתעמם","תן לי רעיון","במה אפשר להתעסק","תציע משהו מעניין");
        add("learning","למד אותי משהו","אני רוצה ללמוד","תן לי עובדה מעניינת","ספר לי משהו חדש","תחדש לי","תלמד אותי דבר חדש");
        add("technology","ספר לי על טכנולוגיה","אני אוהב מחשבים","מה זה אנדרואיד","בוא נדבר על מחשבים","איך עובדת אפליקציה","אני מתעניין בטכנולוגיה");
        add("travel","אני רוצה לטייל","ספר לי על טיולים","לאן כדאי לנסוע","אני אוהב לטייל","בוא נדבר על מקומות בעולם");
        add("family","ספר לי על משפחה","בוא נדבר על משפחה","יש לי משפחה","אני רוצה לדבר על חברים","חבר שלי");
        add("clarify","לא הבנת למה התכוונתי","אני אסביר שוב","הכוונה שלי אחרת","תקשיב למה שאני אומר","לא לזה התכוונתי בכלל","אתה טועה בהבנה");
        add("yes","כן","נכון מאוד","בדיוק","זה מה שהתכוונתי","מסכים","בהחלט");
        add("no","לא","ממש לא","זה לא נכון","טעית","לא נכון בכלל","שלילי");

        add("science","איך עובד כוח הכבידה","מה זה אטום","ספר לי על החלל","מהי אנרגיה","איך עושים ניסוי מדעי","למה השמים כחולים","איך נוצר ברק","מה זה מולקולה");
        add("history","ספר לי על ההיסטוריה","מה קרה בעבר","מי היו המצרים הקדמונים","מהי תקופת ימי הביניים","למה לומדים היסטוריה","ספר לי על המצאת הדפוס");
        add("animals","ספר לי על בעלי חיים","איך כלבים מתקשרים","למה חתולים מגרגרים","איזו חיה הכי מהירה","איך ציפורים עפות","ספר לי עובדה על תמנון","מה ההבדל בין יונק לזוחל");
        add("sports","בוא נדבר על ספורט","אני אוהב כדורגל","איך משחקים כדורסל","תן לי רעיון לאימון","למה חשוב לעשות פעילות גופנית","ספר לי על ריצה");
        add("programming","תעזור לי בתכנות","מה זה קוד","איך כותבים תוכנית","מה זה באג בתוכנה","ספר לי על ג'אווה","איך מתחילים ללמוד תכנות");
        add("phone","הטלפון שלי איטי","איך לשמור על הסוללה","המכשיר לא נטען","יש לי בעיה במסך","איך מפנים מקום בטלפון","איך מפעילים מצב טיסה");
        add("app","איך מתקינים אפליקציה","מה זה קובץ apk","אני רוצה לבנות אפליקציה","איך מעדכנים יישום","האפליקציה קורסת");
        add("money","כמה זה עולה","איך מחשבים מחיר","מה ההבדל בין שקל לדולר","תעזור לי לחשב תקציב","איך לחסוך כסף");
        add("writing","תעזור לי לכתוב הודעה","נסח לי מכתב","כתוב לי סיפור קצר","איך לנסח את זה יפה","תשפר את הטקסט שלי");
        add("language","איך אומרים באנגלית שלום","תרגם לי מילה","מה פירוש המילה","איך כותבים נכון בעברית","למד אותי מילה חדשה");
        add("cooking","תן לי מתכון","איך מכינים ארוחה","מה אפשר לבשל","אני רוצה לאפות","איך מבשלים אורז");
        add("directions","איך מגיעים למקום","תן לי מסלול נסיעה","מה הדרך לשם","איך מנווטים");
        add("safety","איך שומרים על פרטיות","איך בוחרים סיסמה חזקה","איך מזהים הודעה חשודה","איך מגנים על הטלפון");
        add("compare","מה ההבדל בין שני דברים","תשווה בין האפשרויות","מה היתרונות והחסרונות","מה עדיף לדעתך","במה הם שונים");
        add("riddle","תן לי חידה","יש לך חידה בשבילי","בוא נשחק משחק חשיבה","תאתגר אותי");
        add("encourage","תעודד אותי","אני צריך קצת מוטיבציה","אין לי כוח להמשיך","תן לי מילה טובה");
        add("angry","אני כועס","זה מעצבן אותי","אני מתוסכל","נמאס לי מזה");
        add("apology","סליחה","אני מתנצל","לא התכוונתי","טעיתי במה שאמרתי");
        add("preference","מה אתה מעדיף","מה אתה אוהב","יש לך העדפה","מה התחביב שלך");
        add("howto","איך עושים את זה","תן לי הוראות שלב אחרי שלב","תסביר איך לבצע","מה הצעדים שצריך לעשות");
    }

    private void concept(String key, String... words) {
        for (String w : words) synonyms.put(norm(w), norm(key));
    }
    private void add(String intent, String... phrases) {
        ArrayList<String[]> list = model.get(intent);
        if (list == null) { list = new ArrayList<String[]>(); model.put(intent, list); }
        for (String p : phrases) list.add(tokens(p));
    }

    public String reply(String prompt) {
        if (prompt == null || prompt.trim().length() == 0) return "לא קיבלתי משפט. אפשר לנסח שוב?";
        String raw = prompt.trim(), n = norm(raw);
        String math = calculate(raw);
        if (math != null) return math;

        if (n.matches(".*(קוראים לי|שמי הוא|שמי|השם שלי הוא|אני נקרא) .+")) {
            String candidate = raw.replaceAll(".*(?:קוראים לי|שמי הוא|שמי|השם שלי הוא|אני נקרא)\\s*", "").replaceAll("[.!?,]+$", "").trim();
            if (candidate.length() > 0 && candidate.length() < 35) {
                userName = candidate; lastIntent = "name_set";
                return "נעים להכיר, " + userName + ". אזכור את השם שלך כל עוד האפליקציה פתוחה.";
            }
        }

        if (isOneOf(n,"כן","נכון","בדיוק","בהחלט","מסכים","מסכימה") && lastIntent.length()>0)
            return contextualYes();
        if (isOneOf(n,"לא","ממש לא","לא נכון","טעית","שלילי") && lastIntent.length()>0)
            return contextualNo();

        Match match = understand(raw);
        if (match.score < 0.20) {
            if (lastIntent.equals("greeting") && has(n,"בסדר","טוב","מצוין","ברוך השם","סבבה")) return "יופי, שמח לשמוע. על מה תרצה לדבר?";
            if (lastIntent.equals("understanding")) return "אני מנסה להבין אותך. תן לי דוגמה למה שהתכוונת או כתוב מה תרצה שאעשה.";
            return "אני עדיין לא בטוח שהבנתי את הכוונה. אפשר לנסח במילים אחרות? אני לומד לזהות משמעות של משפטים, לא רק מילים בודדות.";
        }
        String intent = match.intent;
        lastIntent = intent;
        if (intent.equals("greeting")) return userName.length()>0 ? "שלום " + userName + "! מה תרצה לעשות היום?" : "שלום! טוב שבאת. על מה נדבר?";
        if (intent.equals("identity")) return "אני AI Talk, מודל הבנת שפה מקומי קטן. אני מנתח מילים, מילים דומות והקשר כדי לזהות את משמעות המשפט, והכול פועל בלי אינטרנט.";
        if (intent.equals("help")) return "אפשר לדבר איתי בעברית, לשאול שאלות בסיסיות, לבצע חישובים, לקבל שעה ותאריך, לספר בדיחה ולשוחח על נושאים יומיומיים. אני מנסה להבין גם ניסוחים שונים לאותה כוונה.";
        if (intent.equals("time")) return "השעה עכשיו לפי שעון המכשיר: " + new SimpleDateFormat("HH:mm", new Locale("he","IL")).format(new Date()) + ".";
        if (intent.equals("date")) return "היום לפי שעון המכשיר: " + new SimpleDateFormat("EEEE, d בMMMM yyyy", new Locale("he","IL")).format(new Date()) + ".";
        if (intent.equals("thanks") || intent.equals("compliment")) return "בשמחה! טוב שהצלחתי לעזור. מה תרצה לעשות עכשיו?";
        if (intent.equals("yes")) return "יופי. מה תרצה שנעשה עכשיו?";
        if (intent.equals("no")) return "הבנתי. תוכל להסביר מה לא מתאים או מה רצית במקום?";

        if (intent.equals("science")) return knowledgeScience(raw);
        if (intent.equals("history")) return "היסטוריה חוקרת אירועים, חברות ואנשים מן העבר בעזרת מסמכים, ממצאים ועדויות. בחר תקופה או אירוע מסוים ואספר עליו מתוך הידע המקומי שלי.";
        if (intent.equals("animals")) return "עולם בעלי החיים מגוון: יונקים, עופות, זוחלים, דו־חיים, דגים וחסרי חוליות. לתמנון, למשל, יש שלושה לבבות ושמונה זרועות. איזו חיה מעניינת אותך?";
        if (intent.equals("sports")) return "פעילות גופנית יכולה לשפר סיבולת, כוח והרגשה כללית. אפשר לדבר על כדורגל, כדורסל, ריצה או לבנות אימון בסיסי.";
        if (intent.equals("programming")) return "תכנות הוא כתיבת הוראות שמחשב מבצע. אפשר ללמוד משתנים, תנאים, לולאות ופונקציות. איזה מושג תרצה להבין?";
        if (intent.equals("phone")) return "נסה להתחיל בהפעלה מחדש, בדיקת מקום פנוי, סגירת יישומים מיותרים ובדיקת המטען והכבל. מה בדיוק התקלה במכשיר?";
        if (intent.equals("app")) return "אפליקציה היא תוכנה שמבצעת משימות במכשיר. קובץ APK הוא חבילת התקנה לאנדרואיד. אפשר לתכנן יחד מסכים, פעולות ותכונות.";
        if (intent.equals("money")) return "אני יכול לעזור בחישובים ובבניית תקציב, אבל אין לי שערי מטבע או מחירים בזמן אמת. כתוב את הסכומים ואחשב אותם.";
        if (intent.equals("writing")) return "בשמחה. כתוב מה המסר שאתה רוצה להעביר, למי הוא מיועד ואיזה סגנון מתאים, ואציע ניסוח.";
        if (intent.equals("language")) return "אפשר לעזור בהסבר מילים, ניסוח ותרגום בסיסי. כתוב את המילה או המשפט ואת השפה המבוקשת.";
        if (intent.equals("cooking")) return "אפשר להכין יחד מתכון פשוט. כתוב אילו מצרכים יש לך ואציע רעיון.";
        if (intent.equals("directions")) return "אין לי גישה למפות או למיקום חי, ולכן איני יכול לחשב מסלול אמיתי. אפשר לכתוב שמות מקומות ואעזור בתכנון כללי.";
        if (intent.equals("safety")) return "כדאי להשתמש בסיסמה ייחודית וארוכה, להפעיל נעילת מסך, לעדכן תוכנות ולהיזהר מקישורים וקבצים לא מוכרים. אל תמסור סיסמאות או קודים.";
        if (intent.equals("compare")) return "בשמחה. כתוב בין אילו אפשרויות להשוות ומה חשוב לך — מחיר, מהירות, נוחות או תכונות — ואסדר יתרונות וחסרונות.";
        if (intent.equals("riddle")) return "חידה: מה עולה כל הזמן אבל אף פעם לא יורד? נסה לנחש!";
        if (intent.equals("encourage")) return "גם התקדמות קטנה היא התקדמות. בחר צעד אחד קטן וברור והתחל ממנו. אני כאן לעזור לפרק את המשימה.";
        if (intent.equals("angry")) return "נשמע שמשהו ממש הכעיס אותך. אפשר לעצור לרגע, לקחת נשימה, ואז לספר לי מה קרה — אנסה לעזור לחשוב על פתרון.";
        if (intent.equals("apology")) return "הכול בסדר. תודה שהבהרת. אפשר להמשיך מכאן.";
        if (intent.equals("preference")) return "אין לי טעם אישי או חוויות, אבל אני יכול להתאים הצעות למה שאתה אוהב. מה מעניין אותך?";
        if (intent.equals("howto")) return "אנסה לפרק את זה לשלבים פשוטים. כתוב איזו פעולה אתה רוצה לבצע ובאיזה מכשיר או מצב.";
        if (intent.equals("bye")) return "להתראות! אשמח להמשיך לדבר כשתחזור.";
        if (intent.equals("joke")) return "למה המחשב הלך לרופא? כי היה לו וירוס והוא לא רצה להדביק את כל הרשת!";
        if (intent.equals("internet")) return "מנוע ההבנה פועל מקומית ללא אינטרנט. זיהוי הדיבור והקראת הטקסט תלויים בשירותים שמותקנים באנדרואיד.";
        if (intent.equals("weather")) return "אין לי נתוני מזג אוויר חיים, ולכן לא אמציא תחזית.";
        if (intent.equals("repeat")) return "בשמחה. איזה חלק תרצה שאסביר שוב? אפשר גם לכתוב מה לא היה ברור.";
        if (intent.equals("mood")) return "אני כאן ומוכן לעזור 🙂 ומה שלומך?";
        if (intent.equals("name_ask")) return userName.length()>0 ? "אמרת לי שקוראים לך " + userName + "." : "עוד לא סיפרת לי את שמך. אפשר לומר: קוראים לי...";
        if (intent.equals("memory")) return userName.length()>0 ? "בשיחה הזאת סיפרת לי שקוראים לך " + userName + ". הזיכרון נמחק כשסוגרים את האפליקציה." : "אני זוכר רק את השיחה הפתוחה. עוד לא סיפרת לי את שמך.";
        if (intent.equals("music")) return "אפשר לדבר על מוזיקה. איזה שיר, זמר או כלי נגינה מעניינים אותך?";
        if (intent.equals("location")) return "אין לי גישה למיקום המכשיר, ולכן איני יודע היכן אתה נמצא.";
        if (intent.equals("food")) return "בכיף, נדבר על אוכל. אתה מחפש רעיון לארוחה, מתכון או סתם משוחח?";
        if (intent.equals("work")) return "בשמחה. תאר לי מה אתה רוצה להשיג, ואנסה לחלק את המשימה לשלבים.";
        if (intent.equals("understanding") || intent.equals("clarify")) return "אני מבין שהפירוש שלי לא תאם למה שהתכוונת. בוא ננסה מחדש: תאר לי את התוצאה שרצית, ואנסה להתאים את עצמי.";
        if (intent.equals("explain")) return "בשמחה. כתוב לי את הנושא או המושג שתרצה שאסביר, ואנסה להסביר אותו בצורה פשוטה. כרגע הידע שלי מוגבל למידע שנכלל באפליקציה.";
        if (intent.equals("question")) return "בוודאי, שאל אותי. אנסה להבין את השאלה ולענות בכנות אם יש לי מספיק מידע.";
        if (intent.equals("opinion")) return "אני יכול לשקול את היתרונות והחסרונות, אבל אין לי דעות או חוויות אישיות. על איזה נושא תרצה לשמוע ניתוח?";
        if (intent.equals("sad")) return "מצטער לשמוע שעובר עליך יום קשה. אני כאן להקשיב. רוצה לספר לי מה קרה?";
        if (intent.equals("happy")) return "איזה יופי! שמח לשמוע שיש לך חדשות טובות. רוצה לספר לי מה קרה?";
        if (intent.equals("bored")) return "אפשר לעשות חידון קצר, לפתור חידה, לדבר על מוזיקה או ללמוד עובדה מעניינת. מה נשמע לך?";
        if (intent.equals("learning")) return "עובדה מעניינת: תמנונים מחזיקים חלק גדול מתאי העצב שלהם בזרועות, ולכן כל זרוע יכולה לבצע תנועות מורכבות באופן חלקי ועצמאי.";
        if (intent.equals("technology")) return "טכנולוגיה כוללת חומרה ותוכנה שפועלות יחד. אפשר לדבר על טלפונים, מחשבים, אפליקציות, תכנות או בינה מלאכותית.";
        if (intent.equals("travel")) return "טיולים יכולים להיות דרך נהדרת להכיר מקומות. אין לי כרגע מידע חי על מחירים או מצב אתרים, אבל אפשר לחשוב יחד על סוג הטיול שמתאים לך.";
        if (intent.equals("family")) return "משפחה וחברים הם נושאים חשובים. אני יכול להקשיב ולעזור לך לחשוב על מצב או שאלה שמעסיקים אותך.";
        return "אני מקשיב. ספר לי עוד קצת.";
    }

    private String knowledgeScience(String raw) {
        String n = norm(raw);
        if (has(n,"כבידה")) return "כבידה היא כוח משיכה בין גופים שיש להם מסה. כוח הכבידה של כדור הארץ מושך חפצים לכיוונו, ולכן הם נופלים לקרקע.";
        if (has(n,"אטום")) return "אטום הוא יחידת יסוד של חומר. במרכזו גרעין שמכיל פרוטונים ונייטרונים, וסביבו נמצאים אלקטרונים.";
        if (has(n,"מולקולה")) return "מולקולה היא קבוצה של שני אטומים או יותר הקשורים בקשרים כימיים. מולקולת מים מורכבת משני אטומי מימן ואטום חמצן.";
        if (has(n,"שמים כחולים")) return "השמים נראים כחולים בעיקר מפני שמולקולות האוויר מפזרות אור כחול מהשמש ביעילות רבה יותר מאור אדום.";
        if (has(n,"ברק")) return "ברק הוא פריקה חשמלית חזקה באטמוספרה, שנוצרת כאשר מצטבר הבדל מטען חשמלי בין אזורים בענן או בין ענן לקרקע.";
        if (has(n,"אנרגיה")) return "אנרגיה היא היכולת לגרום לשינוי או לבצע עבודה. יש לה צורות שונות, כמו אנרגיית תנועה, חום, אור ואנרגיה כימית.";
        if (has(n,"חלל","כוכב")) return "החלל מכיל כוכבים, כוכבי לכת, ירחים, גז ואבק. השמש שלנו היא כוכב, וכדור הארץ הוא אחד מכוכבי הלכת שמקיפים אותה.";
        return "מדע מנסה להסביר את העולם באמצעות תצפיות, ניסויים ובדיקת ראיות. בחר נושא מסוים — חלל, גוף האדם, חשמל, בעלי חיים או פיזיקה — ואנסה להסביר.";
    }

    private Match understand(String input) {
        String[] query = tokens(input);
        Match best = new Match();
        for (Map.Entry<String,ArrayList<String[]>> entry : model.entrySet()) {
            double score = 0;
            for (String[] example : entry.getValue()) score = Math.max(score, similarity(query, example));
            if (score > best.score) { best.score = score; best.intent = entry.getKey(); }
        }
        return best;
    }

    private String contextualYes() {
        if (lastIntent.equals("explain")) return "מעולה. כתוב את המושג או השאלה, ואתחיל להסביר.";
        if (lastIntent.equals("question")) return "אני מקשיב. מה השאלה?";
        if (lastIntent.equals("work")) return "מצוין. מה הצעד הראשון או מה בדיוק צריך לבצע?";
        if (lastIntent.equals("food")) return "אז נמשיך. איזה סוג אוכל או ארוחה מעניין אותך?";
        if (lastIntent.equals("music")) return "יופי. איזה סגנון מוזיקה אתה אוהב?";
        return "הבנתי. ספר לי עוד כדי שנוכל להמשיך.";
    }
    private String contextualNo() {
        if (lastIntent.equals("greeting")) return "בסדר גמור. אולי תספר לי מה תרצה לעשות?";
        return "הבנתי, אז לא לזה התכוונת. נסה לנסח מה כן רצית, ואעדכן את ההבנה שלי.";
    }

    private double similarity(String[] a, String[] b) {
        if (a.length == 0 || b.length == 0) return 0;
        Map<String,Integer> x = counts(a), y = counts(b);
        double dot=0, nx=0, ny=0;
        HashSet<String> terms = new HashSet<String>(); terms.addAll(x.keySet()); terms.addAll(y.keySet());
        for (String t : terms) {
            double vx = weight(t, x.containsKey(t)?x.get(t):0), vy = weight(t, y.containsKey(t)?y.get(t):0);
            dot += vx*vy; nx += vx*vx; ny += vy*vy;
        }
        double cosine = nx==0 || ny==0 ? 0 : dot/(Math.sqrt(nx)*Math.sqrt(ny));
        int common=0; HashSet<String> used=new HashSet<String>();
        for (String t:x.keySet()) if (y.containsKey(t)) { common++; used.add(t); }
        int fuzzy=0;
        for (String t:x.keySet()) {
            if (y.containsKey(t) || t.length()<4) continue;
            for (String u:y.keySet()) {
                if (used.contains(u) || u.length()<4) continue;
                if (editDistanceAtMostOne(t,u)) { fuzzy++; used.add(u); break; }
            }
        }
        double coverage = (double)(common + fuzzy*0.72)/Math.max(1,Math.min(x.size(),y.size()));
        return cosine*0.68 + Math.min(1.0,coverage)*0.32;
    }

    private boolean containsNegation(String[] words) {
        for (String w : words) if (w.equals("לא") || w.equals("אין") || w.equals("בלי") || w.equals("לעולם")) return true;
        return false;
    }
    private boolean editDistanceAtMostOne(String a,String b) {
        if (Math.abs(a.length()-b.length()) > 1) return false;
        int i=0,j=0,errors=0;
        while (i<a.length() && j<b.length()) {
            if (a.charAt(i)==b.charAt(j)) { i++; j++; }
            else {
                if (++errors>1) return false;
                if (a.length()>b.length()) i++;
                else if (b.length()>a.length()) j++;
                else { i++; j++; }
            }
        }
        if (i<a.length() || j<b.length()) errors++;
        return errors<=1;
    }

    private double weight(String t,int count) {
        if (count==0) return 0;
        double w = t.length()<=1 ? 0.25 : 1.0;
        if (t.equals("מה") || t.equals("איך") || t.equals("אני") || t.equals("אתה")) w=0.35;
        return w*(1.0+Math.log(count));
    }
    private Map<String,Integer> counts(String[] a) {
        HashMap<String,Integer> m=new HashMap<String,Integer>();
        for(String t:a) m.put(t,m.containsKey(t)?m.get(t)+1:1);
        return m;
    }
    private String[] tokens(String value) {
        String[] raw=norm(value).split(" ");
        ArrayList<String> out=new ArrayList<String>();
        for(String w:raw) {
            if(w.length()==0 || stop(w)) continue;
            w=stem(w);
            if(synonyms.containsKey(w)) w=synonyms.get(w);
            if(w.length()>0) out.add(w);
        }
        return out.toArray(new String[out.size()]);
    }
    private String stem(String w) {
        if(w.length()>4 && (w.startsWith("וה") || w.startsWith("כש") || w.startsWith("שה"))) w=w.substring(1);
        if(w.length()>4 && "בלמכוהש".indexOf(w.charAt(0))>=0) w=w.substring(1);
        if(w.length()>5 && (w.endsWith("ים") || w.endsWith("ות") || w.endsWith("תי"))) w=w.substring(0,w.length()-2);
        return w;
    }
    private boolean stop(String w) {
        return w.equals("של")||w.equals("את")||w.equals("על")||w.equals("עם")||w.equals("לי")||
            w.equals("לך")||w.equals("זה")||w.equals("זאת")||w.equals("הוא")||w.equals("היא")||
            w.equals("גם")||w.equals("רק")||w.equals("אם")||w.equals("כי")||w.equals("אז");
    }
    private String norm(String s) {
        return s.toLowerCase(new Locale("he","IL")).replace('ך','כ').replace('ם','מ').replace('ן','נ').replace('ף','פ').replace('ץ','צ')
            .replaceAll("[\\u0591-\\u05C7]","").replaceAll("[^\\p{L}\\p{N} +*/xX×÷.,-]"," ").replaceAll("\\s+"," ").trim();
    }
    private boolean has(String s,String... words) { for(String w:words) if(s.contains(norm(w))) return true; return false; }
    private boolean isOneOf(String s,String... words) { for(String w:words) if(s.equals(norm(w))) return true; return false; }

    private String calculate(String input) {
        Matcher m=Pattern.compile(".*?(-?\\d+(?:[.,]\\d+)?)\\s*([+*/xX×÷-])\\s*(-?\\d+(?:[.,]\\d+)?).*").matcher(input);
        if(!m.matches()) return null;
        try {
            double a=Double.parseDouble(m.group(1).replace(',','.')), b=Double.parseDouble(m.group(3).replace(',','.')), r;
            String op=m.group(2);
            if(op.equals("+")) r=a+b; else if(op.equals("-")) r=a-b;
            else if(op.equals("*")||op.equalsIgnoreCase("x")||op.equals("×")) r=a*b;
            else { if(b==0) return "אי אפשר לחלק באפס."; r=a/b; }
            if(Double.isNaN(r)||Double.isInfinite(r)) return null;
            String result=r==Math.rint(r)&&Math.abs(r)<9.0e15?Long.toString((long)r):Double.toString(r);
            return "התוצאה היא "+result+".";
        } catch(Exception e) { return null; }
    }
    public void close() { userName=""; lastIntent=""; }
    private static final class Match { String intent=""; double score=0; }
}
