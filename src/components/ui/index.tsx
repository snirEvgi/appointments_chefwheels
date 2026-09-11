import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

/* אותה מערכת רכיבים כמו במערכת הצעות המחיר של העסק, כדי ששני הדפים
 * ייראו כמו מקום אחד. ההבדל היחיד: כאן הכפתורים גדולים יותר, כי זה
 * דף שנפתח מהטלפון ולרוב בדפדפן המוטמע של וואטסאפ. */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink-950 text-white hover:bg-ink-800 active:bg-ink-700 disabled:bg-ink-300',
  secondary: 'bg-gold-500 text-ink-950 hover:bg-gold-400 active:bg-gold-600 disabled:bg-gold-100',
  ghost:
    'bg-white text-ink-700 border border-ink-200 hover:bg-ink-50 hover:border-ink-300 active:bg-ink-100',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50 active:bg-red-100',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  busy?: boolean;
}

export function Button({
  variant = 'ghost',
  icon,
  busy = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-3 text-[15px] font-semibold transition-colors select-none disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {busy ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function Field({ label, hint, error, className = '', id, ...rest }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-700">{label}</span>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full rounded-lg border bg-white px-3.5 py-3 text-[15px] text-ink-900 outline-none transition-colors placeholder:text-ink-300 ${
          error
            ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
            : 'border-ink-200 focus:border-gold-500 focus:ring-2 focus:ring-gold-100'
        } ${className}`}
        {...rest}
      />
      {error ? (
        <span id={`${id}-error`} role="alert" className="mt-1.5 block text-xs font-medium text-red-600">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="mt-1.5 block text-xs text-ink-400">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-ink-200 bg-white ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          {title && <h2 className="text-sm font-bold text-ink-900">{title}</h2>}
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Banner({
  tone = 'warn',
  children,
}: {
  tone?: 'warn' | 'error' | 'info' | 'success';
  children: ReactNode;
}) {
  const tones = {
    warn: 'border-gold-300 bg-gold-50 text-ink-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-ink-200 bg-ink-50 text-ink-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

/** שלד טעינה. עדיף על ספינר כי הוא תופס מראש את המקום של התוכן,
 *  והמעבר מטעינה לתוכן אינו קופץ. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`shimmer rounded-lg bg-ink-100 ${className}`} />;
}
