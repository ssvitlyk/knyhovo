// Knyhovo · Wishlist Verdicts + Savings (W3) — canvas.
// Verdict v2 anatomy + in-context rows/cards + savings visualization.
'use strict';

const VC_DS = window.KnyhovoDesignSystem_9fa616;
const { VerdictBlock, VerdictBadge, SavingsStack, WLRow, WLMobCard, WLShell } = window.PHV;
const VC = window.PHData;

/* ── Anatomy / rationale doc ─────────────────────────────────────────────── */
function AnatomyDoc({ theme }) {
  const order = ['now', 'wait', 'high'];
  return (
    <div className="v1-doc-page" data-theme={theme} data-screen-label={'Anatomy · ' + theme}>
      <div className="v1-doc-wrap">
        <p className="v1-eyebrow">БАЖАНКИ · ВЕРДИКТИ ТА ЗАОЩАДЖЕННЯ · W3 PRICE HISTORY</p>
        <h1 className="v1-doc-h1">Що Книговик радить — і чому</h1>
        <p className="v1-doc-lead">
          Три вердикти спираються на історію цін. Кожен — це <b>іконка + заголовок + коротке пояснення</b> з історичним
          контекстом. Колір лише підсилює: форму іконки та текст видно і без кольору, тож вердикти безпечні для дальтоніків.
        </p>

        <h2 className="v1-doc-h2">Три вердикти</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
          {order.map((k) => <VerdictBlock key={k} verdict={k} />)}
        </div>

        <h2 className="v1-doc-h2">Специфікація</h2>
        <div className="v1-doc-anno" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-5)' }}>
          {order.map((k) => {
            const v = VC.VERDICTS[k];
            return (
              <div className="v1-spec-row" key={k}>
                <span className="v1-spec-label">{v.en}</span>
                <span className="v1-spec-val">
                  Іконка <code>{v.icon}</code> · тон <code>{v.tone}</code> · «{v.label}» — {v.text}
                </span>
              </div>
            );
          })}
        </div>

        <h2 className="v1-doc-h2">Безпечно для дальтоніків</h2>
        <ul className="v1-doc-ul">
          <li><b>Форма іконки</b> розрізняє вердикти: ↘ падіння · — стабільно · ↗ зростання.</li>
          <li><b>Текст і заголовок</b> завжди присутні — сенс читається без кольору.</li>
          <li><b>Позиція</b> у рядку стала: вердикт ліворуч від ціни, у тому самому місці.</li>
          <li><b>Червоного немає.</b> Висока ціна — інформативний синій, а не сигнал тривоги.</li>
        </ul>

        <h2 className="v1-doc-h2">Зелена ієрархія (frozen)</h2>
        <div className="v1-doc-anno" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-5)' }}>
          <div className="v1-spec-row"><span className="v1-spec-label">Найсильніший зелений</span><span className="v1-spec-val">лише «Чудовий момент» — ціна нижча за звичайну.</span></div>
          <div className="v1-spec-row"><span className="v1-spec-label">Помірний зелений</span><span className="v1-spec-val">значення заощадження («Економія 80 ₴»).</span></div>
          <div className="v1-spec-row"><span className="v1-spec-label">Нейтральні тони</span><span className="v1-spec-val">звичайні ціни та стан «Зачекайте».</span></div>
          <div className="v1-spec-row"><span className="v1-spec-label">Синій (інформативний)</span><span className="v1-spec-val">«Ціна висока» — без червоного, без тривоги.</span></div>
        </div>

        <h2 className="v1-doc-h2">Візуалізація заощадження</h2>
        <p className="v1-doc-lead" style={{ margin: '0 0 var(--space-5)' }}>
          Стримана, без e-commerce-тиску. Стара ціна — приглушений закреслений текст; поточна — серифна, помірний зелений;
          рядок «Економія» — помірний зелений. Жодних «−25%!», «найкраща ціна назавжди» чи терміновості.
        </p>
        <div className="phv-spec-grid">
          <div className="phv-spec-card">
            <h4>Заощадження — три рядки</h4>
            <SavingsStack item={VC.WL_ITEMS[0]} align="left" />
          </div>
          <div className="phv-spec-card">
            <h4>Стабільна ціна — без заощадження</h4>
            <span className="wl-pricestack" style={{ alignItems: 'flex-start' }}>
              <span className="wl-pricerow"><span className="wl-price">245 ₴</span></span>
              <span className="wl-store">Yakaboo · ціна стабільна</span>
            </span>
          </div>
          <div className="phv-spec-card">
            <h4>Ціна зросла — інформативно</h4>
            <span className="wl-pricestack" style={{ alignItems: 'flex-start' }}>
              <span className="wl-delta wl-delta--up"><VC.Icon name="trending-up" size={14} />+25 ₴</span>
              <span className="wl-pricerow"><span className="wl-price">335 ₴</span></span>
              <span className="wl-store">Rozetka · вище за звичне</span>
            </span>
          </div>
        </div>

        <div className="v1-doc-stamp">
          <p className="v1-eyebrow" style={{ margin: 0 }}>W3 EXTENSION · НЕ ЗМІНЮЄ FROZEN-МАКЕТИ</p>
          <p style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-body)' }}>
            Вердикти й заощадження живуть у наявних колонках рядка Бажанок — висота рядка та сітка не змінюються.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Desktop — verdicts in real wishlist rows ────────────────────────────── */
