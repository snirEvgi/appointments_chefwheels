import { BookingPage } from './pages/BookingPage';
import { CancelPage } from './pages/CancelPage';

/* ניתוב לפי פרמטרים ולא לפי נתיב, ובכוונה.
 *
 * הדף נשלח כקישור אחד בהודעת וואטסאפ. פרמטרים שורדים כל העתקה, כל
 * קיצור כתובת וכל דפדפן מוטמע; נתיב דורש תצורת שרת נכונה בכל סביבה.
 * קישור עם e ו-r הוא מסך הביטול, כל השאר הוא קביעת פגישה. */
export function App() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get('e') ?? '';
  const token = params.get('r') ?? '';

  // השם token ולא ref: ב-React 19 התכונה ref שמורה למנגנון ה-refs.
  if (eventId && token) return <CancelPage eventId={eventId} token={token} />;
  return <BookingPage />;
}
