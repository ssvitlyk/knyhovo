// Knyhovo · W7 — Search Intelligence · MOBILE canvas.
// The same intelligence layer inside the frozen <768px Search Results
// layout: compact header, full-width search, single-column, 44px targets,
// full-screen typeahead sheet. Light + dark. Composes DS + si.css only.
'use strict';

const { Header, Footer, DS, DATA } = window.SI;
const SIBm = window.SIB;
const { SITAList: SITAListM } = window.SITA;

/* Compact mobile chrome — logo · theme toggle · menu (44px targets). */
function SIMShell({ theme, query, summary, children, searchExtra, label }) {
  const { SearchBar, ThemeToggle } = DS;
  const logo = theme === 'dark' ? '../../assets/logo/knyhovo-logo-dark.png' : '../../assets/logo/knyhovo-logo-light.png';
  return (
    <div className="si-m" data-theme={theme} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="si-m__head" data-screen-label="Mobile header">
        <img className="si-m__logo" src={logo} alt="Knyhovo" />
        <div className="si-m__head-actions">
          <ThemeToggle theme={theme} />
          <button className="si-m__icon-btn" aria-label="Меню"><window.SI.Icon name="list" /></button>
        </div>
      </div>
      <div className="si-m__body" data-screen-label={label}>
        <p className="results__eyebrow">ПОШУК · 5 КНИГАРЕНЬ</p>
        {query !== undefined && <h1 className="si-m__title">Результати для <em>«{query}»</em></h1>}
        <div className="results__search">
          <SearchBar value={query || ''} onChange={() => {}} />
          {searchExtra}
        </div>
        {summary !== undefined && (
          <div className="results__toolbar"><p className="results__summary">{summary}</p></div>
        )}
        {children}
      </div>
      <div className="page"><Footer theme={theme} /></div>
    </div>
  );
}

/* Full-screen typeahead sheet (mobile pattern: field stays, results fill). */
function SIMSheet({ theme, query, label }) {
  const { SearchBar } = DS;
  return (
    <div className="si-m" data-theme={theme} style={{ background: 'var(--surface)', color: 'var(--text)' }}>
      <div className="si-sheet" data-screen-label={label}>
        <div className="si-sheet__bar">
          <div style={{ flex: 1 }}><SearchBar value={query} onChange={() => {}} buttonLabel="Шукати" /></div>
          <button className="si-sheet__cancel" type="button">Скасувати</button>
        </div>
        <SITAListM query={query} />
      </div>
    </div>
  );
}

