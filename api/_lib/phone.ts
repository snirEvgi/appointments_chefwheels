/* נרמול מספרי טלפון לפורמט שווטסאפ דורש: E.164 בלי הסימן +.
 *   050-123-4567  →  972501234567
 *
 * פורט של הלוגיקה מ-"Lead manager.md" §4.3, שרצה בייצור ומכוסה ב-22
 * מקרי בדיקה (phone.test.ts). הלוגיקה הזו קובעת את מפתח הזהות של הליד
 * במסד, ולכן:
 *
 *   1. סדר הענפים הוא load-bearing. אסור "לסדר" אותו.
 *   2. ההגדרות נעולות כאן ולא במשתני סביבה — שינוי שלהן הוא מיגרציה,
 *      כי שורות קיימות לא ימופתחו מחדש.
 *
 * מטפל בכל הצורות שמופיעות בפועל בגיליונות לידים:
 *   '050-123-4567'    טקסט עם מקפים
 *   '+972 50 123 4567'
 *   '00972501234567'
 *   "'0501234567"     גרש מוביל, מעמודה שמעוצבת כטקסט
 *   501234567         מספר — הגיליון בלע את האפס המוביל
 */

export interface PhoneConfig {
  /** קידומת מדינה בלי + . ישראל = 972. */
  countryCode: string;
  /** אורך המספר המלא אחרי נרמול, כולל קידומת המדינה. */
  minLength: number;
  maxLength: number;
  /** מספר נייח לא יכול לקבל ווטסאפ. שליחה אליו רק שורפת קריאת API. */
  mobileOnly: boolean;
  /** תחיליות של ניידים אחרי נרמול. ישראל: 972 ואחריו 5. */
  mobilePrefixes: string[];
}

export const PHONE_CONFIG: PhoneConfig = {
  countryCode: '972',
  minLength: 11,
  maxLength: 15,
  mobileOnly: true,
  mobilePrefixes: ['9725'],
};

export type PhoneResult =
  | { ok: true; phone: string }
  | { ok: false; reason: string };

export function normalizePhone(raw: unknown, config: PhoneConfig = PHONE_CONFIG): PhoneResult {
  if (raw === null || raw === undefined) {
    return { ok: false, reason: 'תא ריק' };
  }

  let s: string;
  if (typeof raw === 'number') {
    // הגיליון שמר את המספר כמספר ולא כטקסט, כך שהאפס המוביל אבד.
    // toFixed(0) מונע גם את הצגת המספר בכתיב מדעי (5.01e8).
    //
    // הענף הזה נדלק רק כי אנחנו מבקשים UNFORMATTED_VALUE מ-Sheets.
    // עם ברירת המחדל של ה-API כל תא חוזר כמחרוזת, והמקרה הזה מפסיק
    // להיבדק באמת. ראה api/_lib/sheets.ts.
    if (!Number.isFinite(raw)) return { ok: false, reason: 'ערך מספרי לא תקין' };
    s = raw.toFixed(0);
  } else {
    s = String(raw);
  }

  s = s.trim().replace(/^'/, '');
  if (!s) return { ok: false, reason: 'תא ריק' };

  // נקבע לפני הסרת התווים שאינם ספרות — אחרת ה-+ הולך לאיבוד.
  let isInternational = s.charAt(0) === '+';
  let digits = s.replace(/[^0-9]/g, '');
  if (!digits) return { ok: false, reason: 'אין ספרות במספר' };

  // קידומת חיוג בינלאומי בצורת 00
  if (digits.substring(0, 2) === '00') {
    digits = digits.substring(2);
    isInternational = true;
  }

  const cc = config.countryCode;
  let normalized: string;

  if (isInternational) {
    // המשתמש כתב + או 00 — סומכים עליו שהקידומת כבר שם.
    normalized = digits;
  } else if (digits.charAt(0) === '0') {
    // מספר מקומי עם אפס מוביל: 0501234567 → 972501234567
    normalized = cc + digits.substring(1);
  } else if (digits.substring(0, cc.length) === cc && digits.length > cc.length + 6) {
    // כבר כולל קידומת מדינה, רק בלי + . מספר מקומי לעולם לא מתחיל
    // ב-972 אחרי הסרת האפס, ולכן אין כאן דו-משמעות.
    normalized = digits;
  } else {
    // מספר מקומי שאיבד את האפס המוביל: 501234567 → 972501234567
    normalized = cc + digits;
  }

  /* ── ולידציה ── */

  if (normalized.length < config.minLength) {
    return { ok: false, reason: `מספר קצר מדי (${normalized.length} ספרות)` };
  }
  if (normalized.length > config.maxLength) {
    return { ok: false, reason: `מספר ארוך מדי (${normalized.length} ספרות)` };
  }

  if (config.mobileOnly && normalized.substring(0, cc.length) === cc) {
    // בודקים נייד רק עבור מספרים בקידומת שלנו. מספר זר עובר כמו שהוא,
    // כי איננו מכירים את כללי הניידים של כל מדינה.
    const isMobile = config.mobilePrefixes.some((prefix) => normalized.startsWith(prefix));
    if (!isMobile) {
      return { ok: false, reason: 'לא מספר נייד — ווטסאפ לא יעבוד' };
    }
  }

  return { ok: true, phone: normalized };
}
