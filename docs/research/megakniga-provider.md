# Мегакнига (megakniga.com.ua) — HTML Scraping Recon

> **Тип:** research / recon. **Дата:** 2026-07-19. **Ціль:** `https://www.megakniga.com.ua/`.
> **Питання дослідження:** чи є публічне API; який стек; чи достатньо plain fetch; наскільки стабільний DOM; складність інтеграції.
> **Короткий висновок:** 🟢 **Tier A.** Yii2 (PHP) SSR без bot-захисту; API немає — HTML scraping через каталог; plain fetch достатньо. Найближчий аналог — **vivat** (catalog crawl + enrichment). Provider quality: HIGH · Integration complexity: LOW · Maintenance risk: LOW.
> **Зв'язок:** slug провайдера (пропозиція) — `megakniga`; apex `megakniga.com.ua` → 301 → `www.megakniga.com.ua`; PRD ще не існує.

## 1. Публічне API — немає

- REST/GraphQL/JSON endpoints відсутні. Сайт класичний SSR (Yii2 + jQuery), дані рендеряться в HTML.
- Live-пошук існує: `POST /live-search` з `{q}` — але захищений Yii2 CSRF (без сесійної куки + `_csrf-frontend` токена → 400). Використовувати недоцільно.
- AJAX-endpoints кошика (`/cart/addToCart`, `/catalog/calcProductPrice`) — теж CSRF POST, нерелевантні.
- Мобільного API немає (немає окремого app/API host у бандлі).

## 2. Стек

| | |
|---|---|
| Платформа | **Yii2 (PHP)**, повний SSR (куки `app-frontend`, `_csrf-frontend`; 50 згадок `yii` у HTML) |
| Frontend | jQuery + jQuery UI, один minify-бандл; Cloudflare Rocket Loader |
| CDN | Cloudflare — **лише як CDN**, без challenge |
| Хост | nginx; apex `megakniga.com.ua` → 301 на `www.` |

## 3. HTML scraping — якість DOM

DOM стабільний і семантичний (стара Yii2-тема, роками не змінюється):
класи `product-list-item`, `product-list-name`, `authors-block`, `price`, `price price-old`, `product-available-container in_stock`, `product-description-title`; data-атрибути `data-price`, `data-id-item`, `data-src`/`data-echo` (lazy-load обкладинок).

**Сторінка товару має schema.org microdata Product:** `itemprop=price` (432.10), `priceCurrency` (UAH), `availability` (InStock/OutOfStock), `sku`, **`mpn`+`identifier` = ISBN**, `name`, `description`, `image`. JSON-LD — лише Organization (Product JSON-LD немає).

Витягуваність полів (сторінка товару):

| Поле | Джерело | Витягується |
|---|---|---|
| ISBN | `itemprop="mpn"/"identifier"` + текст «Код товару / ISBN:» | Так (надійно) |
| title | `<h1>` | Так |
| author | блок «Автор:» (лінк на `/search?onlyAvtor=1&q=`) | Так |
| publisher | «Виробник:» (напр. ВСЛ, Фоліо). Увага: `itemprop="brand"` = «Мегакнига», брати треба текстовий «Виробник» | Так |
| price | microdata `price` (= «Ціна роздріб»; є ще «Ціна опт» — ігнорувати) | Так |
| old price | `.price.price-old` (є на discount-товарах) | Так |
| availability | microdata + текст («Є в наявності» / «Товар очікується») | Так |
| description | блок «Опис товару» + `itemprop="description"` | Так |
| cover | `data-echo="/uploads/files/Products/..."` (повнорозмірна) | Так |
| breadcrumbs | семантичний блок `breadcrumb` (Головна/Каталог/Книги/Жанр/...) → `rawCategories` | Так |
| binding | «Обкладинка: Тверда/М'яка» → `format` | Так |
| language | — | Ні |
| pages | — | Ні |
| рік видання | — | Ні |

Маркер типу товару: текст **«Паперова книга»** на сторінці товару + URL-префікс `/catalog/knigi/` — фільтр книг від іграшок/дисків/канцелярії.

## 4. Захист — мінімальний

- Cloudflare pass-through: curl зі звичайним UA → HTTP 200 одразу, без JS challenge/Turnstile.
- DataDome/Imperva/Akamai — відсутні.
- Rate limit: 8 швидких послідовних запитів → усі 200, стабільні ~1.0s (за сесію розвідки ~30 запитів без жодного блоку).
- reCAPTCHA є лише на формах (login/відгуки), не на каталозі.
- robots.txt: `Disallow: /search` (і `/ua/search`) — пошук ботам заборонений; каталог і sitemap відкриті → скрапити через каталог/sitemap.
- **Висновок: звичайного FetchProvider (`FetchHtmlFetcher`) достатньо. Playwright не потрібен.**

