// Knyhovo Wishlist — Variant D «Момент» (Claude's Vision).
// EXPLORATION ONLY — not approved for implementation.
// Philosophy: книги чекають свого моменту — а Knyhovyk його підказує.
// Rethinks terminology (полиця очікування), grouping (за готовністю до купівлі,
// не за жанром), emotional framing (порада друга, не дашборд метрик) і додає
// три підписні механіки: вердикт моменту, недільний лист, лічильник заощаджень.

const WLD = window.WL;

/* Verdict — Knyhovyk's advice per book. Composed from the frozen Badge tones only.
   In D the verdict REPLACES the generic item badge (still max one strong signal per row). */
const WLD_VERDICTS = {
  now: { tone: 'green', label: 'Чудовий момент' },
  wait: { tone: 'neutral', label: 'Зачекайте' },
  high: { tone: 'blue', label: 'Ціна висока' },
  data: { tone: 'neutral', label: 'Збираємо дані' },
  out: { tone: 'neutral', label: 'Очікуємо наявності' },
};
function WLDVerdict({ item }) {
  const { Badge } = WLD.DS;
  const v = WLD_VERDICTS[item.verdict] || WLD_VERDICTS.wait;
  return <span className="wl-verdict"><Badge tone={v.tone}>{v.label}</Badge></span>;
}

/* Verdict reason — one honest line of evidence under the title. */
function wldReason(item) {
  if (item.verdict === 'now') {
    return item.targetMet
      ? 'Ціна ' + WLD.uah(item.price) + ' — нижча за вашу ціль ' + WLD.uah(item.target)
      : 'Найнижча ціна за пів року спостережень';
  }
  if (item.verdict === 'high') return 'Ціна зросла на ' + Math.abs(WLD.delta(item)) + ' ₴ — такі сплески зазвичай минають';
  if (item.verdict === 'data') return 'Додано сьогодні · перший звіт про ціни — завтра о 08:00';
  if (item.verdict === 'out') return 'Немає в жодній із 5 книгарень · повідомимо про появу';
  return 'Ціна стабільна · купувати не горить';
}

function WLDRow({ item, front }) {
  const { Button } = WLD.DS;
  return (
    <div className={'wl-row' + (front ? ' wl-row--hot' : '') + (item.avail === 'out' ? ' wl-row--out' : '')}>
      <span className="wl-cover"></span>
      <span className="wl-row__main">
        <span className="wl-row__title">{item.title}</span>
        <span className="wl-row__author">{item.author}</span>
        <span className="wl-row__badges">
          <WLDVerdict item={item} />
          <span className="wl-statline"><span>{wldReason(item)}</span></span>
        </span>
      </span>
      <WLD.PriceStack item={item} big={front} />
      {front
        ? <Button variant="primary" size="md">Перейти до книгарні</Button>
        : <WLD.Actions item={item} compact />}
    </div>
  );
}

function wldGroups(items) {
  return {
    ready: items.filter((i) => i.verdict === 'now'),
    waiting: items.filter((i) => i.verdict === 'wait' || i.verdict === 'high'),
    meeting: items.filter((i) => i.verdict === 'data' || i.verdict === 'out'),
  };
}

function WLDLetter({ items, compact }) {
  const { Button } = WLD.DS;
  const ready = wldGroups(items).ready;
  return (
    <div className="wld-letter" data-screen-label="Недільний лист" style={compact ? { padding: 'var(--space-5)' } : null}>
      <p className="wld-letter__eyebrow">НЕДІЛЬНИЙ ЛИСТ · ЩОТИЖНЯ У ВАШІЙ СКРИНЬЦІ</p>
      <p className="wld-letter__text">
        {ready.length
          ? <span>Цього тижня «Відьмак» нарешті подешевшав до 240 ₴ — найнижча ціна за пів року. <em>Гарний момент.</em> Решта полиці спокійно чекає свого.</span>
          : <span>Тихий тиждень: ціни на вашій полиці стабільні. <em>Жодного приводу поспішати.</em> Ми пильнуємо далі — щодня о 08:00.</span>}
      </p>
      <p className="wld-letter__sig">— Knyhovyk</p>
      <div className="wld-letter__actions">
        {ready.length ? <Button variant="primary" size="sm">Переглянути готові</Button> : null}
        <Button variant="secondary" size="sm">Налаштувати лист</Button>
      </div>
    </div>
  );
}

