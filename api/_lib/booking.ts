/* הפיכת אירועי יומן לזמנים תפוסים, ורישום פגישה חדשה בלי כפילות. */

import type { CalendarEvent, InsertResult } from './calendar.js';
import { getEvent, insertEvent } from './calendar.js';
import type { Interval } from './slots.js';
import { overlaps, slotId } from './slots.js';
import { TZ, atHour, dayKeyOf } from './tz.js';

/** כמה שמות חלופיים לנסות לאותו תור לפני ויתור.
 *  כל דור נשרף רק כשפגישה באותה שעה נקבעה ובוטלה. שישה מספיקים
 *  בשפע לתור בודד, והגבול קיים כדי שלולאה לא תרוץ לנצח מול באג. */
const MAX_GENERATIONS = 6;

/** הטווח שאירוע תופס, או null אם אינו חוסם.
 *
 *  אירוע יומי חוסם את היום כולו **גם אם הוא מסומן "פנוי"**. זו החלטה
 *  מכוונת: כך בעל העסק סוגר יום שלם בכתיבת "חופש" כאירוע יומי, שזו
 *  הפעולה הטבעית ביותר ביומן, בלי להכיר את הגדרת ה"זמינות".
 *  אירוע עם שעה שמסומן "פנוי" אינו חוסם — זו המשמעות המקובלת. */
