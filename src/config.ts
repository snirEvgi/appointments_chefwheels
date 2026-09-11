/* פרטי העסק והטקסטים של הדף.
 *
 * הכול כאן ציבורי במפורש — הקובץ נארז לתוך ה-bundle ונשלח לדפדפן.
 * סודות חיים רק ב-api/, ולא עוברים דרך כאן לעולם. */

/** E.164 בלי + — הפורמט ש-wa.me דורש.
 *
 *  ⚠️ המספר אינו מוצג בשום מקום בדף, אבל הוא כן מופיע בתוך קישורי
 *  ה-wa.me. זה בלתי נמנע: קישור וואטסאפ *הוא* המספר. מי שיפתח את קוד
 *  המקור של הדף יראה אותו. הגנה אמיתית יותר תדרוש לוותר על כפתורי
 *  הוואטסאפ, ולהשאיר ללקוח רק את הטופס. */
export const BUSINESS_PHONE_E164 = '972508313777';
export const BUSINESS_NAME = 'Chefs Wheels';
export const BUSINESS_TAGLINE = 'פודטראקים וציוד מטבח מקצועי';

/** כתובת הפגישה. מוזרקת מ-BUSINESS_ADDRESS ב-vite.config.ts.
 *  כשהיא ריקה הדף פשוט לא מציג כתובת וכפתורי ניווט, במקום להמציא. */
export const BUSINESS_ADDRESS: string = import.meta.env.BUSINESS_ADDRESS ?? '';

/** מה לחפש במפות, אם שונה מהכתובת המוצגת (למשל שם העסק). */
const MAP_QUERY: string = import.meta.env.BUSINESS_MAP_QUERY || BUSINESS_ADDRESS;

export const hasAddress = BUSINESS_ADDRESS.trim().length > 0;

export const mapsUrl = hasAddress
  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAP_QUERY)}`
  : '';

export const wazeUrl = hasAddress
  ? `https://waze.com/ul?q=${encodeURIComponent(MAP_QUERY)}&navigate=yes`
  : '';

export function whatsappUrl(message?: string): string {
  const base = `https://wa.me/${BUSINESS_PHONE_E164}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** משך הפגישה כפי שמוצג ללקוח. השרת הוא הקובע בפועל ומחזיר את הערך
 *  האמיתי ב-/api/slots; זו רק ברירת מחדל עד שהתשובה מגיעה. */
export const DEFAULT_SLOT_MINUTES = 60;