## 5. Пошук

`GET /search?q=` — шукає за назвою, **за ISBN (точне влучання, placeholder прямо каже «або код ISBN»)**, за автором (`?onlyAvtor=1&q=`). Релевантність нормальна («кобзар» → усі видання Кобзаря). Через заборону в robots.txt (розділ 4) для інтеграції не використовується — лише як ручний інструмент.

## 6. URL-схема

- Товар: `/catalog/<кат>/<підкат>[/<під-підкат>]/<slug>.html` — стабільні, канонічні в sitemap.
- Slug часто містить ISBN (`...-9789662909944.html`), але ненадійно (є `eneida.html`, `-188.html`) — формувати URL з ISBN не можна; джерело URL = лістинги категорій або sitemap. Проходити через пошук не потрібно.

## 7. Пагінація

- Категорії: path-стиль `/catalog/knigi/pageN?per-page=16|32|64` (також працює `?page=N`). Пейджер обрізаний (не показує останню сторінку); за межами останньої повертається остання → потрібен stop-критерій «повтор URL-ів» (dedupe, як у yakaboo).
- Пошук: `?page=N`.
- Сортування на лістингах: стандартні Yii2 GET-параметри (не критично для скрапа).

## 8. Performance / розмір каталогу

- Sitemap: індекс з 55 частин × 1000 URL = **~55k товарів усього**; книги (`/catalog/knigi/`) ≈ **26–28k** (остання сторінка кореневої категорії книг між page400 і page440 при per-page=64).
- ⚠️ **`lastmod` у sitemap фейковий**: усі 1000 записів вибірки мають ідентичний `2026-07-19T02:00:05+03:00` (нічна регенерація) → інкрементальність через `planIncrementalFetch`/lastmod не працює (на відміну від bookchef).
- Зате **лістинги категорій містять ціну + наявність + назву + автора + обкладинку + URL** → регулярний price-scrape дешевий:
  - **scrape search (повний прохід цін):** ~420–440 запитів (`/catalog/knigi/pageN?per-page=64`) — швидкий регулярний прохід.
  - **scrape details (enrichment):** 1 запит на книгу (ISBN/опис/видавець/палітурка/breadcrumbs) — одноразово для нових URL; первинний прогін ~27k запитів — long-running one-time crawl (керується concurrency-патерном laboratory).

## 9. Порівняння з існуючими провайдерами

Найближчий аналог — **vivat**: той самий клас провайдера (plain fetch, catalog crawl лістингів + опційний enrichment через product page). Реєстрація стандартна: `ProviderName` union + `src/providers/index.ts` + `SINGLE_PRODUCT_PARSERS`.

| Аспект | megakniga | Аналог |
|---|---|---|
| Транспорт | plain fetch, SSR HTML | vivat / knigoland |
| Discovery | catalog crawl лістингів + `?page` | **vivat** (`?page=N`, stop on no-next) |
| ISBN/метадані | тільки зі сторінки товару → enrichment pass | vivat (`enrichProductDetails`) |
| Structured data | microdata (не JSON-LD) | ближче до vivat, ніж до bookchef/laboratory |
| Sitemap | є, але lastmod марний → лише як довідник повного списку URL | не bookchef-стиль |

Повне порівняння (difficulty — за фактичним кодом у `packages/scrapers`; similarity — збіг патерну з потребами Мегакниги):

| Provider | Транспорт (факт) | Difficulty | Similarity до Megakniga |
|---|---|---|---|
| Vivat | plain fetch, catalog crawl `?page=N`, enrichment | LOW | HIGH — прямий шаблон, reference implementation |
| Yakaboo | plain fetch, catalog crawl + URL dedupe (prod заблокований) | LOW (код) | MEDIUM-HIGH — той самий crawl + stop-критерій dedupe |
| Knigoland | sitemap index + JSON-LD + spec-table fallback | MEDIUM | MEDIUM — attribute-block fallback схожий, discovery інший |
| Laboratory | sitemap + concurrency + подвійне HTML-декодування | MEDIUM | MEDIUM — потрібен лише його concurrency-патерн для enrichment |
| BookChef | sitemap incremental (lastmod) + JSON-LD | MEDIUM | LOW-MEDIUM — інкрементальний lastmod-патерн на Мегакнизі не працює |
| Book-club (КСД) | GraphQL API | MEDIUM | NONE — інший клас провайдера |
| Book-Ye | Playwright + Cloudflare Turnstile (blocked) | HIGH | NONE — Мегакнизі це все не потрібно |
| **Megakniga (прогноз)** | plain fetch, catalog crawl + microdata | **LOW** | — |