export function eventInterval(event: CalendarEvent): Interval | null {
  if (event.status === 'cancelled') return null;

  const startDate = event.start?.date;
  const endDate = event.end?.date;
  if (startDate) {
    // ב-Calendar תאריך הסיום של אירוע יומי אינו נכלל בו.
    const start = atHour(startDate, 0);
    const end = endDate ? atHour(endDate, 0) : atHour(startDate, 24);
    return { start: start.getTime(), end: end.getTime() };
  }

  if (event.transparency === 'transparent') return null;

  const startTime = event.start?.dateTime;
  const endTime = event.end?.dateTime;
  if (!startTime || !endTime) return null;

  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

export function busyIntervals(events: CalendarEvent[]): Interval[] {
  const intervals: Interval[] = [];
  for (const event of events) {
    const interval = eventInterval(event);
    if (interval) intervals.push(interval);
  }
  return intervals;
}

/** האם אירוע חוסם בפועל את התור הזה. */
export function blocksSlot(event: CalendarEvent, startMs: number, endMs: number): boolean {
  const interval = eventInterval(event);
  return interval !== null && overlaps(startMs, endMs, interval.start, interval.end);
}

/* ── בניית האירוע ────────────────────────────────────────────── */

/** 972501234567 → 050-123-4567. לתצוגה בלבד. */
export function localPhone(e164: string): string {
  const national = e164.startsWith('972') ? `0${e164.slice(3)}` : e164;
  return /^0\d{9}$/.test(national)
    ? `${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`
    : national;
}

export interface BookingDetails {
  start: Date;
  end: Date;
  name: string;
  /** E.164 בלי +. */
  phone: string;
  note: string;
  /** מזהה חד-פעמי שמאפשר ללקוח לבטל. */
  ref: string;
  /** מקור הליד, אם הגיע בקישור. */
  source: string;
  address: string;
  /** מקור הכתובת לבניית קישור הביטול, בלי סלאש בסוף. */
  baseUrl: string;
}

/** הקישור שבאמצעותו הלקוח מבטל. שני חלקים: מזהה האירוע, שהוא צפוי,
 *  ו-ref אקראי שנשמר על האירוע — בלעדיו אי אפשר לבטל פגישה של אחר. */
export function cancelUrl(baseUrl: string, eventId: string, ref: string): string {
  if (!baseUrl) return '';
  return `${baseUrl}/?e=${encodeURIComponent(eventId)}&r=${encodeURIComponent(ref)}`;
}

export function buildEvent(details: BookingDetails, eventId: string): CalendarEvent {
  const display = localPhone(details.phone);
  const lines = [
    `שם: ${details.name}`,
    `טלפון: ${display}`,
    `וואטסאפ: https://wa.me/${details.phone}`,
  ];
  if (details.note) lines.push('', `הערת הלקוח: ${details.note}`);
  if (details.source) lines.push('', `מקור: ${details.source}`);
  lines.push('', 'נקבע דרך דף קביעת התורים.');
  const link = cancelUrl(details.baseUrl, eventId, details.ref);
  if (link) lines.push(`קישור הביטול של הלקוח: ${link}`);

  return {
    id: eventId,
    summary: `פגישה · ${details.name} · ${display}`,
    description: lines.join('\n'),
    location: details.address || undefined,
    start: { dateTime: details.start.toISOString(), timeZone: TZ },
    end: { dateTime: details.end.toISOString(), timeZone: TZ },
    // 5 = "בננה" בפלטת גוגל, הצהוב הקרוב ביותר לצבע המותג. עוזר לזהות
    // במבט אחד אילו אירועים ביומן הגיעו מהדף.
    colorId: '5',
    // התזכורות של הבעלים נקבעות בהגדרות היומן שלו; חשבון שירות אינו
    // יכול לקבוע תזכורת עבור אדם אחר. useDefault מבטיח שהן יחולו.
    reminders: { useDefault: true },
    transparency: 'opaque',
    extendedProperties: {
      private: {
        source: 'web',
        phone: details.phone,
        ref: details.ref,
        name: details.name,
      },
    },
  };
}

/* ── הכנסה אטומית ────────────────────────────────────────────── */

export type InsertOutcome =
  | { ok: true; event: CalendarEvent; eventId: string }
  /** מישהו הקדים, או שיש אירוע אחר בשעה הזו. */
  | { ok: false; reason: 'taken' }
  /** כל הדורות נשרפו. מצב קיצון שמצדיק פנייה אנושית. */
  | { ok: false; reason: 'exhausted' };

/** הפעולות שהלולאה זקוקה להן. קיים כדי שאפשר יהיה לבדוק את ההכרעה
 *  הזו מול תרחישים שקשה לשחזר מול יומן אמיתי — מרוץ, מחיקה, והזזה. */
export interface CalendarOps {
  insert: (calendarId: string, event: CalendarEvent) => Promise<InsertResult>;
  get: (calendarId: string, eventId: string) => Promise<CalendarEvent | null>;
}

const LIVE_OPS: CalendarOps = { insert: insertEvent, get: getEvent };

/** מכניס את האירוע עם מזהה דטרמיניסטי, ועובר לדור הבא כשהמזהה תפוס
 *  בלי שהתור באמת תפוס.
 *
 *  זה הלב של מניעת הכפילות. שתי בקשות מקבילות מייצרות את אותו מזהה,
 *  וגוגל מכריעה ביניהן — הפסידן מקבל 409 ואז בודק *מה* יושב שם:
 *
 *    • אירוע פעיל שחופף לתור  → התור באמת תפוס.
 *    • אירוע שבוטל/נמחק        → רק השם תפוס. דור הבא.
 *    • אירוע שבעל העסק הזיז    → השם תפוס, התור פנוי. דור הבא.
 *
 *  בלי הבדיקה הזו, מחיקה אחת של בעל העסק הייתה חוסמת את התור לצמיתות. */
export async function insertWithGeneration(
  calendarId: string,
  details: BookingDetails,
  ops: CalendarOps = LIVE_OPS,
): Promise<InsertOutcome> {
  const startMs = details.start.getTime();
  const endMs = details.end.getTime();
  for (let generation = 0; generation < MAX_GENERATIONS; generation += 1) {
    const id = slotId(details.start, generation);
    // האירוע נבנה מחדש לכל דור, כי קישור הביטול מכיל את המזהה.
    const result = await ops.insert(calendarId, buildEvent(details, id));
    if (result.ok) return { ok: true, event: result.event, eventId: id };

    const existing = await ops.get(calendarId, id);
    if (existing && blocksSlot(existing, startMs, endMs)) return { ok: false, reason: 'taken' };
    // אחרת המזהה שרוף אבל התור פנוי — ננסה שם אחר.
  }

  return { ok: false, reason: 'exhausted' };
}

/** האם קיימת פגישה אחרת שחוסמת את התור, מלבד זו שהרגע יצרנו.
 *  שימושי לאימות אחרי ההכנסה, מול אירוע שנוסף ידנית באותו רגע. */
export function foreignBlocker(
  events: CalendarEvent[],
  ownId: string,
  startMs: number,
  endMs: number,
): boolean {
  return events.some((event) => event.id !== ownId && blocksSlot(event, startMs, endMs));
}

/** מפתח היום של הפגישה, לשימוש בהודעות. */
export function bookingDay(start: Date): string {
  return dayKeyOf(start);
}
