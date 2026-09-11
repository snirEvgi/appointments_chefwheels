import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button, Field } from './ui';
import { formatPhone, isValidPhone, phoneProblem } from '../lib/phone';

export interface Details {
  name: string;
  phone: string;
  note: string;
  /** מלכודת דבש. נשאר ריק אצל בן אדם. */
  company: string;
}

/** שלב 1 — שם וטלפון.
 *
 *  שני שדות חובה ולא יותר. כל שדה נוסף הוא לקוח שנוטש, וגם ככה השיחה
 *  הראשונה תתחיל בוואטסאפ. ההערה קיימת כי היא חוסכת לבעל העסק שאלה
 *  פתיחה, אבל היא מפורשות לא חובה. */
export function DetailsStep({
  value,
  onChange,
  onNext,
}: {
  value: Details;
  onChange: (next: Details) => void;
  onNext: () => void;
}) {
  const [touched, setTouched] = useState({ name: false, phone: false });

  const nameError = touched.name && value.name.trim().length < 2 ? 'נא למלא שם מלא.' : '';
  const phoneError = touched.phone ? phoneProblem(value.phone) : '';
  const ready = value.name.trim().length >= 2 && isValidPhone(value.phone);

  function submit() {
    setTouched({ name: true, phone: true });
    if (ready) onNext();
  }

  return (
    <form
      className="fade-in space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Field
        id="name"
        label="שם מלא"
        placeholder="ישראל ישראלי"
        autoComplete="name"
        enterKeyHint="next"
        value={value.name}
        error={nameError}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
        onBlur={() => setTouched((t) => ({ ...t, name: true }))}
      />

      <Field
        id="phone"
        label="טלפון נייד"
        placeholder="050-000-0000"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        enterKeyHint="next"
        dir="ltr"
        className="num text-right"
        value={value.phone}
        error={phoneError}
        hint="כדי שנוכל לאשר ולעדכן אם משהו משתנה."
        onChange={(event) => onChange({ ...value, phone: formatPhone(event.target.value) })}
        onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
      />

      <label className="block" htmlFor="note">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-700">
          במה אתה מתעניין?{' '}
          <span className="font-normal text-ink-400">(לא חובה)</span>
        </span>
        <textarea
          id="note"
          rows={3}
          maxLength={300}
          placeholder="פודטראק, מטבח מקצועי, שדרוג לקראת אירוע…"
          value={value.note}
          onChange={(event) => onChange({ ...value, note: event.target.value })}
          className="w-full resize-none rounded-lg border border-ink-200 bg-white px-3.5 py-3 text-[15px] text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-gold-500 focus:ring-2 focus:ring-gold-100"
        />
        <span className="mt-1.5 block text-xs text-ink-400">
          נגיע לפגישה מוכנים עם מה שרלוונטי לך.
        </span>
      </label>

      {/* מלכודת דבש: מוסתרת מבני אדם ומקוראי מסך, גלויה לבוטים שממלאים
          כל שדה שהם מוצאים. השרת פוסל כל בקשה שהשדה הזה מלא בה. */}
      <div className="absolute h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="company">חברה</label>
        <input
          id="company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={value.company}
          onChange={(event) => onChange({ ...value, company: event.target.value })}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        icon={<ArrowLeft size={17} aria-hidden="true" />}
      >
        בחירת מועד
      </Button>
    </form>
  );
}
