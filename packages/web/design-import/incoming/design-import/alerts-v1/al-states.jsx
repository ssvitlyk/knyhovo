// Knyhovo · Price Alerts (W4) — shared state-matrix & specimen building blocks
// for the Alert States · Desktop / Mobile spec pages. Exports window.ALS.
'use strict';

const ALS_AL = window.AL;
const ALS = window.ALData;
const ALSIcon = ALS.Icon;

/* ── Explicit alert state matrix ──────────────────────────────────────────
   Surface · trigger · visual treatment · underlying target_price. ── */
const ALS_MATRIX = [
  ['saved', 'Книга у бажанках, сповіщення не налаштоване', 'Дзвіночок (bell) · без чипа · «Сповістити про ціну»', 'target_price = NULL'],
  ['watch (active)', 'Сповіщення увімкнене, ціна ще не досягла цілі', 'bell-dot акцент · чип «Стежимо за ціною» · лінія цілі', 'target_price = поріг'],
  ['triggered', 'Ціна ≤ цілі (Книговик надіслав лист)', 'Зелений момент-рядок · bell-ring · чип «Ціль досягнута» · економія', 'target_price ≥ нова ціна'],
  ['paused', 'Користувач тимчасово вимкнув сповіщення', 'bell-off muted · чип «Призупинено» · «Поновіть…»', 'target_price збережено, paused'],
  ['unavailable', 'Книга out-of-stock або немає даних для стеження', 'bell-off faint (disabled) · чип «Сповіщення недоступні»', 'target_price збережено, неактивне'],
];

function StateMatrix({ compact }) {
  return (
    <div className={'al-matrix-wrap' + (compact ? ' al-matrix-wrap--compact' : '')} data-screen-label="Alert state matrix">
      <table className={'al-matrix' + (compact ? ' al-matrix--compact' : '')}>
        <thead>
          {compact
            ? <tr><th>Стан</th><th>Коли</th><th>Рішення</th></tr>
            : <tr><th>Стан</th><th>Коли</th><th>Візуальне рішення</th><th>target_price</th></tr>}
        </thead>
        <tbody>
          {ALS_MATRIX.map((r) => (
            compact
              ? <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}<br /><code>{r[3]}</code></td></tr>
              : <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td><code>{r[3]}</code></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Bell control — all five lifecycle glyphs ─────────────────────────────── */
const ALS_BELLS = [
  ['off', 'saved · без сповіщення'],
  ['watch', 'watch · активне'],
  ['trig', 'triggered · ціль досягнута'],
  ['paused', 'paused · призупинено'],
  ['unavail', 'unavailable · недоступне'],
];
function BellGallery() {
  return (
    <div className="al-spec__demo" style={{ gap: 'var(--space-6)' }}>
      {ALS_BELLS.map(([state, cap]) => (
        <span key={state} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', minWidth: 96 }}>
          <span className="al-bell-demo"><ALS_AL.Bell state={state} size={18} /></span>
          <span className="al-spec__when" style={{ textAlign: 'center' }}>{cap}</span>
        </span>
      ))}
    </div>
  );
}
function ChipGallery() {
  return (
    <div className="al-spec__demo" style={{ gap: 'var(--space-3)' }}>
      <ALS_AL.Chip state="watch" /><ALS_AL.Chip state="trig" /><ALS_AL.Chip state="paused" /><ALS_AL.Chip state="unavail" />
    </div>
  );
}

/* ── Empty states ─────────────────────────────────────────────────────────── */
function EmptyNoAlerts() {
  return (
    <div className="v1-quiet-banner" data-screen-label="Empty · no alerts">
      <ALSIcon name="bell" size={20} />
      <div>
        <p style={{ margin: 0, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>Ви ще не стежите за жодною ціною.</p>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Оберіть книгу у бажанках і ввімкніть сповіщення — Книговик підкаже, коли настане вдалий момент купувати.</p>
      </div>
    </div>
  );
}
function EmptyUnavailable() {
  return (
    <div className="v1-quiet-banner" data-screen-label="Empty · alerts unavailable">
      <ALSIcon name="clock" size={20} />
      <div>
        <p style={{ margin: 0, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>Сповіщення про ціну будуть доступні незабаром.</p>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Knyhovo ще збирає історію цін для цієї книги. Додайте її до бажанок — щойно дані з’являться, ви зможете налаштувати сповіщення.</p>
      </div>
    </div>
  );
}

/* Specimen card wrapper (caption + demo) */
function Spec({ name, when, children, col }) {
  return (
    <div className="al-spec">
      <div className="al-spec__cap">
        <span className="al-spec__name">{name}</span>
        <span className="al-spec__when">{when}</span>
      </div>
      <div className={'al-spec__demo' + (col ? ' al-spec__demo--col' : '')}>{children}</div>
    </div>
  );
}

window.ALS = {
  StateMatrix, BellGallery, ChipGallery, EmptyNoAlerts, EmptyUnavailable, Spec,
};
