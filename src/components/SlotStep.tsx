import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarX, RefreshCw } from 'lucide-react';
import { Banner, Button, Skeleton } from './ui';
import type { DaySlots } from '../lib/api';
import { dayMonth, relativeDayLabel, time } from '../lib/format';
import { whatsappUrl } from '../config';

/** שלב 2 — בחירת מועד.
 *
 *  שתי שורות החלטה ולא לוח חודשי: בטלפון, לוח חודשי מכריח את הלקוח
 *  לצוד ימים פנויים בין ימים אפורים. כאן מוצגים רק ימי עבודה, וימים
 *  מלאים נשארים ברשימה מסומנים כמלאים — כדי שיהיה ברור שהם קיימים
 *  ותפוסים, ולא שנשמטו בטעות. */
export function SlotStep({
  days,
  loading,
  error,
  selected,
  onSelect,
  onRetry,
}: {
  days: DaySlots[];
  loading: boolean;
  error: string;
  selected: string;
  onSelect: (startIso: string) => void;
  onRetry: () => void;
}) {
  const openDays = useMemo(() => days.filter((day) => day.availableCount > 0), [days]);
  const [activeDate, setActiveDate] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  // כשהרשימה מתרעננת (למשל אחרי "התור נתפס") נשמרת בחירת היום אם היא
  // עדיין אפשרית, ואחרת קופצים ליום הפנוי הראשון.
  useEffect(() => {
    setActiveDate((current) => {
      if (current && openDays.some((day) => day.date === current)) return current;
      const fromSelection = selected
        ? days.find((day) => day.slots.some((slot) => slot.start === selected))?.date
        : undefined;
      return fromSelection ?? openDays[0]?.date ?? '';
    });
  }, [days, openDays, selected]);

  const activeDay = days.find((day) => day.date === activeDate);

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div className="fade-in space-y-3">
        <Banner tone="error">{error}</Banner>
        <div className="flex gap-2">
          <Button
            variant="primary"
            className="flex-1"
            icon={<RefreshCw size={16} aria-hidden="true" />}
            onClick={onRetry}
          >
            נסה שוב
          </Button>
          <a href={whatsappUrl('היי, ניסיתי לקבוע פגישה דרך הדף ולא הצלחתי.')} className="flex-1">
            <Button variant="ghost" className="w-full">
              דברו איתנו
            </Button>
          </a>
        </div>
      </div>
    );
  }

  if (openDays.length === 0) {
    return (
      <div className="fade-in space-y-3">
        <div className="rounded-xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
          <CalendarX size={28} className="mx-auto text-ink-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink-700">
            כל המועדים בשבועות הקרובים תפוסים
          </p>
          <p className="mt-1 text-sm text-ink-400">
            כתבו לנו בוואטסאפ ונמצא לכם מועד, גם אם הוא לא מופיע כאן.
          </p>
        </div>
        <a
          href={whatsappUrl('היי, אשמח לקבוע פגישה. לא ראיתי מועדים פנויים בדף.')}
          className="block"
        >
          <Button variant="secondary" className="w-full">
            לקביעת מועד בוואטסאפ
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="fade-in space-y-4">
      {/* ── ימים ── */}
      <div>
        <h2 className="mb-2 text-[13px] font-semibold text-ink-700">בחרו יום</h2>
        <div
          ref={scroller}
          role="tablist"
          aria-label="ימים פנויים"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
        >
          {days.map((day) => {
            const full = day.availableCount === 0;
            const active = day.date === activeDate;
            return (
              <button
                key={day.date}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={full}
                onClick={() => setActiveDate(day.date)}
                className={`flex min-w-[76px] shrink-0 flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 transition-colors ${
                  active
                    ? 'border-ink-950 bg-ink-950 text-white'
                    : full
                      ? 'cursor-not-allowed border-ink-100 bg-ink-50 text-ink-300'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 active:bg-ink-50'
                }`}
              >
                <span className="text-[13px] font-bold">{relativeDayLabel(day.slots[0].start)}</span>
                <span className={`num text-[11px] ${active ? 'text-gold-400' : 'text-ink-400'}`}>
                  {dayMonth(day.slots[0].start)}
                </span>
                {full && <span className="text-[10px] font-semibold">מלא</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── שעות ── */}
      {activeDay && (
        <div>
          <h2 className="mb-2 text-[13px] font-semibold text-ink-700">בחרו שעה</h2>
          <div role="radiogroup" aria-label="שעות פנויות" className="grid grid-cols-3 gap-2">
            {activeDay.slots.map((slot) => {
              const chosen = slot.start === selected;
              return (
                <button
                  key={slot.start}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  disabled={!slot.available}
                  onClick={() => onSelect(slot.start)}
                  className={`flex flex-col items-center justify-center rounded-xl border py-3 transition-colors ${
                    chosen
                      ? 'border-gold-500 bg-gold-500 text-ink-950'
                      : slot.available
                        ? 'border-ink-200 bg-white text-ink-900 hover:border-gold-400 hover:bg-gold-50 active:bg-gold-100'
                        : 'cursor-not-allowed border-ink-100 bg-ink-50 text-ink-300'
                  }`}
                >
                  <span className="num text-[15px] font-bold">{time(slot.start)}</span>
                  <span
                    className={`text-[10px] ${
                      chosen ? 'text-ink-800' : slot.available ? 'text-ink-400' : 'text-ink-300'
                    }`}
                  >
                    {slot.available ? `עד ${time(slot.end)}` : 'תפוס'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">טוען מועדים פנויים</span>
      <div>
        <Skeleton className="mb-2 h-4 w-20" />
        <div className="-mx-4 flex gap-2 overflow-hidden px-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-[68px] min-w-[76px] shrink-0 rounded-xl" />
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="mb-2 h-4 w-20" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-[62px] rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
