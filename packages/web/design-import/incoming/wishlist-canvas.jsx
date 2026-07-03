// Knyhovo Wishlist & Price Tracking — EXPLORATION ONLY (not approved for implementation).
// Canvas composition: overview + model, variants A–D (light/dark/mobile/anatomy),
// page states, mascot exploration, comparison & recommendation.

const WLC2 = window.WL;
const VA = window.WLVariantA;
const VB = window.WLVariantB;
const VC = window.WLVariantC;
const VD = window.WLVariantD;
const ST = window.WLStates;
const DOCS = window.WLDocs;

const WL_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "scenario": "Звичайний тиждень",
  "statesTheme": "Світла",
  "mobileTheme": "Світла"
}/*EDITMODE-END*/;

function WLApp() {
  const [t, setTweak] = useTweaks(WL_TWEAK_DEFAULTS);
  const items = WLC2.getItems(t.scenario);
  const stTheme = t.statesTheme === 'Темна' ? 'dark' : 'light';
  const mTheme = t.mobileTheme === 'Темна' ? 'dark' : 'light';
  const grow = { height: 'auto' };

  return (
    <React.Fragment>
      <DesignCanvas>
        <DCSection id="overview" title="Wishlist & Price Tracking — Exploration"
          subtitle="Exploration only — not approved for implementation · Knyhovo DS v1.0 unchanged">
          <DCArtboard id="overview-doc" label="Огляд і принципи" width={560} height={1050} style={grow}>
            <DOCS.WLOverviewDoc />
          </DCArtboard>
          <DCArtboard id="model-doc" label="Модель: Збережено → Стежимо → Сповістимо" width={560} height={1050} style={grow}>
            <DOCS.WLModelDoc />
          </DCArtboard>
        </DCSection>

        <DCSection id="variant-a" title="Variant A — Collection-first · «Моя полиця»"
          subtitle="Колекція веде, стеження тихе · Exploration only">
          <DCArtboard id="a-light" label="A · Desktop light" width={1240} height={2150} style={grow}>
            <VA.VariantCollection theme="light" items={items} />
          </DCArtboard>
          <DCArtboard id="a-dark" label="A · Desktop dark" width={1240} height={2150} style={grow}>
            <VA.VariantCollection theme="dark" items={items} />
          </DCArtboard>
          <DCArtboard id="a-mobile" label="A · Mobile <768px" width={390} height={2150} style={grow}>
            <VA.VariantCollectionMobile theme={mTheme} items={items} />
          </DCArtboard>
          <DCArtboard id="a-doc" label="A · Анатомія і компроміси" width={560} height={1150} style={grow}>
            <DOCS.WLAnatomyDoc {...DOCS.WL_DOCS.A} />
          </DCArtboard>
        </DCSection>

        <DCSection id="variant-b" title="Variant B — Alert-first · «Що змінилось»"
          subtitle="Зміни цін — головний сигнал · Exploration only">
          <DCArtboard id="b-light" label="B · Desktop light" width={1240} height={1800} style={grow}>
            <VB.VariantAlert theme="light" items={items} />
          </DCArtboard>
          <DCArtboard id="b-dark" label="B · Desktop dark" width={1240} height={1800} style={grow}>
            <VB.VariantAlert theme="dark" items={items} />
          </DCArtboard>
          <DCArtboard id="b-mobile" label="B · Mobile <768px" width={390} height={1500} style={grow}>
            <VB.VariantAlertMobile theme={mTheme} items={items} />
          </DCArtboard>
          <DCArtboard id="b-doc" label="B · Анатомія і компроміси" width={560} height={1150} style={grow}>
            <DOCS.WLAnatomyDoc {...DOCS.WL_DOCS.B} />
          </DCArtboard>
        </DCSection>

        <DCSection id="variant-c" title="Variant C — Balanced · «Вішлист» · Mobile Foundation"
          subtitle="Статус оновлено 2026-06-12: Mobile Foundation для Hybrid Freeze (D + C) — мобільна accordion-архітектура">
          <DCArtboard id="c-light" label="C · Desktop light" width={1240} height={1900} style={grow}>
            <VC.VariantBalanced theme="light" items={items} />
          </DCArtboard>
          <DCArtboard id="c-dark" label="C · Desktop dark" width={1240} height={1900} style={grow}>
            <VC.VariantBalanced theme="dark" items={items} />
          </DCArtboard>
          <DCArtboard id="c-mobile" label="C · Mobile <768px" width={390} height={2100} style={grow}>
            <VC.VariantBalancedMobile theme={mTheme} items={items} />
          </DCArtboard>
          <DCArtboard id="c-doc" label="C · Анатомія і компроміси" width={560} height={1100} style={grow}>
            <DOCS.WLAnatomyDoc {...DOCS.WL_DOCS.C} />
          </DCArtboard>
        </DCSection>

        <DCSection id="variant-d" title="Variant D — «Момент» · Primary Direction"
          subtitle="Статус оновлено 2026-06-12: Primary Direction для Hybrid Freeze (D + C) — desktop-база Wishlist v1.0">
          <DCArtboard id="d-light" label="D · Desktop light" width={1240} height={2250} style={grow}>
            <VD.VariantMoment theme="light" items={items} />
          </DCArtboard>
          <DCArtboard id="d-dark" label="D · Desktop dark" width={1240} height={2250} style={grow}>
            <VD.VariantMoment theme="dark" items={items} />
          </DCArtboard>
          <DCArtboard id="d-mobile" label="D · Mobile <768px" width={390} height={2300} style={grow}>
            <VD.VariantMomentMobile theme={mTheme} items={items} />
          </DCArtboard>
          <DCArtboard id="d-doc" label="D · Анатомія і компроміси" width={560} height={1200} style={grow}>
            <DOCS.WLAnatomyDoc {...DOCS.WL_DOCS.D} />
          </DCArtboard>
        </DCSection>

        <DCSection id="states" title="Стани сторінки — на каркасі C"
          subtitle="Завантаження · порожній · перша книга · без сповіщень · 50+ книг · Exploration only">
          <DCArtboard id="st-loading" label="Завантаження" width={1240} height={1350} style={grow}>
            <ST.StateLoading theme={stTheme} />
          </DCArtboard>
          <DCArtboard id="st-empty" label="Порожній стан" width={1240} height={1500} style={grow}>
            <ST.StateEmpty theme={stTheme} />
          </DCArtboard>
          <DCArtboard id="st-first" label="Перша книга (first use)" width={1240} height={1300} style={grow}>
            <ST.StateFirstUse theme={stTheme} />
          </DCArtboard>
          <DCArtboard id="st-noalerts" label="Без активних сповіщень" width={1240} height={1450} style={grow}>
            <ST.StateNoAlerts theme={stTheme} />
          </DCArtboard>
          <DCArtboard id="st-many" label="50+ книг · масові дії · пагінація" width={1240} height={1850} style={grow}>
            <ST.StateManyItems theme={stTheme} />
          </DCArtboard>
          <DCArtboard id="st-doc" label="Стани · нотатки" width={560} height={1100} style={grow}>
            <DOCS.WLStatesDoc />
          </DCArtboard>
        </DCSection>

        <DCSection id="mascot" title="Маскот — Knyhovyk у читацькому кріслі"
          subtitle="Композиційні брифи (персонаж захищений — ілюстрації не перемальовуються) · Exploration only">
          <DCArtboard id="mascot-id" label="Ідентичність і правила" width={560} height={1000} style={grow}>
            <ST.MascotIdentity theme={stTheme} />
          </DCArtboard>
          <DCArtboard id="mascot-hero" label="Композиція 1 · Герой (порожній стан)" width={900} height={760} style={grow}>
            <ST.MascotComposition theme={stTheme} mode="hero" />
          </DCArtboard>
          <DCArtboard id="mascot-side" label="Композиція 2 · Бічна (перша книга)" width={900} height={560} style={grow}>
            <ST.MascotComposition theme={stTheme} mode="side" />
          </DCArtboard>
          <DCArtboard id="mascot-vignette" label="Композиція 3 · Віньєтка (тихий тиждень)" width={900} height={380} style={grow}>
            <ST.MascotComposition theme={stTheme} mode="vignette" />
          </DCArtboard>
        </DCSection>

        <DCSection id="compare" title="Порівняння і рекомендація"
          subtitle="Жодне рішення не затверджено · Exploration only">
          <DCArtboard id="cmp-table" label="Порівняльна таблиця" width={980} height={760} style={grow}>
            <DOCS.WLCompareDoc />
          </DCArtboard>
          <DCArtboard id="cmp-rec" label="Рекомендований напрям" width={560} height={1000} style={grow}>
            <DOCS.WLRecommendDoc />
          </DCArtboard>
          <DCArtboard id="cmp-frozen" label="Кандидати на заморозку" width={560} height={1100} style={grow}>
            <DOCS.WLFrozenDoc />
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel>
        <TweakSection label="Дані (усі варіанти)" />
        <TweakSelect label="Сценарій тижня" value={t.scenario}
          options={['Звичайний тиждень', 'Хвиля знижок', 'Тихий тиждень']}
          onChange={(v) => setTweak('scenario', v)} />
        <TweakSection label="Теми секцій" />
        <TweakRadio label="Стани і маскот" value={t.statesTheme}
          options={['Світла', 'Темна']}
          onChange={(v) => setTweak('statesTheme', v)} />
        <TweakRadio label="Мобільні артборди" value={t.mobileTheme}
          options={['Світла', 'Темна']}
          onChange={(v) => setTweak('mobileTheme', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<WLApp />);
