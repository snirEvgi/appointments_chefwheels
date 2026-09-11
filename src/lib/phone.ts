/* טלפון בצד הלקוח — נוחות בלבד.
 *
 * הבדיקה המחייבת נמצאת ב-api/_lib/phone.ts ורצה בשרת. כאן המטרה היא
 * שהלקוח יראה את הטעות לפני שהוא לוחץ, ושהמספר ייראה כמו מספר תוך
 * כדי הקלדה. */

/** משאיר ספרות בלבד, ומתרגם כתיבה בינלאומית לצורה המקומית. */
export function digitsOf(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00972')) digits = digits.slice(5);
  else if (digits.startsWith('972')) digits = digits.slice(3);
  else return digits;
  return digits.startsWith('0') ? digits : `0${digits}`;
}

/** 0501234567 → 050-123-4567, גם באמצע הקלדה. */
export function formatPhone(raw: string): string {
  const digits = digitsOf(raw).slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** נייד ישראלי: 05X ואחריו שמונה ספרות. */
export function isValidPhone(raw: string): boolean {
  return /^05\d{8}$/.test(digitsOf(raw));
}

/** ההסבר שמוצג מתחת לשדה. ריק = תקין. */
export function phoneProblem(raw: string): string {
  const digits = digitsOf(raw);
  if (!digits) return 'נא למלא מספר טלפון נייד.';
  if (!digits.startsWith('05')) return 'נא למלא מספר נייד (מתחיל ב-05).';
  if (digits.length < 10) return 'חסרות ספרות במספר.';
  if (digits.length > 10) return 'יש ספרות מיותרות במספר.';
  return '';
}
