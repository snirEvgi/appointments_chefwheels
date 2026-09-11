/* חישוב התורים הפנויים — פונקציה טהורה.
 *
 * כל מה שנוגע ברשת נשאר מחוץ לקובץ הזה: הקלט הוא ההגדרות, רשימת
 * הזמנים התפוסים, ו"עכשיו". התוצאה נקבעת לחלוטין על ידם, ולכן אפשר
 * לבדוק כאן את מה שבאמת מסוכן — גבולות DST, אירוע שחוצה תורים,
 * וזמן התראה מינימלי — בלי יומן אמיתי ובלי שעון אמיתי. */

import type { Schedule } from './config.js';
import { type DayKey, addDays, atHour, dayKeyOf, pad, partsOf, weekdayOf } from './tz.js';

/** טווח תפוס, במילישניות אפוק. חצי פתוח: [start, end). */
export interface Interval {
  start: number;
  end: number;
}

export interface Slot {
  /** ISO של תחילת התור. זה גם המזהה שהלקוח מחזיר בהזמנה. */
  start: string;
  end: string;
  available: boolean;
}

export interface DaySlots {
  date: DayKey;
  /** 0 = ראשון. */
  weekday: number;
  slots: Slot[];
  availableCount: number;
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** תחילות התורים ביום נתון, בסדר עולה.
 *
 *  המרווחים נבנים בדקות של שעון קיר ולא בחיבור מילישניות, כדי שיום
 *  שמחליף בו שעון לא יזיז את כל התורים בשעה. */
export function slotStarts(config: Schedule, day: DayKey): Date[] {
  const spanMinutes = (config.endHour - config.startHour) * 60;
  const count = Math.floor(spanMinutes / config.slotMinutes);
  const starts: Date[] = [];
  for (let i = 0; i < count; i += 1) {
    const minutesFromMidnight = config.startHour * 60 + i * config.slotMinutes;
    starts.push(atHour(day, Math.floor(minutesFromMidnight / 60), minutesFromMidnight % 60));
  }
  return starts;
}

/** מחזיר את כל הימים באופק, כולל ימים שכולם תפוסים.
 *
 *  יום מלא נשלח עם available:false ולא מושמט: לקוח שרואה "מלא" מבין
 *  שהיום קיים ותפוס, ולא חושב שהמערכת שכחה אותו. */
export function computeSlots(config: Schedule, busy: Interval[], now: Date): DaySlots[] {
  const nowMs = now.getTime();
  const earliest = nowMs + config.minLeadHours * 3_600_000;
  const slotMs = config.slotMinutes * 60_000;
  const today = dayKeyOf(now);

  const days: DaySlots[] = [];
  for (let offset = 0; offset < config.horizonDays; offset += 1) {
    const date = addDays(today, offset);
    const weekday = weekdayOf(date);
    if (!config.weekdays.includes(weekday)) continue;

    const slots: Slot[] = [];
    for (const start of slotStarts(config, date)) {
      const startMs = start.getTime();
      const endMs = startMs + slotMs;
      const available =
        startMs >= earliest && !busy.some((b) => overlaps(startMs, endMs, b.start, b.end));
      slots.push({
        start: start.toISOString(),
        end: new Date(endMs).toISOString(),
        available,
      });
    }

    // יום שכבר עבר לגמרי לא מעניין אף אחד ורק מאריך את הרשימה.
    const availableCount = slots.filter((s) => s.available).length;
    if (offset === 0 && availableCount === 0) continue;

    days.push({ date, weekday, slots, availableCount });
  }
  return days;
}

/** האם הרגע הזה הוא בדיוק תחילת תור חוקי בלוח.
 *
 *  זו ההגנה על השרת: הלקוח יכול לשלוח כל מחרוזת, וכאן היא נמדדת מול
 *  הלוח עצמו — לא מול מה שהוצג לו. */
export function isGridStart(config: Schedule, start: Date): boolean {
  const time = start.getTime();
  if (!Number.isFinite(time)) return false;
  const day = dayKeyOf(start);
  if (!config.weekdays.includes(weekdayOf(day))) return false;
  return slotStarts(config, day).some((candidate) => candidate.getTime() === time);
}

/* ── מזהה האירוע ─────────────────────────────────────────────── */

/** מזהה דטרמיניסטי לתור: bk + YYYYMMDDHHMM (שעון ירושלים) + ספרת דור.
 *
 *  כאן נמצאת מניעת הכפילות כולה. שני לקוחות שלוחצים "אשר" באותה שנייה
 *  מייצרים את אותו מזהה בדיוק, וגוגל מקבלת רק את הראשון — השני מקבל
 *  409. אין צורך במסד נתונים ואין חלון מרוץ.
 *
 *  ספרת הדור קיימת כי מזהה שנמחק נשאר "תפוס" אצל גוגל: אם בעל העסק
 *  מוחק פגישה, המזהה המקורי ימשיך להחזיר 409 לנצח, והתור היה נשאר
 *  חסום. הדור הבא נותן שם חדש לאותו תור.
 *
 *  גוגל מגבילה מזהי אירוע לאלפבית base32hex — הספרות 0–9 והאותיות
 *  a–v בלבד. 'b' ו-'k' בתוך הטווח; 'w' למשל אינו, ולכן אין כאן
 *  קידומת מהשם של העסק. */
export function slotId(start: Date, generation: number): string {
  const p = partsOf(start);
  return `bk${p.year}${pad(p.month)}${pad(p.day)}${pad(p.hour)}${pad(p.minute)}${generation}`;
}
