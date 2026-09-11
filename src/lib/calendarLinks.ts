/* "הוסף ליומן שלי" — שני מסלולים, כי אין אחד שעובד בכל מקום.
 *
 *   • קישור Google Calendar: עובד מצוין באנדרואיד ובדסקטופ.
 *   • קובץ ICS: מה שאייפון מבין, וגם אאוטלוק.
 *
 * שים לב שזה נפרד לגמרי מהאירוע שנוצר ביומן של העסק — זה עותק ללקוח,
 * ביומן שלו. ביטול של הלקוח לא ימחק את העותק הזה, ולכן מסך האישור
 * אומר את זה במפורש. */

export interface CalendarEntry {
  start: string;
  end: string;
  title: string;
  details: string;
  location: string;
}

/** 2026-09-15T07:00:00Z → 20260915T070000Z */
function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function googleCalendarUrl(entry: CalendarEntry): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: entry.title,
    dates: `${stamp(entry.start)}/${stamp(entry.end)}`,
    details: entry.details,
    location: entry.location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** תו חדש, פסיק ונקודה-פסיק הם תווים בעלי משמעות בתקן iCalendar. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function buildIcs(entry: CalendarEntry): string {
  const uid = `${stamp(entry.start)}-chefswheels@appointments`;
  // CRLF אינו קישוט: מנתחי ICS מחמירים דוחים שורות שמסתיימות ב-LF בלבד.
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chefs Wheels//Appointments//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(entry.start)}`,
    `DTEND:${stamp(entry.end)}`,
    `SUMMARY:${escapeText(entry.title)}`,
    `DESCRIPTION:${escapeText(entry.details)}`,
    entry.location ? `LOCATION:${escapeText(entry.location)}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(entry.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/** מוריד את קובץ ה-ICS. מחזיר false אם הדפדפן חסם — בדפדפן המוטמע של
 *  וואטסאפ זה קורה, ואז המסך מציע את קישור גוגל במקום. */
export function downloadIcs(entry: CalendarEntry, fileName = 'chefs-wheels.ics'): boolean {
  try {
    const blob = new Blob([buildIcs(entry)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // שחרור מושהה: חלק מהדפדפנים קוראים את ה-blob אחרי שה-click חזר.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}