## 10. Reference implementation

Куди дивитися при реалізації (based on the current implementation in `packages/scrapers`):

| Purpose | Reference |
|---------|-----------|
| Listing crawler (пагінація, `errors[]`) | `packages/scrapers/src/providers/vivat/vivat.scraper.ts` |
| Listing/product parser (SSR HTML) | `packages/scrapers/src/providers/vivat` |
| Structured data як untrusted + fallback на текстовий attribute-блок | `packages/scrapers/src/providers/laboratory`, `packages/scrapers/src/providers/knigoland` |
| URL dedupe (stop-критерій пагінації) | `packages/scrapers/src/providers/yakaboo` |
| Constants (maxPages, delays, селектори) | `packages/scrapers/src/providers/vivat/constants.ts` |
| Enrichment (opt-in per-product pass) | `packages/scrapers/src/lib/enrich-product-details.ts` |
| Concurrency + `maxRuntimeMs` ceiling | `packages/scrapers/src/providers/laboratory/laboratory.scraper.ts` |
| Retry з exponential backoff | `packages/scrapers/src/http/retry.ts` |
| Single product parser (реєстрація refresh) | `packages/scrapers/src/providers/single-product.ts` |
| Tests + fixtures (найповніше покриття серед провайдерів) | `packages/scrapers/src/providers/vivat/__tests__` |

## 11. Suggested scraper defaults

Обґрунтування з recon: сервер відповідає стабільно ~1.0s, 8 швидких запитів поспіль без деградації; захисту немає, але сайт невеликий (Житомир, самописний Yii2) — навантаження треба тримати ввічливим.

| Параметр (`ScraperOptions`) | Listing crawl | Details enrichment | Чому |
|---|---|---|---|
| `delayMs` | 400–500 | 300–400 | ~2 rps сумарно — непомітно для сайту; лістингів лише ~440, поспішати нікуди |
| `concurrency` | 1 (послідовно) | 2–3 | лістинги дешеві; enrichment ~27k сторінок — one-time long-running прогін, 2–3 воркери тримають його керованим без навантаження на сайт |
| `timeoutMs` | 15000 | 15000 | p50 ~1s, запас ×15 на хвости CDN |
| `maxRetries` | 2 | 2 | через `fetchWithRetry` (exponential backoff); стійких помилок у recon не було |
| `maxRuntimeMs` | — | ceiling як у laboratory | первинний enrichment не повинен блокувати cron-slot |
| `per-page` | 64 | — | мінімізує кількість запитів лістингу |

## 12. Not required — категорично НЕ реалізовувати

- Playwright / browser automation — challenge немає, SSR віддає все по plain HTTP.
- Session persistence / cookies — каталог і сторінки товарів працюють без сесії.
- CSRF handling — потрібен лише для POST-форм, які скраперу не потрібні (розділ 1).
- Live-search інтеграція (`POST /live-search`) — розділ 1.
- GraphQL / JSON API клієнт — API не існує.
- Пошук `/search` як discovery — розділи 4–5.
- Інкрементальність через sitemap `lastmod` / `planIncrementalFetch` — розділ 8.
- Проксі / UA-ротація / anti-detection — не потрібні, і за політикою проєкту не робимо.

## 13. DOM stability

**Risk: LOW**

Reasons:
- SSR, не CSR: увесь контент (ціни, наявність, атрибути) присутній у першому HTML-response; JS (jQuery) лише додає інтерактивність кошика/слайдерів — парсинг від JS не залежить взагалі.
- Семантичні CSS-класи (перелік у розділі 3) — іменовані за змістом, не generated/hashed.
- Schema.org microdata на сторінці товару — це SEO-контракт сайту, найстабільніший шар: навіть при редизайні теми microdata зазвичай зберігають.
- data-атрибути (`data-price`, `data-id-item`, `data-src`/`data-echo`) — другий незалежний шар для цін/обкладинок.
- Тема — стара Yii2/Bootstrap-3-ера (кастомна, не маркетплейсний конструктор): сайт явно не інвестує у frontend-редизайни; ризик раптової зміни DOM мінімальний.

**Expected maintenance cost: LOW.** Парсер має два незалежні джерела для критичних полів (microdata + семантичні класи), тож поламка одного шару не валить скрапер; блокувань немає, отже не буде і гонки з анти-ботом.

