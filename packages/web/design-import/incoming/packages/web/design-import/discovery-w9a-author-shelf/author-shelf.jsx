// Knyhovo · W9a — Author Shelf «Інші книги автора»
// Book Details v1.1 (Variant C) extension. Composes window.KnyhovoDesignSystem_9fa616
// (frozen BookCard, Badge) + DS v1.0 tokens ONLY. No new visual language.
// Exposes window.AuthorShelfKit: { selectAuthorShelf, AuthorShelf, AuthorShelfTablet, AuthorShelfMobile, AuthorShelfSection, ROSTER, ... }.
// (Namespace is AuthorShelfKit — NOT window.AuthorShelf — because the React component
// function AuthorShelf would shadow a same-named global in Babel script scope.)
//
// DATA REALITY (W9a): the only signal is the text field canonical_books.author.
// There is NO author entity. Matching is string-based and may be incomplete or
// noisy, and result sets are small. The component is therefore built to DEGRADE
// GRACEFULLY: it never pads, never fakes, and silently omits itself when there is
// not enough to show.
//
// DEDUP KEY (frozen): exclusion of the current book and of Series-shelf books is
// keyed on the canonical `id` (stable) — NOT on title (titles collide across
// editions and break on noisy strings). The page passes currentId + seriesIds.
//
// AVAILABILITY MAP (frozen): provider best-price join → 'in' (in stock),
// 'low' (low stock — treated as in stock for ordering), 'out' (out of stock →
// price renders «—», sorted last). If EVERY matched book is 'out', the shelf is
// still shown (the author's catalogue exists); it is only omitted on count < 2.

const AS_DS = window.KnyhovoDesignSystem_9fa616;

const asUah = (n) => n + ' ₴';
const asPct = (b) => '-' + Math.round((1 - b.price / b.oldPrice) * 100) + '%';

/* ---- Icons (Lucide path data, 2px stroke — DS icon spec) ---- */
const AS_ICONS = {
  'arrow-right': ['M5 12h14', 'm12 5 7 7-7 7'],
  library: ['m16 6 4 14', 'M12 6v14', 'M8 8v12', 'M4 4v16'],
};
function ASIcon({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {AS_ICONS[name].map((d, i) => <path key={i} d={d}></path>)}
    </svg>
  );
}

/* ---- Mock roster: other books carrying the same author string. Mixed
   availability + discounts so degradation, ordering and see-all are visible.
   `current` = the book whose page this is; `series` = titles already shown by
   the Series shelf above (deduped out so the two shelves never overlap). ---- */
const AS_ROSTER = [
  { id: 'w-sg',  title: 'Сезон гроз', price: 265, oldPrice: null, store: 'Yakaboo', avail: 'in' },
  { id: 'w-vl',  title: 'Вежа ластівки', price: 260, oldPrice: null, store: 'BookChef', avail: 'in' },
  { id: 'w-vo',  title: 'Володарка озера', price: 275, oldPrice: 310, store: 'Rozetka', avail: 'in' },
  { id: 'w-bv',  title: 'Божі воїни', price: 290, oldPrice: null, store: 'Книгарня «Є»', avail: 'in' },
  { id: 'w-vb',  title: 'Вежа блазнів', price: 245, oldPrice: 300, store: 'Yakaboo', avail: 'in' },
  { id: 'w-sv',  title: 'Світло вічне', price: 280, oldPrice: null, store: 'Rozetka', avail: 'in' },
  { id: 'w-sc',  title: 'Скеля чаклунок', price: 270, oldPrice: null, store: 'Yakaboo', avail: 'in' },
  { id: 'w-vk',  title: 'Відьмак. Камінь', price: 250, oldPrice: 290, store: 'BookChef', avail: 'in' },
  { id: 'w-lt',  title: 'Легенди Темерії', price: 235, oldPrice: null, store: 'Rozetka', avail: 'in' },
  { id: 'w-dbv', title: 'Дорога без вороття', price: 255, oldPrice: null, store: 'BookChef', avail: 'low' },
  { id: 'w-zm',  title: 'Змія', price: null, oldPrice: null, store: 'Nash Format', avail: 'out' },
];

