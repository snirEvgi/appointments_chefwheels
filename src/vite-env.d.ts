/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** כתובת העסק, מוזרקת ב-vite.config.ts. ציבורית. */
  readonly BUSINESS_ADDRESS?: string;
  /** מחרוזת חיפוש למפות, אם שונה מהכתובת. ציבורית. */
  readonly BUSINESS_MAP_QUERY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
