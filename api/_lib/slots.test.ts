/* חישוב התורים. הפונקציה טהורה, ולכן אפשר לבדוק כאן בדיוק את המקרים
 * שקשה לשחזר מול יומן אמיתי: יום שנחסם, אירוע שחוצה שני תורים, וזמן
 * ההתראה המינימלי.
 *
 * "עכשיו" בכל הבדיקות: ראשון, 13 בספטמבר 2026, 08:00 בירושלים. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SCHEDULE, type Schedule } from './config.js';
import { computeSlots, isGridStart, slotId, type Interval } from './slots.js';
import { atHour, dayKeyOf, partsOf } from './tz.js';

const NOW = atHour('2026-09-13', 8); // ראשון בבוקר
const CONFIG: Schedule = DEFAULT_SCHEDULE;

function span(day: string, fromHour: number, toHour: number): Interval {
  return { start: atHour(day, fromHour).getTime(), end: atHour(day, toHour).getTime() };
}

function dayNamed(days: ReturnType<typeof computeSlots>, date: string) {
  return days.find((d) => d.date === date);
}

function hoursAvailable(days: ReturnType<typeof computeSlots>, date: string): number[] {
  const day = dayNamed(days, date);
  if (!day) return [];
  return day.slots
    .filter((slot) => slot.available)
    .map((slot) => partsOf(new Date(slot.start)).hour);
}

test('שישי ושבת אינם מוצעים', () => {
  const days = computeSlots(CONFIG, [], NOW);
  for (const day of days) {
    assert.ok(day.weekday >= 0 && day.weekday <= 4, `יום ${day.date} אינו יום עבודה`);
  }
});

test('אופק של שלושה שבועות — חמישה עשר ימי עבודה', () => {
  const days = computeSlots(CONFIG, [], NOW);
  assert.equal(days.length, 15);
  assert.equal(days[0].date, '2026-09-13');
  assert.equal(days.at(-1)!.date, '2026-10-01');
});

test('שישה תורים ביום, 10:00 עד 16:00', () => {
  const days = computeSlots(CONFIG, [], NOW);
  const tomorrow = dayNamed(days, '2026-09-14')!;
  assert.equal(tomorrow.slots.length, 6);
  assert.equal(tomorrow.availableCount, 6);
  assert.equal(tomorrow.slots[0].start, atHour('2026-09-14', 10).toISOString());
  assert.equal(tomorrow.slots[0].end, atHour('2026-09-14', 11).toISOString());
  assert.equal(tomorrow.slots[5].start, atHour('2026-09-14', 15).toISOString());
  assert.equal(tomorrow.slots[5].end, atHour('2026-09-14', 16).toISOString());
});

test('זמן התראה מינימלי חוסם את התורים הקרובים היום', () => {
  // 08:00 + 3 שעות → התור הראשון האפשרי הוא 11:00.
  const days = computeSlots(CONFIG, [], NOW);
  assert.deepEqual(hoursAvailable(days, '2026-09-13'), [11, 12, 13, 14, 15]);
});

test('אירוע שחוצה תור חוסם את שני התורים שהוא נוגע בהם', () => {
  // 10:30–11:30 חופף גם ל-10:00–11:00 וגם ל-11:00–12:00.
  const busy: Interval[] = [
    { start: atHour('2026-09-14', 10).getTime() + 30 * 60_000, end: atHour('2026-09-14', 11).getTime() + 30 * 60_000 },
  ];
  assert.deepEqual(hoursAvailable(computeSlots(CONFIG, busy, NOW), '2026-09-14'), [12, 13, 14, 15]);
});

test('אירוע שנוגע בקצה בלבד אינו חוסם', () => {
  // 09:00–10:00 נוגע ב-10:00 אבל אינו חופף לו.
  const busy = [span('2026-09-14', 9, 10)];
  assert.deepEqual(hoursAvailable(computeSlots(CONFIG, busy, NOW), '2026-09-14'), [10, 11, 12, 13, 14, 15]);
});

test('יום חסום לגמרי מוצג כמלא ולא נעלם', () => {
  const busy = [span('2026-09-14', 0, 24)];
  const days = computeSlots(CONFIG, busy, NOW);
  const blocked = dayNamed(days, '2026-09-14');
  assert.ok(blocked, 'היום החסום חייב להופיע ברשימה');
  assert.equal(blocked!.availableCount, 0);
  assert.equal(blocked!.slots.length, 6);
  assert.ok(blocked!.slots.every((slot) => !slot.available));
});

test('היום הנוכחי נעלם כשלא נשאר בו כלום', () => {
  // בשונה מיום עתידי: "היום מלא" הוא רעש, לא מידע.
  const busy = [span('2026-09-13', 0, 24)];
  const days = computeSlots(CONFIG, busy, NOW);
  assert.equal(dayNamed(days, '2026-09-13'), undefined);
  assert.equal(days[0].date, '2026-09-14');
});

test('חסימה ביום אחד אינה נוגעת ביום אחר', () => {
  const busy = [span('2026-09-14', 0, 24)];
  const days = computeSlots(CONFIG, busy, NOW);
  assert.equal(dayNamed(days, '2026-09-15')!.availableCount, 6);
});

test('התורים נכונים גם אחרי מעבר השעון', () => {
  // 25 באוקטובר 2026 השעון חוזר לחורף. התור עדיין 10:00 מקומי.
  const config = { ...CONFIG, horizonDays: 45 };
  const days = computeSlots(config, [], NOW);
  const afterSwitch = dayNamed(days, '2026-10-26'); // יום שני
  assert.ok(afterSwitch);
  assert.equal(afterSwitch!.slots[0].start, '2026-10-26T08:00:00.000Z');
  assert.equal(dayKeyOf(new Date(afterSwitch!.slots[0].start)), '2026-10-26');
});

test('שעות עבודה אחרות מכבדות את ההגדרה', () => {
  const config: Schedule = { ...CONFIG, startHour: 9, endHour: 12, slotMinutes: 90 };
  const days = computeSlots(config, [], NOW);
  const day = dayNamed(days, '2026-09-14')!;
  assert.equal(day.slots.length, 2);
  assert.equal(day.slots[1].start, atHour('2026-09-14', 10, 30).toISOString());
});

test('isGridStart מקבל רק שעות קבלה אמיתיות', () => {
  assert.ok(isGridStart(CONFIG, atHour('2026-09-14', 10)));
  assert.ok(isGridStart(CONFIG, atHour('2026-09-14', 15)));
  assert.ok(!isGridStart(CONFIG, atHour('2026-09-14', 16)), 'אחרי שעת הסגירה');
  assert.ok(!isGridStart(CONFIG, atHour('2026-09-14', 9)), 'לפני שעת הפתיחה');
  assert.ok(!isGridStart(CONFIG, atHour('2026-09-14', 10, 30)), 'לא על השעה העגולה');
  assert.ok(!isGridStart(CONFIG, atHour('2026-09-18', 10)), 'יום שישי');
  assert.ok(!isGridStart(CONFIG, atHour('2026-09-19', 10)), 'שבת');
  assert.ok(!isGridStart(CONFIG, new Date(NaN)), 'תאריך לא תקין');
});

test('מזהה התור דטרמיניסטי ובאלפבית שגוגל מתירה', () => {
  const id = slotId(atHour('2026-09-14', 10), 0);
  assert.equal(id, 'bk2026091410000');
  assert.equal(slotId(atHour('2026-09-14', 10), 0), id, 'אותו תור → אותו מזהה');
  assert.notEqual(slotId(atHour('2026-09-14', 11), 0), id);
  assert.notEqual(slotId(atHour('2026-09-14', 10), 1), id, 'דור אחר → מזהה אחר');

  // גוגל מתירה רק base32hex: הספרות 0–9 והאותיות a–v.
  for (const generation of [0, 1, 5]) {
    for (const day of ['2026-01-05', '2026-07-01', '2026-12-31']) {
      const candidate = slotId(atHour(day, 15), generation);
      assert.match(candidate, /^[0-9a-v]+$/, candidate);
      assert.ok(candidate.length >= 5 && candidate.length <= 1024);
    }
  }
});

test('המזהה נגזר משעון ירושלים ולא מ-UTC', () => {
  // בקיץ 10:00 מקומי הם 07:00 ב-UTC. מזהה שנגזר מ-UTC היה מתנגש עם
  // תור אחר ומייצר חסימות מדומות.
  assert.equal(slotId(atHour('2026-07-01', 10), 0), 'bk2026070110000');
  assert.equal(slotId(atHour('2026-01-05', 10), 0), 'bk2026010510000');
});
