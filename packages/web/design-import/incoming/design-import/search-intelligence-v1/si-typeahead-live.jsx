// Knyhovo · W7 — Search Intelligence · LIVE TYPEAHEAD PROTOTYPE
// A real, interactive search field: type → live suggestions, keyboard
// nav (↑ ↓ ↵ Esc), click-to-pick, recent searches, ISBN detection.
// Composes the DS .kn-field visual + si.css. Theme + last query persist.
'use strict';

const { Header, Footer, DS, Icon } = window.SI;
const { SITAList, siRowValues, siLooksLikeIsbn } = window.SITA;

const LS_THEME = 'kn-theme';
const LS_RECENT = 'si-recent-v1';

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(LS_RECENT)) || ['Стівен Кінг', 'атомні звички']; }
  catch (e) { return ['Стівен Кінг', 'атомні звички']; }
}

// Where would a committed query route? (implementation-oriented routing model)
function routeFor(q) {
  const v = q.trim();
  if (!v) return null;
  if (siLooksLikeIsbn(v)) return { kind: 'ISBN', icon: 'scan', to: 'Точне видання за ISBN', note: 'Кілька видань → вибір видання.' };
  const low = v.toLowerCase();
  const series = window.SITA.CORPUS.series.find((s) => s.name.toLowerCase() === low);
  if (series) return { kind: 'Серія', icon: 'layers', to: series.name, note: 'Навігація серією в порядку читання.' };
  const author = window.SITA.CORPUS.authors.find((a) => a.name.toLowerCase() === low);
  if (author) return { kind: 'Автор', icon: 'user', to: author.name, note: 'Сторінка добірки автора.' };
  const title = window.SITA.CORPUS.titles.find((t) => t.title.toLowerCase() === low);
  if (title) return { kind: 'Книга', icon: 'bookOpen', to: title.title, note: 'Сторінка книги з найкращою ціною.' };
  // typo demo
  if (low === 'гари потер') return { kind: 'Виправлення', icon: 'sparkles', to: 'Гаррі Поттер', note: 'Авто-виправлення + результати.' };
  if (low === 'ведьмак') return { kind: 'Did-you-mean', icon: 'sparkles', to: 'Відьмак', note: 'Підказка переходу до серії/автора.' };
  return { kind: 'Результати', icon: 'search', to: '«' + v + '»', note: 'Сторінка результатів пошуку.' };
}

function LiveField({ value, onChange, onCommit, open, setOpen, active, setActive, count }) {
  const ref = React.useRef(null);
  const onKeyCapture = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min((a < 0 ? -1 : a) + 1, count - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    else if (e.key === 'Enter') { e.preventDefault(); onCommit(active); }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
  };
  return (
    <div className="kn-field" onKeyDownCapture={onKeyCapture}
      role="combobox" aria-expanded={open} aria-haspopup="listbox">
      <span className="kn-field__icon"><Icon name="search" style={{ width: 20, height: 20 }} /></span>
      <input ref={ref} type="search" value={value}
        placeholder="Назва книги, автора або ISBN…"
        aria-label="Пошук"
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }} />
      <button type="button" className="kn-btn kn-btn--primary" onClick={() => onCommit(-1)}>Знайти</button>
    </div>
  );
}

function LiveApp() {
  const { Chip, ThemeToggle } = DS;
  const [theme, setTheme] = React.useState(() => localStorage.getItem(LS_THEME) || 'light');
  const [value, setValue] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [recent, setRecent] = React.useState(loadRecent);
  const [committed, setCommitted] = React.useState(null);

  React.useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem(LS_THEME, theme); }, [theme]);

  const rows = siRowValues(value, recent);
  const count = rows.length;

  const commit = (idx) => {
    const q = (idx != null && idx >= 0 && rows[idx] != null) ? rows[idx] : value;
    commitStr(q);
  };

  const commitStr = (q) => {
    if (!q || !q.trim()) return;
    setValue(q);
    setOpen(false);
    setActive(-1);
    setCommitted(q);
    setRecent((r) => {
      const next = [q, ...r.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
      localStorage.setItem(LS_RECENT, JSON.stringify(next));
      return next;
    });
  };

  const clearRecent = () => { setRecent([]); localStorage.setItem(LS_RECENT, JSON.stringify([])); };

  const route = committed ? routeFor(committed) : null;
  const seeds = ['гар', 'ведьмак', 'Маленький принц', 'Стівен Кінг', '978-617-12-0512-3'];

  return (
    <div className="bd-page" data-theme={theme} style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <div className="page">
        <Header theme={theme} onTheme={setTheme} />
      </div>
      <div className="si-live">
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <p className="si-live__eyebrow">W7 · Підказки пошуку — живий прототип</p>
        </div>
        <h1 className="si-live__title">Почніть вводити — <em>Книговик підкаже</em></h1>
        <p className="si-live__lead">
          Живі підказки: книги з обкладинкою та ціною, автори, серії та нещодавні запити. Спробуйте друкарську помилку,
          ISBN або лише ім’я автора. Працюють ↑ ↓ для вибору, ↵ щоб перейти, Esc щоб закрити.
        </p>

        <div className="si-ta-wrap" style={{ position: 'relative', maxWidth: 640 }}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
          <LiveField value={value} onChange={setValue} onCommit={commit}
            open={open} setOpen={setOpen} active={active} setActive={setActive} count={count} />
          {open && (
            <div className="si-ta--pop">
              <SITAList query={value} active={active} recent={recent}
                onPick={commitStr}
                onClearRecent={clearRecent} />
            </div>
          )}
        </div>

        <div className="si-live__seed">
          <span className="si-live__hint" style={{ marginTop: 0, marginRight: 'var(--space-1)' }}>Спробуйте:</span>
          {seeds.map((s) => (
            <Chip key={s} onClick={() => { setValue(s); setOpen(true); setActive(-1); }}>{s}</Chip>
          ))}
        </div>

        {route && (
          <div className="si-jump" style={{ cursor: 'default', marginTop: 'var(--space-10)', maxWidth: 640 }} data-screen-label="Routing result">
            <span className="si-jump__icon"><Icon name={route.icon} /></span>
            <span className="si-jump__body">
              <span className="si-jump__kind">Перехід · {route.kind}</span>
              <span className="si-jump__name">{route.to}</span>
              <span className="si-jump__meta">{route.note}</span>
            </span>
            <span className="si-jump__chev"><Icon name="arrowRight" /></span>
          </div>
        )}
      </div>
      <div className="page"><Footer theme={theme} /></div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('si-root')).render(<LiveApp />);