## 14. Canonical matching

Рекомендований порядок матчингу (узгоджено з [canonical-matcher-final-audit.md](canonical-matcher-final-audit.md) — усі конфлікти гейтяться title similarity):

1. **ISBN** — первинний ключ. На Мегакнизі ISBN надійний (`itemprop="mpn"/"identifier"` на кожній обстеженій книзі), тож переважна більшість матчів має пройти по ISBN.
2. **Title + Author** — fallback для товарів без ISBN у microdata (якщо такі виявляться в довгому хвості).
3. **Publisher** («Виробник») — лише як додатковий сигнал/tie-breaker, ніколи як самостійний ключ.

Чому саме так: у Мегакниги немає language/pages/року видання (розділ 16), тобто менше сигналів для розрізнення видань одного твору — покладатися треба на ISBN, а title-gate захищає від false merges (див. відомий кейс ISBN_CONFLICT у matcher-аудиті). Обов'язковий пре-фільтр книг — розділ 3.

## 15. План реалізації (майбутній PRD, НЕ зараз)

1. `src/providers/megakniga/constants.ts` — базові URL (`/catalog/knigi`), per-page=64, delays, селектори.
2. `megakniga.parser.ts` — pure: `parseMegaknigaListing` (картки лістингу → `RawProviderListing`: title, author, price з `data-price`, availability, coverUrl, url), `megaknigaPriceToKopecks`, `parseMegaknigaProduct` (microdata price/availability для single-product refresh), `extractMegaknigaProductDetails` (ISBN з `mpn`, publisher «Виробник», binding «Обкладинка», опис, breadcrumbs → rawCategories).
3. `megakniga.scraper.ts` — vivat-патерн: пагінація `/catalog/knigi/pageN?per-page=64`, stop по дублікатах URL, опційний enrichment через `enrichProductDetails`, помилки в `errors[]`.
4. Mapping/normalization — стандартні `RawProviderListing` поля; `language`/`publicationYear` = null (обмеження джерела).
5. Реєстрація: `ProviderName`, `providers/index.ts`, `SINGLE_PRODUCT_PARSERS`.
6. Тести: `__fixtures__` (лістинг, товар in-stock/out-of-stock/зі знижкою `price-old`/без ISBN) + parser/scraper/product-state тести за зразком vivat, офлайн через injected fetcher. Coverage ≥80%.

## 16. Known limitations

### Метадані

- language — недоступна.
- page count — недоступний.
- publication year — недоступний.

### Каталог і sitemap

- `lastmod` у sitemap фейковий (розділ 8) — інкрементальність через lastmod неможлива.
- Дві ціни (роздріб + опт) — брати лише роздрібну (= microdata `price`).
- Змішаний каталог (книги + іграшки/диски/канцелярія) — обов'язковий фільтр книг (розділ 3).
- ISBN у slug ненадійний — URL з ISBN не формуються (розділ 6).

### Пошук і discovery

- `/search` заборонений robots.txt (розділ 4).
- Live-search вимагає CSRF (розділ 1).

### Canonical matching

- Publisher потребує нормалізації: короткі неканонічні форми («ВСЛ» vs «Видавництво Старого Лева»).
- Author потребує нормалізації: часто КАПСОМ і лише прізвищем («ШЕВЧЕНКО»).
- `itemprop="brand"` = «Мегакнига», не видавець — видавця брати лише з текстового «Виробник:».

## 17. Future improvements

- Incremental URL diff (нові/зниклі товари між прогонами).
- Category-aware crawling (обхід піддерев жанрів для точніших `rawCategories`).
- Publisher normalization.
- Optional sitemap bootstrap.
- Використання old price (`price-old`) для сигналів знижок.

## 18. Overall assessment

- **Provider quality: HIGH** — ~26–28k паперових книг (більше за bookchef, менше за knigoland), надійний ISBN, повний набір цінових полів включно зі старою ціною; у recon 100% успішних запитів зі стабільними відповідями.
- **Integration complexity: LOW** — vivat-шаблон без нового транспорту чи анти-бот обходу; все потрібне (`FetchHtmlFetcher`, `enrichProductDetails`, `fetchWithRetry`, тестовий патерн injected fetcher) вже існує в `packages/scrapers`; основна робота — парсер лістингу/товару + фікстури/тести.
- **Maintenance risk: LOW** — розділ 13.

**Вердикт: інтегрувати варто.** Прихованого API немає (розділ 1), plain fetch достатньо (розділ 4), обмеження джерела зведені в розділі 16.