function SIMobileCanvas() {
  const W = 375;
  return (
    <DesignCanvas>
      {/* 1 · Recovery */}
      <DCSection id="m-recovery" title="1 · Відновлення · мобільна"
        subtitle="Той самий зміст у вертикальному стеку: повідомлення про виправлення на всю ширину, перехід до серії/автора картками, найближчі збіги — одна колонка.">
        <DCArtboard id="m-rec-harry-l" label="«гари потер» · авто · Світла" width={W} height={1080}>
          <SIMShell theme="light" query="гари потер" summary="Знайдено 7 книг" label="Recovery — auto"><SIBm.SIRecoverHigh scenario="harry" /></SIMShell>
        </DCArtboard>
        <DCArtboard id="m-rec-witcher-l" label="«ведьмак» · did-you-mean · Світла" width={W} height={1040}>
          <SIMShell theme="light" query="ведьмак" summary="Точних збігів немає" label="Recovery — dym"><SIBm.SIRecoverLow scenario="witcher" /></SIMShell>
        </DCArtboard>
        <DCArtboard id="m-rec-harry-d" label="«гари потер» · авто · Темна" width={W} height={1080}>
          <SIMShell theme="dark" query="гари потер" summary="Знайдено 7 книг" label="Recovery — auto"><SIBm.SIRecoverHigh scenario="harry" /></SIMShell>
        </DCArtboard>
      </DCSection>

      {/* 2 · Typeahead sheet */}
      <DCSection id="m-typeahead" title="2 · Підказки · повноекранний аркуш"
        subtitle="На мобільному typeahead — повноекранний аркуш: поле зверху + кнопка «Скасувати», списки нещодавніх / книг / авторів / серій на всю ширину, рядки ≥44px.">
        <DCArtboard id="m-ta-typing-l" label="Ввід «гар» · Світла" width={W} height={620}>
          <SIMSheet theme="light" query="гар" label="Typeahead sheet — typing" />
        </DCArtboard>
        <DCArtboard id="m-ta-idle-l" label="Нещодавні · Світла" width={W} height={420}>
          <SIMSheet theme="light" query="" label="Typeahead sheet — idle" />
        </DCArtboard>
        <DCArtboard id="m-ta-isbn-l" label="Ввід ISBN · Світла" width={W} height={320}>
          <SIMSheet theme="light" query="978617120" label="Typeahead sheet — ISBN" />
        </DCArtboard>
        <DCArtboard id="m-ta-typing-d" label="Ввід «гар» · Темна" width={W} height={620}>
          <SIMSheet theme="dark" query="гар" label="Typeahead sheet — typing" />
        </DCArtboard>
      </DCSection>

      {/* 3 · ISBN */}
      <DCSection id="m-isbn" title="3 · ISBN · мобільна"
        subtitle="Поле розпізнає ISBN; вибір видання — вертикальні рядки з повноширинною CTA.">
        <DCArtboard id="m-isbn-multi-l" label="Кілька видань · Світла" width={W} height={1020}>
          <SIMShell theme="light" query={DATA.isbn.code} summary="Кілька видань за ISBN" label="ISBN — editions"
            searchExtra={<SIBm.SIIsbnHint code={DATA.isbn.code} />}>
            <SIBm.SIWork work={DATA.isbn.multi.work} editions={DATA.isbn.multi.editions} screenLabel="ISBN — editions" />
          </SIMShell>
        </DCArtboard>
        <DCArtboard id="m-isbn-multi-d" label="Кілька видань · Темна" width={W} height={1020}>
          <SIMShell theme="dark" query={DATA.isbn.code} summary="Кілька видань за ISBN" label="ISBN — editions"
            searchExtra={<SIBm.SIIsbnHint code={DATA.isbn.code} />}>
            <SIBm.SIWork work={DATA.isbn.multi.work} editions={DATA.isbn.multi.editions} screenLabel="ISBN — editions" />
          </SIMShell>
        </DCArtboard>
      </DCSection>

      {/* 4 · Ambiguous / editions */}
      <DCSection id="m-ambiguous" title="4 · Канонічний твір + видання · мобільна"
        subtitle="Назва-«гігант» згортається в один твір; видання стають вертикальним списком із ціною за найдешевшим продавцем.">
        <DCArtboard id="m-amb-l" label="«Маленький принц» · Світла" width={W} height={1080}>
          <SIMShell theme="light" query="Маленький принц" summary="Один твір · 9 видань" label="Ambiguous — work">
            <SIBm.SIWork work={DATA.work} editions={DATA.work.editions} screenLabel="Ambiguous — work" />
          </SIMShell>
        </DCArtboard>
      </DCSection>

      {/* 5 · Author */}
      <DCSection id="m-author" title="5 · Дослідження автора · мобільна"
        subtitle="Заголовок автора + перемикач добірок (горизонтальний скрол чипів) над одноколонковою сіткою книг.">
        <DCArtboard id="m-auth-l" label="«Стівен Кінг» · Світла" width={W} height={1100}>
          <SIMShell theme="light" query="Стівен Кінг" summary="Автор · 64 книги" label="Author landing"><SIBm.SIAuthorLanding /></SIMShell>
        </DCArtboard>
      </DCSection>

      {/* 6 · Series */}
      <DCSection id="m-series" title="6 · Навігація серією · мобільна"
        subtitle="Серія в порядку читання: компактні рядки з номером тому, наявністю та ціною; перемикач порядку зверху.">
        <DCArtboard id="m-ser-l" label="Серія «Відьмак» · Світла" width={W} height={1040}>
          <SIMShell theme="light" query="Відьмак" summary="Серія · 8 книг" label="Series nav"><SIBm.SISeriesRail /></SIMShell>
        </DCArtboard>
      </DCSection>

      {/* 7 · Empty + error */}
      <DCSection id="m-empty-error" title="7 · Порожні та помилкові стани · мобільна"
        subtitle="Не знайдено ніде → мускот + три дії стовпчиком (рядкові картки). Помилка — локальна, відновлювана. Частковий індекс — попередження над сіткою.">
        <DCArtboard id="m-empty-l" label="Не знайдено ніде · Світла" width={W} height={880}>
          <SIMShell theme="light" query="rare obscure title" summary="Нічого не знайдено" label="Empty — not found"><SIBm.SIEmpty theme="light" typed="rare obscure title" /></SIMShell>
        </DCArtboard>
        <DCArtboard id="m-empty-d" label="Не знайдено ніде · Темна" width={W} height={880}>
          <SIMShell theme="dark" query="rare obscure title" summary="Нічого не знайдено" label="Empty — not found"><SIBm.SIEmpty theme="dark" typed="rare obscure title" /></SIMShell>
        </DCArtboard>
        <DCArtboard id="m-err-l" label="Помилка пошуку · Світла" width={W} height={560}>
          <SIMShell theme="light" query="психологія" label="Search error"><SIBm.SISysError /></SIMShell>
        </DCArtboard>
        <DCArtboard id="m-partial-l" label="Частковий індекс · Світла" width={W} height={920}>
          <SIMShell theme="light" query="Дюна" summary="Знайдено 12 книг" label="Partial index">
            <SIBm.SIPartial />
            {SIBm.siGrid(DATA.recover.harry.results.slice(0, 3))}
          </SIMShell>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('si-root')).render(<SIMobileCanvas />);
