/* קריאת משתני סביבה, עם הודעות שגיאה שאומרות מה חסר.
 *
 * כל הסודות חיים כאן ורק כאן. הם לעולם לא מגיעים לדפדפן:
 * vite.config.ts מזריק ל-bundle רשימת שמות מפורשת וקצרה, ולא קידומת
 * כללית. מפתח חשבון השירות אינו ברשימה הזו ולא יהיה. */

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `חסר משתנה הסביבה ${name}. הגדר אותו ב-Vercel תחת Settings → ` +
        'Environment Variables (ובקובץ .env המקומי), ופרוס מחדש.',
    );
  }
  return value.trim();
}

export function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

export function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface ServiceAccount {
  clientEmail: string;
  privateKey: string;
}

/** קורא את מפתח חשבון השירות של גוגל.
 *
 *  מועדף: GOOGLE_SERVICE_ACCOUNT_B64 — קובץ ה-JSON כולו מקודד Base64.
 *  Base64 חסר ירידות שורה וחסר גרשיים מעצם הגדרתו, ולכן אין מה לברוח
 *  ואין דו-משמעות. החלופה (מפתח PEM עם \n מילולי) נתמכת אבל היא מקור
 *  תקלה מוכר — במיוחד כשהגרשיים נשמרים כחלק מהערך. */
export function loadServiceAccount(): ServiceAccount {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
  if (encoded && encoded.trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(encoded.trim(), 'base64').toString('utf8'));
    } catch {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_B64 אינו Base64 תקין של קובץ JSON. ' +
          'קודד מחדש את קובץ המפתח שהורדת מ-Google Cloud.',
      );
    }
    const json = parsed as { client_email?: string; private_key?: string };
    if (!json.client_email || !json.private_key) {
      throw new Error('קובץ חשבון השירות חסר client_email או private_key.');
    }
    return { clientEmail: json.client_email, privateKey: json.private_key };
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (clientEmail && rawKey) {
    const privateKey = rawKey
      .replace(/^["']|["']$/g, '') // כלים מסוימים שומרים את הגרשיים כחלק מהערך
      .replace(/\n/g, '\n');
    return { clientEmail, privateKey };
  }

  throw new Error(
    'חסרים פרטי חשבון השירות של גוגל. הגדר GOOGLE_SERVICE_ACCOUNT_B64 ' +
      '(קובץ ה-JSON כולו ב-Base64), או לחלופין GOOGLE_CLIENT_EMAIL ו-GOOGLE_PRIVATE_KEY. ' +
      'ראה README.md.',
  );
}

/* ── פרטי העסק ───────────────────────────────────────────────── */

/** מזהה היומן שאליו נכתבות הפגישות — בדרך כלל כתובת ה-Gmail של העסק.
 *  היומן חייב להיות משותף עם כתובת חשבון השירות בהרשאת
 *  "ביצוע שינויים באירועים". */
export function calendarId(): string {
  return requireEnv('CALENDAR_ID');
}

export interface BusinessInfo {
  /** E.164 בלי + — הפורמט ש-wa.me דורש. */
  phone: string;
  address: string;
  /** בסיס לבניית קישור הביטול. בלי סלאש בסוף. */
  baseUrl: string;
}

export function businessInfo(): BusinessInfo {
  return {
    phone: optionalEnv('BUSINESS_PHONE_E164', '972508313777'),
    address: optionalEnv('BUSINESS_ADDRESS', ''),
    baseUrl: optionalEnv('PUBLIC_BASE_URL', '').replace(/\/+$/, ''),
  };
}
