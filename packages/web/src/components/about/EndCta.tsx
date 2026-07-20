import Link from 'next/link';
import { AbIcon } from './icons';

/**
 * Final CTA (`about-app.jsx` AbEndCta) — theme-swapped mascot (lupa/lantern)
 * via CSS `--light`/`--dark` classes, never JS theme reads.
 */
export function EndCta(): React.JSX.Element {
  return (
    <section className="ab-endcta reveal">
      <div className="ab-endcta__panel">
        <img className="ab-endcta__mascot ab-endcta__mascot--light" src="/mascot/mascot-magnifier.png" alt="" />
        <img className="ab-endcta__mascot ab-endcta__mascot--dark" src="/mascot/mascot-lantern.png" alt="" />
        <h2 className="ab-endcta__title">
          Знайдіть книгу, яку <em>давно хотіли</em>.
        </h2>
        <p className="ab-endcta__sub">Пошук і порівняння цін — безкоштовно, без реєстрації.</p>
        <Link className="kn-btn kn-btn--primary kn-btn--lg ab-endcta__btn" href="/">
          Почати пошук
          <AbIcon name="arrowright" size={16} />
        </Link>
      </div>
    </section>
  );
}
