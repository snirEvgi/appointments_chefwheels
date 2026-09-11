import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, Clock, MapPin } from 'lucide-react';
import { Header } from '../components/Header';
import { Stepper } from '../components/Stepper';
import { DetailsStep, type Details } from '../components/DetailsStep';
import { SlotStep } from '../components/SlotStep';
import { ConfirmStep } from '../components/ConfirmStep';
import { SuccessScreen } from '../components/SuccessScreen';
import { Button } from '../components/ui';
import {
  ApiError,
  book,
  getSlots,
  type BookingResponse,
  type DaySlots,
} from '../lib/api';
import { formatPhone } from '../lib/phone';
import { BUSINESS_ADDRESS, DEFAULT_SLOT_MINUTES, hasAddress } from '../config';

const STORAGE_KEY = 'chefs-wheels:booking';

/** הפגישה האחרונה שנקבעה במכשיר הזה.
 *
 *  נשמרת כדי שרענון, סיבוב מסך או חזרה לדפדפן אחרי פתיחת Waze לא
 *  ימחקו את מסך האישור — בדפדפן המוטמע של וואטסאפ זה קורה בקלות.
 *  פגישה שכבר עברה נמחקת מעצמה, כך שהקישור חוזר להיות שמיש. */
function loadStoredBooking(): BookingResponse | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookingResponse;
    if (!parsed?.start || new Date(parsed.start).getTime() < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeBooking(booking: BookingResponse | null): void {
  try {
    if (booking) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(booking));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* חלון פרטי או אחסון חסום — מסך האישור פשוט לא ישרוד רענון. */
  }
}

/** פרטים שהגיעו בקישור: ?name=&phone=&ref=
 *  הליד כבר נתן לנו אותם בשיחה, ואין סיבה לבקש שוב. */
function prefillFromUrl(): Details {
  const params = new URLSearchParams(window.location.search);
  return {
    name: (params.get('name') ?? '').slice(0, 60).trim(),
    phone: formatPhone(params.get('phone') ?? ''),
    note: '',
    company: '',
  };
}

function sourceFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return (params.get('ref') ?? params.get('utm_source') ?? '').slice(0, 60).trim();
}

