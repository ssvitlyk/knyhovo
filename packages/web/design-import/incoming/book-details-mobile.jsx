// Knyhovo Book Details — Variant C MOBILE ADAPTATION · APPROVED · v1.1.
// Frozen 2026-06-11. Design system v1.0 unchanged.
// Structural reference: common mobile commerce patterns (per brief);
// no external visual identity copied — all visuals are frozen Knyhovo tokens.

const BDM = window.BD;

/* ---------------- Extra line icons (Lucide paths, DS icon spec) ---------------- */
function MIcon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === 'search' ? (
        <React.Fragment>
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.3-4.3"></path>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <path d="M4 6h16"></path>
          <path d="M4 12h16"></path>
          <path d="M4 18h16"></path>
        </React.Fragment>
      )}
    </svg>
  );
}

/* ---------------- Mobile chrome ---------------- */
function MHeader({ theme }) {
  const { ThemeToggle } = BDM.DS;
  const logo = theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png';
  return (
    <header className="bdm-header" data-screen-label="Mobile header">
      <img className="site-logo" src={logo} alt="Knyhovo" />
      <div className="bdm-header__actions">
        <span style={{ pointerEvents: 'none' }}><ThemeToggle theme={theme} /></span>
        <button type="button" className="bdm-iconbtn" aria-label="Меню"><MIcon name="menu" /></button>
      </div>
    </header>
  );
}

/* Mobile page shell — exploration note, compact header, full-width SearchBar
   (frozen Search Results <768px rule), crumbs, footer always present. */
function MShell({ theme, label, searchSkeleton, crumbTail, children }) {
  const { SearchBar } = BDM.DS;
  return (
    <div className="bd-page bdm" data-theme={theme} data-screen-label={label}>
      <div className="bd-note"><b>Approved · Book Details v1.1 · Mobile · Frozen 2026-06-11</b></div>
      <div className="bdm-wrap">
        <MHeader theme={theme} />
        <div className="bdm-search">
          {searchSkeleton ? <BDM.SearchSkeleton /> : <SearchBar placeholder="Назва, автор або ISBN…" />}
        </div>
        <p className="bd-crumbs bdm-crumbs">Каталог · Фентезі · <span>{crumbTail || BDM.BOOK.title}</span></p>
        {children}
        <BDM.Footer theme={theme} />
      </div>
    </div>
  );
}

/* ---------------- Mobile blocks ---------------- */
function MHero({ book }) {
  return (
    <section className="bdm-hero" data-screen-label="Mobile book hero">
      <BDM.Cover size="md" />
      <p className="bd-eyebrow">{book.genreEyebrow}</p>
      <h1 className="bd-h1">{book.title}</h1>
      <p className="bd-author">{book.author}</p>
    </section>
  );
}

function MRow({ o }) {
  const { Button } = BDM.DS;
  const av = BDM.AVAIL[o.avail];
  const out = o.avail === 'out';
  return (
    <div className={'bdm-row' + (out ? ' bdm-row--out' : '')}>
      <div className="bdm-row__main">
        <span className="bdm-row__store">{o.store}</span>
        <span className={'bdm-row__avail bd-offer__avail--' + av.cls}>{av.label}</span>
      </div>
      <div className="bdm-row__prices">
        {o.oldPrice && !out ? <span className="bdm-row__old">{BDM.uah(o.oldPrice)}</span> : null}
        <span className="bdm-row__price">{out ? '—' : BDM.uah(o.price)}</span>
      </div>
      <Button variant="secondary" size="sm" disabled={out}>Перейти</Button>
    </div>
  );
}

/* Decision panel, full-width on mobile. Wishlist sits directly under the
   best-price CTA (requirement: visible near the price section). */
