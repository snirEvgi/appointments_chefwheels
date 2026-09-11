/* עזרי HTTP משותפים לפונקציות השרת. */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CalendarError } from './calendar.js';

export function json(res: VercelResponse, status: number, body: unknown): void {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
}

/** שגיאה ללקוח. `code` מיועד לקוד (כדי להחליט מה להציג), `error`
 *  לבן אדם — הוא מוצג כמו שהוא, ולכן נכתב בעברית ובלי ז'רגון. */
export function fail(
  res: VercelResponse,
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): void {
  json(res, status, { ok: false, code, error: message, ...extra });
}

/** מחזיר false ושולח 405 אם השיטה לא נתמכת. */
export function allowMethods(
  req: VercelRequest,
  res: VercelResponse,
  methods: string[],
): boolean {
  if (methods.includes(req.method ?? '')) return true;
  res.setHeader('Allow', methods.join(', '));
  fail(res, 405, 'method', `השיטה ${req.method} לא נתמכת בנקודת הקצה הזו.`);
  return false;
}

/** תרגום שגיאה לתשובה, בלי לדלוף פרטי תשתית ללקוח.
 *
 *  הטקסט המלא נכתב תמיד ללוג — שם הוא שימושי לאבחון — והלקוח מקבל
 *  משפט אחד שמסביר מה לעשות עכשיו.
 *
 *  היוצא מן הכלל הוא **תקלות הגדרה**: הרשאה, יומן שלא נמצא, ומשתני
 *  סביבה חסרים. אלו לעולם לא תקלות של הלקוח אלא של מי שהתקין את
 *  המערכת, והן נכשלות באופן עקבי ולא חולף. לכן ההודעה שלהן מועברת
 *  כמות שהיא ומסומנת 503 — אחרת תקלת הגדרה נראית בדפדפן כמו 502
 *  אנונימי, ומי שמתקין מחפש באפלה. */
export function failFromError(res: VercelResponse, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  console.error('[appointments]', detail);

  if (error instanceof CalendarError) {
    if (error.status === 401 || error.status === 403) {
      fail(res, 503, 'calendar_auth', detail);
      return;
    }
    if (error.status === 404) {
      // כמעט תמיד CALENDAR_ID שגוי, או יומן שלא שותף עם חשבון השירות
      // — גוגל מחזירה "לא נמצא" גם כשאין גישה כלל.
      fail(res, 503, 'calendar_not_found', detail);
      return;
    }
  }
  if (/משתנה הסביבה|חשבון השירות|Base64/.test(detail)) {
    fail(res, 503, 'config', detail);
    return;
  }
  fail(
    res,
    502,
    'upstream',
    'לא הצלחנו לדבר עם היומן כרגע. נסה שוב בעוד רגע, או פנה אלינו בוואטסאפ.',
    // מזהה הבקשה של Vercel, כדי שאפשר יהיה לאתר את השורה בלוג.
    // אין כאן שום פרט על התקלה עצמה, רק מצביע אליה.
    { requestId: process.env.VERCEL_REQUEST_ID ?? undefined },
  );
}

/** גוף הבקשה כאובייקט, עם תקרת גודל.
 *
 *  Vercel כבר מפרסר JSON לתוך req.body. התקרה כאן היא הגנה זולה: אין
 *  שום סיבה שטופס עם שם, טלפון והערה יגיע בגודל שמצדיק עיבוד. */
export function readJsonBody(req: VercelRequest): Record<string, unknown> {
  const length = Number(req.headers['content-length'] ?? 0);
  if (Number.isFinite(length) && length > 4096) {
    throw new BadRequest('הבקשה גדולה מדי.');
  }

  const body = req.body;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  if (typeof body === 'string' && body.trim()) {
    try {
      const parsed: unknown = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      throw new BadRequest('גוף הבקשה אינו JSON תקין.');
    }
  }
  return {};
}

/** שגיאת קלט של המשתמש. הודעתה מוצגת לו ישירות. */
export class BadRequest extends Error {
  constructor(
    message: string,
    readonly code = 'invalid',
  ) {
    super(message);
    this.name = 'BadRequest';
  }
}

export function queryParam(req: VercelRequest, name: string): string {
  const value = req.query[name];
  if (Array.isArray(value)) return (value[0] ?? '').trim();
  return (value ?? '').toString().trim();
}

/** מקור הבקשה (סכימה + מארח), לבניית קישורים מוחלטים.
 *
 *  PUBLIC_BASE_URL גובר כשהוא מוגדר; אחרת נגזר מהכותרות של Vercel, כך
 *  שגם פריסת preview מייצרת קישור ביטול שעובד. */
export function requestOrigin(req: VercelRequest): string {
  const rawProto = req.headers['x-forwarded-proto'];
  const proto = (Array.isArray(rawProto) ? rawProto[0] : rawProto ?? 'https').split(',')[0].trim();
  const rawHost = req.headers['x-forwarded-host'] ?? req.headers.host;
  const host = (Array.isArray(rawHost) ? rawHost[0] : rawHost ?? '').split(',')[0].trim();
  return host ? `${proto}://${host}` : '';
}
