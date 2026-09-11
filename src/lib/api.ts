/* הקריאות לשרת.
 *
 * כל שגיאה מגיעה לממשק כ-ApiError עם `code` שאפשר להחליט לפיו ועם
 * הודעה בעברית שאפשר להציג כמו שהיא. בלי זה כל מסך היה ממציא ניסוח
 * משלו ל-"התור נתפס". */

export interface Slot {
  start: string;
  end: string;
  available: boolean;
}

export interface DaySlots {
  date: string;
  weekday: number;
  slots: Slot[];
  availableCount: number;
}

export interface SlotsResponse {
  ok: true;
  tz: string;
  now: string;
  slotMinutes: number;
  cancelCutoffHours: number;
  days: DaySlots[];
}

export interface BookingResponse {
  ok: true;
  eventId: string;
  ref: string;
  start: string;
  end: string;
  name: string;
  phone: string;
  address: string;
  cancelUrl: string;
  cancelCutoffHours: number;
}

export interface BookingLookup {
  ok: true;
  start: string;
  end: string | null;
  name: string;
  address: string;
  canCancel: boolean;
  cancelCutoffHours: number;
  whatsapp: string;
}

export interface BookingInput {
  start: string;
  name: string;
  phone: string;
  note: string;
  source: string;
  /** מלכודת הדבש. תמיד ריק אצל בן אדם. */
  company: string;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly whatsapp?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const NETWORK_MESSAGE = 'אין חיבור לרשת כרגע. בדוק את החיבור ונסה שוב.';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError('network', NETWORK_MESSAGE, 0);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* תשובה שאינה JSON — נטופל למטה לפי הסטטוס */
  }

  if (!response.ok || !(body as { ok?: boolean })?.ok) {
    const payload = (body ?? {}) as { code?: string; error?: string; whatsapp?: string };
    throw new ApiError(
      payload.code ?? 'unknown',
      payload.error ?? 'משהו השתבש. נסה שוב בעוד רגע.',
      response.status,
      payload.whatsapp,
    );
  }

  return body as T;
}

export function getSlots(signal?: AbortSignal): Promise<SlotsResponse> {
  // חותם זמן כדי שדפדפן לא יגיש רשימת מועדים מהמטמון שלו אחרי שהלקוח
  // חזר אחורה בעקבות "התור נתפס".
  return request<SlotsResponse>(`/api/slots?t=${Date.now()}`, { method: 'GET', signal });
}

export function book(input: BookingInput): Promise<BookingResponse> {
  return request<BookingResponse>('/api/book', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getBooking(eventId: string, ref: string): Promise<BookingLookup> {
  const params = new URLSearchParams({ e: eventId, r: ref });
  return request<BookingLookup>(`/api/cancel?${params}`, { method: 'GET' });
}

export function cancelBooking(eventId: string, ref: string): Promise<{ ok: true }> {
  return request<{ ok: true }>('/api/cancel', {
    method: 'POST',
    body: JSON.stringify({ e: eventId, r: ref }),
  });
}