function DeskInContext({ theme }) {
  return (
    <WLShell theme={theme} label={'Бажанки · вердикти · ' + theme}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">БАЖАНКИ · 3 КНИГИ · ПЕРЕВІРЕНО СЬОГОДНІ О 08:00</p>
          <h1 className="v1-h1">Бажанки, за якими стежить <em>Книговик</em>.</h1>
          <p className="v1-sub">Кожен рядок несе вердикт на основі історії цін — Книговик підказує, коли купувати.</p>
        </div>
      </div>
      <div className="v1-single">
        <div className="v1-rows">
          {VC.WL_ITEMS.map((i) => <WLRow key={i.id} item={i} />)}
        </div>
      </div>
    </WLShell>
  );
}

/* ── Mobile — verdicts in accordion cards ────────────────────────────────── */
function MobInContext({ theme }) {
  return (
    <WLShell theme={theme} label={'Бажанки · вердикти · mobile · ' + theme} mobile>
      <div style={{ padding: 'var(--space-5) 0 var(--space-3)' }}>
        <p className="v1-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>БАЖАНКИ · 3 КНИГИ</p>
        <h1 className="v1-h1 v1-h1--mob">Бажанки, за якими стежить <em>Книговик</em>.</h1>
      </div>
      <div className="hy-mcards">
        {VC.WL_ITEMS.map((i, idx) => <WLMobCard key={i.id} item={i} defaultOpen={idx === 0} />)}
      </div>
    </WLShell>
  );
}

function VerdictsCanvas() {
  return (
    <DesignCanvas>
      <DCSection id="anatomy" title="Вердикти та заощадження — анатомія й правила"
        subtitle="Три вердикти · колір-незалежність · зелена ієрархія · візуалізація заощадження · обидві теми">
        <DCArtboard id="anat-light" label="Анатомія · Світла" width={1180} height={1620}>
          <AnatomyDoc theme="light" />
        </DCArtboard>
        <DCArtboard id="anat-dark" label="Анатомія · Темна" width={1180} height={1620}>
          <AnatomyDoc theme="dark" />
        </DCArtboard>
      </DCSection>

      <DCSection id="desk" title="Вердикти у рядках Бажанок — Desktop"
        subtitle="Чудовий момент (із заощадженням) · Зачекайте · Ціна висока · висота рядка не змінюється">
        <DCArtboard id="desk-light" label="Desktop · Світла" width={1440} height={760}>
          <DeskInContext theme="light" />
        </DCArtboard>
        <DCArtboard id="desk-dark" label="Desktop · Темна" width={1440} height={760}>
          <DeskInContext theme="dark" />
        </DCArtboard>
      </DCSection>

      <DCSection id="mob" title="Вердикти у картках — Mobile"
        subtitle="Accordion · вердикт у згорнутому стані · заощадження читається без розкриття">
        <DCArtboard id="mob-light" label="Mobile · Світла" width={390} height={1080}>
          <MobInContext theme="light" />
        </DCArtboard>
        <DCArtboard id="mob-dark" label="Mobile · Темна" width={390} height={1080}>
          <MobInContext theme="dark" />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('vc-root')).render(<VerdictsCanvas />);
