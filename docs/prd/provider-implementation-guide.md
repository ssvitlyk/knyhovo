# Provider Implementation Guide

> **Тип:** PRD / implementation guide. **Статус:** Чорновик (2026-06-27).
> **Скоуп:** єдиний стандарт додавання нових scraper-провайдерів книгарень (Tier A з
> [bookstore-feasibility.md](../research/bookstore-feasibility.md)). Описує структуру файлів,
> contract, тести й acceptance criteria, щоб усі провайдери додавались однотипно. **Архітектуру
> не змінюємо** — кожен Tier A-кандидат лягає у наявний `ScraperProvider`.
> **Споріднені доки:** [provider-integration-strategy.md](../research/provider-integration-strategy.md)
> (типологія `ScraperProvider` / `ApiProvider` / `FeedProvider` / `DisabledProvider`),
> [bookstore-feasibility.md](../research/bookstore-feasibility.md) (ранжування провайдерів),
> [agent_docs/scraper-development.md](../../agent_docs/scraper-development.md) (базові кроки),
> [agent_docs/testing-guide.md](../../agent_docs/testing-guide.md).
>
> **Правило проєкту:** код під конкретний провайдер не пишеться до підтвердження **окремого
> per-provider PRD**. Цей документ — «парасолька», на яку ті PRD спираються. Він **не** є
> дозволом на імплементацію жодного провайдера.

---

## TL;DR

- Кожен новий провайдер = окрема папка `packages/scrapers/src/providers/<slug>/`, що реалізує
  інтерфейс `ScraperProvider` і повертає стабільний масив `RawProviderListing[]`.
- Скрапер інжектує `HtmlFetcher` через конструктор (для мокання в тестах); production-default —
  `FetchHtmlFetcher`. Playwright — **лише за потреби** (Tier A його не потребує).
- Пріоритет джерела даних: **structured (JSON-LD / `__NEXT_DATA__` / RSC) → HTML-селектори лише
  як fallback.**
- Помилки **збираються** у `errors[]`, ніколи не кидаються. Ціна — у копійках. ISBN — через
  shared `normalizeIsbn()`. Відсутній cover ніколи не ламає listing.
- Тести — fixture-based, **без мережі**, coverage нових модулів ≥ 80%.
- Еталон, з якого знято всі патерни цього guide, — наявний провайдер **Vivat**
  (`packages/scrapers/src/providers/vivat/`). Його не чіпаємо.

---

## 1. Стандартна структура папки провайдера

Конвенція нижче — **фактична** (узята з `providers/vivat/`), а не ідеалізована. Файли парсера й
скрапера мають префікс slug (`vivat.parser.ts`, не `parser.ts`).

| Файл | Призначення |
|------|-------------|
| `constants.ts` | Base/catalog URL, селектори (`script#__NEXT_DATA__`, JSON-LD), `isPaperBookType(bookType)`, `buildProductUrl(code)`, `buildCoverUrl(image)`, provider-specific інтерфейси сирих даних. |
| `<slug>.parser.ts` | **Чисті** функції парсингу (без мережі): `parse<Slug>Page(html) → ParseResult`, `<slug>PriceToKopecks(value) → number \| null`, `extract<Slug>ProductDescription(html) → string \| null`, `parse<Slug>Product(html) → ParsedProductState`. |
| `<slug>.scraper.ts` | Клас `<Slug>Scraper implements ScraperProvider`: пагінація, dedupe по URL, opt-in enrichment, збір помилок. |
| `index.ts` | Barrel-експорт скрапера + публічних парсер-функцій/типів. |
| `__tests__/` | `<slug>.parser.test.ts`, `<slug>.product-state.test.ts`, `<slug>.product.test.ts`, `<slug>.scraper.test.ts`. |
| `__tests__/__fixtures__/*.html` | Офлайн HTML-фікстури (детерміновані, без мережі). |

> **Примітка щодо `mapper.ts` / `product.ts`.** ТЗ згадувало окремий `mapper.ts`/`product.ts`, але
> в реальній кодовій базі **окремого mapper-файлу немає**: мапінг сирих даних у `RawProviderListing`
> живе **всередині `<slug>.parser.ts`**. Single-product state (`parse<Slug>Product`) теж лежить у
> парсері, а спільний реєстр single-product парсерів — у `packages/scrapers/src/providers/single-product.ts`
> (тип `ParsedProductState`). Нові провайдери **повторюють цю конвенцію**, не вводять `mapper.ts`.

