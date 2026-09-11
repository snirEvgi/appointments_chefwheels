/* שרת מדומה ל-`npm run dev`, שמופעל רק כש-MOCK_API מוגדר.
 *
 * קיים כדי שאפשר יהיה לעבוד על הממשק בלי מפתח של גוגל ובלי לגעת ביומן
 * אמיתי. הוא מחקה את *התשובות* של api/, אבל לא את הלוגיקה — הבדיקה
 * האמיתית של השרת היא `npm test` ו-`vercel dev`.
 *
 * הקובץ הזה לא נכנס לבנייה: הוא נטען מ-vite.config.ts בלבד. */

import type { Connect, Plugin } from 'vite';
import type { ServerResponse } from 'node:http';

const TZ = 'Asia/Jerusalem';
const SLOT_MINUTES = 60;
const HOURS = [10, 11, 12, 13, 14, 15];
const WEEKDAYS = [0, 1, 2, 3, 4];

function wallToUtc(year: number, month: number, day: number, hour: number): Date {
  const naive = Date.UTC(year, month - 1, day, hour);
  const offset = (instant: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(instant));
    const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
    return (
      Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')) -
      instant
    );
  };
  return new Date(naive - offset(naive - offset(naive)));
}

/** תפוסה קבועה ולא אקראית, כדי שצילומי מסך יהיו ניתנים להשוואה. */
const booked = new Set<string>();

function buildDays() {
  const now = new Date();
  const days: unknown[] = [];
  const cursor = new Date(now);

  for (let offset = 0; offset < 21; offset += 1) {
    const probe = new Date(cursor.getTime() + offset * 86_400_000);
    const key = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(probe);
    const [year, month, day] = key.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (!WEEKDAYS.includes(weekday)) continue;

    const slots = HOURS.map((hour) => {
      const start = wallToUtc(year, month, day, hour);
      const end = new Date(start.getTime() + SLOT_MINUTES * 60_000);
      const iso = start.toISOString();
      // דוגמה מייצגת: כמה שעות תפוסות, ויום אחד מלא לגמרי.
      const busy =
        booked.has(iso) ||
        offset === 3 ||
        (offset === 1 && (hour === 11 || hour === 14)) ||
        (offset === 2 && hour === 10);
      const available = !busy && start.getTime() - now.getTime() >= 3 * 3_600_000;
      return { start: iso, end: end.toISOString(), available };
    });

    const availableCount = slots.filter((slot) => slot.available).length;
    if (offset === 0 && availableCount === 0) continue;
    days.push({ date: key, weekday, slots, availableCount });
  }
  return days;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readBody(req: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

export function mockApi(): Plugin {
  return {
    name: 'chefs-wheels-mock-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/slots', (_req, res) => {
        send(res, 200, {
          ok: true,
          tz: TZ,
          now: new Date().toISOString(),
          slotMinutes: SLOT_MINUTES,
          cancelCutoffHours: 24,
          days: buildDays(),
        });
      });

      server.middlewares.use('/api/book', async (req, res) => {
        const body = await readBody(req);
        const start = String(body.start ?? '');
        if (booked.has(start)) {
          send(res, 409, { ok: false, code: 'taken', error: 'המועד הזה נתפס בינתיים.' });
          return;
        }
        booked.add(start);
        const end = new Date(new Date(start).getTime() + SLOT_MINUTES * 60_000).toISOString();
        send(res, 201, {
          ok: true,
          eventId: 'bk000000000000',
          ref: 'mock',
          start,
          end,
          name: String(body.name ?? ''),
          phone: String(body.phone ?? ''),
          address: process.env.BUSINESS_ADDRESS ?? '',
          cancelUrl: '/?e=bk000000000000&r=mock',
          cancelCutoffHours: 24,
        });
      });

      server.middlewares.use('/api/cancel', async (req, res) => {
        const first = [...booked][0];
        if (!first) {
          send(res, 404, { ok: false, code: 'not_found', error: 'הפגישה לא נמצאה.' });
          return;
        }
        if (req.method === 'POST') {
          booked.delete(first);
          send(res, 200, { ok: true, cancelled: true, start: first });
          return;
        }
        send(res, 200, {
          ok: true,
          start: first,
          end: new Date(new Date(first).getTime() + SLOT_MINUTES * 60_000).toISOString(),
          name: 'ישראל ישראלי',
          address: process.env.BUSINESS_ADDRESS ?? '',
          canCancel: new Date(first).getTime() - Date.now() > 24 * 3_600_000,
          cancelCutoffHours: 24,
          whatsapp: 'https://wa.me/972508313777',
        });
      });
    },
  };
}
