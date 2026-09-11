/* שעון ישראל. הבדיקות כאן קיימות בגלל מעברי השעון: קוד שמחשב ימים
 * בתוספת 24 שעות עובד יפה עשרה חודשים בשנה, ואז מזיז את כל התורים
 * בשעה בלי שאף אחד יבחין עד שלקוח מגיע בזמן הלא נכון.
 *
 * הערכים הקשיחים אומתו מול Intl בסביבת הריצה:
 *   קיץ (IDT) = UTC+3, חורף (IST) = UTC+2,
 *   ב-2026 השעון עובר ב-27 במרץ וחוזר ב-25 באוקטובר. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, atHour, dayKeyOf, partsOf, weekdayOf, wallToUtc } from './tz.js';

test('פירוק לשעון קיר — קיץ וחורף', () => {
  assert.deepEqual(partsOf(new Date('2026-07-01T07:00:00Z')), {
    year: 2026,
    month: 7,
    day: 1,
    hour: 10,
    minute: 0,
    second: 0,
  });
  assert.deepEqual(partsOf(new Date('2026-01-05T08:00:00Z')), {
    year: 2026,
    month: 1,
    day: 5,
    hour: 10,
    minute: 0,
    second: 0,
  });
});

test('10:00 הוא רגע אחר בקיץ ובחורף', () => {
  assert.equal(atHour('2026-07-01', 10).toISOString(), '2026-07-01T07:00:00.000Z');
  assert.equal(atHour('2026-01-05', 10).toISOString(), '2026-01-05T08:00:00.000Z');
});

test('מעבר לשעון קיץ — 27 במרץ 2026', () => {
  // היום שלפני עדיין UTC+2, היום עצמו כבר UTC+3.
  assert.equal(atHour('2026-03-26', 10).toISOString(), '2026-03-26T08:00:00.000Z');
  assert.equal(atHour('2026-03-27', 10).toISOString(), '2026-03-27T07:00:00.000Z');
});

test('חזרה לשעון חורף — 25 באוקטובר 2026', () => {
  assert.equal(atHour('2026-10-24', 10).toISOString(), '2026-10-24T07:00:00.000Z');
  assert.equal(atHour('2026-10-26', 10).toISOString(), '2026-10-26T08:00:00.000Z');
});

test('חיבור ימים חוצה מעבר שעון בלי להזיז את השעה', () => {
  // זו הבדיקה שנופלת אם מישהו יחליף את addDays בחיבור מילישניות.
  const before = atHour('2026-03-26', 10);
  const after = atHour(addDays('2026-03-26', 1), 10);
  assert.equal(partsOf(after).hour, 10);
  assert.equal(after.getTime() - before.getTime(), 23 * 3_600_000);
});

test('חיבור ימים חוצה חודש ושנה', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29'); // שנה מעוברת
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('ימי השבוע — ראשון הוא 0', () => {
  assert.equal(weekdayOf('2026-09-11'), 5); // שישי
  assert.equal(weekdayOf('2026-09-15'), 2); // שלישי
  assert.equal(weekdayOf('2026-09-13'), 0); // ראשון
});

test('מפתח היום נקבע לפי ירושלים ולא לפי UTC', () => {
  // 21:30 ב-UTC הם כבר למחרת בישראל.
  assert.equal(dayKeyOf(new Date('2026-07-01T21:30:00Z')), '2026-07-02');
  assert.equal(dayKeyOf(new Date('2026-07-01T06:30:00Z')), '2026-07-01');
});

test('שעון קיר → רגע → שעון קיר חוזר לעצמו', () => {
  for (const day of ['2026-01-05', '2026-03-27', '2026-07-01', '2026-10-25', '2026-12-31']) {
    for (const hour of [10, 13, 15]) {
      const parts = partsOf(atHour(day, hour));
      assert.equal(parts.hour, hour, `${day} ${hour}:00`);
      assert.equal(dayKeyOf(atHour(day, hour)), day);
    }
  }
});

test('wallToUtc מקבל גם דקות', () => {
  assert.equal(wallToUtc(2026, 7, 1, 10, 30).toISOString(), '2026-07-01T07:30:00.000Z');
});
