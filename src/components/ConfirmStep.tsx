import { CalendarDays, Clock, MapPin, Phone, User } from 'lucide-react';
import type { ReactNode } from 'react';
import { Banner, Button } from './ui';
import type { Details } from './DetailsStep';
import { BUSINESS_ADDRESS, hasAddress } from '../config';
import { fullDate, timeRange } from '../lib/format';

/** שלב 3 — אישור.
 *
 *  מסך קריאה בלבד לפני פעולה שנכנסת ליומן של אדם אחר. כל שורה ניתנת
 *  לתיקון בלחיצה, כדי שהתיקון לא ידרוש לחזור אחורה ולנחש איפה. */
export function ConfirmStep({
  details,
  start,
  end,
  submitting,
  error,
  onEditDetails,
  onEditSlot,
  onConfirm,
}: {
  details: Details;
  start: string;
  end: string;
  submitting: boolean;
  error: ReactNode;
  onEditDetails: () => void;
  onEditSlot: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fade-in space-y-4">
      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
        <Row
          icon={<CalendarDays size={16} aria-hidden="true" />}
          label="תאריך"
          value={fullDate(start)}
          onEdit={onEditSlot}
        />
        <Row
          icon={<Clock size={16} aria-hidden="true" />}
          label="שעה"
          value={<span className="num">{timeRange(start, end)}</span>}
          onEdit={onEditSlot}
        />
        <Row
          icon={<User size={16} aria-hidden="true" />}
          label="שם"
          value={details.name}
          onEdit={onEditDetails}
        />
        <Row
          icon={<Phone size={16} aria-hidden="true" />}
          label="טלפון"
          value={<span className="num">{details.phone}</span>}
          onEdit={onEditDetails}
        />
        {hasAddress && (
          <Row
            icon={<MapPin size={16} aria-hidden="true" />}
            label="מיקום"
            value={BUSINESS_ADDRESS}
          />
        )}
      </div>

      {details.note && (
        <div className="rounded-xl border border-ink-200 bg-white p-4">
          <p className="mb-1 text-xs font-semibold text-ink-400">מה שכתבת לנו</p>
          <p className="text-sm whitespace-pre-line text-ink-700">{details.note}</p>
        </div>
      )}

      {error && <Banner tone="error">{error}</Banner>}

      <Button
        variant="secondary"
        className="w-full"
        busy={submitting}
        onClick={onConfirm}
      >
        {submitting ? 'רושמים את הפגישה…' : 'אישור הפגישה'}
      </Button>

      <p className="text-center text-xs text-ink-400">
        לחיצה על אישור קובעת את הפגישה ביומן שלנו.
      </p>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  onEdit,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3 last:border-b-0">
      <span className="text-ink-300">{icon}</span>
      <span className="w-14 shrink-0 text-xs text-ink-400">{label}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">{value}</span>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-gold-600 transition-colors hover:bg-gold-50"
        >
          שינוי
        </button>
      )}
    </div>
  );
}
