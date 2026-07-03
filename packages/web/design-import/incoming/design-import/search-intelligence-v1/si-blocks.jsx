// Knyhovo · W7 — Search Intelligence · BLOCKS
// Presentational intelligence components composed from DS exports +
// the si.css layer. No new visual language. Exposed on window.SIB.
'use strict';

const { DS, Icon, highlight, uah, DATA } = window.SI;

/* Build a DS Badge from a book's badge tag (+ derive -N% from oldPrice). */
function siBadge(book) {
  const { Badge } = DS;
  if (!book.badge) return null;
  if (book.badge === 'green') return <Badge tone="green">Найкраща ціна</Badge>;
  if (book.badge === 'accent') return <Badge tone="accent">Новинка</Badge>;
  if (book.badge === 'solid' && book.oldPrice) {
    return <Badge tone="solid">{'-' + Math.round((1 - book.price / book.oldPrice) * 100) + '%'}</Badge>;
  }
  return null;
}

function siGrid(books) {
  const { BookCard } = DS;
  return (
    <div className="results__grid">
      {books.map((b) => (
        <BookCard key={b.title} title={b.title} author={b.author}
          price={uah(b.price)} oldPrice={b.oldPrice ? uah(b.oldPrice) : null}
          store={b.store} badge={siBadge(b)} />
      ))}
    </div>
  );
}

/* ---------------- Jump card → author or series ---------------- */
function SIJump({ data }) {
  return (
    <button className="si-jump" type="button">
      <span className="si-jump__icon"><Icon name={data.icon} /></span>
      <span className="si-jump__body">
        <span className="si-jump__kind">{data.kind}</span>
        <span className="si-jump__name">{data.name}</span>
        <span className="si-jump__meta">{data.meta}</span>
      </span>
      <span className="si-jump__chev"><Icon name="chevron" /></span>
    </button>
  );
}

/* ---------------- Recovery — high-confidence auto-correction ---------------- */
function SICorrectNotice({ typed, corrected, note }) {
  return (
    <div className="si-correct" data-screen-label="Auto-correction notice">
      <span className="si-correct__icon"><Icon name="sparkles" /></span>
      <div className="si-correct__body">
        <p className="si-correct__line">
          Показано результати для <strong>«{corrected}»</strong>.
          {note ? ' ' + note : ''}
        </p>
        <button className="si-correct__alt" type="button">
          Натомість шукати <q>«{typed}»</q>
        </button>
      </div>
    </div>
  );
}

/* High-confidence: corrected, results grid, optional series/author jump. */
function SIRecoverHigh({ scenario }) {
  const d = DATA.recover[scenario];
  return (
    <div data-screen-label="No-results recovery · auto-corrected">
      <SICorrectNotice typed={d.typed} corrected={d.corrected} note={d.note} />
      {d.jump && <div className="si-block"><SIJump data={d.jump} /></div>}
      <p className="si-label"><Icon name="search" />Знайдено за виправленим запитом</p>
      {siGrid(d.results)}
    </div>
  );
}

/* Low-confidence: did-you-mean chips + author/series jumps + closest matches. */
function SIRecoverLow({ scenario }) {
  const { Chip } = DS;
  const d = DATA.recover[scenario];
  return (
    <div data-screen-label="No-results recovery · did-you-mean">
      <div className="si-correct">
        <span className="si-correct__icon"><Icon name="sparkles" /></span>
        <div className="si-correct__body">
          <p className="si-correct__line">
            За запитом <strong>«{d.typed}»</strong> нічого не знайдено. {d.note}
          </p>
          <div className="si-dym" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
            <span className="si-dym__label">Можливо:</span>
            {d.candidates.map((c) => <Chip key={c}>{c}</Chip>)}
          </div>
        </div>
      </div>
      {d.jumps && <div className="si-block" style={{ marginTop: 'var(--space-6)' }}>{d.jumps.map((j) => <SIJump key={j.name} data={j} />)}</div>}
      {d.results && (
        <React.Fragment>
          <p className="si-label"><Icon name="search" />Найближчі збіги</p>
          {siGrid(d.results)}
        </React.Fragment>
      )}
    </div>
  );
}

