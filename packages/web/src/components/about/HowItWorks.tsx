import { AbIcon } from './icons';

/**
 * «Як працює Knyhovo» (`about-app.jsx` AbFlow) — 4-step user flow on the
 * green-wash band. Internal mechanics (matching, comparison, history) are
 * deliberately not steps here — they live in `Features`.
 */
interface FlowNode {
  readonly icon: string;
  readonly label: string;
  readonly cap: string;
  readonly fin?: boolean;
}

const AB_FLOW: readonly FlowNode[] = [
  { icon: 'search', label: 'Знайдіть книгу', cap: 'за назвою, автором або ISBN' },
  { icon: 'heart', label: 'Додайте її в бажанку', cap: 'за бажанням — із цільовою ціною' },
  { icon: 'refresh', label: 'Ми щодня перевіряємо ціни', cap: 'автоматично, без вашої участі' },
  { icon: 'mail', label: 'Отримайте email', cap: 'коли книгу стане вигідно купувати', fin: true },
];

export function HowItWorks(): React.JSX.Element {
  return (
    <section className="ab-flow reveal">
      <div className="ab-sechead">
        <div className="ab-eyebrow">Крок за кроком</div>
        <h2 className="ab-h2">Як працює Knyhovo</h2>
        <p className="ab-sub">Чотири кроки — від пошуку до вигідної покупки.</p>
      </div>
      <div className="ab-flow__grid">
        {AB_FLOW.map((n, i) => (
          <div className={'ab-node' + (n.fin ? ' ab-node--fin' : '')} key={n.label}>
            <div className="ab-node__top">
              <span className="ab-ic">
                <AbIcon name={n.icon} size={18} />
              </span>
              <span className="ab-node__num">{'0' + (i + 1)}</span>
            </div>
            <div className="ab-node__label">{n.label}</div>
            <div className="ab-node__cap">{n.cap}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