### Реєстрація провайдера (три точки)

1. **Slug** → union `ProviderName` у [packages/shared/src/types/provider.ts](../../packages/shared/src/types/provider.ts).
2. **Barrel** → експорт класу скрапера у `packages/scrapers/src/providers/index.ts`.
3. **Fetcher** → запис у `FETCHER_FACTORY` у `packages/api/src/refresh/fetcher-registry.ts`
   (Tier A → `getFetchFetcher`/`FetchHtmlFetcher`).

---

## 2. Стандартний contract

### 2.1 Provider slug
Стабільний рядок-ідентифікатор у `ProviderName`
([packages/shared/src/types/provider.ts](../../packages/shared/src/types/provider.ts)). Той самий
slug проставляється у поле `provider` кожного `RawProviderListing` і у `ScraperResult.provider`.

### 2.2 Sitemap discovery
Централізованої sitemap-утиліти **наразі немає**. Tier A використовує **пагінацію каталогу** як
Vivat: `?page=N`, стоп на порожній сторінці (`hasNextPage === false`) або на network error.
Sitemap/feed-crawler — це майбутній `FeedProvider` (див. provider-integration-strategy) і **поза
скоупом** цього guide.

### 2.3 Product page fetching
Лише через інтерфейс:

```ts
interface HtmlFetcher { fetch(url: string, timeoutMs: number): Promise<string>; }
```

- `FetchHtmlFetcher` ([http/html-fetcher.ts](../../packages/scrapers/src/http/html-fetcher.ts)) —
  для SSR без challenge. **Усі Tier A** використовують його.
- `PlaywrightHtmlFetcher` — лише коли потрібен реальний браузер (challenge/JS-render). Tier A його
  **не потребує**; не додавати «про запас».
- `timeoutMs` обов'язковий (security.md: явний timeout, без прихованих retry-loops).

### 2.4 JSON-LD / embedded JSON / HTML fallback
Пріоритет джерел (стабільність спадає згори вниз):

1. **JSON-LD** `@type:Product` / `@type:Book` (BookChef, Лабораторія, КСД, Книголенд, Grenka).
2. **Embedded JSON**: `__NEXT_DATA__` (Vivat, Старий Лев) або RSC-stream (Readeat, Megogo).
3. **HTML-селектори** — лише як **fallback**, коли structured-даних немає (Bukva). Крихкі;
   уникати для Tier A.

Парсер читає structured-блок (`cheerio.load(html)` + селектор), `JSON.parse`, навігує до масиву
продуктів. Усі гілки `try/catch` повертають error у `errors[]`, не кидають.

### 2.5 Price parsing in kopiyky
Гроші — `Money { amount: <копійки, ціле>, currency: 'UAH' }`
([packages/shared/src/types/money.ts](../../packages/shared/src/types/money.ts)).

```ts
export function <slug>PriceToKopecks(value: unknown): number | null {
  // null для 0 / негативних / нескінченних / нечислових
  // Math.round(value * 100)
}
```

Функція **per-provider** (формат різний: число в JSON, текст «620 грн», `data-price-amount`).
Каскад джерел ціни (приклад Vivat): `promotion → retail → priceRebate`, перший валідний виграє.

### 2.6 Availability mapping
`Availability = 'in-stock' | 'out-of-stock' | 'unknown'`.

- **Немає ціни → завжди `out-of-stock`** (інваріант).
- `preorder` → `in-stock` (політика Vivat/Yakaboo).
- Явні «out/unavailable» текст-маркери → `out-of-stock`.
- Інакше fallback на stock-level; невизначено → `unknown`.

### 2.7 ISBN normalization
Shared `normalizeIsbn()` ([canonical/isbn.ts](../../packages/scrapers/src/canonical/isbn.ts)):
ISBN-10 → ISBN-13 + перевірка checksum, невалідний → `null`. Якщо каталог не дає ISBN на картці —
`isbn: null` (заповниться на product-page або під час canonical matching).

