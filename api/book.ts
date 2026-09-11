/* POST /api/book — קביעת הפגישה.
 *
 * סדר הפעולות נבחר כך שהמקרה הנפוץ יהיה מהיר והמקרה הנדיר יהיה בטוח:
 *
 *   1. ולידציה מקומית (חינם).
 *   2. קריאה אחת ליומן — משמשת גם לבדיקת תפוסה וגם לתקרה לפי טלפון.
 *   3. הכנסה עם מזהה דטרמיניסטי — כאן נחתך מרוץ בין שני לקוחות.
 *   4. אימות אחרי ההכנסה — תופס אירוע שבעל העסק הוסיף ידנית באותה שנייה.
 *
 * שלב 2 לבדו אינו מספיק: בין הקריאה לכתיבה יש חלון. שלב 3 סוגר אותו. */

import { randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  busyIntervals,
  cancelUrl,
  foreignBlocker,
  insertWithGeneration,
} from './_lib/booking.js';
import { deleteEvent, listEvents } from './_lib/calendar.js';
import { schedule } from './_lib/config.js';
import { businessInfo, calendarId } from './_lib/env.js';
import {
  BadRequest,
  allowMethods,
  fail,
  failFromError,
  json,
  readJsonBody,
  requestOrigin,
} from './_lib/http.js';
import { overlaps } from './_lib/slots.js';
import { addDays, atHour, dayKeyOf } from './_lib/tz.js';
import { parseBooking } from './_lib/validate.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!allowMethods(req, res, ['POST'])) return;

  const business = businessInfo();
  const whatsapp = `https://wa.me/${business.phone}`;

  try {
    const config = schedule();
    const now = new Date();
    const input = parseBooking(readJsonBody(req), config, now);
    const id = calendarId();

    const startMs = input.start.getTime();
    const endMs = input.end.getTime();

    /* ── 2. האם התור פנוי, והאם הטלפון הזה כבר קבע ── */
    const horizonEnd = atHour(addDays(dayKeyOf(now), config.horizonDays + 1), 0);
    const events = await listEvents({
      calendarId: id,
      timeMin: atHour(addDays(dayKeyOf(now), -1), 0),
      timeMax: horizonEnd,
    });

    const taken = busyIntervals(events).some((b) => overlaps(startMs, endMs, b.start, b.end));
    if (taken) {
      fail(res, 409, 'taken', 'המועד הזה נתפס בינתיים. בחר מועד אחר מהרשימה המעודכנת.');
      return;
    }

    // תקרה לפי מספר טלפון — בלם ספאם, לא מדיניות. מי שבאמת צריך עוד
    // פגישה מוזמן להתקשר, וההודעה אומרת את זה.
    const openForPhone = events.filter(
      (event) =>
        event.status !== 'cancelled' &&
        event.extendedProperties?.private?.phone === input.phone &&
        new Date(event.start?.dateTime ?? event.start?.date ?? 0).getTime() > now.getTime(),
    ).length;
    if (openForPhone >= config.maxOpenPerPhone) {
      fail(
        res,
        429,
        'limit',
        'כבר קיימת פגישה פתוחה עם המספר הזה. לקביעת פגישה נוספת דברו איתנו.',
        { whatsapp },
      );
      return;
    }

    /* ── 3. ההכנסה עצמה ── */
    const ref = randomBytes(16).toString('hex');
    const baseUrl = business.baseUrl || requestOrigin(req);

    const outcome = await insertWithGeneration(id, {
      start: input.start,
      end: input.end,
      name: input.name,
      phone: input.phone,
      note: input.note,
      source: input.source,
      address: business.address,
      baseUrl,
      ref,
    });

    if (!outcome.ok) {
      if (outcome.reason === 'taken') {
        fail(res, 409, 'taken', 'המועד הזה נתפס בינתיים. בחר מועד אחר מהרשימה המעודכנת.');
      } else {
        fail(
          res,
          503,
          'exhausted',
          'לא הצלחנו לרשום את הפגישה במועד הזה. בחר מועד אחר או דבר איתנו בוואטסאפ.',
          { whatsapp },
        );
      }
      return;
    }

    /* ── 4. אימות אחרי ההכנסה ── */
    const after = await listEvents({
      calendarId: id,
      timeMin: atHour(addDays(dayKeyOf(input.start), -1), 0),
      timeMax: atHour(addDays(dayKeyOf(input.start), 2), 0),
    });
    if (foreignBlocker(after, outcome.eventId, startMs, endMs)) {
      // מישהו — בדרך כלל בעל העסק ביומן שלו — תפס את השעה בין הבדיקה
      // לכתיבה. מוחקים את מה שיצרנו ומבקשים מהלקוח לבחור שוב, במקום
      // להשאיר שתי פגישות חופפות שאף אחד לא שם לב אליהן.
      await deleteEvent(id, outcome.eventId).catch(() => undefined);
      fail(res, 409, 'taken', 'המועד הזה נתפס בינתיים. בחר מועד אחר מהרשימה המעודכנת.');
      return;
    }

    json(res, 201, {
      ok: true,
      eventId: outcome.eventId,
      ref,
      start: input.start.toISOString(),
      end: input.end.toISOString(),
      name: input.name,
      phone: input.phone,
      address: business.address,
      cancelUrl: cancelUrl(baseUrl, outcome.eventId, ref),
      cancelCutoffHours: config.cancelCutoffHours,
    });
  } catch (error) {
    if (error instanceof BadRequest) {
      fail(res, 400, error.code, error.message);
      return;
    }
    failFromError(res, error);
  }
}
