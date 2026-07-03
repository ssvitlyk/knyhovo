// Knyhovo Wishlist — Variant A «Collection-first» (Моя полиця).
// EXPLORATION ONLY — not approved for implementation.
// Philosophy: «Моя особиста бібліотека». Browsing, organizing, rediscovering.
// Price tracking exists but stays quiet. Composes frozen BookCard in the approved
// vertical page-level override (Book Details v1.1 precedent — component untouched).

const WLA = window.WL;

/* ---------------- Mobile shell (shared by all variant mobile artboards) ---------------- */
function WLMShell({ theme, label, children }) {
  const { SearchBar, ThemeToggle } = WLA.DS;
  const logo = theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png';
  return (
    <div className="wl-page wlm" data-theme={theme} data-screen-label={label}>
      <div className="wl-note"><b>Exploration only</b> · not approved</div>
      <div className="wlm-wrap">
        <header className="wlm-header" data-screen-label="Compact header">
          <img className="site-logo" src={logo} alt="Knyhovo" />
          <div className="wlm-header__actions">
            <span style={{ pointerEvents: 'none' }}><ThemeToggle theme={theme} /></span>
            <button className="wlm-iconbtn" aria-label="Меню" type="button"><WLA.Icon name="menu" size={20} /></button>
          </div>
        </header>
        <div style={{ marginBottom: 'var(--space-4)' }}><SearchBar placeholder="Назва книги, автора або ISBN…" /></div>
        {children}
        <WLA.Footer theme={theme} />
      </div>
    </div>
  );
}

/* ---------------- Desktop ---------------- */
const WLA_GROUPS = [
  ['Фентезі', ['vidmak', 'krov', 'mech', 'dim']],
  ['Нонфікшн', ['zvychky', 'sapiens']],
  ['Класика', ['tini', 'kobzar']],
];

function WLACardPrice(item) {
  if (item.avail === 'pending') return { price: '…', store: 'збираємо ціни у 5 книгарнях' };
  if (item.avail === 'out') return { price: '—', store: 'немає в наявності' };
  return { price: WLA.uah(item.price), store: item.store };
}

function WLAShelfCell({ item }) {
  const { BookCard } = WLA.DS;
  const p = WLACardPrice(item);
  const d = WLA.delta(item);
  return (
    <div className="wl-shelfcell">
      <BookCard title={item.title} author={item.author}
        price={p.price} oldPrice={d !== 0 && item.price != null ? WLA.uah(item.prev) : null}
        store={p.store} badge={<WLA.ItemBadge item={item} />} />
      <div className="wl-shelfcell__meta">
        <WLA.Status item={item} />
        <button className={'wl-iconbtn' + (item.tracking ? ' wl-iconbtn--on' : '')} type="button"
          title={item.tracking ? 'Стежимо — натисніть, щоб вимкнути' : 'Стежити за ціною'}>
          <WLA.Icon name={item.tracking ? 'bell' : 'bell-off'} size={16} />
        </button>
      </div>
    </div>
  );
}

function VariantCollection({ theme, items }) {
  const { Button, Chip } = WLA.DS;
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const tracked = items.filter((i) => i.tracking).length;
  const drops = WLA.drops(items).length;
  return (
    <WLA.Shell theme={theme} label={'Variant A · ' + theme} crumbTail="Моя полиця">
      <div className="wl-head" data-screen-label="Page head">
        <div className="wl-head__main">
          <p className="wl-eyebrow">МОЯ ПОЛИЦЯ · {items.length} КНИГ · 3 ДОБІРКИ</p>
          <h1 className="wl-h1">Моя полиця</h1>
          <p className="wl-sub">Книги, які ви хочете прочитати. Knyhovo тихенько стежить за цінами — а полиця лишається полицею.</p>
        </div>
        <div className="wl-head__aside">
          <Button variant="secondary" size="sm"><WLA.Icon name="plus" size={15} /> Нова добірка</Button>
          <span className="wl-statline wl-statline--on">
            <WLA.Icon name="bell" size={13} />
            Стежимо за {tracked} · {drops} подешевшали
          </span>
        </div>
      </div>

      <div className="wl-toolbar" data-screen-label="Collections & sort">
        <div className="wl-chips">
          <Chip selected>Уся полиця · {items.length}</Chip>
          <Chip>Фентезі · 4</Chip>
          <Chip>Нонфікшн · 2</Chip>
          <Chip>Класика · 2</Chip>
        </div>
        <div className="wl-toolbar__right">
          <Button variant="ghost" size="sm">Спочатку нові <WLA.Icon name="chevron-down" size={14} /></Button>
        </div>
      </div>

      {WLA_GROUPS.map(([name, ids]) => (
        <section className="wl-group" key={name} data-screen-label={'Добірка · ' + name}>
          <div className="wl-group__head">
            <h2 className="wl-group__title">{name}</h2>
            <span className="wl-group__count">{ids.length} {ids.length === 1 ? 'книга' : 'книги'}</span>
            <WLA.DS.Button variant="ghost" size="sm">Упорядкувати</WLA.DS.Button>
          </div>
          <div className="wl-shelf">
            {ids.map((id) => <WLAShelfCell key={id} item={byId[id]} />)}
          </div>
        </section>
      ))}
    </WLA.Shell>
  );
}

/* ---------------- Mobile (<768px) — 2-col cover grid, collection chips ---------------- */
function WLAMobileCard({ item }) {
  if (!item) return null;
  const d = WLA.delta(item);
  return (
    <div className="wlm-gridcard">
      <span className="wlm-cover" aria-label="Обкладинка (плейсхолдер)"></span>
      <span className="wlm-title">{item.title}</span>
      <span className="wl-row__author">{item.author}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {item.avail === 'pending' ? <span className="wlm-price wlm-price--faint">…</span>
          : item.avail === 'out' ? <span className="wlm-price wlm-price--faint">—</span>
            : <span className="wlm-price">{WLA.uah(item.price)}</span>}
        {d !== 0 && item.price != null ? <WLA.Delta item={item} /> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <WLA.ItemBadge item={item} />
        <button className={'wl-iconbtn' + (item.tracking ? ' wl-iconbtn--on' : '')} type="button"
          style={{ width: 44, height: 44 }} title="Стеження">
          <WLA.Icon name={item.tracking ? 'bell' : 'bell-off'} size={17} />
        </button>
      </div>
    </div>
  );
}

function VariantCollectionMobile({ theme, items }) {
  const { Chip } = WLA.DS;
  return (
    <WLMShell theme={theme} label="Variant A · mobile">
      <p className="wl-eyebrow">МОЯ ПОЛИЦЯ · {items.length} КНИГ</p>
      <h1 className="wl-h1" style={{ marginBottom: 'var(--space-3)' }}>Моя полиця</h1>
      <div className="wlm-chips" data-screen-label="Collections">
        <Chip selected>Усі · {items.length}</Chip>
        <Chip>Фентезі · 4</Chip>
        <Chip>Нонфікшн · 2</Chip>
        <Chip>Класика · 2</Chip>
        <Chip>+ Добірка</Chip>
      </div>
      <div className="wlm-grid" data-screen-label="Shelf grid">
        {items.map((i) => <WLAMobileCard key={i.id} item={i} />)}
      </div>
    </WLMShell>
  );
}

Object.assign(window, { WLMShell });
window.WLVariantA = { VariantCollection, VariantCollectionMobile };
