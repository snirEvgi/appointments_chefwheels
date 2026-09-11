/* GET /api/slots — המועדים הפנויים לשלושת השבועות הקרובים.
 *
 * היומן הוא מקור האמת היחיד. אין כאן מסד נתונים שאפשר שיצא מסנכרון
 * איתו: כל טעינה של הדף קוראת את היומן כפי שהוא ברגע זה. */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { busyIntervals } from './_lib/booking.js';
import { listEvents } from './_lib/calendar.js';
import { schedule } from './_lib/config.js';
import { calendarId } from './_lib/env.js';
import { allowMethods, failFromError, json } from './_lib/http.js';
import { computeSlots } from './_lib/slots.js';
import { TZ, addDays, atHour, dayKeyOf } from './_lib/tz.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!allowMethods(req, res, ['GET'])) return;

  try {
    const config = schedule();
    const now = new Date();
    const today = dayKeyOf(now);

    // יום ריפוד לכל צד: אירועים יומיים נשמרים כתאריך בלי אזור זמן,
    // והשוואת הגבולות מולם עדינה יותר ממה שנדמה.
    const timeMin = atHour(addDays(today, -1), 0);
    const timeMax = atHour(addDays(today, config.horizonDays + 1), 0);

    const events = await listEvents({ calendarId: calendarId(), timeMin, timeMax });
    const days = computeSlots(config, busyIntervals(events), now);

    // מטמון קצר בשכבת הקצה: פרץ של לחיצות על אותו קישור לא מכה ביומן
    // בכל פעם, ועשרים שניות אינן מספיקות כדי להציג תור שנתפס — ממילא
    // ההזמנה עצמה נבדקת שוב מול היומן.
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');

    json(res, 200, {
      ok: true,
      tz: TZ,
      now: now.toISOString(),
      slotMinutes: config.slotMinutes,
      cancelCutoffHours: config.cancelCutoffHours,
      days,
    });
  } catch (error) {
    failFromError(res, error);
  }
}
