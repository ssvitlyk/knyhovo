import { AbIcon } from './icons';

/**
 * Hero (`about-app.jsx` AbHero) — variant «Момент» (frozen default), perks
 * row always shown (`heroPerks: true` default in the mock's Tweaks panel).
 */
const AB_PERKS = [
  { icon: 'clock', label: 'Щоденне оновлення цін' },
  { icon: 'trendup', label: 'Історія зміни ціни' },
  { icon: 'store', label: 'Усі книгарні в одному місці' },
] as const;

export function AboutHero(): React.JSX.Element {
  return (
    <section className="ab-hero reveal">
      <div className="ab-eyebrow">Про Knyhovo</div>
      <h1 className="ab-hero__title">
        Купуйте книги <em>у правильний момент</em>.
      </h1>
      <p className="ab-sub ab-hero__sub">
        Knyhovo стежить за цінами на книги й підказує, де та коли купити найвигідніше.
      </p>
      <div className="ab-hero__perks">
        {AB_PERKS.map((p) => (
          <span className="ab-perk" key={p.label}>
            <AbIcon name={p.icon} size={17} />
            {p.label}
          </span>
        ))}
      </div>
    </section>
  );
}