export function BookingPage() {
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<Details>(prefillFromUrl);
  const [source] = useState(sourceFromUrl);

  const [days, setDays] = useState<DaySlots[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [selected, setSelected] = useState('');
  const [slotMinutes, setSlotMinutes] = useState(DEFAULT_SLOT_MINUTES);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  /** ההודעה שמוצגת כשמועד נתפס בין הבחירה לאישור. */
  const [takenNotice, setTakenNotice] = useState('');
  const [booking, setBooking] = useState<BookingResponse | null>(loadStoredBooking);

  const loadSlots = useCallback(async (signal?: AbortSignal) => {
    setSlotsLoading(true);
    setSlotsError('');
    try {
      const response = await getSlots(signal);
      setDays(response.days);
      setSlotMinutes(response.slotMinutes);
    } catch (error) {
      if (signal?.aborted) return;
      setSlotsError(
        error instanceof ApiError ? error.message : 'לא הצלחנו לטעון את המועדים הפנויים.',
      );
    } finally {
      if (!signal?.aborted) setSlotsLoading(false);
    }
  }, []);

  // המועדים נטענים ברקע כבר במסך הראשון, כדי ששלב 2 ייפתח מלא ולא ריק.
  useEffect(() => {
    if (booking) return;
    const controller = new AbortController();
    void loadSlots(controller.signal);
    return () => controller.abort();
  }, [booking, loadSlots]);

  // גלילה לראש המסך בכל מעבר שלב. בלי זה הלקוח נשאר באמצע הדף ולא
  // מבין שהתוכן התחלף.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const selectedSlot = days
    .flatMap((day) => day.slots)
    .find((slot) => slot.start === selected);

  // המועד שנבחר נעלם מהרשימה אחרי רענון — מחזירים לבחירה במקום להציג
  // מסך אישור ריק.
  useEffect(() => {
    if (step === 2 && !selectedSlot && !slotsLoading) setStep(1);
  }, [step, selectedSlot, slotsLoading]);

  async function confirm() {
    if (!selected) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await book({
        start: selected,
        name: details.name.trim(),
        phone: details.phone,
        note: details.note.trim(),
        source,
        company: details.company,
      });
      storeBooking(result);
      setBooking(result);
    } catch (error) {
      const api = error instanceof ApiError ? error : null;

      if (api?.code === 'taken' || api?.code === 'too_soon') {
        // מישהו הקדים. מרעננים את הרשימה ומחזירים לבחירת מועד, כדי
        // שהלקוח לא ילחץ שוב על אותה שעה ויקבל את אותה שגיאה.
        setSelected('');
        setStep(1);
        void loadSlots();
        setSlotsError('');
        setSubmitError('');
        setTakenNotice(api.message);
      } else {
        setSubmitError(api?.message ?? 'לא הצלחנו לקבוע את הפגישה. נסו שוב בעוד רגע.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (booking) {
    return (
      <Shell>
        <SuccessScreen booking={booking} />
        <button
          type="button"
          onClick={() => {
            storeBooking(null);
            setBooking(null);
            setStep(0);
            setSelected('');
            setDetails((current) => ({ ...current, note: '' }));
          }}
          className="mx-auto block pb-6 text-xs font-semibold text-ink-400 underline underline-offset-2"
        >
          לקביעת פגישה נוספת
        </button>
      </Shell>
    );
  }

  return (
    <Shell stepper={{ current: step, onJump: setStep }}>
      <Intro slotMinutes={slotMinutes} />

      {takenNotice && step === 1 && (
        <div
          role="status"
          className="rounded-lg border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-ink-800"
        >
          {takenNotice}
        </div>
      )}

      {step === 0 && (
        <DetailsStep value={details} onChange={setDetails} onNext={() => setStep(1)} />
      )}

      {step === 1 && (
        <>
          <SlotStep
            days={days}
            loading={slotsLoading}
            error={slotsError}
            selected={selected}
            onSelect={(start) => {
              setSelected(start);
              setTakenNotice('');
              setStep(2);
            }}
            onRetry={() => void loadSlots()}
          />
          <BackButton onClick={() => setStep(0)} label="חזרה לפרטים" />
        </>
      )}

      {step === 2 && selectedSlot && (
        <>
          <ConfirmStep
            details={details}
            start={selectedSlot.start}
            end={selectedSlot.end}
            submitting={submitting}
            error={submitError}
            onEditDetails={() => setStep(0)}
            onEditSlot={() => setStep(1)}
            onConfirm={() => void confirm()}
          />
          <BackButton onClick={() => setStep(1)} label="חזרה לבחירת מועד" />
        </>
      )}
    </Shell>
  );
}

function Shell({
  children,
  stepper,
}: {
  children: ReactNode;
  stepper?: { current: number; onJump: (step: number) => void };
}) {
  return (
    <div className="min-h-full bg-ink-50">
      <Header />
      {stepper && <Stepper current={stepper.current} onJump={stepper.onJump} />}
      <main className="safe-bottom mx-auto max-w-lg space-y-4 px-4 py-4">{children}</main>
    </div>
  );
}

function Intro({ slotMinutes }: { slotMinutes: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
      <span className="flex items-center gap-1.5">
        <Clock size={13} className="text-ink-400" aria-hidden="true" />
        פגישה של עד {slotMinutes} דקות
      </span>
      {hasAddress && (
        <span className="flex min-w-0 items-center gap-1.5">
          <MapPin size={13} className="shrink-0 text-ink-400" aria-hidden="true" />
          <span className="truncate">{BUSINESS_ADDRESS}</span>
        </span>
      )}
    </div>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button
      variant="ghost"
      className="w-full"
      onClick={onClick}
      icon={<ArrowRight size={16} aria-hidden="true" />}
    >
      {label}
    </Button>
  );
}
