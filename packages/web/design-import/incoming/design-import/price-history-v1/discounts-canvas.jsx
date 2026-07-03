// Knyhovo · «Книги зі знижками» (Discounts) section (W3) — canvas.
// Extends the frozen green discounts section with empty / populated / loading.
'use strict';

const DC_DS = window.KnyhovoDesignSystem_9fa616;
const { WLRow, WLMobCard, WLSkRow, WLSkCard, WLShell } = window.PHV;
const DCD = window.PHData;
const DC_REST = DCD.WL_ITEMS.filter((i) => i.verdict !== 'now'); // wait + high

/* ── Section heads ───────────────────────────────────────────────────────── */
function FrontHead({ count, mobile }) {
  return (
    <div className={'hy-group-head' + (mobile ? ' hy-group-head--mob' : '')}>
      <h2 className="hy-group-title">Книги зі знижками</h2>
      <span className="hy-group-count">{count}</span>
    </div>
  );
}

/* ── Populated ───────────────────────────────────────────────────────────── */
function DiscountsPopulated({ theme, mobile }) {
  const disc = DCD.DISCOUNT_ITEMS;
  if (mobile) {
    return (
      <WLShell theme={theme} label={'Знижки · populated · mobile · ' + theme} mobile>
        <div style={{ padding: 'var(--space-5) 0 var(--space-2)' }}>
          <p className="v1-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>БАЖАНКИ · ПЕРЕВІРЕНО О 08:00</p>
          <h1 className="v1-h1 v1-h1--mob">Бажанки, за якими стежить <em>Книговик</em>.</h1>
        </div>
        <section className="hy-front" style={{ padding: 'var(--space-4)' }}>
          <FrontHead count={disc.length} mobile />
          <div className="hy-mcards">
            {disc.map((i, idx) => <WLMobCard key={i.id} item={i} defaultOpen={idx === 0} />)}
          </div>
        </section>
        <div className="hy-group">
          <div className="hy-group-head hy-group-head--mob"><h2 className="hy-group-title">Інші бажанки</h2><span className="hy-group-count">{DC_REST.length}</span></div>
          <div className="hy-mcards">{DC_REST.map((i) => <WLMobCard key={i.id} item={i} />)}</div>
        </div>
      </WLShell>
    );
  }
  return (
    <WLShell theme={theme} label={'Знижки · populated · ' + theme}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">БАЖАНКИ · ПЕРЕВІРЕНО СЬОГОДНІ О 08:00</p>
          <h1 className="v1-h1">Бажанки, за якими стежить <em>Книговик</em>.</h1>
          <p className="v1-sub">Книги, що подешевшали, Книговик автоматично піднімає нагору — їх не треба шукати у списку.</p>
        </div>
      </div>
      <div className="v1-single">
        <section className="hy-front">
          <FrontHead count={disc.length} />
          <div className="v1-rows">{disc.map((i) => <WLRow key={i.id} item={i} />)}</div>
        </section>
        <section className="hy-group">
          <div className="hy-group-head"><h2 className="hy-group-title">Інші бажанки</h2><span className="hy-group-count">{DC_REST.length}</span></div>
          <div className="v1-rows">{DC_REST.map((i) => <WLRow key={i.id} item={i} />)}</div>
        </section>
      </div>
    </WLShell>
  );
}

/* ── Empty — explains the daily 08:00 check ──────────────────────────────── */
function DiscountsEmptyInner({ mobile }) {
  return (
    <section className={'hy-front'} style={mobile ? { padding: 'var(--space-4)' } : null}>
      <FrontHead count={0} mobile={mobile} />
      <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
        <span style={{
          width: 40, height: 40, flex: 'none', borderRadius: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'color-mix(in oklab, var(--brand-green) 14%, transparent)', color: 'var(--brand-green)',
        }}><DCD.Icon name="trending-down" size={20} /></span>
        <p className="hy-front-empty" style={{ maxWidth: '60ch' }}>
          Сьогодні знижок немає. Knyhovo щодня о 08:00 перевіряє ціни у 5 книгарнях — щойно якась
          із ваших бажанок подешевшає, Книговик підніме її сюди й підкаже, що настав вдалий момент.
        </p>
      </div>
    </section>
  );
}
function DiscountsEmpty({ theme, mobile }) {
  return (
    <WLShell theme={theme} label={'Знижки · empty · ' + (mobile ? 'mobile · ' : '') + theme} mobile={mobile}>
      {mobile
        ? <div style={{ padding: 'var(--space-5) 0 var(--space-2)' }}>
            <p className="v1-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>БАЖАНКИ · ПЕРЕВІРЕНО О 08:00</p>
            <h1 className="v1-h1 v1-h1--mob">Бажанки, за якими стежить <em>Книговик</em>.</h1>
          </div>
        : <div className="v1-page-head"><div className="v1-page-head-left">
            <p className="v1-eyebrow">БАЖАНКИ · ПЕРЕВІРЕНО СЬОГОДНІ О 08:00</p>
            <h1 className="v1-h1">Бажанки, за якими стежить <em>Книговик</em>.</h1>
          </div></div>}
      <div className="v1-single"><DiscountsEmptyInner mobile={mobile} /></div>
    </WLShell>
  );
}

