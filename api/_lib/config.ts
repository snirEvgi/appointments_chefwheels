/* חוקי הזמינות של העסק — המקום היחיד שבו משנים אותם.
 *
 * ברירות המחדל הן מה שסוכם: ראשון–חמישי, 10:00–16:00, פגישה של שעה,
 * כלומר שישה תורים ביום. אפשר לעקוף בכל אחד ממשתני הסביבה בלי לגעת
 * בקוד, ולפרוס מחדש. */

import { intEnv, optionalEnv } from './env.js';

export interface Schedule {
  /** ימי עבודה. 0 = ראשון … 6 = שבת. */
  weekdays: number[];
  /** שעת ההתחלה של התור הראשון. */
  startHour: number;
  /** שעת הסיום של התור האחרון (לא כולל). 16 = התור האחרון 15:00–16:00. */
  endHour: number;
  slotMinutes: number;
  /** כמה ימים קדימה פתוחים לקביעה. */
  horizonDays: number;
  /** לא מאפשרים לקבוע פגישה שמתחילה בעוד פחות מזה. */
  minLeadHours: number;
  /** ביטול עצמי מותר רק אם נשארו לפחות כך שעות לפגישה. */
  cancelCutoffHours: number;
  /** תקרת פגישות פתוחות לאותו מספר טלפון. בלם ספאם, לא מדיניות. */
  maxOpenPerPhone: number;
}

function weekdaysFromEnv(): number[] {
  // "0,1,2,3,4" → ראשון עד חמישי
  const raw = optionalEnv('WORK_WEEKDAYS', '0,1,2,3,4');
  const parsed = raw
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return parsed.length ? [...new Set(parsed)].sort((a, b) => a - b) : [0, 1, 2, 3, 4];
}

export function schedule(): Schedule {
  return {
    weekdays: weekdaysFromEnv(),
    startHour: intEnv('WORK_START_HOUR', 10),
    endHour: intEnv('WORK_END_HOUR', 16),
    slotMinutes: intEnv('SLOT_MINUTES', 60),
    horizonDays: intEnv('HORIZON_DAYS', 21),
    minLeadHours: intEnv('MIN_LEAD_HOURS', 3),
    cancelCutoffHours: intEnv('CANCEL_CUTOFF_HOURS', 24),
    maxOpenPerPhone: intEnv('MAX_OPEN_PER_PHONE', 2),
  };
}

/** ברירת המחדל, לשימוש בבדיקות ובמקומות שלא קוראים סביבה. */
export const DEFAULT_SCHEDULE: Schedule = {
  weekdays: [0, 1, 2, 3, 4],
  startHour: 10,
  endHour: 16,
  slotMinutes: 60,
  horizonDays: 21,
  minLeadHours: 3,
  cancelCutoffHours: 24,
  maxOpenPerPhone: 2,
};
