/* עבודה עם שעון ישראל, בלי ספריית תאריכים.
 *
 * הבעיה שהקובץ הזה פותר: השרת רץ ב-UTC, בעל העסק חושב בשעון ירושלים,
 * וישראל מחליפה שעון פעמיים בשנה. "10:00 ביום שלישי" הוא רגע אחר ב-UTC
 * בקיץ ובחורף. חישוב של "עוד יום" בתוספת 24 שעות שובר את זה פעמיים
 * בשנה — ולכן כאן אין שום חשבון של מילישניות על ימים: ימים נבנים
 * מרכיבי תאריך (YYYY-MM-DD), ורק בסוף מתורגמים לרגע בזמן.
 *
 * Intl מספיק: ה-runtime של Vercel כולל ICU מלא, והנתונים מתעדכנים עם
 * ה-runtime. פחות סיכון מלנעול קובץ אזורי זמן משלנו. */

export const TZ = 'Asia/Jerusalem';

const FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export interface WallParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number; // 0–23
  minute: number;
  second: number;
}

/** מפרק רגע בזמן לשעון הקיר בירושלים. */
export function partsOf(date: Date): WallParts {
  const out: Record<string, number> = {};
  for (const part of FORMATTER.formatToParts(date)) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return {
    year: out.year!,
    month: out.month!,
    day: out.day!,
    // hourCycle h23 אמור להחזיר 0 בחצות, אבל יש סביבות שמחזירות 24.
    hour: out.hour! % 24,
    minute: out.minute!,
    second: out.second!,
  };
}

/** ההיסט של ירושלים מ-UTC ברגע נתון, במילישניות (7200000 או 10800000). */
function offsetMs(instant: Date): number {
  const p = partsOf(instant);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - instant.getTime();
}

/** שעון קיר בירושלים → רגע בזמן.
 *
 *  שני מעברים: בניחוש הראשון משתמשים בהיסט של הרגע הלא-נכון, ובשני
 *  בהיסט של הרגע שכבר קרוב לתשובה. זה מדויק בכל מקרה שאינו נופל בתוך
 *  שעת המעבר עצמה (02:00–03:00), ופגישות שלנו הן 10:00–16:00. */
export function wallToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstGuess = naive - offsetMs(new Date(naive));
  return new Date(naive - offsetMs(new Date(firstGuess)));
}

/* ── מפתח יום: 'YYYY-MM-DD' בשעון ירושלים ─────────────────────
 * זו יחידת העבודה של כל הקוד שמסביב. מחרוזת, לא Date: אי אפשר
 * "להחליק" ממנה בטעות לאזור זמן אחר. */

export type DayKey = string;

export function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

export function dayKeyOf(date: Date): DayKey {
  const p = partsOf(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function parseDayKey(key: DayKey): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new Error(`מפתח יום לא תקין: ${key}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** חיבור ימים קלנדרי. עובר חודשים ושנים מעוברות נכון, ובלי תלות באזור
 *  זמן — כי הוא מתבצע כולו בלוח השנה, לא על ציר הזמן. */
export function addDays(key: DayKey, days: number): DayKey {
  const { year, month, day } = parseDayKey(key);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** 0 = ראשון … 6 = שבת. */
export function weekdayOf(key: DayKey): number {
  const { year, month, day } = parseDayKey(key);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** שעה מסוימת ביום מסוים, בשעון ירושלים → רגע בזמן. */
export function atHour(key: DayKey, hour: number, minute = 0): Date {
  const { year, month, day } = parseDayKey(key);
  return wallToUtc(year, month, day, hour, minute);
}