/* ── Loading skeleton (warm neutral frame) ───────────────────────────────── */
function DiscountsLoading({ theme, mobile }) {
  return (
    <WLShell theme={theme} label={'Знижки · loading · ' + (mobile ? 'mobile · ' : '') + theme} mobile={mobile}>
      {mobile
        ? <div style={{ padding: 'var(--space-5) 0 var(--space-2)' }}>
            <span className="v1-sk-block" style={{ width: 120, height: 11, display: 'block', marginBottom: 10 }}></span>
            <span className="v1-sk-block" style={{ width: '85%', height: 24, display: 'block' }}></span>
          </div>
        : <div className="v1-page-head"><div className="v1-page-head-left">
            <span className="v1-sk-block" style={{ width: 240, height: 12, display: 'block', marginBottom: 12 }}></span>
            <span className="v1-sk-block" style={{ width: 460, height: 34, display: 'block' }}></span>
          </div></div>}
      <div className="v1-single">
        <section className="hy-front hy-front--sk" aria-busy="true" style={mobile ? { padding: 'var(--space-4)' } : null}>
          <div className={'hy-group-head' + (mobile ? ' hy-group-head--mob' : '')}>
            <span className="v1-sk-block" style={{ width: 180, height: mobile ? 16 : 20 }}></span>
            <span className="v1-sk-block" style={{ width: 18, height: 14 }}></span>
          </div>
          {mobile
            ? <div className="hy-mcards">{[0, 1].map((i) => <WLSkCard key={i} />)}</div>
            : <div className="v1-rows">{[0, 1].map((i) => <WLSkRow key={i} />)}</div>}
        </section>
      </div>
    </WLShell>
  );
}

function DiscountsCanvas() {
  return (
    <DesignCanvas>
      <DCSection id="populated" title="«Книги зі знижками» — заповнено"
        subtitle="Повторно використовує рядки/картки Бажанок · знижки автопідняті нагору · «Економія N ₴» · обидві теми">
        <DCArtboard id="pop-d-light" label="Desktop · Світла" width={1440} height={840}>
          <DiscountsPopulated theme="light" />
        </DCArtboard>
        <DCArtboard id="pop-d-dark" label="Desktop · Темна" width={1440} height={840}>
          <DiscountsPopulated theme="dark" />
        </DCArtboard>
        <DCArtboard id="pop-m-light" label="Mobile · Світла" width={390} height={1180}>
          <DiscountsPopulated theme="light" mobile />
        </DCArtboard>
        <DCArtboard id="pop-m-dark" label="Mobile · Темна" width={390} height={1180}>
          <DiscountsPopulated theme="dark" mobile />
        </DCArtboard>
      </DCSection>

      <DCSection id="empty" title="Порожній стан — пояснює щоденну перевірку"
        subtitle="Книговик перевіряє ціни щодня о 08:00 · без mascot (це підсекція, не порожня сторінка)">
        <DCArtboard id="emp-d-light" label="Desktop · Світла" width={1440} height={520}>
          <DiscountsEmpty theme="light" />
        </DCArtboard>
        <DCArtboard id="emp-d-dark" label="Desktop · Темна" width={1440} height={520}>
          <DiscountsEmpty theme="dark" />
        </DCArtboard>
        <DCArtboard id="emp-m-light" label="Mobile · Світла" width={390} height={620}>
          <DiscountsEmpty theme="light" mobile />
        </DCArtboard>
        <DCArtboard id="emp-m-dark" label="Mobile · Темна" width={390} height={620}>
          <DiscountsEmpty theme="dark" mobile />
        </DCArtboard>
      </DCSection>

      <DCSection id="loading" title="Завантаження — теплі skeleton-блоки"
        subtitle="Warm --surface-accent · ніколи холодний сірий · нейтральна рамка секції">
        <DCArtboard id="load-d-light" label="Desktop · Світла" width={1440} height={560}>
          <DiscountsLoading theme="light" />
        </DCArtboard>
        <DCArtboard id="load-d-dark" label="Desktop · Темна" width={1440} height={560}>
          <DiscountsLoading theme="dark" />
        </DCArtboard>
        <DCArtboard id="load-m-light" label="Mobile · Світла" width={390} height={560}>
          <DiscountsLoading theme="light" mobile />
        </DCArtboard>
        <DCArtboard id="load-m-dark" label="Mobile · Темна" width={390} height={560}>
          <DiscountsLoading theme="dark" mobile />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('dc-root')).render(<DiscountsCanvas />);
