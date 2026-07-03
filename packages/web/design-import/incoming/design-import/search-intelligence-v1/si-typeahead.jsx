// Knyhovo · W7 — Search Intelligence · TYPEAHEAD
// One real suggestion component, shared by the static gallery and the
// live prototype. Composes DS exports + si.css. Exposed on window.SITA.
'use strict';

const { Icon, highlight, uah } = window.SI;

/* ---------------- Suggestion corpus (mock backend index) ---------------- */
const SITA_CORPUS = {
  titles: [
    { title: 'Гаррі Поттер і філософський камінь', author: 'Дж. К. Ролінґ', price: 285 },
    { title: 'Гаррі Поттер і таємна кімната', author: 'Дж. К. Ролінґ', price: 295 },
    { title: 'Гарвардський метод переговорів', author: 'Роджер Фішер', price: 260 },
    { title: 'Атомні звички', author: 'Джеймс Клір', price: 245 },
    { title: 'Дюна', author: 'Френк Герберт', price: 340 },
    { title: 'Відьмак. Останнє бажання', author: 'Анджей Сапковський', price: 265 },
    { title: 'Марсіянин', author: 'Енді Вейр', price: 295 },
    { title: 'Сяйво', author: 'Стівен Кінг', price: 310 },
    { title: 'Воно', author: 'Стівен Кінг', price: 480 },
    { title: 'Кобзар', author: 'Тарас Шевченко', price: 180 },
    { title: 'Маленький принц', author: 'Антуан де Сент-Екзюпері', price: 95 },
  ],
  authors: [
    { name: 'Гарпер Лі', meta: '3 книги' },
    { name: 'Стівен Кінг', meta: '64 книги' },
    { name: 'Анджей Сапковський', meta: '11 книг' },
    { name: 'Френк Герберт', meta: '6 книг' },
  ],
  series: [
    { name: 'Гаррі Поттер', meta: '7 книг · Дж. К. Ролінґ' },
    { name: 'Відьмак', meta: '8 книг · Анджей Сапковський' },
    { name: 'Дюна', meta: '6 книг · Френк Герберт' },
  ],
};

const SITA_RECENT = ['Стівен Кінг', 'атомні звички'];

// ISBN-ish: 10–13 digits possibly with dashes/spaces, or starts with 978/979.
function siLooksLikeIsbn(q) {
  const digits = q.replace(/[\s-]/g, '');
  return /^\d{3,13}$/.test(digits) && digits.length >= 6;
}

function siMatchGroups(q, recent = SITA_RECENT) {
  const query = q.trim().toLowerCase();
  if (!query) return { empty: true, recent };
  if (siLooksLikeIsbn(query)) return { isbn: q.trim() };
  const inc = (s) => s.toLowerCase().includes(query);
  return {
    titles: SITA_CORPUS.titles.filter((t) => inc(t.title) || inc(t.author)).slice(0, 4),
    authors: SITA_CORPUS.authors.filter((a) => inc(a.name)).slice(0, 2),
    series: SITA_CORPUS.series.filter((s) => inc(s.name)).slice(0, 2),
  };
}

/* ---------------- The dropdown list (presentational) ----------------
   `active` is a flat index for keyboard nav; rows expose data-active. */
