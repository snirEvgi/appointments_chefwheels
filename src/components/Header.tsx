import { Phone } from 'lucide-react';
import { BUSINESS_NAME, BUSINESS_PHONE_DISPLAY, BUSINESS_TAGLINE, telUrl } from '../config';

/** הפס העליון — אותו שחור וזהב של המותג, ועם דרך להתקשר מכל מסך.
 *  הטלפון גלוי בכוונה: לקוח שנתקע עם הטופס צריך מוצא מיידי. */
export function Header() {
  return (
    <header className="safe-top border-b border-ink-800 bg-ink-950">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        <img
          src="/logo.png"
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-lg object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-tight font-extrabold text-gold-500">
            {BUSINESS_NAME}
          </p>
          <p className="truncate text-[11px] leading-tight text-ink-400">{BUSINESS_TAGLINE}</p>
        </div>
        <a
          href={telUrl}
          className="flex items-center gap-1.5 rounded-lg border border-ink-800 px-3 py-2 text-xs font-semibold text-ink-300 transition-colors hover:border-ink-700 hover:text-white"
        >
          <Phone size={14} aria-hidden="true" />
          <span className="num">{BUSINESS_PHONE_DISPLAY}</span>
        </a>
      </div>
    </header>
  );
}
