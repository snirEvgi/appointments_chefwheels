import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { mockApi } from './dev/mockApi';
import { localApi } from './dev/localApi';

/* פרטי העסק נקראים ללא הקידומת VITE_ (גם ב-.env המקומי וגם ב-Vercel),
 * באותו דפוס כמו בפרויקט הצעות המחיר. Vite חושף לדפדפן רק משתנים עם
 * הקידומת הזו, ולכן מזריקים כאן במפורש בדיוק את השמות שמותר לפרסם —
 * ולא מרחיבים את envPrefix, שהיה עלול לחשוף מפתחות עתידיים.
 *
 * ⚠️ כל מה שנכנס לרשימה הזו מגיע לדפדפן כטקסט גלוי. סודות (מפתח חשבון
 *    השירות) לעולם לא נכנסים לכאן — הם נקראים רק בתוך api/. */
const PUBLIC_VARS = ['BUSINESS_ADDRESS', 'BUSINESS_MAP_QUERY'] as const;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // loadEnv קורא את .env אבל אינו כותב ל-process.env, ואילו הפונקציות
  // ב-api/ קוראות משם — כמו שהן עושות בייצור. הגשר נעשה כאן, ורק
  // למשתנים שעוד לא מוגדרים, כדי שסביבה אמיתית תמיד גוברת.
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  const define: Record<string, string> = {};
  for (const name of PUBLIC_VARS) {
    define[`import.meta.env.${name}`] = JSON.stringify(env[name] ?? env[`VITE_${name}`] ?? '');
  }

  return {
    /* שרת הפיתוח מגיש גם את ה-API, כדי ש-`npm run dev` יהיה זרימה
     * שלמה ולא רק ממשק:
     *   MOCK_API=1  → נתונים מומצאים, בלי מפתח ובלי לגעת ביומן.
     *   אחרת        → הפונקציות האמיתיות שב-api/, מול היומן האמיתי.
     * שניהם פעילים רק ב-serve ואינם נכנסים לבנייה. */
    plugins: [
      react(),
      tailwindcss(),
      env.MOCK_API ? mockApi() : localApi(),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    define,
    server: { port: 5173, open: true },
  };
});
