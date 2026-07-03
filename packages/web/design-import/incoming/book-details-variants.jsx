// Knyhovo Book Details — EXPLORATION ONLY (not approved for implementation).
// Variant compositions A / B / C + states (loading, partial, unavailable).
// Pure information-hierarchy exploration on top of frozen DS v1.0.

const BDV = window.BD;

/* ============================================================
   VARIANT A — EDITORIAL · the book itself comes first.
   Rich description, prices are a secondary, compact section.
   ============================================================ */
function VariantEditorial({ theme, wish }) {
  const { Button, Badge } = BDV.DS;
  const book = BDV.BOOK;
  const best = BDV.best(BDV.OFFERS);
  return (
    <BDV.Shell theme={theme} label={'Variant A Editorial ' + theme} frozen={false}>
      <section className="bda-hero" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--space-12)', alignItems: 'start' }} data-screen-label="Editorial hero">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <BDV.Cover size="lg" />
          <BDV.Wishlist saved={wish.saved} alert={wish.alert} />
        </div>
        <div>
          <p className="bd-eyebrow">{book.genreEyebrow}</p>
          <h1 className="bd-h1 bd-h1--display">{book.title}</h1>
          <p className="bd-author">{book.author}</p>
          <div className="bd-desc">
            <p className="bd-lead">{book.desc[0]}</p>
            <p>{book.desc[1]}</p>
            <p>{book.desc[2]}</p>
          </div>
          <div className="bd-series-box">
            <span><b>Серія «Відьмак»</b> · книга 1 із 8</span>
            <span className="bd-series-note">Найкраще читати з першої книги</span>
            <Button variant="ghost" size="sm">Переглянути серію</Button>
          </div>
          <dl className="bd-meta" style={{ maxWidth: 'none' }}>
            <div><dt>Видавництво</dt><dd>{book.publisher}</dd></div>
            <div><dt>ISBN</dt><dd>{book.isbn}</dd></div>
            <div><dt>Мова</dt><dd>{book.lang}</dd></div>
            <div><dt>Формат</dt><dd>{book.format}</dd></div>
          </dl>
        </div>
      </section>

      <section className="bd-section" data-screen-label="Where to buy (secondary)">
        <h2 className="bd-h2">Де купити</h2>
        <p className="bd-summary">від <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{BDV.uah(best.price)}</strong> · 4 книгарні мають у наявності</p>
        <BDV.OfferList offers={BDV.OFFERS} compact updatedNote />
      </section>

      <BDV.History />
      <BDV.Shelf title="Інші книги серії" books={BDV.SERIES_BOOKS} />
      <BDV.Shelf title="Інші книги автора" books={BDV.AUTHOR_BOOKS} />
    </BDV.Shell>
  );
}

/* ============================================================
   VARIANT B — PRICE-FIRST · the best deal leads the page.
   Comparison dominates; book details are supporting context.
   ============================================================ */
function VariantPriceFirst({ theme, wish }) {
  const { Button, Badge } = BDV.DS;
  const book = BDV.BOOK;
  const best = BDV.best(BDV.OFFERS);
  return (
    <BDV.Shell theme={theme} label={'Variant B Price-first ' + theme} frozen={false}>
      <section className="bdb-hero" data-screen-label="Best price hero">
        <div className="bdb-hero__id">
          <BDV.Cover size="sm" />
          <div style={{ minWidth: 0 }}>
            <p className="bd-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>НАЙКРАЩА ЦІНА СЬОГОДНІ · 5 КНИГАРЕНЬ</p>
            <h1 className="bd-h1" style={{ marginBottom: 'var(--space-1)' }}>{book.title}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--space-3)' }}>{book.author} · {book.publisher}</p>
            <BDV.Wishlist saved={wish.saved} alert={wish.alert} size="sm" />
          </div>
        </div>
        <div className="bdb-hero__deal">
          <Badge tone="green">Найкраща ціна</Badge>
          <div className="bdb-hero__pricerow">
            <span className="bdb-hero__old">{BDV.uah(best.oldPrice)}</span>
            <span className="bdb-hero__price">{BDV.uah(best.price)}</span>
          </div>
          <p className="bdb-hero__store">у <b>{best.store}</b> · <span style={{ color: 'var(--brand-green)' }}>В наявності</span></p>
          <Button variant="primary" size="lg">Перейти до книгарні</Button>
        </div>
      </section>

      <section className="bd-section" data-screen-label="Full comparison">
        <h2 className="bd-h2">Порівняння цін</h2>
        <BDV.OfferList offers={BDV.OFFERS} updatedNote />
      </section>

      <BDV.History />

      <section className="bd-section" data-screen-label="Book details (supporting)">
        <h2 className="bd-h2">Про книгу</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: 'var(--space-12)', alignItems: 'start' }}>
          <div className="bd-desc">
            <p>{book.desc[0]}</p>
            <Button variant="ghost" size="sm">Читати опис повністю</Button>
          </div>
          <BDV.Meta book={book} />
        </div>
      </section>

      <BDV.Shelf title="Інші книги серії" books={BDV.SERIES_BOOKS} />
      <BDV.Shelf title="Інші книги автора" books={BDV.AUTHOR_BOOKS} />
    </BDV.Shell>
  );
}

