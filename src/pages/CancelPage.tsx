import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarCheck, CalendarX, MessageCircle } from 'lucide-react';
import { Header } from '../components/Header';
import { Banner, Button, Skeleton } from '../components/ui';
import { ApiError, cancelBooking, getBooking, type BookingLookup } from '../lib/api';
import { fullDate, fullDateTime, timeRange } from '../lib/format';
import { whatsappUrl } from '../config';

type Phase = 'loading' | 'found' | 'confirming' | 'cancelled' | 'error';

/** מסך הביטול, שנפתח מהקישור האישי שבמסך האישור.
 *
 *  ההחלטה המרכזית כאן היא הסף: ביטול עצמי מותר עד 24 שעות לפני, ומתחת
 *  לזה הלקוח מופנה לוואטסאפ. ביטול עשר דקות לפני פגישה הוא בדיוק המצב
 *  שבו בעל העסק צריך לדעת מיד — לא לגלות ביומן אחרי שחיכה. */
export function CancelPage({ eventId, token }: { eventId: string; token: string }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [booking, setBooking] = useState<BookingLookup | null>(null);
  const [message, setMessage] = useState('');
  const [whatsapp, setWhatsapp] = useState(whatsappUrl());

  useEffect(() => {
    let live = true;
    getBooking(eventId, token)
      .then((result) => {
        if (!live) return;
        setBooking(result);
        if (result.whatsapp) setWhatsapp(result.whatsapp);
        setPhase('found');
      })
      .catch((error: unknown) => {
        if (!live) return;
        const api = error instanceof ApiError ? error : null;
        if (api?.whatsapp) setWhatsapp(api.whatsapp);
        setMessage(api?.message ?? 'לא הצלחנו לטעון את פרטי הפגישה.');
        setPhase('error');
      });
    return () => {
      live = false;
    };
  }, [eventId, token]);

  async function submitCancel() {
    setPhase('confirming');
    setMessage('');
    try {
      await cancelBooking(eventId, token);
      setPhase('cancelled');
    } catch (error) {
      const api = error instanceof ApiError ? error : null;
      if (api?.whatsapp) setWhatsapp(api.whatsapp);
      setMessage(api?.message ?? 'הביטול לא עבר. נסו שוב או דברו איתנו.');
      // חוזרים למצב "נמצאה פגישה" כדי שהכפתורים יהיו זמינים שוב.
      setPhase(booking ? 'found' : 'error');
    }
  }

  return (
    <div className="min-h-full bg-ink-50">
      <Header />
      <main className="safe-bottom mx-auto max-w-lg space-y-4 px-4 py-5">
        {phase === 'loading' && (
          <div className="space-y-3" aria-busy="true">
            <span className="sr-only">טוען את פרטי הפגישה</span>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
        )}

        {phase === 'error' && !booking && (
          <div className="fade-in space-y-4">
            <div className="rounded-xl border border-ink-200 bg-white px-6 py-10 text-center">
              <CalendarX size={28} className="mx-auto text-ink-300" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-ink-700">{message}</p>
              <p className="mt-1 text-sm text-ink-400">
                אם הקישור ישן, ייתכן שהפגישה כבר בוטלה או שכבר התקיימה.
              </p>
            </div>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <Button
                variant="secondary"
                className="w-full"
                icon={<MessageCircle size={17} aria-hidden="true" />}
              >
                דברו איתנו בוואטסאפ
              </Button>
            </a>
          </div>
        )}

        {phase === 'cancelled' && booking && (
          <div className="fade-in space-y-4">
            <div className="rounded-xl border border-ink-200 bg-white px-6 py-8 text-center">
              <CalendarCheck size={28} className="mx-auto text-ink-400" aria-hidden="true" />
              <h1 className="mt-3 text-base font-extrabold text-ink-900">הפגישה בוטלה</h1>
              <p className="mt-1 text-sm text-ink-500">
                המועד ב{fullDate(booking.start)} התפנה. אפשר לקבוע מועד חדש בכל רגע.
              </p>
            </div>
            <a href="/">
              <Button variant="primary" className="w-full">
                קביעת מועד חדש
              </Button>
            </a>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" className="w-full">
                דברו איתנו בוואטסאפ
              </Button>
            </a>
          </div>
        )}

        {(phase === 'found' || phase === 'confirming') && booking && (
          <div className="fade-in space-y-4">
            <div className="rounded-xl border border-ink-200 bg-white p-5 text-center">
              <p className="text-xs text-ink-400">הפגישה שלך</p>
              <p className="mt-1 text-sm font-semibold text-ink-900">{fullDate(booking.start)}</p>
              <p className="num mt-0.5 text-2xl font-extrabold text-ink-950">
                {booking.end ? timeRange(booking.start, booking.end) : fullDateTime(booking.start)}
              </p>
              {booking.address && (
                <p className="mt-2 text-xs text-ink-400">{booking.address}</p>
              )}
            </div>

            {message && <Banner tone="error">{message}</Banner>}

            {booking.canCancel ? (
              <>
                <Button
                  variant="danger"
                  className="w-full"
                  busy={phase === 'confirming'}
                  onClick={() => void submitCancel()}
                >
                  {phase === 'confirming' ? 'מבטלים…' : 'ביטול הפגישה'}
                </Button>
                <a href="/">
                  <Button variant="ghost" className="w-full">
                    להשאיר את הפגישה
                  </Button>
                </a>
                <p className="text-center text-xs text-ink-400">
                  הביטול מיידי והמועד יתפנה ללקוחות אחרים.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-start gap-2.5 rounded-lg border border-gold-300 bg-gold-50 px-4 py-3">
                  <AlertTriangle
                    size={17}
                    className="mt-0.5 shrink-0 text-gold-600"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-ink-800">
                    נשארו פחות מ-{booking.cancelCutoffHours} שעות לפגישה, ולכן הביטול כאן סגור.
                    כתבו לנו והכול יסתדר.
                  </p>
                </div>
                <a
                  href={`${whatsapp}${whatsapp.includes('?') ? '&' : '?'}text=${encodeURIComponent(
                    `היי, לגבי הפגישה ב${fullDateTime(booking.start)} — צריך לשנות.`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="secondary"
                    className="w-full"
                    icon={<MessageCircle size={17} aria-hidden="true" />}
                  >
                    דברו איתנו בוואטסאפ
                  </Button>
                </a>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
