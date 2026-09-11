import { Check } from 'lucide-react';

const STEPS = ['פרטים', 'מועד', 'אישור'] as const;

/** מד התקדמות בשלושה שלבים.
 *
 *  קיים כדי שהלקוח ידע כמה נשאר — טופס שלא מראה את סופו נוטש יותר.
 *  שלב שהושלם לוחץ אחורה; שלב עתידי אינו לחיץ, כי אי אפשר לבחור מועד
 *  לפני שיש שם וטלפון. */
export function Stepper({
  current,
  onJump,
}: {
  current: number;
  onJump: (step: number) => void;
}) {
  return (
    <nav aria-label="שלבי הקביעה" className="mx-auto max-w-lg px-4 pt-4">
      <ol className="flex items-center gap-2">
        {STEPS.map((label, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!done}
                onClick={() => onJump(index)}
                aria-current={active ? 'step' : undefined}
                className={`flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-right transition-colors ${
                  done ? 'cursor-pointer hover:bg-ink-100' : 'cursor-default'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                    done
                      ? 'bg-gold-500 text-ink-950'
                      : active
                        ? 'bg-ink-950 text-white'
                        : 'bg-ink-200 text-ink-400'
                  }`}
                >
                  {done ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={`truncate text-xs font-semibold ${
                    active ? 'text-ink-900' : done ? 'text-ink-600' : 'text-ink-400'
                  }`}
                >
                  {label}
                </span>
              </button>
              {index < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`h-px w-4 shrink-0 ${done ? 'bg-gold-400' : 'bg-ink-200'}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
