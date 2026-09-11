/* GET /api/health — אבחון פריסה.
 *
 * קיים כדי ש-502 בדפדפן יהפוך לתשובה ולא לניחוש. בודק את שרשרת
 * ההגדרה כולה לפי הסדר שבו היא נשברת בפועל: משתני סביבה, חתימה מול
 * גוגל, ולבסוף גישה ליומן.
 *
 * ⚠️ התשובה ציבורית, ולכן אין בה שום ערך סודי — רק נוכחות של משתנים,
 *    כתובת חשבון השירות (שממילא נועדה לשיתוף), ומזהה היומן ממוסך. */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CALENDAR_SCOPE, getAccessToken } from './_lib/google.js';
import { listEvents } from './_lib/calendar.js';
import { loadServiceAccount } from './_lib/env.js';
import { allowMethods, json } from './_lib/http.js';

/** מזהה יומן הוא כתובת מייל. מסתירים את הגוף ומשאירים קצוות שמספיקים
 *  כדי לזהות שמדובר ביומן הנכון. */
function maskCalendarId(value: string): string {
  const [local = '', domain = ''] = value.split('@');
  const head = local.slice(0, 6);
  const tail = local.length > 10 ? local.slice(-4) : '';
  return `${head}…${tail}@${domain}`;
}

type Step = { step: string; ok: boolean; detail: string };

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!allowMethods(req, res, ['GET'])) return;

  const steps: Step[] = [];
  const seen = (name: string) => Boolean(process.env[name]?.trim());

  // 1. משתני סביבה
  const calendarIdRaw = process.env.CALENDAR_ID?.trim() ?? '';
  steps.push({
    step: 'משתני סביבה',
    ok: seen('GOOGLE_SERVICE_ACCOUNT_B64') && Boolean(calendarIdRaw),
    detail: [
      `GOOGLE_SERVICE_ACCOUNT_B64: ${seen('GOOGLE_SERVICE_ACCOUNT_B64') ? 'מוגדר' : 'חסר'}`,
      `CALENDAR_ID: ${calendarIdRaw ? maskCalendarId(calendarIdRaw) : 'חסר'}`,
      `BUSINESS_ADDRESS: ${seen('BUSINESS_ADDRESS') ? 'מוגדר' : 'חסר (הדף לא יציג כתובת)'}`,
    ].join(' | '),
  });

  // 2. פענוח המפתח
  let clientEmail = '';
  try {
    clientEmail = loadServiceAccount().clientEmail;
    steps.push({ step: 'מפתח חשבון השירות', ok: true, detail: clientEmail });
  } catch (error) {
    steps.push({
      step: 'מפתח חשבון השירות',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  // 3. חתימה והחלפה בטוקן
  if (clientEmail) {
    try {
      await getAccessToken(CALENDAR_SCOPE);
      steps.push({ step: 'התחברות לגוגל', ok: true, detail: 'התקבל access token' });
    } catch (error) {
      steps.push({
        step: 'התחברות לגוגל',
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 4. גישה ליומן עצמו
  const reachedGoogle = steps.at(-1)?.step === 'התחברות לגוגל' && steps.at(-1)!.ok;
  if (reachedGoogle && calendarIdRaw) {
    try {
      const events = await listEvents({
        calendarId: calendarIdRaw,
        timeMin: new Date(Date.now() - 86_400_000),
        timeMax: new Date(Date.now() + 7 * 86_400_000),
      });
      steps.push({
        step: 'גישה ליומן',
        ok: true,
        detail: `נקראו ${events.length} אירועים בשבוע הקרוב`,
      });
    } catch (error) {
      steps.push({
        step: 'גישה ליומן',
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const failed = steps.find((s) => !s.ok);
  json(res, failed ? 503 : 200, {
    ok: !failed,
    // Vercel מזריק את זה אוטומטית. מאפשר לדעת בוודאות איזה commit
    // באוויר, במקום לנחש אם הפריסה כללה את התיקון האחרון.
    commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? '(מקומי)').slice(0, 7),
    node: process.version,
    steps,
    ...(failed
      ? {
          נכשל: failed.step,
          מה_לעשות: hintFor(failed, clientEmail),
        }
      : { הערה: 'הכול מחובר. הדף אמור לעבוד.' }),
  });
}

function hintFor(failed: Step, clientEmail: string): string {
  switch (failed.step) {
    case 'משתני סביבה':
      return 'הגדר את המשתנים החסרים ב-Vercel תחת Settings → Environment Variables, ופרוס מחדש. שינוי משתנה אינו חל על פריסה קיימת.';
    case 'מפתח חשבון השירות':
      return 'הערך של GOOGLE_SERVICE_ACCOUNT_B64 אינו Base64 תקין של קובץ ה-JSON. שים לב שהעתקה ידנית נוטה לבלוע תווים או להוסיף ירידות שורה.';
    case 'התחברות לגוגל':
      return 'המפתח נדחה על ידי גוגל. ייתכן שנמחק מחשבון השירות, או שהשעון של השרת חורג.';
    case 'גישה ליומן':
      return `ודא שהיומן משותף עם ${clientEmail || 'כתובת חשבון השירות'} בהרשאת "ביצוע שינויים באירועים", ושה-CALENDAR_ID הוא בדיוק המזהה מהגדרות היומן.`;
    default:
      return 'בדוק את הלוג של הפריסה.';
  }
}
