import { AbIcon } from './icons';

/**
 * «Чому користуються Knyhovo» (`about-app.jsx` AbWhy) — 3 advantages, no
 * freshness pill (removed per 2026-07-19 brief).
 */
const AB_WHY = [
  { icon: 'search', title: 'Один пошук замість десятків вкладок', text: 'Усі книгарні — в одній видачі.' },
  { icon: 'tag', title: 'Найкраща актуальна ціна', text: 'Одразу видно, де зараз найдешевше.' },
  { icon: 'scale', title: 'Чесне ранжування', text: 'Пропозиції впорядковані лише за вигідністю.' },
] as const;

export function WhyKnyhovo(): React.JSX.Element {
  return (
    <section className="ab-sec reveal">
      <div className="ab-sechead--left">
        <div className="ab-eyebrow">Переваги</div>
        <h2 className="ab-h2">Чому користуються Knyhovo</h2>
      </div>
      <div className="ab-why__grid">
        {AB_WHY.map((t) => (
          <div className="ab-wcard" key={t.title}>
            <span className="ab-ic">
              <AbIcon name={t.icon} size={19} />
            </span>
            <h3 className="ab-wcard__title">{t.title}</h3>
            <p className="ab-wcard__text">{t.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