function MPanel({ offers, wish, note }) {
  const { Button, Badge } = BDM.DS;
  const best = BDM.best(offers);
  const rest = offers.filter((o) => o !== best)
    .sort((a, b) => ((a.avail === 'out') - (b.avail === 'out')) || ((a.price ?? 1e9) - (b.price ?? 1e9)));
  return (
    <section className="bdc-panel bdm-panel" data-screen-label="Mobile offers panel" data-comment-anchor="mobile-offers-panel">
      <p className="bd-eyebrow" style={{ marginBottom: 0 }}>ЦІНИ У {offers.length} КНИГАРНЯХ</p>
      <div className="bdc-best">
        <Badge tone="green">Найкраща ціна</Badge>
        <div className="bdc-best__pricerow">
          {best.oldPrice ? <span className="bdc-best__old">{BDM.uah(best.oldPrice)}</span> : null}
          <span className="bdc-best__price">{BDM.uah(best.price)}</span>
        </div>
        <p className="bdc-best__store">у <b>{best.store}</b> · <span style={{ color: 'var(--brand-green)' }}>В наявності</span></p>
        <Button variant="primary" style={{ width: '100%' }}>Перейти до книгарні</Button>
      </div>
      <BDM.Wishlist saved={wish.saved} alert={wish.alert} />
      <div className="bdm-rows">
        {rest.map((o) => <MRow key={o.store} o={o} />)}
      </div>
      <p className="bd-updated">{note || 'Ціни оновлено сьогодні о 08:00'}</p>
    </section>
  );
}

/* Expandable description — collapsed to 6 lines, «Показати все» toggles. */
function MDesc({ book }) {
  const { Button } = BDM.DS;
  const [open, setOpen] = React.useState(false);
  return (
    <section className="bd-section" data-screen-label="Mobile description">
      <h2 className="bd-h2">Про книгу</h2>
      <div className={'bd-desc' + (open ? '' : ' bdm-clamp')}>
        {book.desc.map((p, i) => <p key={i}>{p}</p>)}
      </div>
      <div style={{ marginTop: 'var(--space-3)' }}>
        <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
          {open ? 'Згорнути' : 'Показати все'}
        </Button>
      </div>
    </section>
  );
}

