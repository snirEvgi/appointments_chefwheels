import { useState } from 'react';
import { CalendarPlus, Check, MapPin, MessageCircle, Navigation } from 'lucide-react';
import { Button } from './ui';
import type { BookingResponse } from '../lib/api';
import {
  BUSINESS_ADDRESS,
  BUSINESS_NAME,
  hasAddress,
  mapsUrl,
  wazeUrl,
  whatsappUrl,
} from '../config';
import { fullDate, timeRange } from '../lib/format';
import { downloadIcs, googleCalendarUrl, type CalendarEntry } from '../lib/calendarLinks';

/** מסך האישור.
 *
 *  שלוש משימות, לפי סדר החשיבות ללקוח: לדעת מתי, להגיע לשם, ולזכור.
 *  קישור הביטול נמצא למטה ובקטן במכוון — הוא חייב להיות זמין, אבל הוא
 *  לא הפעולה שאנחנו מעודדים ברגע שבו הלקוח בדיוק אישר. */
export function SuccessScreen({ booking }: { booking: BookingResponse }) {
  const [icsFailed, setIcsFailed] = useState(false);

  const entry: CalendarEntry = {
    start: booking.start,
    end: booking.end,
    title: `פגישה · ${BUSINESS_NAME}`,
    details: [
      `פגישת ייעוץ עם ${BUSINESS_NAME}.`,
      booking.cancelUrl ? `לשינוי או ביטול: ${booking.cancelUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    location: booking.address || BUSINESS_ADDRESS,
  };

  const whatsappMessage = `היי, קבעתי פגישה ל${fullDate(booking.start)} בשעה ${timeRange(
    booking.start,
    booking.end,
  ).split('–')[0]}.`;

  return (
    <div className="fade-in space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500">
          <Check size={26} strokeWidth={3} className="text-white" aria-hidden="true" />
        </span>
        <h1 className="mt-3 text-lg font-extrabold text-emerald-900">הפגישה נקבעה</h1>
        <p className="mt-1 text-sm font-semibold text-emerald-800">{fullDate(booking.start)}</p>
        <p className="num mt-0.5 text-2xl font-extrabold text-emerald-900">
          {timeRange(booking.start, booking.end)}
        </p>
        <p className="mt-2 text-xs text-emerald-700">
          נתראה, {booking.name.split(' ')[0]}. נעדכן בטלפון אם משהו ישתנה.
        </p>
      </div>

      {hasAddress && (
        <div className="rounded-xl border border-ink-200 bg-white p-4">
          <div className="flex items-start gap-2.5">
            <MapPin size={17} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-400">הפגישה אצלנו</p>
              <p className="text-sm font-semibold text-ink-900">
                {booking.address || BUSINESS_ADDRESS}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={wazeUrl} target="_blank" rel="noopener noreferrer">
              <Button
                variant="ghost"
                className="w-full"
                icon={<Navigation size={16} aria-hidden="true" />}
              >
                Waze
              </Button>
            </a>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
              <Button
                variant="ghost"
                className="w-full"
                icon={<MapPin size={16} aria-hidden="true" />}
              >
                Google Maps
              </Button>
            </a>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-ink-200 bg-white p-4">
        <p className="mb-3 text-[13px] font-semibold text-ink-700">שמרו אצלכם תזכורת</p>
        <div className="space-y-2">
          <Button
            variant="primary"
            className="w-full"
            icon={<CalendarPlus size={16} aria-hidden="true" />}
            onClick={() => {
              if (!downloadIcs(entry)) setIcsFailed(true);
            }}
          >
            הוספה ליומן במכשיר
          </Button>
          <a href={googleCalendarUrl(entry)} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" className="w-full">
              הוספה ל-Google Calendar
            </Button>
          </a>
        </div>
        {icsFailed && (
          <p className="mt-2 text-xs text-ink-400">
            הדפדפן חסם את ההורדה. השתמשו בכפתור של Google Calendar, או פתחו את הדף בדפדפן רגיל.
          </p>
        )}
        <p className="mt-3 text-xs text-ink-400">
          זו תזכורת ביומן שלכם בלבד. הפגישה כבר רשומה אצלנו.
        </p>
      </div>

      <a href={whatsappUrl(whatsappMessage)} target="_blank" rel="noopener noreferrer">
        <Button
          variant="secondary"
          className="w-full"
          icon={<MessageCircle size={17} aria-hidden="true" />}
        >
          שלחו לנו הודעה בוואטסאפ
        </Button>
      </a>

      {booking.cancelUrl && (
        <p className="pb-2 text-center text-xs leading-relaxed text-ink-400">
          לא מסתדר לכם?{' '}
          <a
            href={booking.cancelUrl}
            className="font-semibold text-ink-600 underline underline-offset-2"
          >
            אפשר לבטל כאן
          </a>{' '}
          עד {booking.cancelCutoffHours} שעות לפני הפגישה.
          <br />
          שמרו את ההודעה הזו — הקישור אישי.
        </p>
      )}
    </div>
  );
}