### 2.8 Cover URL extraction
`buildCoverUrl(image)` у `constants.ts` резолвить site-relative (`/storage/a.jpg`),
protocol-relative (`//cdn/..`) та absolute URL. **Відсутній/нерядковий cover → `null`, і це
ніколи не ламає listing** (поле опціональне).

### 2.9 Skipped no price
- Listing з `price: null` **не блокується на парсі** — він валідний у `RawProviderListing`.
- Pipeline рахує його у метриці `skippedNoPrice`: **нові** книги без ціни не персистяться (лише
  оновлюється availability для вже відомих).
- Non-paper типи (e-book/audio) — **тихий skip без error** (через `isPaperBookType`).

### 2.10 scrapeErrors
- Помилки **збираються** у `errors: string[]`, **ніколи не кидаються** назовні зі `scrape()`.
- Network error на сторінці → `errors.push(...)` + `break` пагінації (не валить увесь run).
- Malformed structured-дані, missing code/title → окремий запис у `errors[]`, продукт пропускається.
- `errors[]` повертається у `ScraperResult` і потрапляє в `scrapeErrors` summary
  (`packages/api/src/pipeline/run-scrape.ts`).

### 2.11 Blocked provider reporting
`detectProviderBlock(errors)` ([lib/blocked-status.ts](../../packages/scrapers/src/lib/blocked-status.ts))
класифікує `errors[]` → `cloudflare` / `http-403`. У scrape summary це дає статус
`BLOCKED (<label>)`. **Tier A не має блокуватись.** Поява блоку = сигнал переглянути стратегію
провайдера (провести як `blocked`/`disabled`, трек переговорів — provider-integration-strategy §3–4),
а **не** привід обходити anti-bot.

### 2.12 Форма результату

```ts
interface ScraperResult {
  readonly provider: ProviderName;
  readonly listings: RawProviderListing[];
  readonly scrapedAt: string;   // ISO 8601
  readonly errors: string[];
}
```

Скрапер — клас з DI:

```ts
class <Slug>Scraper implements ScraperProvider {
  readonly name = '<slug>' as const;
  constructor(
    private readonly fetcher: HtmlFetcher = new FetchHtmlFetcher(),
    private readonly catalogUrl: string = <SLUG>_CATALOG_URL,
  ) {}
  async scrape(options?: ScraperOptions): Promise<ScraperResult> { /* ... */ }
}
```

Цикл: fetch сторінки → `parse<Slug>Page` → dedupe по `listing.url` (через `Set`) → стоп на
`!hasNextPage` або network error → opt-in `enrichDescriptions` → повернути `ScraperResult`.

---

## 3. Testing checklist

Структура — за патерном `providers/vivat/__tests__/`. **Без мережі**, fetcher завжди мокається.

### Parser tests — `<slug>.parser.test.ts`
- [ ] `<slug>PriceToKopecks`: масштаб цілих/дробових грн → копійки; `null` для 0/негативних/нечислових.
- [ ] Чистий каталог: коректні `provider`, `title`, `author`, `price`, `url`, `availability`, `coverUrl`.
- [ ] Фільтр non-paper (e-book/audio) — тихо пропущено, без error.
- [ ] Каскад ціни (promotion > retail тощо) і `preorder → in-stock`.
- [ ] Null/negative price → `price: null`, availability `out-of-stock`.
- [ ] Empty page → 0 listings, без errors, `hasNextPage: false`.
- [ ] Malformed: відсутній/невалідний `__NEXT_DATA__`/JSON-LD, продукти не масив → error у `errors[]`.
- [ ] Missing code/title → продукт пропущено + відповідний запис у `errors[]`.
- [ ] Cover extraction: site-relative → absolute, absolute pass-through, відсутній/нерядковий → `null`.

### Product-state tests — `<slug>.product-state.test.ts`
- [ ] `parse<Slug>Product`: price + availability зі сторінки товару.
- [ ] No-price → `{ price: null, availability: 'out-of-stock' }`.
- [ ] Missing/empty/unparseable дані → `{ price: null, availability: 'unknown' }` (**non-throwing**).