/* ============================================================
   VARIANT C — BALANCED · two panes of equal weight:
   discovery on the left, decision (offers panel) on the right.
   ============================================================ */
function BDCPanel({ offers, wish, note }) {
  const { Button, Badge } = BDV.DS;
  const best = BDV.best(offers);
  const rest = offers.filter((o) => o !== best)
    .sort((a, b) => ((a.avail === 'out') - (b.avail === 'out')) || ((a.price ?? 1e9) - (b.price ?? 1e9)));
  return (
    <aside className="bdc-panel" data-screen-label="Offers panel">
      <p className="bd-eyebrow" style={{ marginBottom: 0 }}>ЦІНИ У {offers.length} КНИГАРНЯХ</p>
      <div className="bdc-best">
        <Badge tone="green">Найкраща ціна</Badge>
        <div className="bdc-best__pricerow">
          {best.oldPrice ? <span className="bdc-best__old">{BDV.uah(best.oldPrice)}</span> : null}
          <span className="bdc-best__price">{BDV.uah(best.price)}</span>
        </div>
        <p className="bdc-best__store">у <b>{best.store}</b> · <span style={{ color: 'var(--brand-green)' }}>В наявності</span></p>
        <Button variant="primary" style={{ width: '100%' }}>Перейти до книгарні</Button>
      </div>
      <div>
        {rest.map((o) => {
          const av = BDV.AVAIL[o.avail];
          const out = o.avail === 'out';
          return (
            <div key={o.store} className={'bdc-row' + (out ? ' bdc-row--out' : '')}>
              <span className="bdc-row__store">{o.store}</span>
              <span className={'bdc-row__avail bd-offer__avail--' + av.cls}>{av.label}</span>
              {o.oldPrice && !out ? <span className="bdc-row__old">{BDV.uah(o.oldPrice)}</span> : null}
              <span className="bdc-row__price">{out ? '—' : BDV.uah(o.price)}</span>
              <Button variant="secondary" size="sm" disabled={out}>Перейти</Button>
            </div>
          );
        })}
      </div>
      {note ? <p className="bd-updated">{note}</p> : <p className="bd-updated">Ціни оновлено сьогодні о 08:00</p>}
      <BDV.Wishlist saved={wish.saved} alert={wish.alert} />
    </aside>
  );
}

function VariantBalanced({ theme, wish }) {
  const { Button } = BDV.DS;
  const book = BDV.BOOK;
  return (
    <BDV.Shell theme={theme} label={'Variant C Balanced ' + theme} frozen={true}>
      <div className="bdc-grid" data-screen-label="Balanced two-pane">
        <div className="bdc-left">
          <div className="bdc-idrow">
            <BDV.Cover size="md" />
            <div>
              <p className="bd-eyebrow">{book.genreEyebrow}</p>
              <h1 className="bd-h1">{book.title}</h1>
              <p className="bd-author">{book.author}</p>
            </div>
          </div>
          <div className="bd-desc">
            <p>{book.desc[0]}</p>
            <p>{book.desc[1]}</p>
          </div>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Button variant="ghost" size="sm">Читати опис повністю</Button>
          </div>
          <h2 className="bd-h2" style={{ marginTop: 'var(--space-8)' }}>Про видання</h2>
          <BDV.Meta book={book} />
        </div>
        <BDCPanel offers={BDV.OFFERS} wish={wish} />
      </div>

      <BDV.History />
      <BDV.Shelf title="Інші книги серії" books={BDV.SERIES_BOOKS} />
      <BDV.Shelf title="Інші книги автора" books={BDV.AUTHOR_BOOKS} />
    </BDV.Shell>
  );
}

/* ============================================================
   STATES — demonstrated on the Balanced (C) composition.
   Footer & header always present (frozen Search Results rule).
   ============================================================ */

