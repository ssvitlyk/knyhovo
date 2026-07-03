// Knyhovo Book Details — EXPLORATION ONLY (not approved for implementation).
// Canvas composition: overview, Variants A/B/C (light + dark + anatomy/rationale), states.

const BDC = window.BD;
const V = window.BDVariants;
const M = window.BDMobile;

/* ---------------- Anatomy diagram ---------------- */
function Anat({ rows }) {
  return (
    <div className="anat">
      {rows.map((row, i) => (
        <div className="anat__row" key={i}>
          {row.map((b, j) => (
            <div key={j}
              className={'anat__b' + (b.hot ? ' anat__b--hot' : '') + (b.dim ? ' anat__b--dim' : '')}
              style={{ minHeight: b.h || 30, flex: b.f || 1 }}>
              {b.t}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Doc cards ---------------- */
function DocBadges() {
  const { Badge } = BDC.DS;
  return (
    <div className="bd-doc__badge-row">
      <Badge tone="green">Approved · v1.1</Badge>
      <Badge tone="neutral">Frozen 2026-06-11</Badge>
    </div>
  );
}

function OverviewDoc() {
  return (
    <div className="bd-doc" data-screen-label="Overview">
      <DocBadges />
      <h2>Book Details Page — 3 information hierarchies</h2>
      <p className="bd-doc__sub">Knyhovo Design System v1.0 · Variant C approved & frozen as v1.1 · A &amp; B exploration reference</p>
      <p>Goal: find the page structure that best helps a reader decide <em>where to buy a specific book at the best price</em>. Knyhovo compares prices — it does not sell books.</p>
      <h3>What is constant in all three</h3>
      <ul>
        <li><span className="uc">·</span><span>Composed only from <code>KnyhovoDesignSystem_9fa616</code> exports (SearchBar, Button, Badge, BookCard, Chip, ThemeToggle) + frozen tokens. No new colors, type, radii, shadows.</span></li>
        <li><span className="uc">·</span><span>Header, persistent SearchBar, breadcrumbs and footer in every state (rule inherited from frozen Search Results v1.0).</span></li>
        <li><span className="uc">·</span><span>Best price: green «Найкраща ціна» badge + primary CTA «Перейти до книгарні»; store names stay muted (frozen metadata hierarchy).</span></li>
        <li><span className="uc">·</span><span>Price-history section is a reserved placeholder — no chart styles invented yet.</span></li>
        <li><span className="uc">·</span><span>Cover images are placeholders; demo content is fictional sample data.</span></li>
      </ul>
      <h3>What differs</h3>
      <ol>
        <li><strong>A · Editorial</strong> — the book leads; prices are a compact secondary section.</li>
        <li><strong>B · Price-first</strong> — the best deal leads; book details support.</li>
        <li><strong>C · Balanced</strong> — discovery and decision share the fold as two panes.</li>
      </ol>
      <h3>Tweaks</h3>
      <p>Use the Tweaks panel to flip the wishlist state (saved / price-alert) across all variants and to re-theme the States section. No winner is chosen here.</p>
    </div>
  );
}

function AnatomyDoc({ letter, title, rows, hierarchy, pros, cons, uses }) {
  return (
    <div className="bd-doc" data-screen-label={'Anatomy ' + letter}>
      <DocBadges />
      <h2>Variant {letter} — {title}</h2>
      <h3>Layout anatomy</h3>
      <Anat rows={rows} />
      <h3>Information hierarchy rationale</h3>
      <ol>{hierarchy.map((x, i) => <li key={i}>{x}</li>)}</ol>
      <h3>Advantages</h3>
      <ul>{pros.map((x, i) => <li key={i}><span className="pro">+</span><span>{x}</span></li>)}</ul>
      <h3>Potential drawbacks</h3>
      <ul>{cons.map((x, i) => <li key={i}><span className="con">−</span><span>{x}</span></li>)}</ul>
      <h3>Recommended use cases</h3>
      <ul>{uses.map((x, i) => <li key={i}><span className="uc">·</span><span>{x}</span></li>)}</ul>
    </div>
  );
}

function StatesDoc() {
  return (
    <div className="bd-doc" data-screen-label="States notes">
      <DocBadges />
      <h2>States — notes</h2>
      <p className="bd-doc__sub">Demonstrated on the Balanced (C) composition; the same rules apply to A and B.</p>
      <ol>
        <li><strong>Loading</strong> — warm <code>--surface-accent</code> blocks only, one-shot 280ms staggered fade (frozen skeleton spec). SearchBar skeleton reuses the <code>.kn-field</code> capsule. Footer stays.</li>
        <li><strong>Partial data</strong> — honest gaps: «Уточнюємо…» in metadata, a hint instead of the missing description, offers list marked as still being checked. Nothing is faked.</li>
        <li><strong>Book unavailable</strong> — Knyhovyk guides to the wishlist + availability alert; out-of-stock store rows stay visible as proof of the check. Mascot follows theme rules (magnifier / lantern).</li>
        <li><strong>No price history yet</strong> — every variant already reserves the «Динаміка ціни» placeholder with a «Незабаром» badge and explanatory text; no chart styles are defined yet.</li>
      </ol>
      <h3>Responsive intent (not drawn here)</h3>
      <p>Below 768px all variants collapse to a single column. Variant C explicitly orders: identity → offers panel → description → history → shelves. Touch targets keep the 44px minimum.</p>
    </div>
  );
}

/* ---------------- Anatomy data ---------------- */
const ROW = (...b) => b;
const ANAT_A = [
  ROW({ t: 'exploration note', dim: true, h: 16 }),
  ROW({ t: 'header', dim: true }),
  ROW({ t: 'searchbar · crumbs', dim: true }),
  ROW({ t: 'cover + wishlist', f: 0.38, h: 96 }, { t: 'title · author · rich description · series · metadata', hot: true, f: 0.62, h: 96 }),
  ROW({ t: 'де купити — compact offer list', h: 44 }),
  ROW({ t: 'price history (reserved)', dim: true }),
  ROW({ t: 'series shelf' }, { t: 'author shelf' }),
  ROW({ t: 'footer', dim: true }),
];
const ANAT_B = [
  ROW({ t: 'exploration note', dim: true, h: 16 }),
  ROW({ t: 'header', dim: true }),
  ROW({ t: 'searchbar · crumbs', dim: true }),
  ROW({ t: 'best-price hero · identity + price + CTA', hot: true, h: 52 }),
  ROW({ t: 'full price comparison · 5 stores', hot: true, h: 80 }),
  ROW({ t: 'price history (reserved)', dim: true }),
  ROW({ t: 'about the book', f: 0.6, h: 40 }, { t: 'metadata', f: 0.4, h: 40 }),
  ROW({ t: 'series shelf' }, { t: 'author shelf' }),
  ROW({ t: 'footer', dim: true }),
];
const ANAT_C = [
  ROW({ t: 'exploration note', dim: true, h: 16 }),
  ROW({ t: 'header', dim: true }),
  ROW({ t: 'searchbar · crumbs', dim: true }),
  ROW({ t: 'discovery pane · cover · description · metadata', hot: true, f: 0.6, h: 110 }, { t: 'decision pane · best price · all offers · wishlist', hot: true, f: 0.4, h: 110 }),
  ROW({ t: 'price history (reserved)', dim: true }),
  ROW({ t: 'series shelf' }, { t: 'author shelf' }),
  ROW({ t: 'footer', dim: true }),
];

const DOC_A = {
  letter: 'A', title: 'Editorial', rows: ANAT_A,
  hierarchy: [
    'The book itself leads: large cover, display-size title, full three-paragraph description and series context come first — the page reads like a catalogue entry in a literary magazine.',
    'Edition metadata sits inside the hero, completing the «book passport» before any commerce appears.',
    '«Де купити» is a deliberately compact list with a «від 240 ₴» summary — present, but secondary.',
    'Price history and related shelves close the page as further reading.',
  ],
  pros: [
    'Strongest discovery experience — builds confidence for readers who don’t know the book yet.',
    'Premium editorial feel matches the brand personality (warm guide, not a marketplace).',
    'Rich description and series context give the page standalone value beyond price checking.',
  ],
  cons: [
    'Best price is below the fold — deal-driven visitors must scroll.',
    'Weakest layout for repeat «just checking the price» visits.',
    'Long text column risks burying the CTA on smaller screens.',
  ],
  uses: [
    'Traffic from discovery surfaces: series pages, author pages, editorial collections.',
    'New or unfamiliar titles where the description does the convincing.',
    'Gift shopping and browsing sessions without firm purchase intent.',
  ],
};
const DOC_B = {
  letter: 'B', title: 'Price-first', rows: ANAT_B,
  hierarchy: [
    'The best deal answers the core question with zero scrolling: hero card pairs compact book identity with the large serif price, savings and the primary CTA.',
    'The full five-store comparison immediately follows — the comparison table IS the product.',
    'Price history sits right after the prices, supporting the «buy at the right moment» decision.',
    'Book description and metadata are supporting context further down; related shelves close the page.',
  ],
  pros: [
    'Fastest path to Knyhovo’s mission — «where to buy cheapest» is answered instantly.',
    'Highest CTA prominence; strongest expected conversion to bookstores.',
    'The dominant comparison table reinforces the «we compare 5 stores daily» positioning.',
  ],
  cons: [
    'Thin book context up top may lower confidence for unfamiliar titles.',
    'Reads transactional — less of the warm-guide brand personality.',
    'Two CTAs for the same store (hero + table row) need disciplined analytics and copy.',
  ],
  uses: [
    'Visitors arriving from search results with a specific book already chosen.',
    'Price-drop alert and wishlist-notification landings.',
    'Repeat visitors tracking a known book over time.',
  ],
};
const DOC_C = {
  letter: 'C', title: 'Balanced', rows: ANAT_C,
  hierarchy: [
    'Two panes of equal weight share the fold: the left pane serves discovery (cover, title, description, metadata), the right pane serves the decision (best price, all offers, wishlist).',
    'Neither job blocks the other — a reader can evaluate the book and the deal in one glance.',
    'Price history bridges the panes below; series and author shelves invite further exploration.',
  ],
  pros: [
    'Both core jobs — discovery and decision — are above the fold.',
    'Familiar product-page pattern; near-zero learning curve.',
    'The offers panel is self-contained and could become sticky on long pages later.',
  ],
  cons: [
    'Panes compete for attention; neither gets the full stage.',
    'Description width is constrained by the panel column.',
    'Responsive collapse needs an explicit ordering decision below 768px.',
  ],
  uses: [
    'Default, general-purpose book details page for mixed-intent traffic.',
    'A solid A/B baseline against which A and B can be tested.',
    'Catalogue browsing where users hop between many books.',
  ],
};

/* ---------------- Canvas app ---------------- */
const BD_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "wish": "Авто",
  "statesTheme": "Світла"
}/*EDITMODE-END*/;

const BD_WISH_MAP = {
  'Не збережено': { saved: false, alert: false },
  'Збережено': { saved: true, alert: false },
  'Збережено + сповіщення': { saved: true, alert: true },
};

function BDApp() {
  const [t, setTweak] = useTweaks(BD_TWEAK_DEFAULTS);
  React.useEffect(() => { window.lucide && lucide.createIcons(); });

  // «Авто» varies intentionally: A/B show the unsaved control, C shows saved + price alert.
  const wishFor = (v) => BD_WISH_MAP[t.wish] || (v === 'C' ? { saved: true, alert: true } : { saved: false, alert: false });
  const stTheme = t.statesTheme === 'Темна' ? 'dark' : 'light';
  const grow = { height: 'auto' };

  return (
    <React.Fragment>
      <DesignCanvas>
        <DCSection id="overview" title="Book Details Page — v1.1 Approved" subtitle="Variant C frozen · A & B exploration reference · Knyhovo DS v1.0 unchanged">
          <DCArtboard id="overview-doc" label="Overview & constraints" width={560} height={860} style={grow}>
            <OverviewDoc />
          </DCArtboard>
        </DCSection>

        <DCSection id="variant-a" title="Variant A — Editorial" subtitle="The book leads · prices secondary · Exploration reference only — not approved">
          <DCArtboard id="a-light" label="A · Light" width={1240} height={3080} style={grow}>
            <V.VariantEditorial theme="light" wish={wishFor('A')} />
          </DCArtboard>
          <DCArtboard id="a-dark" label="A · Dark" width={1240} height={3080} style={grow}>
            <V.VariantEditorial theme="dark" wish={wishFor('A')} />
          </DCArtboard>
          <DCArtboard id="a-doc" label="A · Anatomy & rationale" width={560} height={1230} style={grow}>
            <AnatomyDoc {...DOC_A} />
          </DCArtboard>
        </DCSection>

        <DCSection id="variant-b" title="Variant B — Price-first" subtitle="The deal leads · book supports · Exploration reference only — not approved">
          <DCArtboard id="b-light" label="B · Light" width={1240} height={3010} style={grow}>
            <V.VariantPriceFirst theme="light" wish={wishFor('B')} />
          </DCArtboard>
          <DCArtboard id="b-dark" label="B · Dark" width={1240} height={3010} style={grow}>
            <V.VariantPriceFirst theme="dark" wish={wishFor('B')} />
          </DCArtboard>
          <DCArtboard id="b-doc" label="B · Anatomy & rationale" width={560} height={1230} style={grow}>
            <AnatomyDoc {...DOC_B} />
          </DCArtboard>
        </DCSection>

        <DCSection id="variant-c" title="Variant C — Balanced" subtitle="✓ Approved · Book Details v1.1 desktop · Frozen 2026-06-11">
          <DCArtboard id="c-light" label="C · Light" width={1240} height={2680} style={grow}>
            <V.VariantBalanced theme="light" wish={wishFor('C')} />
          </DCArtboard>
          <DCArtboard id="c-dark" label="C · Dark" width={1240} height={2680} style={grow}>
            <V.VariantBalanced theme="dark" wish={wishFor('C')} />
          </DCArtboard>
          <DCArtboard id="c-doc" label="C · Anatomy & rationale" width={560} height={1150} style={grow}>
            <AnatomyDoc {...DOC_C} />
          </DCArtboard>
        </DCSection>

        <DCSection id="mobile-c" title="Variant C — Mobile adaptation" subtitle="✓ Approved · Book Details v1.1 mobile · Frozen 2026-06-11 · DS v1.0 unchanged">
          <DCArtboard id="m-light" label="Mobile · Light" width={390} height={2950} style={grow}>
            <M.MobilePage theme="light" wish={wishFor('C')} />
          </DCArtboard>
          <DCArtboard id="m-dark" label="Mobile · Dark" width={390} height={2950} style={grow}>
            <M.MobilePage theme="dark" wish={wishFor('C')} />
          </DCArtboard>
          <DCArtboard id="m-sticky" label="Sticky CTA · scrolled viewport" width={390} height={760}>
            <M.MobileStickyDemo theme={stTheme} wish={wishFor('C')} />
          </DCArtboard>
          <DCArtboard id="m-offers" label="Store offers · wishlist states" width={390} height={1540} style={grow}>
            <M.MobileOffersDetail theme={stTheme} />
          </DCArtboard>
          <DCArtboard id="m-loading" label="Mobile · Loading" width={390} height={1500} style={grow}>
            <M.MobileLoading theme={stTheme} />
          </DCArtboard>
          <DCArtboard id="m-partial" label="Mobile · Partial data" width={390} height={2300} style={grow}>
            <M.MobilePartial theme={stTheme} />
          </DCArtboard>
          <DCArtboard id="m-unavail" label="Mobile · Unavailable" width={390} height={2450} style={grow}>
            <M.MobileUnavailable theme={stTheme} />
          </DCArtboard>
          <DCArtboard id="m-doc" label="Mobile · Notes & breakpoints" width={560} height={1500} style={grow}>
            <M.MobileDoc />
          </DCArtboard>
        </DCSection>

        <DCSection id="states" title="States — Balanced (desktop)" subtitle="✓ Approved · Book Details v1.1 · loading · partial data · unavailable · Frozen 2026-06-11">
          <DCArtboard id="st-loading" label="Loading" width={1240} height={1500} style={grow}>
            <V.StateLoading theme={stTheme} />
          </DCArtboard>
          <DCArtboard id="st-partial" label="Partial data" width={1240} height={2100} style={grow}>
            <V.StatePartial theme={stTheme} wish={{ saved: false, alert: false }} />
          </DCArtboard>
          <DCArtboard id="st-unavail" label="Book unavailable" width={1240} height={2300} style={grow}>
            <V.StateUnavailable theme={stTheme} />
          </DCArtboard>
          <DCArtboard id="st-doc" label="States · notes" width={560} height={900} style={grow}>
            <StatesDoc />
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel>
        <TweakSection label="Вішлист (усі варіанти)" />
        <TweakSelect label="Стан вішлиста" value={t.wish}
          options={['Авто', 'Не збережено', 'Збережено', 'Збережено + сповіщення']}
          onChange={(v) => setTweak('wish', v)} />
        <TweakSection label="Секція «States» і mobile-стани" />
        <TweakRadio label="Тема" value={t.statesTheme}
          options={['Світла', 'Темна']}
          onChange={(v) => setTweak('statesTheme', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<BDApp />);
