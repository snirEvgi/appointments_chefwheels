/* תרגום אירועי יומן לזמנים תפוסים, והלולאה שמונעת קביעה כפולה.
 *
 * הלולאה היא החלק שבו טעות עולה ביוקר: תשובה שגויה בכיוון אחד יוצרת
 * שתי פגישות באותה שעה, ובכיוון השני חוסמת תור פנוי לצמיתות. שני
 * הכיוונים נבדקים כאן. */

import test from 'node:test';
import assert from 'node:assert/strict';
import type { CalendarEvent, InsertResult } from './calendar.js';
import {
  type BookingDetails,
  type CalendarOps,
  blocksSlot,
  buildEvent,
  busyIntervals,
  cancelUrl,
  eventInterval,
  foreignBlocker,
  insertWithGeneration,
  localPhone,
} from './booking.js';
import { atHour } from './tz.js';

const SLOT_START = atHour('2026-09-14', 10);
const SLOT_END = atHour('2026-09-14', 11);

const DETAILS: BookingDetails = {
  start: SLOT_START,
  end: SLOT_END,
  name: 'ישראל ישראלי',
  phone: '972501234567',
  note: 'מתעניין בפודטראק',
  ref: 'a'.repeat(32),
  source: 'whatsapp',
  address: 'רחוב הדוגמה 1, תל אביב',
  baseUrl: 'https://example.com',
};

function timed(from: number, to: number, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'x',
    status: 'confirmed',
    start: { dateTime: atHour('2026-09-14', from).toISOString() },
    end: { dateTime: atHour('2026-09-14', to).toISOString() },
    ...extra,
  };
}

/* ── תרגום אירועים ── */

test('אירוע עם שעה חוסם את הטווח שלו', () => {
  const interval = eventInterval(timed(10, 11));
  assert.deepEqual(interval, { start: SLOT_START.getTime(), end: SLOT_END.getTime() });
});

test('אירוע עם שעה שמסומן פנוי אינו חוסם', () => {
  assert.equal(eventInterval(timed(10, 11, { transparency: 'transparent' })), null);
});

test('אירוע שבוטל אינו חוסם', () => {
  assert.equal(eventInterval(timed(10, 11, { status: 'cancelled' })), null);
});

test('אירוע יומי חוסם את כל היום', () => {
  const interval = eventInterval({
    status: 'confirmed',
    start: { date: '2026-09-14' },
    end: { date: '2026-09-15' },
  });
  assert.deepEqual(interval, {
    start: atHour('2026-09-14', 0).getTime(),
    end: atHour('2026-09-15', 0).getTime(),
  });
});

test('אירוע יומי חוסם גם כשהוא מסומן פנוי', () => {
  // מכוון: חופש כאירוע יומי הוא הדרך הטבעית לסגור יום, וגוגל מסמנת
  // אירועים יומיים כפנויים כברירת מחדל. כיבוד הסימון היה מייצר תורים
  // ביום שבעל העסק בטוח שסגר.
  const event: CalendarEvent = {
    status: 'confirmed',
    transparency: 'transparent',
    summary: 'חופש',
    start: { date: '2026-09-14' },
    end: { date: '2026-09-15' },
  };
  assert.ok(blocksSlot(event, SLOT_START.getTime(), SLOT_END.getTime()));
});

test('אירוע יומי רב-יומי חוסם את כל הטווח פרט ליום הסיום', () => {
  const event: CalendarEvent = {
    status: 'confirmed',
    start: { date: '2026-09-14' },
    end: { date: '2026-09-16' }, // תאריך הסיום אינו נכלל
  };
  assert.ok(
    blocksSlot(event, atHour('2026-09-15', 10).getTime(), atHour('2026-09-15', 11).getTime()),
  );
  assert.ok(
    !blocksSlot(event, atHour('2026-09-16', 10).getTime(), atHour('2026-09-16', 11).getTime()),
  );
});

test('אירוע פגום אינו מפיל את החישוב', () => {
  assert.equal(eventInterval({ status: 'confirmed' }), null);
  assert.equal(eventInterval(timed(11, 10)), null, 'סיום לפני התחלה');
  assert.equal(busyIntervals([{ status: 'confirmed' }, timed(10, 11)]).length, 1);
});

test('foreignBlocker מתעלם מהאירוע שלנו עצמו', () => {
  const mine: CalendarEvent = timed(10, 11, { id: 'bk2026091410000' });
  const start = SLOT_START.getTime();
  const end = SLOT_END.getTime();
  assert.ok(!foreignBlocker([mine], 'bk2026091410000', start, end));
  assert.ok(foreignBlocker([mine, timed(10, 12, { id: 'other' })], 'bk2026091410000', start, end));
});

/* ── בניית האירוע ── */

test('האירוע נושא את כל מה שבעל העסק צריך כדי להתקשר', () => {
  const event = buildEvent(DETAILS, 'bk2026091410000');
  assert.equal(event.id, 'bk2026091410000');
  assert.match(event.summary!, /ישראל ישראלי/);
  assert.match(event.summary!, /050-123-4567/);
  assert.match(event.description!, /wa\.me\/972501234567/);
  assert.match(event.description!, /מתעניין בפודטראק/);
  assert.match(event.description!, /whatsapp/);
  assert.equal(event.location, DETAILS.address);
  assert.equal(event.transparency, 'opaque');
  assert.equal(event.reminders?.useDefault, true);
  assert.equal(event.extendedProperties?.private?.ref, DETAILS.ref);
  assert.equal(event.extendedProperties?.private?.phone, '972501234567');
  // בלי attendees: חשבון שירות ללא האצלת סמכויות מקבל 403 על הזמנת משתתפים.
  assert.equal((event as Record<string, unknown>).attendees, undefined);
});