### Scraper tests з mocked fetcher — `<slug>.scraper.test.ts`
- [ ] `makeFetcher([...pages])` повертає сторінки по черзі.
- [ ] Multi-page combine; dedupe ідентичних URL; стоп на порожній сторінці.
- [ ] `maxPages` дотримано; `delayMs: 0` у тестах (детермінізм, без реального sleep).
- [ ] Network error → запис у `errors[]`, **не throw**, пагінація зупиняється.
- [ ] `ScraperResult` shape: `provider`, `listings[]`, `scrapedAt` (ISO), `errors[]`.

### Інше
- [ ] **Blocked-page tests** — лише якщо провайдер потенційно під challenge (Tier A зазвичай **ні**).
- [ ] Усі HTML-фікстури — в `__tests__/__fixtures__/`, детерміновані (без random, без часу — testing.md).
- [ ] **No network in unit tests.** Coverage нових модулів ≥ 80%.

---

## 4. Acceptance criteria для кожного provider PR

- [ ] **Scraper tests pass** (parser + product-state + scraper).
- [ ] **API tests pass** (pipeline/persist не зламані новим slug).
- [ ] **`pnpm build` pass** (typecheck + build усього монорепо).
- [ ] Провайдер повертає **стабільний `RawProviderListing`** — усі обов'язкові поля (`provider`,
      `title`, `author`, `isbn`, `price`, `url`, `availability`) присутні й коректно типізовані.
- [ ] **No anti-bot bypass** — жодного обходу challenge; блок → статус `BLOCKED`, не «прорив».
- [ ] **No Playwright unless needed** — Tier A на `FetchHtmlFetcher`.
- [ ] **Scrape summary читабельний** — `Status: OK`, `Scraped > 0`, `scrapeErrors` зрозумілі.
- [ ] Slug зареєстровано у `ProviderName` **і** в обох registries (barrel + `FETCHER_FACTORY`).
- [ ] Окремий **per-provider PRD підтверджено** перед написанням коду (правило проєкту).
- [ ] Conventional Commit, feature branch, зелений CI перед merge (git.md).

---

## 5. BookChef — first implementation plan

> Це план **першого** провайдера за цим guide. Код пишеться лише після підтвердження окремого
> BookChef PRD.

### 5.1 Чому BookChef перший
- **Найкращий JSON-LD для canonical matching:** один блок `@type:Product` містить `isbn` **+
  `gtin13`** + `price` + `priceCurrency:UAH` + `availability` + `author` + `brand`.
- **SSR без challenge:** Cloudflare лише як CDN; plain fetch повертає реальний HTML.
- **Low maintenance, ~1 day** (bookstore-feasibility Tier A).

### 5.2 Які дані беремо з JSON-LD (`@type:Product`)
| Поле listing | Джерело JSON-LD | Примітка |
|--------------|-----------------|----------|
| `title` | `name` | trim |
| `author` | `author` / `brand` | масив або рядок → нормалізувати |
| `price` | `offers.price` + `priceCurrency` | → копійки через `bookChefPriceToKopecks` |
| `availability` | `offers.availability` | `InStock`/`OutOfStock`/preorder → mapping §2.6 |
| `isbn` | `isbn` (fallback `gtin13`) | через `normalizeIsbn()` |
| `coverUrl` | `image` | через `buildCoverUrl()`, відсутній → `null` |
| `url` | product URL | `buildProductUrl` |

### 5.3 Очікувані edge cases
- **Посилення Cloudflare** — моніторити `detectProviderBlock`; якщо з'явиться challenge → статус
  `BLOCKED`, не bypass.
- **8 типів sub-sitemap** — для майбутнього discovery; **v1 = пагінація каталогу** (як Vivat).
- **Відсутній/невалідний `gtin13`** → fallback на `isbn`; обидва відсутні → `isbn: null`.
- **Non-paper** позиції → тихий skip.
- **Missing price** → `price: null` → `skippedNoPrice`.

### 5.4 Що НЕ робимо у v1
- Sitemap/feed-crawler.
- `enrichDescriptions` (за замовчуванням off).
- Playwright / будь-який обхід anti-bot.
- Зміна архітектури чи shared-контрактів.
- Інші Tier A провайдери (Лабораторія, Старий Лев, КСД, Книголенд, Readeat) — окремими PRD/PR.

---

## 6. Proposed commit message

```
docs(prd): add provider implementation guide and BookChef plan
```