/* Loading — warm --surface-accent blocks only, one-shot 280ms stagger. */
function StateLoading({ theme }) {
  const Sk = BDV.Sk;
  const stagger = BDV.useStagger();
  return (
    <BDV.Shell theme={theme} label="State loading" searchSkeleton crumbTail="…" frozen={true}>
      <div className={'bdc-grid' + stagger} aria-busy="true" data-screen-label="Loading state">
        <div>
          <div className="bdc-idrow">
            <div className="bd-sk" style={{ width: 220, height: 320, borderRadius: 'var(--radius-md)', flex: 'none' }}></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
              <Sk w="40%" h={10} />
              <Sk w="78%" h={26} />
              <Sk w="34%" h={14} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Sk w="96%" /><Sk w="92%" /><Sk w="88%" /><Sk w="55%" />
          </div>
        </div>
        <div className="bd-sk--card" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Sk w="45%" h={10} />
          <div className="bd-sk" style={{ height: 148, borderRadius: 'var(--radius-md)' }}></div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
              <Sk w="32%" h={13} /><Sk w="18%" h={10} style={{ marginLeft: 'auto' }} /><Sk w={64} h={18} />
            </div>
          ))}
        </div>
      </div>
      <section className="bd-section">
        <div className="bd-sk" style={{ height: 140, borderRadius: 'var(--radius-md)' }}></div>
      </section>
    </BDV.Shell>
  );
}

/* Partial data — honest gaps: no description yet, missing metadata,
   only two stores checked so far. Nothing is faked to look complete. */
function StatePartial({ theme, wish }) {
  const book = { ...BDV.BOOK, desc: null, isbn: null, series: null, genreEyebrow: 'ФЕНТЕЗІ' };
  const offers = BDV.OFFERS.slice(0, 2);
  return (
    <BDV.Shell theme={theme} label="State partial data" frozen={true}>
      <div className="bdc-grid" data-screen-label="Partial data state">
        <div className="bdc-left">
          <div className="bdc-idrow">
            <BDV.Cover size="md" />
            <div>
              <p className="bd-eyebrow">{book.genreEyebrow}</p>
              <h1 className="bd-h1">{book.title}</h1>
              <p className="bd-author">{book.author}</p>
            </div>
          </div>
          <BDV.Hint>Опис ще не додано — ми збираємо інформацію про це видання. Зазвичай це триває до одного дня.</BDV.Hint>
          <h2 className="bd-h2" style={{ marginTop: 'var(--space-8)' }}>Про видання</h2>
          <BDV.Meta book={book} missing="Уточнюємо…" />
        </div>
        <BDCPanel offers={offers} wish={wish} note="Перевіряємо ще 3 книгарні — список доповнюється." />
      </div>
      <BDV.History />
      <BDV.Shelf title="Інші книги автора" books={BDV.AUTHOR_BOOKS} />
    </BDV.Shell>
  );
}

/* Unavailable — no store has the book; Knyhovyk guides toward the
   wishlist + notification instead of a dead end. */
function StateUnavailable({ theme }) {
  const { Button } = BDV.DS;
  const book = BDV.BOOK;
  const mascot = theme === 'dark' ? 'assets/mascot/mascot-lantern.png' : 'assets/mascot/mascot-magnifier.png';
  const offers = BDV.OFFERS.map((o) => ({ ...o, avail: 'out' }));
  return (
    <BDV.Shell theme={theme} label="State unavailable" frozen={true}>
      <div className="bdc-grid" data-screen-label="Unavailable state">
        <div className="bdc-left">
          <div className="bdc-idrow">
            <BDV.Cover size="md" />
            <div>
              <p className="bd-eyebrow">{book.genreEyebrow}</p>
              <h1 className="bd-h1">{book.title}</h1>
              <p className="bd-author">{book.author}</p>
            </div>
          </div>
          <div className="bd-desc">
            <p>{book.desc[0]}</p>
          </div>
          <h2 className="bd-h2" style={{ marginTop: 'var(--space-8)' }}>Про видання</h2>
          <BDV.Meta book={book} />
        </div>
        <aside className="bdc-panel">
          <div className="bd-unavail">
            <img className="bd-unavail__mascot" src={mascot} alt="" />
            <h2 className="bd-unavail__title">Зараз немає в наявності</h2>
            <p className="bd-unavail__text">Жодна з 5 книгарень не має цієї книги. Збережіть її у вішлист — повідомимо, щойно вона з’явиться.</p>
            <Button variant="primary"><BDV.Icon name="bell" size={16} /> Повідомити про наявність</Button>
          </div>
          <div>
            {offers.map((o) => (
              <div key={o.store} className="bdc-row bdc-row--out">
                <span className="bdc-row__store">{o.store}</span>
                <span className="bdc-row__avail bd-offer__avail--out">Немає в наявності</span>
                <span className="bdc-row__price">—</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
      <BDV.History />
      <BDV.Shelf title="Інші книги серії — є в наявності" books={BDV.SERIES_BOOKS} />
    </BDV.Shell>
  );
}

window.BDVariants = { VariantEditorial, VariantPriceFirst, VariantBalanced, StateLoading, StatePartial, StateUnavailable };