/* ---------------- ISBN — detected hint under the field ---------------- */
function SIIsbnHint({ code }) {
  return (
    <div className="si-correct" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }} data-screen-label="ISBN detected">
      <span className="si-correct__icon"><Icon name="scan" /></span>
      <div className="si-correct__body">
        <p className="si-correct__line">Схоже на <strong>ISBN</strong> — шукаємо точне видання за номером <q style={{ fontStyle: 'normal', color: 'var(--text-body)' }}>{code}</q>.</p>
      </div>
    </div>
  );
}

/* ---------------- Editions / canonical work group ---------------- */
function SIWork({ work, editions, screenLabel }) {
  const { Button, Badge } = DS;
  return (
    <div className="si-work" data-screen-label={screenLabel || 'Canonical work + editions'}>
      <div className="si-work__head">
        <div className="si-work__cover"></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="si-work__title">{work.title}</h2>
          <p className="si-work__author">{work.author}</p>
          {work.note && <p className="si-work__note">{work.note}</p>}
          <p className="si-work__from">Найкраща ціна від <b>{uah(work.from)}</b> · {work.count} видань у {work.stores} книгарнях</p>
        </div>
      </div>
      <div className="si-eds">
        <div className="si-eds__cap">
          <span>Оберіть видання</span>
          <span>Ціна за найдешевшим продавцем</span>
        </div>
        {editions.map((e) => (
          <div className="si-ed" key={e.fmt}>
            <div className="si-ed__fmt">
              <div className="si-ed__fmt-name">
                {e.fmt}{' '}
                {e.best && <Badge tone="green">Найкраща ціна</Badge>}
              </div>
              <div className="si-ed__fmt-meta">{e.meta}</div>
            </div>
            <div className="si-ed__right">
              <span className="si-ed__price">{uah(e.price)}</span>
              <span className="si-ed__store">· {e.store}</span>
            </div>
            <Button variant={e.best ? 'primary' : 'secondary'} size="sm">Переглянути</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Author landing — header + segmented tabs + grid ---------------- */
function SIAuthorLanding() {
  const { Chip } = DS;
  const a = DATA.author;
  const [tab, setTab] = React.useState(a.tabs[0]);
  return (
    <div data-screen-label="Author landing">
      <div className="si-jump" style={{ cursor: 'default', marginBottom: 'var(--space-6)' }}>
        <span className="si-jump__icon"><Icon name="user" /></span>
        <span className="si-jump__body">
          <span className="si-jump__kind">Автор</span>
          <span className="si-author__name" style={{ fontSize: 'var(--fs-h3)' }}>{a.name}</span>
          <span className="si-jump__meta"><b style={{ color: 'var(--text-body)' }}>{a.meta.books}</b> книг · відстежують <b style={{ color: 'var(--text-body)' }}>{a.meta.tracked.toLocaleString('uk')}</b> читачів</span>
        </span>
      </div>
      <div className="si-tabs" role="group" aria-label="Добірки автора">
        {a.tabs.map((t) => <Chip key={t} selected={tab === t} onClick={() => setTab(t)}>{t}</Chip>)}
      </div>
      {siGrid(a.books[tab])}
    </div>
  );
}

/* ---------------- Series rail — reading-order volumes ---------------- */
function SISeriesRail() {
  const { Button, Badge, Chip } = DS;
  const s = DATA.series;
  const [order, setOrder] = React.useState('reading');
  const dotLabel = { ok: 'В наявності', soon: 'Закінчується', out: 'Немає в наявності' };
  return (
    <div data-screen-label="Series navigation">
      <div className="si-jump" style={{ cursor: 'default', marginBottom: 'var(--space-5)' }}>
        <span className="si-jump__icon"><Icon name="layers" /></span>
        <span className="si-jump__body">
          <span className="si-jump__kind">Серія</span>
          <span className="si-jump__name">{s.name}</span>
          <span className="si-jump__meta">{s.meta} · {s.author}</span>
        </span>
      </div>
      <div className="si-series__bar">
        <p className="si-label" style={{ margin: 0 }}><Icon name="list" />Порядок</p>
        <div className="si-tabs" style={{ margin: 0 }}>
          <Chip selected={order === 'reading'} onClick={() => setOrder('reading')}>За порядком читання</Chip>
          <Chip selected={order === 'date'} onClick={() => setOrder('date')}>За датою виходу</Chip>
        </div>
      </div>
      <div className="si-series__list">
        {s.volumes.map((v) => (
          <div className={'si-vol' + (v.owned ? ' si-vol--owned' : '')} key={v.no}>
            <span className="si-vol__no">{v.no}</span>
            <span className="si-vol__cover"></span>
            <span className="si-vol__body">
              <span className="si-vol__title">{v.title}</span>
              <span className="si-vol__sub">
                {v.tag && <span>{v.tag}</span>}
                <span><span className={'si-dot si-dot--' + v.avail}></span> {dotLabel[v.avail]}</span>
                {v.owned && <Badge tone="neutral">У вішлисті</Badge>}
              </span>
            </span>
            <span className="si-vol__price">{uah(v.price)}</span>
            <span className="si-vol__cta">
              <Button variant="secondary" size="sm" disabled={v.avail === 'out'}>
                {v.avail === 'out' ? 'Стежити' : 'Переглянути'}
              </Button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Empty — not found anywhere (mascot + actions) ---------------- */
function SIEmpty({ theme, typed }) {
  const { Button } = DS;
  const mascot = theme === 'dark' ? '../../assets/mascot/mascot-lantern.png' : '../../assets/mascot/mascot-magnifier.png';
  return (
    <div className="si-empty" data-screen-label="Empty — not found anywhere">
      <img className="si-empty__mascot" src={mascot} alt="" />
      <h3 className="si-empty__title">Поки що не маємо «{typed}»</h3>
      <p className="si-empty__text">
        Книговик перевірив усі 5 книгарень і не знайшов цю книгу. Ми можемо стежити за її появою або попросити книгарні додати її.
      </p>
      <div className="si-actions">
        <div className="si-act">
          <span className="si-act__icon"><Icon name="bell" /></span>
          <span className="si-act__title">Стежити за появою</span>
          <span className="si-act__text">Повідомимо, щойно книга з’явиться в будь-якій книгарні.</span>
          <Button variant="primary" size="sm">Стежити</Button>
        </div>
        <div className="si-act">
          <span className="si-act__icon"><Icon name="bookPlus" /></span>
          <span className="si-act__title">Попросити додати</span>
          <span className="si-act__text">Передамо запит книгарням-партнерам на додавання книги.</span>
          <Button variant="secondary" size="sm">Надіслати запит</Button>
        </div>
        <div className="si-act">
          <span className="si-act__icon"><Icon name="scan" /></span>
          <span className="si-act__title">Вказати ISBN</span>
          <span className="si-act__text">Знаєте номер видання? Так ми знайдемо книгу точніше.</span>
          <Button variant="secondary" size="sm">Додати ISBN</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Errors — recoverable service failure & partial index ---------------- */
function SISysError() {
  const { Button } = DS;
  return (
    <div className="si-syserr" data-screen-label="Search error — recoverable">
      <span className="si-syserr__icon"><Icon name="cloudOff" /></span>
      <h3 className="si-syserr__title">Не вдалося виконати пошук</h3>
      <p className="si-syserr__text">Сталася тимчасова помилка. Ваш запит збережено — спробуйте ще раз.</p>
      <div style={{ marginTop: 'var(--space-4)' }}><Button variant="primary" size="sm">Спробувати ще раз</Button></div>
    </div>
  );
}

function SIPartial() {
  const { Button } = DS;
  return (
    <div className="si-partial" data-screen-label="Partial index notice">
      <Icon name="alert" />
      <span>Деякі книгарні зараз не відповідають — показано ціни з 3 з 5. Результати можуть оновитися.</span>
      <Button variant="ghost" size="sm">Оновити</Button>
    </div>
  );
}

window.SIB = {
  siBadge, siGrid, SIJump, SICorrectNotice,
  SIRecoverHigh, SIRecoverLow, SIIsbnHint, SIWork,
  SIAuthorLanding, SISeriesRail, SIEmpty, SISysError, SIPartial,
};