function VariantMoment({ theme, items }) {
  const { Button } = WLD.DS;
  const g = wldGroups(items);
  return (
    <WLD.Shell theme={theme} label={'Variant D · ' + theme} crumbTail="Полиця очікування">
      <div className="wl-head" data-screen-label="Page head">
        <div className="wl-head__main">
          <p className="wl-eyebrow">ПОЛИЦЯ ОЧІКУВАННЯ · {items.length} КНИГ · ПЕРЕВІРЕНО СЬОГОДНІ О 08:00</p>
          <h1 className="wl-h1">Коли купувати? <em>Knyhovo знає момент.</em></h1>
          <p className="wl-sub">Кожна збережена книга отримує пораду: купуйте зараз — або зачекайте. Без поспіху, без пропущених знижок.</p>
        </div>
        <div className="wl-head__aside">
          <span className="wld-saved">Заощаджено з Knyhovo: <b>412 ₴</b></span>
          <span className="wl-checked">за 4 покупки у вдалий момент</span>
        </div>
      </div>

      <section className="wld-front" data-screen-label="Готові до купівлі">
        <div className="wld-front__head">
          <h2 className="wl-group__title">Готові до купівлі</h2>
          <span className="wl-group__count">{g.ready.length}</span>
        </div>
        {g.ready.length ? (
          <div className="wl-rows">
            {g.ready.map((i) => <WLDRow key={i.id} item={i} front />)}
          </div>
        ) : (
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: 0 }}>
            Поки що жодна книга не дочекалась свого моменту. Щойно дочекається — вона з’явиться тут, а ми напишемо.
          </p>
        )}
      </section>

      <section className="wl-group" data-screen-label="Чекають моменту">
        <div className="wl-group__head">
          <h2 className="wl-group__title">Чекають свого моменту</h2>
          <span className="wl-group__count">{g.waiting.length}</span>
          <Button variant="ghost" size="sm">За порадою <WLD.Icon name="chevron-down" size={14} /></Button>
        </div>
        <div className="wl-rows">
          {g.waiting.map((i) => <WLDRow key={i.id} item={i} />)}
        </div>
      </section>

      <section className="wl-group" data-screen-label="Знайомимось">
        <div className="wl-group__head">
          <h2 className="wl-group__title">Знайомимось</h2>
          <span className="wl-group__count">{g.meeting.length}</span>
        </div>
        <div className="wl-rows">
          {g.meeting.map((i) => <WLDRow key={i.id} item={i} />)}
        </div>
      </section>

      <section className="wl-group" data-screen-label="Weekly letter">
        <WLDLetter items={items} />
      </section>
    </WLD.Shell>
  );
}

/* ---------------- Mobile (<768px) — front-shelf rail + verdict groups ---------------- */
function WLDMobileFrontCard({ item }) {
  const { Button } = WLD.DS;
  return (
    <div className="wlm-card wlm-card--open" style={{ borderColor: 'color-mix(in oklab, var(--accent) 45%, var(--border))' }}>
      <div className="wlm-card__top">
        <span className="wlm-cover"></span>
        <span className="wlm-card__main">
          <span className="wlm-title">{item.title}</span>
          <span className="wl-row__author">{item.author}</span>
          <span style={{ marginTop: 2 }}><WLDVerdict item={item} /></span>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', margin: 'var(--space-3) 0' }}>
        <span className="wl-old">{WLD.uah(item.prev)}</span>
        <span className="wlm-price" style={{ fontSize: '1.5rem' }}>{WLD.uah(item.price)}</span>
        <span className="wl-store" style={{ marginLeft: 'auto' }}>{item.store}</span>
      </div>
      <WLD.DS.Button variant="primary" size="md" style={{ width: '100%' }}>Перейти до книгарні</WLD.DS.Button>
    </div>
  );
}

function WLDMobileRow({ item }) {
  return (
    <div className="wlm-card">
      <div className="wlm-card__top">
        <span className="wlm-cover"></span>
        <span className="wlm-card__main">
          <span className="wlm-title">{item.title}</span>
          <span style={{ marginTop: 2 }}><WLDVerdict item={item} /></span>
        </span>
        <span className="wl-pricestack">
          {item.price != null
            ? <span className="wlm-price">{WLD.uah(item.price)}</span>
            : <span className="wlm-price wlm-price--faint">—</span>}
        </span>
      </div>
    </div>
  );
}

function VariantMomentMobile({ theme, items }) {
  const g = wldGroups(items);
  return (
    <WLMShell theme={theme} label="Variant D · mobile">
      <p className="wl-eyebrow">ПОЛИЦЯ ОЧІКУВАННЯ · {items.length} КНИГ</p>
      <h1 className="wl-h1" style={{ marginBottom: 'var(--space-1)' }}>Момент</h1>
      <p className="wld-saved" style={{ marginBottom: 'var(--space-4)' }}>Заощаджено: <b>412 ₴</b></p>

      <div className="wl-group__head" style={{ marginBottom: 'var(--space-3)' }}>
        <h2 className="wl-group__title" style={{ fontSize: 'var(--fs-body)' }}>Готові до купівлі</h2>
        <span className="wl-group__count">{g.ready.length}</span>
      </div>
      {g.ready.length ? (
        <div className="wlm-rail" data-screen-label="Front shelf rail">
          {g.ready.map((i) => <WLDMobileFrontCard key={i.id} item={i} />)}
        </div>
      ) : (
        <div className="wl-hint" style={{ marginBottom: 'var(--space-4)' }}>
          <WLD.Icon name="info" size={16} /><span>Поки що жодна книга не дочекалась моменту — пильнуємо.</span>
        </div>
      )}

      <div className="wl-group__head" style={{ margin: 'var(--space-5) 0 var(--space-3)' }}>
        <h2 className="wl-group__title" style={{ fontSize: 'var(--fs-body)' }}>Чекають свого моменту</h2>
        <span className="wl-group__count">{g.waiting.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {g.waiting.map((i) => <WLDMobileRow key={i.id} item={i} />)}
      </div>

      <div className="wl-group__head" style={{ margin: 'var(--space-5) 0 var(--space-3)' }}>
        <h2 className="wl-group__title" style={{ fontSize: 'var(--fs-body)' }}>Знайомимось</h2>
        <span className="wl-group__count">{g.meeting.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {g.meeting.map((i) => <WLDMobileRow key={i.id} item={i} />)}
      </div>

      <div style={{ marginTop: 'var(--space-6)' }}>
        <WLDLetter items={items} compact />
      </div>
    </WLMShell>
  );
}

window.WLVariantD = { VariantMoment, VariantMomentMobile, WLDVerdict };
