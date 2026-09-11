/* אימות מול Google כחשבון שירות, בלי שום תלות חיצונית.
 *
 * הזרימה היא JWT-bearer: חותמים JWT עם המפתח הפרטי, ומחליפים אותו
 * ב-access token. זה כל מה ש-google-auth-library עושה עבור המקרה הזה,
 * ו-node:crypto מספיק בהחלט.
 *
 * פורט מ-price_qoute/api/_lib/google.ts. ההבדל היחיד: ה-scope מתקבל
 * כפרמטר והמטמון מפתוח לפיו, כדי שהוספת scope נוסף בעתיד לא תחזיר
 * בשקט טוקן עם ההרשאה הלא נכונה. */

import { createSign } from 'node:crypto';
import { loadServiceAccount } from './env.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** כתיבה וקריאה של אירועים בלבד.
 *  לא calendar המלא: השרת לא אמור להיות מסוגל למחוק יומן או לשנות
 *  הגדרות שיתוף. */
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

function base64url(input: Buffer | string): string {
  return Buffer.from(input as never)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function mintToken(scope: string): Promise<{ token: string; expiresAtMs: number }> {
  const { clientEmail, privateKey } = loadServiceAccount();
  const issuedAt = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: clientEmail,
    scope,
    aud: TOKEN_URL,
    iat: issuedAt,
    // גוגל דוחה תוקף ארוך משעה.
    exp: issuedAt + 3600,
    // בלי sub — הוא נדרש רק ל-domain-wide delegation, כלומר התחזות
    // למשתמש Workspace. אנחנו כותבים ליומן כחשבון השירות עצמו,
    // שהיומן שותף איתו ישירות. זו הסיבה שזה עובד גם עם Gmail רגיל.
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  let signature: Buffer;
  try {
    // גוגל מנפיקה PKCS#8 ("BEGIN PRIVATE KEY"), ש-createSign קורא ללא
    // אפשרויות. RSA-SHA256 עם ריפוד PKCS#1 v1.5 הוא בדיוק RS256.
    signature = createSign('RSA-SHA256').update(signingInput).end().sign(privateKey);
  } catch {
    throw new Error(
      'חתימת ה-JWT נכשלה — המפתח הפרטי של חשבון השירות אינו תקין. ' +
        'אם השתמשת ב-GOOGLE_PRIVATE_KEY, ודא שירידות השורה נשמרו כ-\n. ' +
        'עדיף להשתמש ב-GOOGLE_SERVICE_ACCOUNT_B64.',
    );
  }

  const assertion = `${signingInput}.${base64url(signature)}`;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  let body: { access_token?: string; expires_in?: number; error?: string; error_description?: string } =
    {};
  try {
    body = JSON.parse(text);
  } catch {
    /* גוף שאינו JSON — נטופל למטה */
  }

  if (!response.ok || !body.access_token) {
    throw new Error(describeTokenError(response.status, body, text));
  }

  const lifetimeMs = (body.expires_in ?? 3600) * 1000;
  return { token: body.access_token, expiresAtMs: Date.now() + lifetimeMs };
}

/** מתרגם את שגיאות ההתחברות הנפוצות להוראה מעשית.
 *  בלי זה המשתמש רואה `invalid_grant` ולא יודע מה לתקן. */
function describeTokenError(
  status: number,
  body: { error?: string; error_description?: string },
  raw: string,
): string {
  const detail = body.error_description ?? body.error ?? raw.slice(0, 300);

  if (/Invalid JWT Signature/i.test(detail)) {
    return `ההתחברות לגוגל נכשלה (${detail}) ← המפתח הפרטי הושחת. אם הוא מוגדר כ-GOOGLE_PRIVATE_KEY, ירידות השורה כנראה אבדו. עבור ל-GOOGLE_SERVICE_ACCOUNT_B64.`;
  }
  if (/expired|too early/i.test(detail)) {
    return `ההתחברות לגוגל נכשלה (${detail}) ← פער שעון בין השרת לגוגל.`;
  }
  if (/invalid_client|not found/i.test(detail)) {
    return `ההתחברות לגוגל נכשלה (${detail}) ← חשבון השירות לא קיים או נמחק.`;
  }
  return `ההתחברות לגוגל נכשלה (HTTP ${status}): ${detail}`;
}

interface CacheEntry {
  cached: { token: string; expiresAtMs: number } | null;
  inFlight: Promise<string> | null;
}

const byScope = new Map<string, CacheEntry>();

/** מחזיר access token תקף עבור ה-scope המבוקש.
 *
 *  ממוטמן ברמת המודול, ולכן פרץ של בקשות במכולה חמה משלם על הנפקה
 *  אחת בלבד. `inFlight` מאחד בקשות מקבילות — קביעת תור טיפוסית עושה
 *  שלוש קריאות ל-Calendar, וכולן חולקות טוקן אחד. */
export async function getAccessToken(scope: string = CALENDAR_SCOPE): Promise<string> {
  let entry = byScope.get(scope);
  if (!entry) {
    entry = { cached: null, inFlight: null };
    byScope.set(scope, entry);
  }

  // מרווח של דקה כדי שטוקן לא יפוג באמצע הבקשה שמשתמשת בו.
  if (entry.cached && Date.now() < entry.cached.expiresAtMs - 60_000) return entry.cached.token;
  if (entry.inFlight) return entry.inFlight;

  const pending = mintToken(scope)
    .then((minted) => {
      entry.cached = minted;
      return minted.token;
    })
    .finally(() => {
      entry.inFlight = null;
    });

  entry.inFlight = pending;
  return pending;
}