function MMeta({ book, missing }) {
  const rows = [
    ['Мова', book.lang],
    ['Видавництво', book.publisher],
    ['Формат', book.format],
    ['ISBN', book.isbn],
    ['Рік видання', book.year],
    ['Серія', book.series],
  ];
  return (
    <section className="bd-section" data-screen-label="Mobile metadata">
      <h2 className="bd-h2">Про видання</h2>
      <dl className="bdm-meta-card">
        {rows.map(([dt, dd]) => (
          <div className="bdm-meta-row" key={dt}>
            <dt>{dt}</dt>
            {dd ? <dd>{dd}</dd> : <dd className="bd-meta--missing">{missing || '—'}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}

function MShelf({ title, books }) {
  const { BookCard, Badge } = BDM.DS;
  return (
    <section className="bd-section" data-screen-label={title}>
      <h2 className="bd-h2">{title}</h2>
      <div className="bdm-shelf">
        {books.map((b) => (
          <BookCard key={b.title} title={b.title} author={b.author}
            price={BDM.uah(b.price)} oldPrice={b.oldPrice ? BDM.uah(b.oldPrice) : null}
            store={b.store}
            badge={b.oldPrice ? <Badge tone="solid">{BDM.pct(b)}</Badge> : null} />
        ))}
      </div>
    </section>
  );
}

function MStickyBar({ offers }) {
  const { Button } = BDM.DS;
  const best = BDM.best(offers);
  return (
    <div className="bdm-sticky" data-screen-label="Sticky purchase bar">
      <div className="bdm-sticky__deal">
        <div className="bdm-sticky__pricerow">
          <span className="bdm-sticky__price">{BDM.uah(best.price)}</span>
          {best.oldPrice ? <span className="bdm-sticky__old">{BDM.uah(best.oldPrice)}</span> : null}
        </div>
        <span className="bdm-sticky__store">найкраща ціна · {best.store}</span>
      </div>
      <Button variant="primary">Перейти до книгарні</Button>
    </div>
  );
}

/* ---------------- Pages ---------------- */
const M_BOOK = { ...BDM.BOOK, year: '2016' };

function MobilePage({ theme, wish }) {
  return (
    <MShell theme={theme} label={'Mobile C ' + theme}>
      <MHero book={M_BOOK} />
      <MPanel offers={BDM.OFFERS} wish={wish} />
      <MDesc book={M_BOOK} />
      <MMeta book={M_BOOK} />
      <BDM.History />
      <MShelf title="Інші книги серії" books={BDM.SERIES_BOOKS} />
      <MShelf title="Інші книги автора" books={BDM.AUTHOR_BOOKS} />
    </MShell>
  );
}

/* Scrolled-viewport simulation: page shifted up past the best-price block,
   sticky bar shown. In the live page an IntersectionObserver on the best-price
   block toggles the bar; page bottom padding equals bar height. */
function MobileStickyDemo({ theme, wish }) {
  return (
    <div className="bdm-viewport" data-theme={theme} data-screen-label="Sticky CTA demo">
      <div className="bdm-viewport__tag">Симуляція: прокручено нижче блоку цін</div>
      <div style={{ transform: 'translateY(-980px)' }} aria-hidden="true">
        <MobilePage theme={theme} wish={wish} />
      </div>
      <MStickyBar offers={BDM.OFFERS} />
    </div>
  );
}

/* Store offers detail — documents wishlist unsaved vs saved + alert. */
function MobileOffersDetail({ theme }) {
  return (
    <div className="bd-page bdm" data-theme={theme} data-screen-label="Mobile offers detail">
      <div className="bd-note"><b>Approved · Book Details v1.1 · Mobile · Frozen 2026-06-11</b></div>
      <div className="bdm-wrap" style={{ paddingTop: 'var(--space-5)', paddingBottom: 'var(--space-6)' }}>
        <p className="bd-eyebrow">Стан 1 · Вішлист не збережено</p>
        <MPanel offers={BDM.OFFERS} wish={{ saved: false, alert: false }} />
        <p className="bd-eyebrow" style={{ marginTop: 'var(--space-8)' }}>Стан 2 · Збережено + стежимо за ціною</p>
        <MPanel offers={BDM.OFFERS} wish={{ saved: true, alert: true }} />
      </div>
    </div>
  );
}

/* Loading — warm surfaces, one-shot stagger, footer present. */
function MobileLoading({ theme }) {
  const Sk = BDM.Sk;
  const stagger = BDM.useStagger();
  return (
    <MShell theme={theme} label="Mobile loading" searchSkeleton crumbTail="…">
      <div className={stagger.trim()} aria-busy="true" data-screen-label="Mobile loading state">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <span className="bd-sk" style={{ width: 180, height: 262, borderRadius: 'var(--radius-md)', display: 'block', marginBottom: 'var(--space-2)' }}></span>
          <Sk w="44%" h={10} />
          <Sk w="72%" h={22} />
          <Sk w="38%" h={13} />
        </div>
        <div className="bd-sk--card" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Sk w="48%" h={10} />
          <span className="bd-sk" style={{ height: 150, borderRadius: 'var(--radius-md)', display: 'block' }}></span>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
              <Sk w="36%" h={13} /><Sk w="20%" h={12} style={{ marginLeft: 'auto' }} /><Sk w={64} h={18} />
            </div>
          ))}
        </div>
        <div className="bd-section" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Sk w="40%" h={16} />
          <Sk w="100%" /><Sk w="94%" /><Sk w="62%" />
        </div>
      </div>
    </MShell>
  );
}

/* Partial data — honest gaps, offers still being checked. */
function MobilePartial({ theme }) {
  const book = { ...M_BOOK, desc: null, isbn: null, series: null, year: null, genreEyebrow: 'ФЕНТЕЗІ' };
  return (
    <MShell theme={theme} label="Mobile partial data">
      <MHero book={book} />
      <MPanel offers={BDM.OFFERS.slice(0, 2)} wish={{ saved: false, alert: false }}
        note="Перевіряємо ще 3 книгарні — список доповнюється." />
      <section className="bd-section">
        <h2 className="bd-h2">Про книгу</h2>
        <BDM.Hint>Опис ще не додано — ми збираємо інформацію про це видання. Зазвичай це триває до одного дня.</BDM.Hint>
      </section>
      <MMeta book={book} missing="Уточнюємо…" />
      <BDM.History />
      <MShelf title="Інші книги автора" books={BDM.AUTHOR_BOOKS} />
    </MShell>
  );
}

/* Unavailable — Knyhovyk guides to the availability alert; no sticky bar. */
function MobileUnavailable({ theme }) {
  const { Button } = BDM.DS;
  const mascot = theme === 'dark' ? 'assets/mascot/mascot-lantern.png' : 'assets/mascot/mascot-magnifier.png';
  const offers = BDM.OFFERS.map((o) => ({ ...o, avail: 'out' }));
  return (
    <MShell theme={theme} label="Mobile unavailable">
      <MHero book={M_BOOK} />
      <section className="bdc-panel bdm-panel" data-screen-label="Mobile unavailable panel">
        <div className="bd-unavail">
          <img className="bd-unavail__mascot" src={mascot} alt="" />
          <h2 className="bd-unavail__title">Зараз немає в наявності</h2>
          <p className="bd-unavail__text">Жодна з 5 книгарень не має цієї книги. Збережіть її у вішлист — повідомимо, щойно вона з’явиться.</p>
          <Button variant="primary"><BDM.Icon name="bell" size={16} /> Повідомити про наявність</Button>
        </div>
        <div className="bdm-rows">
          {offers.map((o) => <MRow key={o.store} o={o} />)}
        </div>
      </section>
      <BDM.History />
      <MShelf title="Інші книги серії — є в наявності" books={BDM.SERIES_BOOKS} />
    </MShell>
  );
}

/* ---------------- Notes / breakpoints doc ---------------- */
function MobileDoc() {
  const { Badge } = BDM.DS;
  return (
    <div className="bd-doc" data-screen-label="Mobile notes">
      <div className="bd-doc__badge-row">
        <Badge tone="green">Approved · v1.1</Badge>
        <Badge tone="neutral">Frozen 2026-06-11 · DS v1.0 unchanged</Badge>
      </div>
      <h2>Variant C → Mobile — transformation notes</h2>
      <p className="bd-doc__sub">Structural adaptation only; every visual is a frozen v1.0 token or component. No external visual identity referenced.</p>
      <h3>How desktop Variant C transforms</h3>
      <ol>
        <li>The two panes stack into one column in decision-first order after the hero: <strong>book hero → offers panel → description → metadata → price history → shelves</strong>. Best price stays within the first scroll.</li>
        <li>Header compacts: logo left; theme toggle + menu right (44px targets). The full-width SearchBar below the header inherits the frozen Search Results &lt;768px rule. No bottom navigation.</li>
        <li>The offers panel becomes a full-width card. Store rows switch to a two-line layout: store + availability left, price stack right, 44px «Перейти» CTA. Best offer keeps the green badge + accent-tinted block + full-width primary CTA.</li>
        <li>Wishlist moves directly under the best-price CTA; saved state adds the «Стежимо за ціною» badge (documented in the offers artboard).</li>
        <li>Description clamps to 6 lines with «Показати все» / «Згорнути» (ghost button, real toggle in this mockup). Metadata becomes grouped label–value rows in one card, year included when known.</li>
        <li>Series and author shelves become horizontal scroll rails (vertical BookCards, page-level override — component untouched). Edge cut-off implies scrollability.</li>
        <li>Price history stays a reserved placeholder — no chart styles yet.</li>
      </ol>
      <h3>Sticky purchase bar</h3>
      <ul>
        <li><span className="uc">·</span><span>Appears only after the best-price block leaves the viewport (IntersectionObserver on the block); hides when it is visible again.</span></li>
        <li><span className="uc">·</span><span>Content: best price (serif accent) + old price, «найкраща ціна · Store», primary CTA «Перейти до книгарні».</span></li>
        <li><span className="uc">·</span><span>Never covers content: the page reserves bottom padding equal to the bar height (+ safe-area inset). Hidden entirely in the unavailable state.</span></li>
        <li><span className="uc">·</span><span>Opaque surface + hairline top border — no blur/transparency (per DS).</span></li>
      </ul>
      <h3>Breakpoints</h3>
      <ol>
        <li><strong>Desktop ≥1024px</strong> — approved Variant C: two panes, offers panel 460px right column; 4-up shelves; no sticky bar.</li>
        <li><strong>Tablet 768–1023px</strong> — two panes retained, panel narrows to 380px; description column shrinks first; shelves go 3-up; still no sticky bar.</li>
        <li><strong>Mobile &lt;768px</strong> — this adaptation: single column, compact header, sticky purchase bar, horizontal shelves, 44px touch targets everywhere.</li>
      </ol>
      <h3>States parity</h3>
      <p>Loading (warm skeletons, one-shot 280ms stagger), partial data («Уточнюємо…», offers list still filling), unavailable (mascot 180px on mobile per frozen ≤900px rule, alert CTA, no sticky bar). Footer present in all states.</p>
    </div>
  );
}

window.BDMobile = { MobilePage, MobileStickyDemo, MobileOffersDetail, MobileLoading, MobilePartial, MobileUnavailable, MobileDoc };