function SITAList({ query, onPick, active = -1, onClearRecent, recent }) {
  const g = siMatchGroups(query, recent);
  let idx = -1; // flat counter across all interactive rows
  const Row = ({ icon, cover, primary, secondary, price, onClick, kbd }) => {
    idx += 1;
    const myIdx = idx;
    return (
      <button className="si-ta__row" type="button" data-active={myIdx === active}
        onClick={() => onPick && onPick(typeof onClick === 'string' ? onClick : primaryText(primary))}>
        {cover ? <span className="si-ta__cover"></span>
          : <span className="si-ta__ico"><Icon name={icon} /></span>}
        <span className="si-ta__txt">
          <span className="si-ta__primary">{primary}</span>
          {secondary && <span className="si-ta__secondary">{secondary}</span>}
        </span>
        {price != null && <span className="si-ta__price">{uah(price)}</span>}
        {kbd && <span className="si-ta__kbd">{kbd}</span>}
      </button>
    );
  };

  // Empty (idle) → recent searches
  if (g.empty) {
    return (
      <div className="si-ta" role="listbox" aria-label="Підказки пошуку">
        <div className="si-ta__group">
          <div className="si-ta__cap">
            <span>Нещодавні запити</span>
            <button className="si-ta__clear" type="button" onClick={onClearRecent}>Очистити</button>
          </div>
          {g.recent.map((r) => (
            <Row key={r} icon="clock" primary={r} onClick={r} />
          ))}
        </div>
        <div className="si-ta__group">
          <button className="si-ta__row" type="button" disabled
            style={{ cursor: 'default', color: 'var(--text-muted)' }}>
            <span className="si-ta__ico"><Icon name="sparkles" /></span>
            <span className="si-ta__txt"><span className="si-ta__primary" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Почніть вводити назву, автора, серію або ISBN</span></span>
          </button>
        </div>
      </div>
    );
  }

  // ISBN detected
  if (g.isbn) {
    return (
      <div className="si-ta" role="listbox" aria-label="Підказки пошуку">
        <div className="si-ta__group">
          <div className="si-ta__cap"><span>Розпізнано ISBN</span></div>
          <Row icon="scan" primary={<span><mark className="si-hl">{g.isbn}</mark></span>}
            secondary="Натисніть Enter, щоб знайти точне видання" onClick={g.isbn} kbd="↵" />
        </div>
      </div>
    );
  }

  const nothing = !g.titles.length && !g.authors.length && !g.series.length;
  if (nothing) {
    return (
      <div className="si-ta" role="listbox" aria-label="Підказки пошуку">
        <div className="si-ta__group">
          <button className="si-ta__row" type="button" onClick={() => onPick && onPick(query)}>
            <span className="si-ta__ico"><Icon name="search" /></span>
            <span className="si-ta__txt"><span className="si-ta__primary">Шукати «{query}»</span>
              <span className="si-ta__secondary">Точних підказок немає — покажемо найближчі збіги</span></span>
            <span className="si-ta__kbd">↵</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="si-ta" role="listbox" aria-label="Підказки пошуку">
      {g.titles.length > 0 && (
        <div className="si-ta__group">
          <div className="si-ta__cap"><span>Книги</span></div>
          {g.titles.map((t) => (
            <Row key={t.title} cover primary={highlight(t.title, query)} secondary={t.author} price={t.price} onClick={t.title} />
          ))}
        </div>
      )}
      {g.authors.length > 0 && (
        <div className="si-ta__group">
          <div className="si-ta__cap"><span>Автори</span></div>
          {g.authors.map((a) => (
            <Row key={a.name} icon="user" primary={highlight(a.name, query)} secondary={a.meta} onClick={a.name} />
          ))}
        </div>
      )}
      {g.series.length > 0 && (
        <div className="si-ta__group">
          <div className="si-ta__cap"><span>Серії</span></div>
          {g.series.map((s) => (
            <Row key={s.name} icon="layers" primary={highlight(s.name, query)} secondary={s.meta} onClick={s.name} />
          ))}
        </div>
      )}
    </div>
  );
}

// Pull a plain string out of a (possibly highlighted) primary node.
function primaryText(node) {
  if (typeof node === 'string') return node;
  if (node && node.props && node.props.children) {
    const ch = node.props.children;
    if (Array.isArray(ch)) return ch.map(primaryText).join('');
    return primaryText(ch);
  }
  return '';
}

// Count interactive rows for keyboard nav.
function siRowCount(query, recent) {
  const g = siMatchGroups(query, recent);
  if (g.empty) return g.recent.length;
  if (g.isbn) return 1;
  const n = (g.titles?.length || 0) + (g.authors?.length || 0) + (g.series?.length || 0);
  return n || 1;
}

// Flat list of pickable values for keyboard Enter.
function siRowValues(query, recent) {
  const g = siMatchGroups(query, recent);
  if (g.empty) return g.recent.slice();
  if (g.isbn) return [g.isbn];
  const vals = [];
  (g.titles || []).forEach((t) => vals.push(t.title));
  (g.authors || []).forEach((a) => vals.push(a.name));
  (g.series || []).forEach((s) => vals.push(s.name));
  return vals.length ? vals : [query];
}

window.SITA = { SITAList, siMatchGroups, siRowCount, siRowValues, siLooksLikeIsbn, CORPUS: SITA_CORPUS, RECENT: SITA_RECENT };
