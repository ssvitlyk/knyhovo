import Link from 'next/link';

/**
 * UnsubscribeConfirmation — the public unsubscribe confirmation screen.
 * Presentational only (no data fetching); the opt-out side-effect is performed
 * by the `/unsubscribe` page before this renders. Port of `NP_Unsubscribe` from
 * design-import/incoming/np-shared.jsx. The CTA is a `next/link` styled with the
 * DS `.kn-btn` classes (avoids nesting a <button> inside a link).
 */
export function UnsubscribeConfirmation(): React.JSX.Element {
  return (
    <main className="np-container np-unsub-main">
      <div className="np-unsub">
        <span className="np-unsub__icon">
          {/* IconMailOff — ported inline SVG from np-shared.jsx */}
          <svg
            width={26}
            height={26}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m2 8 9.42 5.65a2 2 0 0 0 2.16 0L22 8" />
            <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        </span>
        <h1 className="np-unsub__title">Ви відписані від усіх сповіщень</h1>
        <p className="np-unsub__text">
          Ви більше не отримуватимете email-сповіщення від Knyhovo. Якщо це сталося помилково &mdash; підписку
          можна поновити в налаштуваннях акаунту.
        </p>
        <Link href="/" className="kn-btn kn-btn--primary np-unsub-cta">
          Повернутися на головну
        </Link>
      </div>
    </main>
  );
}