const AS_SERIES_IDS = ['w-mp', 'w-ke', 'w-cp', 'w-hv']; // ids already shown by the Series shelf

/* ============================================================
   SELECTOR — the single source of degradation truth.
   Dedup is keyed on canonical `id`. cap = row/rail cap for the breakpoint
   (desktop 4, mobile 8). Returns { show, books, total, hasMore, cols }.
   ============================================================ */
function selectAuthorShelf({ currentId, roster = AS_ROSTER, seriesIds = [], cap = 4 } = {}) {
  const seriesSet = new Set(seriesIds);
  // remove the current book + anything already on the Series shelf (dedupe by id)
  const pool = roster.filter((b) => b.id !== currentId && !seriesSet.has(b.id));
  // in-stock first (out-of-stock last), then cheapest — calm discovery ordering.
  // Final tie-break on id so ordering is deterministic across requests.
  const sorted = [...pool].sort((a, b) => {
    const ao = a.avail === 'out', bo = b.avail === 'out';
    if (ao !== bo) return ao ? 1 : -1;
    const pa = a.price ?? 1e9, pb = b.price ?? 1e9;
    if (pa !== pb) return pa - pb;
    return String(a.id).localeCompare(String(b.id));
  });
  const total = sorted.length;
  const books = sorted.slice(0, cap);
  return {
    show: total >= 2,          // MIN N = 2. 0 or 1 → section omitted entirely.
    books,
    total,
    hasMore: total > cap,      // cap exceeded → render cap + «усі книги автора →»
    cols: Math.min(books.length, cap), // explicit column count (never auto-fit)
  };
}

/* ---- One card: the frozen BookCard wrapped in a focusable link. The author
   line is suppressed via CSS (.as-shelf .kn-book__author) — redundant here. ---- */
function ASCard({ b, href = '#' }) {
  const { BookCard, Badge } = AS_DS;
  const out = b.avail === 'out';
  return (
    <a className="as-link" href={href} aria-label={'Перейти до книги «' + b.title + '»'}>      <BookCard
        title={b.title}
        price={out ? '—' : asUah(b.price)}
        oldPrice={b.oldPrice && !out ? asUah(b.oldPrice) : null}
        store={b.store}
        badge={b.oldPrice && !out ? <Badge tone="solid">{asPct(b)}</Badge> : null}
        tabIndex={-1}
      />
    </a>
  );
}

/* ============================================================
   GRID BODY — shared by the desktop (cap 4) and tablet (cap 3) instances.
   Column count is ALWAYS min(visible cards, rowCap) via the single inline
   --as-cols var → exactly one row, never a wrap, so column count == card count
   in every range (2→2, 3→3, 4→4). A book beyond the breakpoint cap becomes
   «усі →», never an orphan on a second row.
   ============================================================ */
function ASGrid({ sel, wrapClass, screenLabel, authorHref = '#', stagger = false }) {
  if (!sel.show) return null; // graceful hide — render nothing, not an empty shelf
  const colStyle = { '--as-cols': sel.cols }; // explicit column count (never auto-fit)
  return (
    <section className={'bd-section ' + wrapClass} data-screen-label={screenLabel}>
      <div className="as-head">
        <h2 className="bd-h2">Інші книги автора</h2>
        {sel.hasMore ? (
          <a className="as-all" href={authorHref}>
            Усі книги автора ({sel.total}) <ASIcon name="arrow-right" size={15} />
          </a>
        ) : null}
      </div>
      <div className={'as-shelf' + (stagger ? ' as-stagger' : '')} data-count={sel.books.length} style={colStyle}>
        {sel.books.map((b) => <ASCard key={b.id} b={b} />)}
      </div>
    </section>
  );
}

