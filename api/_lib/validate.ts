/* ולידציה של הטופס.
 *
 * הכלל: שום דבר שהלקוח שולח לא נאמן. השעה נמדדת מול לוח הזמנים שהשרת
 * מחשב בעצמו ולא מול מה שהוצג לדפדפן, כי דפדפן אפשר לערוך. */

import type { Schedule } from './config.js';
import { BadRequest } from './http.js';
import { normalizePhone } from './phone.js';
import { isGridStart } from './slots.js';
import { addDays, dayKeyOf, atHour } from './tz.js';

export interface BookingInput {
  start: Date;
  end: Date;
  name: string;
  /** E.164 בלי +. */
  phone: string;
  note: string;
  source: string;
}

function text(value: unknown): string {
  if (typeof value !== 'string') return '';
  // תווי בקרה מוסרים לפני הכול: הם נכנסים לתיאור האירוע ביומן, ושורה
  // חדשה בשם משתמש הייתה מאפשרת לזייף שדות בתיאור.
  return value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ');
}

function singleLine(value: unknown): string {
  return text(value).replace(/\s+/g, ' ').trim();
}

export function parseBooking(
  body: Record<string, unknown>,
  config: Schedule,
  now: Date,
): BookingInput {
  // מלכודת דבש: שדה מוסתר שאדם לעולם לא ממלא.
  if (singleLine(body.company)) {
    throw new BadRequest('הבקשה נדחתה.', 'bot');
  }

  const name = singleLine(body.name);
  if (name.length < 2) throw new BadRequest('נא למלא שם מלא.', 'name');
  if (name.length > 60) throw new BadRequest('השם ארוך מדי.', 'name');
  if (!/\p{L}/u.test(name)) throw new BadRequest('נא למלא שם תקין.', 'name');

  const phoneResult = normalizePhone(body.phone);
  if (!phoneResult.ok) {
    throw new BadRequest(`מספר הטלפון אינו תקין — ${phoneResult.reason}.`, 'phone');
  }

  const note = text(body.note).replace(/[ \t]+/g, ' ').trim().slice(0, 300);
  const source = singleLine(body.source).slice(0, 60);

  const start = parseStart(body.start, config, now);
  const end = new Date(start.getTime() + config.slotMinutes * 60_000);

  return { start, end, name, phone: phoneResult.phone, note, source };
}

export function parseStart(raw: unknown, config: Schedule, now: Date): Date {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new BadRequest('לא נבחרה שעה.', 'slot');
  }
  const start = new Date(raw.trim());
  if (Number.isNaN(start.getTime())) {
    throw new BadRequest('השעה שנשלחה אינה תקינה.', 'slot');
  }

  if (!isGridStart(config, start)) {
    throw new BadRequest('השעה שנבחרה אינה אחת משעות הקבלה.', 'slot');
  }

  if (start.getTime() - now.getTime() < config.minLeadHours * 3_600_000) {
    throw new BadRequest(
      `אפשר לקבוע פגישה לפחות ${config.minLeadHours} שעות מראש. בחר מועד מאוחר יותר.`,
      'too_soon',
    );
  }

  // סוף האופק: תחילת היום שאחרי היום האחרון שפתוח לקביעה.
  const horizonEnd = atHour(addDays(dayKeyOf(now), config.horizonDays), 0);
  if (start.getTime() >= horizonEnd.getTime()) {
    throw new BadRequest('המועד רחוק מדי. אפשר לקבוע עד שלושה שבועות קדימה.', 'slot');
  }

  return start;
}
