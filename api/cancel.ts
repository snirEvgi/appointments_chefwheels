/* /api/cancel — ביטול עצמי של הלקוח.
 *
 *   GET  ?e=<id>&r=<ref>  → פרטי הפגישה, והאם עדיין אפשר לבטל.
 *   POST {e, r}           → ביטול בפועל.
 *
 * מזהה האירוע נגזר מהמועד ולכן הוא צפוי לחלוטין. ההרשאה כולה נשענת על
 * ה-ref: מחרוזת אקראית של 128 סיביות שנוצרת בקביעה, נשמרת על האירוע,
 * ומופיעה רק בקישור שנשלח ללקוח. בלעדיה אי אפשר לבטל פגישה של אף אחד. */

import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { CalendarEvent } from './_lib/calendar.js';
import { deleteEvent, getEvent } from './_lib/calendar.js';
import { schedule } from './_lib/config.js';
import { businessInfo, calendarId } from './_lib/env.js';
import {
  allowMethods,
  fail,
  failFromError,
  json,
  queryParam,
  readJsonBody,
} from './_lib/http.js';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // timingSafeEqual זורק על אורכים שונים, ולכן בודקים אורך קודם.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function startOf(event: CalendarEvent): Date | null {
  const raw = event.start?.dateTime;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!allowMethods(req, res, ['GET', 'POST'])) return;

  const business = businessInfo();
  const whatsapp = `https://wa.me/${business.phone}`;

  try {
    const body = req.method === 'POST' ? readJsonBody(req) : {};
    const eventId = (queryParam(req, 'e') || String(body.e ?? '')).trim();
    const ref = (queryParam(req, 'r') || String(body.r ?? '')).trim();

    if (!eventId || !ref) {
      fail(res, 400, 'invalid', 'הקישור אינו שלם.', { whatsapp });
      return;
    }

    const config = schedule();
    const id = calendarId();
    const event = await getEvent(id, eventId);

    // אירוע שאינו קיים, שבוטל, או ש-ref שגוי — כולם מקבלים בדיוק אותה
    // תשובה. אחרת הקישור היה הופך לכלי לבדוק אילו שעות תפוסות ולמי.
    const storedRef = event?.extendedProperties?.private?.ref ?? '';
    const start = event ? startOf(event) : null;
    if (!event || event.status === 'cancelled' || !storedRef || !safeEqual(storedRef, ref) || !start) {
      fail(res, 404, 'not_found', 'הפגישה לא נמצאה — ייתכן שכבר בוטלה.', { whatsapp });
      return;
    }

    const now = new Date();
    const hoursLeft = (start.getTime() - now.getTime()) / 3_600_000;
    const canCancel = hoursLeft >= config.cancelCutoffHours;
    const name = event.extendedProperties?.private?.name ?? '';
    const end = event.end?.dateTime ?? null;

    if (req.method === 'GET') {
      json(res, 200, {
        ok: true,
        start: start.toISOString(),
        end,
        name,
        address: event.location ?? business.address,
        canCancel,
        cancelCutoffHours: config.cancelCutoffHours,
        whatsapp,
      });
      return;
    }

    if (!canCancel) {
      // מכוון: מתחת לסף אין ביטול עצמי. ביטול עשר דקות לפני פגישה הוא
      // בדיוק המצב שבו בעל העסק צריך לדעת מיד ולא לגלות בדיעבד ביומן.
      fail(
        res,
        403,
        'too_late',
        `אפשר לבטל עד ${config.cancelCutoffHours} שעות לפני הפגישה. לביטול עכשיו דברו איתנו בוואטסאפ.`,
        { whatsapp, start: start.toISOString(), name },
      );
      return;
    }

    await deleteEvent(id, eventId);
    json(res, 200, { ok: true, cancelled: true, start: start.toISOString(), whatsapp });
  } catch (error) {
    failFromError(res, error);
  }
}