/* DESKTOP — 4-up grid (≥1024px). Wrapped in .as-desktop. cap=4. */
function AuthorShelf({ sel, authorHref = '#', stagger = false }) {
  sel = sel || selectAuthorShelf({ currentId: 'w-ob', seriesIds: AS_SERIES_IDS, cap: 4 });
  return <ASGrid sel={sel} wrapClass="as-desktop" screenLabel="Author shelf · «Інші книги автора»" authorHref={authorHref} stagger={stagger} />;
}

/* TABLET — 3-up grid (768–1023px). Wrapped in .as-tablet. cap=3 so the column
   count == card count for 2–3 cards, and a 4th+ matched book is surfaced via
   «усі →» instead of orphaning onto a second row. Its own selector instance. */
function AuthorShelfTablet({ sel, authorHref = '#', stagger = false }) {
  sel = sel || selectAuthorShelf({ currentId: 'w-ob', seriesIds: AS_SERIES_IDS, cap: 3 });
  return <ASGrid sel={sel} wrapClass="as-tablet" screenLabel="Author shelf · tablet" authorHref={authorHref} stagger={stagger} />;
}

/* ============================================================
   MOBILE — horizontal rail (<768px) + trailing see-all card. Wrapped in
   .as-mobile (hidden ≥768 by CSS). cap=8.
   ============================================================ */
function AuthorShelfMobile({ sel, authorHref = '#' }) {
  sel = sel || selectAuthorShelf({ currentId: 'w-ob', seriesIds: AS_SERIES_IDS, cap: 8 });
  if (!sel.show) return null;
  return (
    <section className="bd-section as-mobile" data-screen-label="Author shelf · mobile">
      <h2 className="bd-h2">Інші книги автора</h2>
      <div className="as-shelf--mob">
        {sel.books.map((b) => <ASCard key={b.id} b={b} />)}
        {sel.hasMore ? (
          <a className="as-railmore" href={authorHref} aria-label={'Усі книги автора, всього ' + sel.total}>
            <ASIcon name="library" size={22} />
            <span>Усі книги автора</span>
            <small>{sel.total} книг</small>
          </a>
        ) : null}
      </div>
    </section>
  );
}

/* ============================================================
   INTEGRATION CONTRACT — the page renders THIS. It runs the selector THREE
   times (cap 4 desktop, cap 3 tablet, cap 8 mobile) and renders all THREE
   wrappers (.as-desktop · .as-tablet · .as-mobile); CSS shows exactly one per
   breakpoint. This is the ONLY supported responsive switch. Each instance caps
   independently, so grid column count == visible card count in every range.
   ============================================================ */
function AuthorShelfSection({ currentId = 'w-ob', roster = AS_ROSTER, seriesIds = AS_SERIES_IDS, authorHref = '#', stagger = false }) {
  const selD = selectAuthorShelf({ currentId, roster, seriesIds, cap: 4 });
  const selT = selectAuthorShelf({ currentId, roster, seriesIds, cap: 3 });
  const selM = selectAuthorShelf({ currentId, roster, seriesIds, cap: 8 });
  if (!selD.show) return null; // same total → all three hide together below N=2
  return (
    <React.Fragment>
      <AuthorShelf sel={selD} authorHref={authorHref} stagger={stagger} />
      <AuthorShelfTablet sel={selT} authorHref={authorHref} stagger={stagger} />
      <AuthorShelfMobile sel={selM} authorHref={authorHref} />
    </React.Fragment>
  );
}

window.AuthorShelfKit = {
  DS: AS_DS, uah: asUah, pct: asPct, Icon: ASIcon,
  ROSTER: AS_ROSTER, SERIES_IDS: AS_SERIES_IDS,
  selectAuthorShelf, ASCard, ASGrid, AuthorShelf, AuthorShelfTablet, AuthorShelfMobile, AuthorShelfSection,
};
