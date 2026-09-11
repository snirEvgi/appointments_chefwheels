/* עטיפה דקה מעל Google Calendar API v3.
 *
 * fetch ישיר ולא googleapis: אנחנו צריכים ארבע פעולות, והחבילה הרשמית
 * גוררת עשרות מגה-בייט לפונקציה serverless. אותה החלטה כבר התקבלה
 * בפרויקט הצעות המחיר עבור Sheets, והיא מחזיקה. */

import { CALENDAR_SCOPE, getAccessToken } from './google.js';

const BASE = 'https://www.googleapis.com/calendar/v3';

export interface EventDateTime {
  /** אירוע עם שעה. */
  dateTime?: string;
  /** אירוע יומי (YYYY-MM-DD). הסיום אינו כולל את היום שרשום בו. */
  date?: string;
  timeZone?: string;
}

export interface CalendarEvent {
  id?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  description?: string;
  location?: string;
  start?: EventDateTime;
  end?: EventDateTime;
  transparency?: 'opaque' | 'transparent';
  eventType?: string;
  colorId?: string;
  reminders?: { useDefault?: boolean };
  extendedProperties?: { private?: Record<string, string> };
  htmlLink?: string;
}

export class CalendarError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly reason?: string,
  ) {
    super(message);
    this.name = 'CalendarError';
  }
}

interface RawResponse {
  status: number;
  body: unknown;
}

async function request(path: string, init: RequestInit = {}): Promise<RawResponse> {
  const token = await getAccessToken(CALENDAR_SCOPE);
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 500) };
    }
  }
  return { status: response.status, body };
}

function errorFrom(status: number, body: unknown): CalendarError {
  const error = (body as { error?: { message?: string; errors?: Array<{ reason?: string }> } })
    ?.error;
  const reason = error?.errors?.[0]?.reason;
  const message = error?.message ?? `שגיאת Calendar API (HTTP ${status})`;

  if (status === 401 || status === 403) {
    return new CalendarError(
      status,
      `${message} ← בדוק שהיומן משותף עם כתובת חשבון השירות בהרשאת "ביצוע שינויים באירועים", ושה-Calendar API מופעל בפרויקט ב-Google Cloud.`,
      reason,
    );
  }
  if (status === 404) {
    return new CalendarError(status, `${message} ← CALENDAR_ID לא נמצא.`, reason);
  }
  return new CalendarError(status, message, reason);
}

function expectOk({ status, body }: RawResponse): unknown {
  if (status >= 200 && status < 300) return body;
  throw errorFrom(status, body);
}

const encode = (id: string) => encodeURIComponent(id);

export interface ListOptions {
  calendarId: string;
  timeMin: Date;
  timeMax: Date;
  /** סינון לפי extendedProperties.private, בצורה "key=value". */
  privateExtendedProperty?: string;
}

/* אירועים שאינם התחייבות אמיתית של בעל העסק. ימי הולדת מאנשי הקשר הם
 * אירועים יומיים ביומן הראשי, ובלי הסינון הזה כל יום הולדת היה סוגר
 * יום שלם לקביעת תורים. */
const IGNORED_EVENT_TYPES = new Set(['birthday', 'workingLocation']);

/** כל האירועים בטווח, עם פריסת חזרות (singleEvents). */
export async function listEvents(options: ListOptions): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
      timeMin: options.timeMin.toISOString(),
      timeMax: options.timeMax.toISOString(),
      showDeleted: 'false',
    });
    if (options.privateExtendedProperty) {
      params.set('privateExtendedProperty', options.privateExtendedProperty);
    }
    if (pageToken) params.set('pageToken', pageToken);

    const body = expectOk(
      await request(`/calendars/${encode(options.calendarId)}/events?${params}`),
    ) as { items?: CalendarEvent[]; nextPageToken?: string };

    for (const event of body.items ?? []) {
      if (event.eventType && IGNORED_EVENT_TYPES.has(event.eventType)) continue;
      events.push(event);
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  return events;
}

export type InsertResult =
  | { ok: true; event: CalendarEvent }
  /** המזהה כבר קיים ביומן — כולל אירוע שנמחק. */
  | { ok: false; conflict: true };

export async function insertEvent(
  calendarId: string,
  event: CalendarEvent,
): Promise<InsertResult> {
  const response = await request(
    `/calendars/${encode(calendarId)}/events?sendUpdates=none&conferenceDataVersion=0`,
    { method: 'POST', body: JSON.stringify(event) },
  );

  if (response.status === 409) return { ok: false, conflict: true };
  return { ok: true, event: expectOk(response) as CalendarEvent };
}

/** null אם האירוע אינו קיים (404) או נמחק לצמיתות (410). */
export async function getEvent(
  calendarId: string,
  eventId: string,
): Promise<CalendarEvent | null> {
  const response = await request(`/calendars/${encode(calendarId)}/events/${encode(eventId)}`);
  if (response.status === 404 || response.status === 410) return null;
  return expectOk(response) as CalendarEvent;
}

/** מחיקה אידמפוטנטית: אירוע שכבר נמחק אינו שגיאה. */
export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  const response = await request(
    `/calendars/${encode(calendarId)}/events/${encode(eventId)}?sendUpdates=none`,
    { method: 'DELETE' },
  );
  if (response.status === 404 || response.status === 410) return;
  expectOk(response);
}
