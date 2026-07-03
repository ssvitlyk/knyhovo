// Knyhovo · W7 — Search Intelligence · DESKTOP canvas.
// Every intelligence state inside the real frozen Search Results page,
// light + dark. Composes DS exports + si.css. No page-layout redesign.
'use strict';

const { Page, Header, Footer, DS, DATA } = window.SI;
const SIB = window.SIB;
const { SITAList } = window.SITA;

/* Typeahead demo page — header + a relative SearchBar slot with the popover open. */
function SITypeaheadPage({ theme, query, label }) {
  const { SearchBar } = DS;
  return (
    <div className="bd-page" data-theme={theme} style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100%' }}>
      <div className="page">
        <Header theme={theme} />
        <main className="results" data-screen-label={label}>
          <p className="results__eyebrow">ПОШУК · 5 КНИГАРЕНЬ · НАЙНИЖЧІ ЦІНИ</p>
          <h1 className="results__title">Що ви шукаєте?</h1>
          <div className="results__search si-ta-wrap" style={{ position: 'relative' }}>
            <SearchBar value={query} onChange={() => {}} />
            <div className="si-ta--pop">
              <SITAList query={query} />
            </div>
          </div>
          <div style={{ height: 320 }}></div>
        </main>
        <Footer theme={theme} />
      </div>
    </div>
  );
}

function SIPageWith({ theme, query, summary, children, searchExtra }) {
  return <Page theme={theme} query={query} summary={summary} searchExtra={searchExtra}>{children}</Page>;
}