test('קישור הביטול מכיל גם את המזהה וגם את הסוד', () => {
  const link = cancelUrl('https://example.com', 'bk2026091410000', 'deadbeef');
  assert.equal(link, 'https://example.com/?e=bk2026091410000&r=deadbeef');
  assert.equal(cancelUrl('', 'x', 'y'), '', 'בלי כתובת בסיס אין קישור');
});

test('טלפון מוצג בפורמט מקומי', () => {
  assert.equal(localPhone('972501234567'), '050-123-4567');
  assert.equal(localPhone('972549876543'), '054-987-6543');
  assert.equal(localPhone('12125551234'), '12125551234', 'מספר זר נשאר כמו שהוא');
});

/* ── לולאת הדורות ── */

function ops(
  script: Array<InsertResult | 'conflict'>,
  existing: Record<string, CalendarEvent | null> = {},
): CalendarOps & { attempted: string[] } {
  const attempted: string[] = [];
  let index = 0;
  return {
    attempted,
    async insert(_calendarId, event) {
      attempted.push(event.id!);
      const step = script[index++] ?? 'conflict';
      if (step === 'conflict') return { ok: false, conflict: true };
      return step;
    },
    async get(_calendarId, eventId) {
      return existing[eventId] ?? null;
    },
  };
}

test('תור פנוי נרשם בדור הראשון', async () => {
  const fake = ops([{ ok: true, event: { id: 'bk2026091410000' } }]);
  const outcome = await insertWithGeneration('cal', DETAILS, fake);
  assert.ok(outcome.ok);
  assert.equal(outcome.ok && outcome.eventId, 'bk2026091410000');
  assert.deepEqual(fake.attempted, ['bk2026091410000']);
});

test('פגישה קיימת באותה שעה מסמנת תור תפוס, בלי ניסיון נוסף', async () => {
  const fake = ops(['conflict'], {
    bk2026091410000: timed(10, 11, { id: 'bk2026091410000' }),
  });
  const outcome = await insertWithGeneration('cal', DETAILS, fake);
  assert.equal(outcome.ok, false);
  assert.equal(!outcome.ok && outcome.reason, 'taken');
  assert.equal(fake.attempted.length, 1, 'אין טעם לנסות דור נוסף כשהתור באמת תפוס');
});

test('פגישה שנמחקה משחררת את התור דרך הדור הבא', async () => {
  // בלי זה, מחיקה אחת של בעל העסק הייתה חוסמת את השעה הזו לנצח.
  const fake = ops(['conflict', { ok: true, event: { id: 'bk2026091410001' } }], {
    bk2026091410000: timed(10, 11, { id: 'bk2026091410000', status: 'cancelled' }),
  });
  const outcome = await insertWithGeneration('cal', DETAILS, fake);
  assert.ok(outcome.ok);
  assert.equal(outcome.ok && outcome.eventId, 'bk2026091410001');
  assert.deepEqual(fake.attempted, ['bk2026091410000', 'bk2026091410001']);
});

test('פגישה שבעל העסק הזיז לשעה אחרת אינה חוסמת את התור המקורי', async () => {
  const fake = ops(['conflict', { ok: true, event: { id: 'bk2026091410001' } }], {
    bk2026091410000: timed(13, 14, { id: 'bk2026091410000' }),
  });
  const outcome = await insertWithGeneration('cal', DETAILS, fake);
  assert.ok(outcome.ok);
  assert.equal(outcome.ok && outcome.eventId, 'bk2026091410001');
});

test('מזהה שנמחק לצמיתות עובר לדור הבא', async () => {
  const fake = ops(['conflict', { ok: true, event: {} }]);
  const outcome = await insertWithGeneration('cal', DETAILS, fake);
  assert.ok(outcome.ok);
  assert.equal(outcome.ok && outcome.eventId, 'bk2026091410001');
});

test('כשכל הדורות נשרפו מוותרים במקום להסתובב בלולאה', async () => {
  const fake = ops([]);
  const outcome = await insertWithGeneration('cal', DETAILS, fake);
  assert.equal(outcome.ok, false);
  assert.equal(!outcome.ok && outcome.reason, 'exhausted');
  assert.equal(fake.attempted.length, 6);
  assert.equal(new Set(fake.attempted).size, 6, 'כל ניסיון עם מזהה אחר');
});

test('קישור הביטול באירוע נושא את המזהה של הדור שנרשם בפועל', async () => {
  const inserted: CalendarEvent[] = [];
  const fake: CalendarOps = {
    async insert(_calendarId, event) {
      inserted.push(event);
      return inserted.length === 1 ? { ok: false, conflict: true } : { ok: true, event };
    },
    async get() {
      return null;
    },
  };
  await insertWithGeneration('cal', DETAILS, fake);
  assert.match(inserted[1].description!, /e=bk2026091410001/);
});
