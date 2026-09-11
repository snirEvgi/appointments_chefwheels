/* תצוגת תאריכים ושעות בעברית, תמיד בשעון ישראל.
 *
 * אזור הזמן ננעל במפורש ולא נלקח מהמכשיר: לקוח שמסתכל על הדף בטיסה
 * או עם שעון מוגדר לא נכון חייב לראות את אותה שעה שתופיע ביומן. */

const TZ = 'Asia/Jerusalem';

const formatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('he-IL', { timeZone: TZ, ...options });

const WEEKDAY_SHORT = formatter({ weekday: 'short' });
const WEEKDAY_LONG = formatter({ weekday: 'long' });
const DAY_MONTH = formatter({ day: 'numeric', month: 'numeric' });
const DAY_MONTH_LONG = formatter({ day: 'numeric', month: 'long' });
const TIME = formatter({ hour: '2-digit', minute: '2-digit', hour12: false });

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));

/** "יום ג׳" */
export function weekdayShort(value: string | Date): string {
  return WEEKDAY_SHORT.format(toDate(value));
}

/** "יום שלישי" */
export function weekdayLong(value: string | Date): string {
  return WEEKDAY_LONG.format(toDate(value));
}

/** "15.9" */
export function dayMonth(value: string | Date): string {
  return DAY_MONTH.format(toDate(value));
}

/** "יום שלישי, 15 בספטמבר" */
export function fullDate(value: string | Date): string {
  const date = toDate(value);
  return `${WEEKDAY_LONG.format(date)}, ${DAY_MONTH_LONG.format(date)}`;
}

/** "10:00" */
export function time(value: string | Date): string {
  return TIME.format(toDate(value));
}

/** "10:00–11:00" — עם מקף עברי (en dash), לא מינוס. */
export function timeRange(start: string | Date, end: string | Date): string {
  return `${time(start)}–${time(end)}`;
}

/** "יום שלישי, 15 בספטמבר בשעה 10:00" */
export function fullDateTime(value: string | Date): string {
  return `${fullDate(value)} בשעה ${time(value)}`;
}

/** "היום" / "מחר" / "יום ג׳", ביחס לתאריך שנתון בשעון ישראל. */
export function relativeDayLabel(value: string | Date, now: Date = new Date()): string {
  const key = (date: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);

  const target = key(toDate(value));
  if (target === key(now)) return 'היום';
  if (target === key(new Date(now.getTime() + 86_400_000))) return 'מחר';
  return weekdayShort(value);
}
