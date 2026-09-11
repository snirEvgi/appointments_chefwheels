/* הולידציה היא הגבול בין מה שהדפדפן שלח למה שהשרת מאמין לו.
 *
 * דפדפן אפשר לערוך, ולכן אף בדיקה בצד הלקוח אינה נחשבת: הבדיקות כאן
 * מוודאות שהשרת מודד את השעה מול לוח הזמנים שהוא מחשב בעצמו. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SCHEDULE } from './config.js';
import { BadRequest } from './http.js';
import { parseBooking } from './validate.js';
import { atHour } from './tz.js';

const NOW = atHour('2026-09-13', 8); // ראשון, 08:00
const VALID = {
  name: 'ישראל ישראלי',
  phone: '050-123-4567',
  start: atHour('2026-09-14', 10).toISOString(),
};

function parse(body: Record<string, unknown>) {
  return parseBooking(body, DEFAULT_SCHEDULE, NOW);
}

function rejectCode(body: Record<string, unknown>): string {
  try {
    parse(body);
  } catch (error) {
    assert.ok(error instanceof BadRequest, 'סוג שגיאה לא צפוי');
    assert.ok(error.message.length > 0, 'שגיאה חייבת להסביר למשתמש מה לתקן');
    return error.code;
  }
  throw new Error('הבקשה התקבלה למרות שהייתה אמורה להיפסל');
}

test('בקשה תקינה עוברת ומנרמלת את הטלפון', () => {
  const input = parse({ ...VALID, note: '  מתעניין בפודטראק  ' });
  assert.equal(input.phone, '972501234567');
  assert.equal(input.name, 'ישראל ישראלי');
  assert.equal(input.note, 'מתעניין בפודטראק');
  assert.equal(input.end.getTime() - input.start.getTime(), 60 * 60_000);
});

test('מלכודת הדבש פוסלת בקשה אוטומטית', () => {
  assert.equal(rejectCode({ ...VALID, company: 'Acme' }), 'bot');
});

test('שם וטלפון הם חובה', () => {
  assert.equal(rejectCode({ ...VALID, name: ' ' }), 'name');
  assert.equal(rejectCode({ ...VALID, name: 'א' }), 'name');
  assert.equal(rejectCode({ ...VALID, name: '12345' }), 'name', 'שם בלי אותיות');
  assert.equal(rejectCode({ ...VALID, name: 'א'.repeat(61) }), 'name');
  assert.equal(rejectCode({ ...VALID, phone: '' }), 'phone');
  assert.equal(rejectCode({ ...VALID, phone: '03-6543210' }), 'phone', 'קו נייח');
});

test('שעה שלא הוצגה ללקוח נדחית', () => {
  assert.equal(rejectCode({ ...VALID, start: '' }), 'slot');
  assert.equal(rejectCode({ ...VALID, start: 'מחר בבוקר' }), 'slot');
  assert.equal(
    rejectCode({ ...VALID, start: atHour('2026-09-14', 10, 30).toISOString() }),
    'slot',
    'לא על השעה העגולה',
  );
  assert.equal(
    rejectCode({ ...VALID, start: atHour('2026-09-14', 20).toISOString() }),
    'slot',
    'מחוץ לשעות הקבלה',
  );
  assert.equal(
    rejectCode({ ...VALID, start: atHour('2026-09-18', 10).toISOString() }),
    'slot',
    'יום שישי',
  );
  assert.equal(
    rejectCode({ ...VALID, start: atHour('2026-11-30', 10).toISOString() }),
    'slot',
    'מעבר לאופק',
  );
});

test('פגישה בעוד שעתיים נדחית בגלל זמן ההתראה', () => {
  assert.equal(rejectCode({ ...VALID, start: atHour('2026-09-13', 10).toISOString() }), 'too_soon');
  // 11:00 באותו יום כבר עומד בשלוש שעות מראש.
  assert.ok(parse({ ...VALID, start: atHour('2026-09-13', 11).toISOString() }));
});

test('תווי בקרה בשם אינם מגיעים לתיאור האירוע', () => {
  // שורה חדשה בשם הייתה מאפשרת לזייף שורות בתיאור שבעל העסק קורא.
  const input = parse({ ...VALID, name: 'ישראל\nטלפון: 0500000000' });
  assert.ok(!input.name.includes('\n'));
  assert.equal(input.name, 'ישראל טלפון: 0500000000');
});

test('הערה ארוכה נחתכת ולא נפסלת', () => {
  const input = parse({ ...VALID, note: 'א'.repeat(500) });
  assert.equal(input.note.length, 300);
});
