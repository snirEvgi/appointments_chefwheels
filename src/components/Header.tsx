import { BUSINESS_NAME, BUSINESS_TAGLINE } from '../config';

/** הפס העליון — הלוגו והשם, בשחור והזהב של המותג.
 *
 *  מספר הטלפון אינו מוצג כאן במכוון. הדף פתוח לכל מי שמחזיק בקישור,
 *  ומספר גלוי בראש כל מסך הוא בדיוק מה שסורקים אוטומטיים אוספים.
 *  הדרך ליצור קשר נשארת בכפתורי הוואטסאפ, בנקודות שבהן הלקוח באמת
 *  צריך אותה. */
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
        <span className="shrink-0 rounded-lg border border-ink-800 px-3 py-1.5 text-[11px] font-semibold text-ink-400">
          קביעת פגישה
        </span>
      </div>
    </header>
  );
}