function SIDesktopCanvas() {
  return (
    <DesignCanvas>
      {/* ---------- 1 · No-results recovery ---------- */}
      <DCSection id="recovery" title="1 · Відновлення після нульового результату"
        subtitle="Жоден запит не веде в глухий кут. Високовпевнене виправлення застосовується автоматично (з поверненням до оригіналу); низьковпевнене показує «можливо» + перехід до автора/серії + найближчі збіги.">
        <DCArtboard id="rec-harry-l" label="«гари потер» → авто-виправлення · Світла" width={1320} height={1180}>
          <SIPageWith theme="light" query="гари потер" summary="Знайдено 7 книг">
            <SIB.SIRecoverHigh scenario="harry" />
          </SIPageWith>
        </DCArtboard>
        <DCArtboard id="rec-witcher-l" label="«ведьмак» → did-you-mean · Світла" width={1320} height={1180}>
          <SIPageWith theme="light" query="ведьмак" summary="Точних збігів немає">
            <SIB.SIRecoverLow scenario="witcher" />
          </SIPageWith>
        </DCArtboard>
        <DCArtboard id="rec-martian-l" label="«марсіянин енді веєр» → назва+автор · Світла" width={1320} height={980}>
          <SIPageWith theme="light" query="марсіянин енді веєр" summary="Знайдено 1 книгу">
            <SIB.SIRecoverHigh scenario="martian" />
          </SIPageWith>
        </DCArtboard>
        <DCArtboard id="rec-harry-d" label="«гари потер» → авто-виправлення · Темна" width={1320} height={1180}>
          <SIPageWith theme="dark" query="гари потер" summary="Знайдено 7 книг">
            <SIB.SIRecoverHigh scenario="harry" />
          </SIPageWith>
        </DCArtboard>
        <DCArtboard id="rec-witcher-d" label="«ведьмак» → did-you-mean · Темна" width={1320} height={1180}>
          <SIPageWith theme="dark" query="ведьмак" summary="Точних збігів немає">
            <SIB.SIRecoverLow scenario="witcher" />
          </SIPageWith>
        </DCArtboard>
      </DCSection>

      {/* ---------- 2 · Search suggestions (typeahead) ---------- */}
      <DCSection id="typeahead" title="2 · Підказки під час вводу (typeahead)"
        subtitle="Випадаюче меню під полем: нещодавні запити (idle) → книги (з обкладинкою + ціною) · автори · серії, із підсвіткою збігу. ISBN розпізнається на льоту. Жива версія — у «Search Suggestions — Live Prototype».">
        <DCArtboard id="ta-typing-l" label="Ввід «гар» · Світла" width={1320} height={720}>
          <SITypeaheadPage theme="light" query="гар" label="Typeahead — typing" />
        </DCArtboard>
        <DCArtboard id="ta-idle-l" label="Порожнє поле · нещодавні · Світла" width={1320} height={720}>
          <SITypeaheadPage theme="light" query="" label="Typeahead — idle" />
        </DCArtboard>
        <DCArtboard id="ta-isbn-l" label="Ввід ISBN · Світла" width={1320} height={560}>
          <SITypeaheadPage theme="light" query="978617120" label="Typeahead — ISBN" />
        </DCArtboard>
        <DCArtboard id="ta-typing-d" label="Ввід «гар» · Темна" width={1320} height={720}>
          <SITypeaheadPage theme="dark" query="гар" label="Typeahead — typing" />
        </DCArtboard>
        <DCArtboard id="ta-idle-d" label="Порожнє поле · нещодавні · Темна" width={1320} height={720}>
          <SITypeaheadPage theme="dark" query="" label="Typeahead — idle" />
        </DCArtboard>
      </DCSection>

      {/* ---------- 3 · ISBN intelligence ---------- */}
      <DCSection id="isbn" title="3 · ISBN-інтелект"
        subtitle="Поле розпізнає ISBN і шукає точне видання. Один збіг → книга. Кілька видань → вибір видання. Немає збігу → той самий empty-стан із діями.">
        <DCArtboard id="isbn-exact-l" label="Точний збіг · Світла" width={1320} height={760}>
          <SIPageWith theme="light" query={DATA.isbn.code} summary="Знайдено 1 точне видання за ISBN"
            searchExtra={<SIB.SIIsbnHint code={DATA.isbn.code} />}>
            {SIB.siGrid([DATA.isbn.exact])}
          </SIPageWith>
        </DCArtboard>
        <DCArtboard id="isbn-multi-l" label="Кілька видань · вибір · Світла" width={1320} height={1020}>
          <SIPageWith theme="light" query={DATA.isbn.code} summary="Цей ISBN має кілька видань"
            searchExtra={<SIB.SIIsbnHint code={DATA.isbn.code} />}>
            <SIB.SIWork work={DATA.isbn.multi.work} editions={DATA.isbn.multi.editions} screenLabel="ISBN — edition chooser" />
          </SIPageWith>
        </DCArtboard>
        <DCArtboard id="isbn-none-l" label="ISBN не знайдено · Світла" width={1320} height={920}>
          <SIPageWith theme="light" query="978-000-00-0000-0" summary="За цим ISBN нічого не знайдено"
            searchExtra={<SIB.SIIsbnHint code="978-000-00-0000-0" />}>
            <SIB.SIEmpty theme="light" typed="978-000-00-0000-0" />
          </SIPageWith>
        </DCArtboard>
        <DCArtboard id="isbn-multi-d" label="Кілька видань · вибір · Темна" width={1320} height={1020}>
          <SIPageWith theme="dark" query={DATA.isbn.code} summary="Цей ISBN має кілька видань"
            searchExtra={<SIB.SIIsbnHint code={DATA.isbn.code} />}>
            <SIB.SIWork work={DATA.isbn.multi.work} editions={DATA.isbn.multi.editions} screenLabel="ISBN — edition chooser" />
          </SIPageWith>
        </DCArtboard>
      </DCSection>

      {/* ---------- 4 · Ambiguous queries / editions ---------- */}
      <DCSection id="ambiguous" title="4 · Неоднозначні запити · канонічний твір + видання"
        subtitle="Назва-«гігант» (Дюна, Кобзар, Маленький принц) групується в один канонічний твір, під яким зібрані всі видання. Ціна показується за найдешевшим продавцем кожного формату.">
        <DCArtboard id="amb-l" label="«Маленький принц» · 9 видань · Світла" width={1320} height={1020}>
          <SIPageWith theme="light" query="Маленький принц" summary="Один твір · 9 видань">
            <SIB.SIWork work={DATA.work} editions={DATA.work.editions} screenLabel="Ambiguous — canonical work" />
          </SIPageWith>
        </DCArtboard>
        <DCArtboard id="amb-d" label="«Маленький принц» · 9 видань · Темна" width={1320} height={1020}>
          <SIPageWith theme="dark" query="Маленький принц" summary="Один твір · 9 видань">
            <SIB.SIWork work={DATA.work} editions={DATA.work.editions} screenLabel="Ambiguous — canonical work" />
          </SIPageWith>
        </DCArtboard>
      </DCSection>

      {/* ---------- 5 · Author exploration ---------- */}
      <DCSection id="author" title="5 · Дослідження автора"
        subtitle="Запит лише з іменем автора відкриває добірку: заголовок із кількістю книг та читачів, що відстежують, + перемикач Популярні / Найвідстежуваніші / Найдешевші над сіткою BookCard.">
        <DCArtboard id="auth-l" label="«Стівен Кінг» · добірка · Світла" width={1320} height={980}>
          <SIPageWith theme="light" query="Стівен Кінг" summary="Автор · 64 книги">
            <SIB.SIAuthorLanding />
          </SIPageWith>
        </DCArtboard>
        <DCArtboard id="auth-d" label="«Стівен Кінг» · добірка · Темна" width={1320} height={980}>
          <SIPageWith theme="dark" query="Стівен Кінг" summary="Автор · 64 книги">
            <SIB.SIAuthorLanding />
          </SIPageWith>
        </DCArtboard>
      </DCSection>

      {/* ---------- 6 · Series navigation ---------- */}
      <DCSection id="series" title="6 · Навігація серією"
        subtitle="Користувач потрапив на один том — показуємо всю серію в порядку читання: номер тому, наявність, найкраща ціна, мітка «у вішлисті». Перемикач порядку читання / дати виходу.">
        <DCArtboard id="ser-l" label="Серія «Відьмак» · порядок читання · Світла" width={1320} height={1040}>
          <SIPageWith theme="light" query="Відьмак" summary="Серія · 8 книг">
            <SIB.SISeriesRail />
          </SIPageWith>
        </DCArtboard>
        <DCArtboard id="ser-d" label="Серія «Відьмак» · порядок читання · Темна" width={1320} height={1040}>
          <SIPageWith theme="dark" query="Відьмак" summary="Серія · 8 книг">
            <SIB.SISeriesRail />
          </SIPageWith>
        </DCArtboard>
      </DCSection>

      {/* ---------- 7 · Empty + error states ---------- */}
      <DCSection id="empty-error" title="7 · Порожні та помилкові стани"
        subtitle="Книги немає ніде → мускот-провідник + три дії (стежити · попросити додати · вказати ISBN). Помилка сервісу — локальна, відновлювана. Частковий індекс — спокійне попередження над результатами.">
        <DCArtboard id="empty-l" label="Не знайдено ніде · Світла" width={1320} height={920}>
          <SIPageWith theme="light" query="rare obscure title" summary="Нічого не знайдено">
            <SIB.SIEmpty theme="light" typed="rare obscure title" />
          </SIPageWith>
        </DCArtboard>
        <DCArtboard id="empty-d" label="Не знайдено ніде · Темна" width={1320} height={920}>
          <SIPageWith theme="dark" query="rare obscure title" summary="Нічого не знайдено">
            <SIB.SIEmpty theme="dark" typed="rare obscure title" />
          </SIPageWith>
        </DCArtboard>
        <DCArtboard id="err-l" label="Помилка пошуку · Світла" width={1320} height={680}>
          <SIPageWith theme="light" query="психологія" summary={undefined}>
            <SIB.SISysError />
          </SIPageWith>
        </DCArtboard>
        <DCArtboard id="partial-l" label="Частковий індекс · Світла" width={1320} height={920}>
          <SIPageWith theme="light" query="Дюна" summary="Знайдено 12 книг">
            <SIB.SIPartial />
            {SIB.siGrid(DATA.recover.harry.results)}
          </SIPageWith>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('si-root')).render(<SIDesktopCanvas />);
