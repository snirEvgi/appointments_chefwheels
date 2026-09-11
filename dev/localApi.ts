/* מריץ את הפונקציות האמיתיות שב-api/ בתוך שרת הפיתוח של Vite.
 *
 * למה זה קיים: `npm run dev` מגיש רק את הממשק, ו-`vercel dev` דורש
 * חשבון Vercel ופרויקט מקושר. המתאם הזה סוגר את הפער — אותו קוד שרת
 * שירוץ בייצור, מול היומן האמיתי, בלי שום התקנה נוספת.
 *
 * אין כאן חיקוי של שום דבר: ההבדל היחיד מייצור הוא שכבת ה-HTTP
 * שמתרגמת בין connect ל-VercelRequest/VercelResponse. */

import type { Connect, Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

type Handler = (req: unknown, res: unknown) => Promise<void> | void;

/** הפונקציות נטענות דרך ssrLoadModule, כך ש-Vite מקמפל את ה-TypeScript
 *  ומרענן אותן בכל שמירה — בדיוק כמו קוד הלקוח. */
const ROUTES: Record<string, string> = {
  '/api/slots': '/api/slots.ts',
  '/api/book': '/api/book.ts',
  '/api/cancel': '/api/cancel.ts',
  '/api/health': '/api/health.ts',
};

function shimRequest(req: IncomingMessage, body: unknown, url: URL) {
  const query: Record<string, string | string[]> = {};
  for (const key of url.searchParams.keys()) {
    const all = url.searchParams.getAll(key);
    query[key] = all.length > 1 ? all : all[0];
  }
  return Object.assign(req, { query, body, cookies: {} });
}

function shimResponse(res: ServerResponse) {
  return Object.assign(res, {
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    send(payload: unknown) {
      res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
      return this;
    },
    json(payload: unknown) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(payload));
      return this;
    },
  });
}

async function readBody(req: Connect.IncomingMessage): Promise<unknown> {
  if (req.method !== 'POST' && req.method !== 'PUT') return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function localApi(): Plugin {
  return {
    name: 'chefs-wheels-local-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const entry = ROUTES[url.pathname];
        if (!entry) return next();

        try {
          const body = await readBody(req);
          const module = (await server.ssrLoadModule(entry)) as { default: Handler };
          await module.default(shimRequest(req, body, url), shimResponse(res));
        } catch (error) {
          // אותה מדיניות כמו בייצור: הפירוט ללוג, ללקוח משפט אחד.
          server.config.logger.error(`[api] ${url.pathname}: ${String(error)}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
          }
          res.end(
            JSON.stringify({
              ok: false,
              code: 'dev_error',
              error: error instanceof Error ? error.message : 'שגיאה בשרת הפיתוח.',
            }),
          );
        }
      });
    },
  };
}
