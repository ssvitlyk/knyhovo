# Bookstore Integration Feasibility

> **Тип:** research / feasibility. Статус: чорновик.
> **Дата:** 2026-06-27
> **Скоуп:** технічна оцінка, які українські книгарні реалістично інтегрувати та підтримувати у MVP без тижнів боротьби з anti-bot. **Мета — НЕ писати скрапери.** Результат — ранжований roadmap.
> **Споріднений док:** [provider-integration-strategy.md](provider-integration-strategy.md) (типологія `ScraperProvider` / `ApiProvider` / `FeedProvider` / `DisabledProvider`). Архітектуру **не змінюємо** — оцінюємо лише провайдерів.

## TL;DR

- **Архітектура достатня.** Кожен «зелений» кандидат лягає у наявний `ScraperProvider` (SSR HTML + JSON-LD/embedded JSON). Жоден не потребує нового типу адаптера для MVP.
- **6 кандидатів готові «з коробки»** (SSR, без challenge, структуровані дані з ціною/наявністю/ISBN): **КСД (ksd.ua)**, **Лабораторія**, **Readeat**, **Книголенд**, **BookChef**, **Старий Лев**. Усі — `1 day`, Low maintenance.
- **6 кандидатів реалістичні, але дорожчі**: Sens, Megogo Books (mbooks), Bohdan, Bukva, Grenka, Folio — потребують або PoW-handshake, або RSC-парсера, або legacy-HTML, або мають robots-застереження.
- **Відкласти**: **Yakaboo**, **Книгарня Є**, **Наш Формат**, **Rozetka**, **Ranok** — Cloudflare **Managed Challenge** / WAF або явна robots-заборона. Це **не інженерна** проблема, а питання легального джерела (див. provider-integration-strategy §1).
- **Жоден український книжковий ритейлер не дає публічного product-feed/API для агрегаторів.** Affiliate-програми (Yakaboo, КСД через VigLink, Grenka через Admitad) орієнтовані на трафік, не на дані. Rozetka має документований Seller API — але це для продавців маркетплейсу, не для читання каталогу.

---

## 1. Методологія та докази

Кожен висновок підкріплений реальним зондуванням (curl з браузерним User-Agent, `--max-time 20`) станом на **2026-06-27**, плюс web-search для API/affiliate/feed. Для кожного магазину перевірялось:

1. `curl -sI` → HTTP-статус, `Server`, `cf-ray` / `cf-mitigated` (Cloudflare), `Set-Cookie: datadome`, Akamai, `X-Powered-By`.
2. Fingerprint у HTML: `__NEXT_DATA__` / `/_next/` (Next.js), `__NUXT__` / `/_nuxt/` (Nuxt), `cdn.shopify`, `Magento`/`mage-`, OpenCart (`catalog/`, `route=`), `wp-content`/`woocommerce`, `bitrix`, Horoshop.
3. `robots.txt` → sitemap, disallow, **явні заборони AI/scraper-ботам**.
4. sitemap → чи містить product-URL (оцінка розміру каталогу).
5. Product page → `application/ld+json` (`@type: Product`/`Offer`/`Book`, `price`, `availability`, `isbn`/`gtin13`) або embedded JSON-стан (`__NEXT_DATA__`/RSC).
6. Anti-bot: чи plain curl отримує реальний HTML, чи `403`/«Just a moment»/challenge.

**Маркери у картках:** ✅ = підтверджено сирим рядком з відповіді; ⚠️ = часткове/непряме; ❓ = припущення (не верифіковано).

> **Застереження.** Зондування — це **миттєвий зріз**. Cloudflare Bot Management вмикається/посилюється конфігом власника будь-коли (особливо «м'який CDN» у Megogo/Readeat/Laboratory/Grenka може посилитись). Підрахунок каталогу з sitemap — оцінка, не точне число. Наявність структурованих даних не означає дозвіл на використання — див. §5 (robots) та §6.

---

## 2. Детальні картки провайдерів

Формат картки відповідає 12 пунктам ТЗ: Website · Catalog · Stack · Rendering · Data source · Public API · Anti-bot · Playwright · Update stability · Legal alt · Effort · Maintenance.

### 2.1 Tier A — інтегрувати одразу

#### КСД / BookClub — `ksd.ua`
- **Website:** https://ksd.ua (`www.bookclub.ua` → 301 → `ksd.ua`). ⚠️ Це **видавництво КСД**, а не маркетплейс bookclub; перевірити з продуктом, чи це той самий «BookClub», що в дорожній карті.
- **Catalog:** M — **~5 271** product-URL (`/product/<slug>`) у sitemap. ✅
- **Stack:** Next.js App Router (`x-powered-by: Next.js`, `vary: RSC`, `/_next/static/`). ✅ nginx, без Cloudflare.
- **Rendering:** SSR + RSC (повний HTML у curl).
- **Data source:** **JSON-LD** `@type:Product` з `price`, `priceCurrency:UAH`, `availability:InStock`, `sku`/`mpn`, `brand`. ✅ ISBN — у сирому HTML/тексті, **не** в JSON-LD полі `isbn`. ⚠️
- **Public API:** немає (`/api/products` → 404). Affiliate через VigLink (застаріла платформа, статус неясний). ❓
- **Anti-bot:** немає (0 збігів anti-bot-маркерів у 342 KB HTML). ✅
- **Playwright:** **Easy** — curl достатньо, JS не потрібен.
- **Update stability:** Висока — стабільний JSON-LD, URL `/product/<slug>`.
- **Legal alt:** немає публічного feed/API; robots дозволяє все, крім `/orders`, `/library`, фільтрів/сортувань.
- **Effort:** **1 day.** **Maintenance:** **Low.**

#### Лабораторія — `laboratory.ua`
- **Website:** https://laboratory.ua (видавництво + книгарня).
- **Catalog:** S–M — **~6 271** product-URL (`sitemap.xml/type-products`, daily `lastmod`). ✅
- **Stack:** власна PHP-подібна SSR-платформа (`<base href>`, `/design/laboratory/js/`); Cloudflare лише як CDN (`cf-cache-status: DYNAMIC`, **без** WAF). ⚠️ `mage-` присутній, але без інших Magento-маркерів.
- **Rendering:** SSR (повний HTML 1.1 MB у curl).
- **Data source:** **JSON-LD — найбагатше покриття.** Два блоки: `@type:Product` (`AggregateOffer`, `price`, `priceValidUntil`, `availability`) + `@type:Book` (`isbn`, `numberOfPages`, `bookFormat`). ✅
- **Public API:** немає (`/rest/V1/`, `/api/rest/` → 404; `/api/` заборонено в robots).
- **Anti-bot:** немає (curl повертає повний HTML). ✅
- **Playwright:** **Easy.**
- **Update stability:** Висока — JSON-LD + daily sitemap.
- **Legal alt:** немає; robots дозволяє продуктові/категорійні сторінки.
- **Effort:** **1 day.** **Maintenance:** **Low** — ISBN прямо в JSON-LD, ідеальний кандидат для canonical matching.

#### Readeat — `readeat.com`
- **Website:** https://readeat.com
- **Catalog:** L — **~53 375** product-URL (`sitemap-products-1/2.xml`, `/product/<id>-<slug>`). ✅
- **Stack:** Next.js App Router (`x-powered-by: Next.js`, RSC) + Laravel/October backend (`/storage/app/uploads/public/`). Cloudflare CDN без WAF. ✅
- **Rendering:** SSR + RSC.
- **Data source:** **JSON через `/api/products`** (без auth) — `name`, `code`, `author`, `publisher`, `price`, `old_price`, `stock{type,minimal,maximum}`, `cashback`. ✅ RSC-payload product-сторінки містить `isbn`, `price`, `InStock`/`preorder`. ⚠️ **Важливо:** `/api/products` схоже на endpoint віджета рекомендацій (8–50 записів незалежно від `page`/`limit`), **не** повний каталог-API → для повного покриття все одно crawl sitemap + RSC-парс. ⚠️
- **Public API:** де-факто `/api/products` доступний, але **недокументований і без явного дозволу** — трактувати як внутрішній.
- **Anti-bot:** немає (CF CDN без challenge). ✅
- **Playwright:** **Easy.**
- **Update stability:** Висока (daily sitemap). RSC-формат менш стабільний ніж JSON-LD ⚠️.
- **Legal alt:** немає офіційного; присутній на bookprice.com.ua (підтверджує scrapaбельність).
- **Effort:** **1 day** (sitemap + RSC/JSON-LD парс). **Maintenance:** **Low–Medium** (RSC може змінитися з апгрейдом Next.js).

#### Книголенд — `knigoland.com.ua`
- **Website:** https://knigoland.com.ua (⚠️ не `knygoland`).
- **Catalog:** M — sub-sitemaps `catalog-products-1..5.xml`. ⚠️
- **Stack:** Next.js (`x-powered-by: Next.js`, `/_next/`) + headless CMS на `admin.knigoland.com.ua` (схоже на Directus). ✅/❓
- **Rendering:** SSR.
- **Data source:** **JSON-LD двошаровий** (`@type:Product` ціна+availability, `@type:Book` `isbn`) + `__NEXT_DATA__`. ✅
- **Public API:** немає публічного; можливий GraphQL/REST через headless CMS ❓.
- **Anti-bot:** немає (curl → повний HTML). ✅
- **Playwright:** **Easy.**
- **Update stability:** Medium (Next.js стабільний; схема CMS може змінитись).
- **Legal alt:** sitemap публічний, robots не забороняє.
- **Effort:** **1 day.** **Maintenance:** **Low.**

#### BookChef — `bookchef.ua`
- **Website:** https://bookchef.ua
- **Catalog:** M — 8 типів sub-sitemap (products, categories, authors, publishers, promotions). ⚠️
- **Stack:** Laravel + Vite (`/build/assets/`, `XSRF-TOKEN`, `bookchef_session`); Cloudflare лише CDN. ✅
- **Rendering:** SSR (Blade/Inertia).
- **Data source:** **JSON-LD — найповніший набір:** `@type:Product`, `isbn`, **`gtin13`**, `price`, `priceCurrency:UAH`, `availability`, `author`, `brand` в одному блоці. ✅
- **Public API:** немає (XSRF лише для POST).
- **Anti-bot:** немає (Managed Challenge не активний; curl → реальний HTML). ✅
- **Playwright:** **Easy.**
- **Update stability:** Висока (стандартний JSON-LD).
- **Legal alt:** sitemap публічний.
- **Effort:** **1 day.** **Maintenance:** **Low** — найкращий кандидат для ISBN/GTIN-матчингу.

#### Видавництво Старого Лева (ВСЛ) — `starylev.com.ua`
- **Website:** https://starylev.com.ua
- **Catalog:** M — **4 502** продукти (підтверджено з `__NEXT_DATA__`: `"total":4502`). ✅
- **Stack:** Next.js (`x-powered-by: Next.js`, `x-nextjs-cache: HIT`, `/_next/static/`) + Google Cloud CDN. ✅
- **Rendering:** Hybrid SSR/SSG (`s-maxage=3600`).
- **Data source:** **`__NEXT_DATA__` — золотий стандарт:** повний product-обʼєкт `{id, name, price, price_old, qty, isbn, active, slug}`. ✅
- **Public API:** немає (`/api/*` → 404); `__NEXT_DATA__` = де-факто API.
- **Anti-bot:** немає (plain curl → повний JSON). ✅
- **Playwright:** **Easy** — один запит, парс `<script id="__NEXT_DATA__">`.
- **Update stability:** Висока (власний каталог видавництва, низька ротація).
- **Legal alt:** партнерської програми не знайдено.
- **Effort:** **1 day.** **Maintenance:** **Low.**

### 2.2 Tier B — реалістичні, але дорожчі

#### Sens — `sens.in.ua`
- **Website:** https://sens.in.ua (⚠️ не `sens.ua`/`sensbook`).
- **Catalog:** S–M (видавництво + книгарня).
- **Stack:** **Horoshop** (українська SaaS, PHP). ⚠️
- **Rendering:** SSR.
- **Data source:** ціна/наявність — у **JS-обʼєкті** (`model.price`), **не** JSON-LD; потрібні CSS-селектори як fallback. ⚠️
- **Anti-bot:** Horoshop **JS PoW-challenge** — ставить cookie `challenge_passed` (TTL ~30 хв); після цього curl з cookie отримує HTML. ⚠️❓ (інтерпретація агента — **верифікувати** перед оцінкою).
- **Public API:** Horoshop надає партнерам платформений API / Google Merchant feed ❓.
- **Playwright:** **Medium** — Playwright лише для першого handshake (cookie), далі curl 30 хв.
- **Update stability:** Medium (SaaS оновлюється централізовано).
- **Legal alt:** robots містить `ai-input=yes, ai-train=yes` — **найчистіший** дозвільний сигнал серед усіх. ✅
- **Effort:** **2–3 days.** **Maintenance:** **Medium** (Horoshop може змінити PoW).

#### Megogo Books — `mbooks.com.ua`
- **Website:** https://mbooks.com.ua (⚠️ окремий домен, не megogo.net). Продає **паперові книги** (16 000+ назв, фізична доставка). ✅
- **Catalog:** L — **~29 861** запис у `sitemap-books.xml` (`/book/NNNNNN-slug/`). ✅
- **Stack:** Next.js App Router (RSC) + Cloudflare (`server: cloudflare`, `cf-cache-status: DYNAMIC`, `cf-mitigated` **відсутній**). ✅
- **Rendering:** App Router + RSC (дані в RSC-потоці, не `__NEXT_DATA__`).
- **Data source:** **RSC stream** (`curl -H "RSC: 1"`) з dehydrated React Query: `price`, `currentPrice`, `currentQuantity`, `isbn`, `barcode`, `sku`, `status`. ✅
- **Public API:** немає (GraphQL → 404).
- **Anti-bot:** Cloudflare присутній, але **неагресивний** (curl отримує дані). ⚠️ Ризик посилення CF Bot Management.
- **Playwright:** **Medium** — сьогодні curl працює; RSC-парсер нетривіальний; якщо CF посилиться → stealth.
- **Update stability:** Medium (RSC менш документований/стабільний за JSON-LD).
- **Legal alt:** не знайдено.
- **Effort:** **2–3 days.** **Maintenance:** **Medium** (моніторинг CF + крихкий RSC).

#### Bohdan Books — `bohdan-books.com`
- **Website:** https://bohdan-books.com (Навчальна книга — Богдан).
- **Catalog:** M — **6 026** продуктів (`sitemap-custom-products.xml`). ✅
- **Stack:** 1C-Bitrix (`X-Powered-CMS: Bitrix Site Manager`, `/bitrix/`, `window.BX`) + nginx. ✅
- **Rendering:** SSR.
- **Data source:** HTML-атрибути `data-price="349.00"`, `data-product-name`; JSON-LD Product **закоментований**. **Бонус:** публічний XLS-прайс `…/upload/price/price BOHDAN <дата>.xls` (HTTP 200, оновлюється щомісяця). ✅⚠️
- **Public API:** немає; XLS-дамп — найближчий аналог feed.
- **Anti-bot:** немає (без CF/DataDome; `Crawl-delay: 5`). ✅
- **Playwright:** **Easy** (єдина тертя — кодування windows-1251).
- **Update stability:** Medium (URL XLS змінюється щомісяця за датою).
- **Legal alt:** публічний XLS-прайс без авторизації — фактично легальний bulk-feed. ✅
- **Effort:** **1–2 days.** **Maintenance:** **Low.**

#### Bukva — `bukva.ua`
- **Website:** https://bukva.ua (мережа фізичних магазинів + онлайн).
- **Catalog:** M–L (велика мережа); sitemap містить **лише категорії** (`/catalog/browse/<id>`), **не** product-URL → потрібен crawl категорій. ⚠️
- **Stack:** кастомний OpenCart (jQuery 2.1.4, Bootstrap, `goods.js`); Cloudflare CDN **без** challenge. ✅
- **Rendering:** SSR.
- **Data source:** **plain HTML** — `<div class="price_value">380.00 грн</div>`, ISBN у HTML (`978-…`), статус (`В наявності`/`Передпродаж`). **Немає JSON-LD/structured data.** ⚠️
- **Public API:** немає; affiliate/feed не підтверджено.
- **Anti-bot:** Cloudflare без JS-challenge (curl → повний HTML). Банер `403_0_ru.jpg` — елемент шаблону, не блокер. ✅
- **Playwright:** **Easy** технічно, але CSS-селектори крихкі.
- **Update stability:** Medium.
- **Legal alt:** ⚠️ **robots: `ClaudeBot Disallow: /`, `GPTBot Disallow: /`, `Amazonbot Disallow: /`** + `Content-Signal: ai-train=no`; але `User-agent: * Allow: /`. Price-aggregator-бот ≠ AI-train, проте сигнал власника варто врахувати.
- **Effort:** **1–2 days.** **Maintenance:** **Medium** (HTML-селектори без structured data).

#### Grenka — `grenka.ua`
- **Website:** https://grenka.ua (відкрито при discovery).
- **Catalog:** M–L; sitemap.xml **404** (відсутній) → crawl з homepage/категорій. ⚠️
- **Stack:** кастомний Mage-based (`mage-`), nginx; Cloudflare CDN **без** challenge. ✅
- **Rendering:** SSR.
- **Data source:** **JSON-LD `@type:Product`** з `price`, `priceCurrency:UAH`, `availability` (InStock/OutOfStock), `mpn` = ISBN (`978-…`), `brand`, `productID`. ✅
- **Public API:** немає; Admitad affiliate (тільки трафік, без feed). ❓
- **Anti-bot:** немає (0 реальних блокерів). ✅
- **Playwright:** **Easy.**
- **Update stability:** Medium (немає sitemap → залежність від навігації).
- **Legal alt:** Admitad affiliate (не дає даних).
- **Effort:** **2–3 days** (відсутність sitemap ускладнює discovery). **Maintenance:** **Medium.**

#### Folio — `folio.com.ua`
- **Website:** https://folio.com.ua (видавництво Фоліо).
- **Catalog:** S–M (власний каталог видавництва).
- **Stack:** Ruby on Rails (nginx + Phusion Passenger 6.0.27, `_folio_session`). ✅
- **Rendering:** SSR.
- **Data source:** не дозондовано до product-page; є `sitemap.xml.gz`. ⚠️ Потрібен окремий probe JSON-LD/HTML.
- **Public API:** немає.
- **Anti-bot:** немає (HTTP 200, без CF/challenge). ✅
- **Playwright:** **Easy** (ймовірно).
- **Update stability:** Medium.
- **Legal alt:** robots стандартний (`Disallow: /cart`, `/payment`), AI-боти не заблоковані.
- **Effort:** **2–3 days** (потрібен дозондаж data-source). **Maintenance:** **Low–Medium.**

### 2.3 Tier C — відкласти

#### Yakaboo — `yakaboo.ua`  ⛔
- **Anti-bot:** **Cloudflare Managed Challenge на всіх endpoint'ах** (`/`, `/robots.txt`, `/sitemap.xml`, `/ua/books.html`, `/affiliate/`) → HTTP 403 + `cf-mitigated: challenge`, `cType:'managed'`, `critical-ch: Sec-CH-UA-*`, per-request CSP nonce. ✅ Підтверджує статус `BLOCKED` (provider-integration-strategy §1).
- **Data source:** недоступний — реальний HTML не повертається жодного разу. Sitemap/JSON-LD теж за challenge.
- **Legal alt:** affiliate через affi.io / promosite.yakaboo.ua (marketing@yakaboo.ua) — але **ненадійна** (вмикають/вимикають програму без виплат), **без XML-feed/API** для агрегаторів. ❓
- **Playwright:** **Nearly impossible** (Managed Challenge + Client Hints + TLS-fingerprint).
- **Effort:** weeks. **Maintenance:** Very High. **Рішення:** `disabled`/`blocked`; трек — переговори про партнерський доступ (provider-integration-strategy §3).

#### Книгарня Є — `book-ye.com.ua`  ⛔
- **Anti-bot:** **Cloudflare Managed Challenge** (`cf-mitigated: challenge`, «Just a moment», 403 на всьому крім robots). ✅ Узгоджується з memory [[book-ye-cloudflare-content-wait]] і W10.4.
- **Stack:** 1C-Bitrix (`PAGEN_*`, `SID=` у robots). Sitemap задекларований (`/media/sitemap/sitemap_index.xml`) але за CF.
- **Data source:** HTML недоступний через anti-bot.
- **Playwright:** **Nearly impossible.** **Effort:** weeks. **Maintenance:** Very High.
- **Legal alt:** robots дозволяє краулери з `Crawl-delay: 30`, але CF блокує → потрібна офіційна домовленість (provider-integration-strategy §4).

#### Наш Формат — `nashformat.ua`  ⛔
- **Anti-bot:** **Cloudflare WAF, жорсткий** — `403` на `/`, `/robots.txt`, `/sitemap.xml`; навіть robots повертає CF challenge HTML. ✅ Найагресивніший серед priority-магазинів.
- **Catalog:** L (~53 000 за зовнішніми джерелами; sitemap недоступний). Stack/rendering невідомі (HTML не пробивається).
- **Data source:** недоступний.
- **Playwright:** **Hard / Nearly impossible.** **Effort:** weeks. **Maintenance:** Very High.
- **Legal alt:** перевірити партнерську програму вручну (через браузер). Великий бренд — варто звернутись по feed/API.

#### Rozetka (books) — `rozetka.com.ua`  ⛔ (як scrape)
- **Anti-bot:** **Cloudflare Managed Challenge** на категорії/продукті/robots/sitemap (`cf-mitigated: challenge`, `__cf_bm`, `critical-ch`). Публічний `api.rozetka.com.ua/goods/get` → nginx **403**. ✅
- **Legal alt — найкраща з усіх:** **документований Seller API** (`api-seller.rozetka.com.ua/apidoc/`, Bearer-token 24h, XML product feed, валідатор). ⚠️ Але це **API для продавців маркетплейсу**, потрібен seller-акаунт; не для читання чужого каталогу.
- **Playwright:** **Nearly impossible** (як публічний scrape). **Effort:** weeks. **Maintenance:** Very High.
- **Рішення:** scrape виключений; теоретичний шлях — seller/партнерська інтеграція (поза MVP).

#### Ranok — `ranok.com.ua`  ⛔ (legal)
- **Anti-bot:** Cloudflare (CDN), HTML повертається (HTTP 200). Stack: Bitrix + Magento.
- **Legal alt:** ⚠️ **robots явно блокує `ClaudeBot`, `anthropic-ai`, `Claude-Web`, `GPTBot`, `CCBot`, `PerplexityBot` тощо — `Disallow: /`.** Дозволено лише `/storage/*` для Googlebot. Технічно scrapaбельний, але власник явно проти автоматизованого доступу → **відкласти / отримати дозвіл**.
- **Effort:** n/a (legal-блокер). **Maintenance:** n/a.

#### Booklya — `booklya.com.ua`  ⛔ (не варто)
- **Catalog:** S — ~4 316 книг (`/books/NNNNN/`).
- **Stack:** legacy custom PHP (windows-1251, HTML 4.0, jQuery 1.x, table-layout, `last-modified: 2015`).
- **Data source:** **plain HTML без structured data, без ISBN** (`<div class="price">128.00 грн</div>`). ⚠️
- **Anti-bot:** немає (CF proxy неагресивний).
- **Playwright:** Easy технічно, але селектори крихкі на table-layout.
- **Update stability:** **High risk** — сайт виглядає покинутим.
- **Effort:** 1–2 days. **Maintenance:** **Very High.** **Рішення:** малий каталог + legacy + без ISBN → низький ROI, відкласти.

#### Ababahalamaha — `ababahalamaha.com.ua`  ⛔ (не магазин-фронт)
- Невалідний SSL, redirect на `/index.php/Main_Page` (MediaWiki-патерн), PHP 5.6, sitemap **410 Gone**. Не повноцінний e-commerce front для порівняння цін. **Відкласти / виключити.**

---

## 3. Зведена матриця

| Store | URL | API | HTML | JSON | Playwright | Anti-bot | Difficulty | Maintenance | MVP Ready |
|-------|-----|:---:|:----:|:----:|:----------:|----------|:----------:|:-----------:|:---------:|
| **КСД/BookClub** | ksd.ua | ✖ | ✓ | JSON-LD | Easy | none | 1d | Low | ✅ |
| **Лабораторія** | laboratory.ua | ✖ | ✓ | JSON-LD (+ISBN) | Easy | CF CDN | 1d | Low | ✅ |
| **Readeat** | readeat.com | ⚠️ internal | ✓ | RSC + `/api` | Easy | CF CDN | 1d | Low–Med | ✅ |
| **Книголенд** | knigoland.com.ua | ✖ | ✓ | JSON-LD (+ISBN) | Easy | none | 1d | Low | ✅ |
| **BookChef** | bookchef.ua | ✖ | ✓ | JSON-LD (+gtin13) | Easy | CF CDN | 1d | Low | ✅ |
| **Старий Лев** | starylev.com.ua | ✖ | ✓ | `__NEXT_DATA__` (+ISBN) | Easy | none | 1d | Low | ✅ |
| **Sens** | sens.in.ua | ❓ | ✓ | JS vars | Medium | JS PoW cookie | 2–3d | Med | ⚠️ |
| **Megogo Books** | mbooks.com.ua | ✖ | ✓ | RSC (+ISBN) | Medium | CF (м'який) | 2–3d | Med | ⚠️ |
| **Bohdan** | bohdan-books.com | ✖ | ✓ | data-attr + XLS | Easy | none | 1–2d | Low | ⚠️ |
| **Bukva** | bukva.ua | ✖ | ✓ | none (HTML+ISBN) | Easy | CF CDN | 1–2d | Med | ⚠️ |
| **Grenka** | grenka.ua | ✖ | ✓ | JSON-LD (+ISBN) | Easy | CF CDN | 2–3d | Med | ⚠️ |
| **Folio** | folio.com.ua | ✖ | ✓ | ❓ (не дозонд.) | Easy | none | 2–3d | Low–Med | ⚠️ |
| **Yakaboo** | yakaboo.ua | ✖ | ✖ | ✖ | Nearly imposs. | CF Managed Chl | weeks | Very High | ⛔ |
| **Книгарня Є** | book-ye.com.ua | ✖ | ✖ | ✖ | Nearly imposs. | CF Managed Chl | weeks | Very High | ⛔ |
| **Наш Формат** | nashformat.ua | ✖ | ✖ | ✖ | Hard | CF WAF | weeks | Very High | ⛔ |
| **Rozetka** | rozetka.com.ua | seller-only | ✖ | ✖ | Nearly imposs. | CF Managed Chl | weeks | Very High | ⛔ |
| **Ranok** | ranok.com.ua | ✖ | ✓ | ? | (legal block) | robots: Disallow AI | n/a | n/a | ⛔ |
| **Booklya** | booklya.com.ua | ✖ | ✓ | none (no ISBN) | Easy | none | 1–2d | Very High | ⛔ |

*Baseline: **Vivat** (`vivat.com.ua`) — вже active `ScraperProvider` (HTTP 200, без challenge), еталон «робочого» провайдера.*

---

## 4. Ранжування

### Tier A — інтегрувати одразу
Low maintenance · стабільні · технічно прості (SSR + структуровані дані, без anti-bot) · висока бізнес-цінність.

1. **BookChef** — JSON-LD з `isbn` + `gtin13` + `price`; найкращий для canonical matching.
2. **Лабораторія** — JSON-LD `Product`+`Book` (ISBN, формат, сторінки), daily sitemap.
3. **Старий Лев (ВСЛ)** — `__NEXT_DATA__` з повним обʼєктом (ISBN, qty, price); найпростіший парс.
4. **КСД (ksd.ua)** — JSON-LD price/availability, 5k+ книг (звірити «BookClub» з дорожньою картою).
5. **Книголенд** — двошаровий JSON-LD з ISBN, чистий Next.js SSR.
6. **Readeat** — найбільший каталог (53k), RSC/JSON; врахувати, що `/api/products` ≠ повний каталог.

> Усі шість — наявний `ScraperProvider`, `1 day` кожен, Low(-Med) maintenance. Рекомендований порядок впровадження = порядок вище (спершу ISBN/GTIN-багаті — кращий matching).

### Tier B — інтегрувати пізніше
Реалістичні, але дорожчі або з застереженнями.

1. **Megogo Books (mbooks)** — 30k каталог, RSC дає ISBN; ризик — посилення Cloudflare + крихкий RSC.
2. **Bohdan** — viable; windows-1251; XLS-прайс як bulk-feed-альтернатива (місячна гранулярність).
3. **Sens** — юридично найчистіший (`ai-train=yes`), але PoW-handshake (верифікувати) + дані в JS, не JSON-LD.
4. **Grenka** — гарний JSON-LD з ISBN, але **немає sitemap** → дорожчий discovery.
5. **Folio** — без anti-bot, але data-source не дозондовано; малий каталог.
6. **Bukva** — великий бренд, HTML+ISBN, але без structured data, sitemap лише категорії, **robots блокує AI-боти** (звірити з нашим UA-рядком/політикою).

### Tier C — відкласти
Severe anti-bot або явна legal-заборона; не інженерна, а юридична/доступова проблема.

- **Yakaboo** — CF Managed Challenge; affiliate ненадійна, без feed → переговори (provider-integration-strategy §3).
- **Книгарня Є** — CF Managed Challenge → переговори/feed (provider-integration-strategy §4).
- **Наш Формат** — CF WAF (найжорсткіший) → переговори/feed.
- **Rozetka** — CF Managed Challenge; легальний шлях лише через Seller API (потрібен seller-акаунт), поза MVP.
- **Ranok** — robots явно забороняє AI/scraper-ботів → лише з дозволу.
- **Booklya** — legacy, без ISBN/structured data, ймовірно покинутий → низький ROI.
- **Ababahalamaha** — не повноцінний e-commerce front → виключити.

---

## 5. Юридичні / robots-сигнали (важливо для скрапера)

| Store | robots-сигнал | Висновок |
|-------|---------------|----------|
| Sens | `ai-input=yes, ai-train=yes` | Найчистіший дозвіл |
| КСД, Лабораторія, Книголенд, BookChef, ВСЛ, Readeat, Grenka, Folio | стандартний (блок cart/checkout/filters) | OK для каталогу |
| Bukva | `ClaudeBot/GPTBot/Amazonbot Disallow: /`, `ai-train=no`; `* Allow: /` | Сигнал проти AI-ботів — звірити політику |
| Ranok | `ClaudeBot/anthropic-ai/GPTBot… Disallow: /` | Явна заборона → не скрапити без дозволу |

> Knyhovo — **price-aggregator**, а не AI-training-краулер; технічно `User-agent: *` часто дозволяє каталог. Але `Content-Signal: ai-train=no` та явні disallow — це воля власника; для Tier B/C-кандидатів з такими сигналами рішення про скрап має бути свідомим (продуктовим/юридичним), а не дефолтним. Для всіх — поважати `Crawl-delay` і `timeout` (security.md).

---

## 6. Висновки та наступні кроки

1. **MVP-набір (Tier A):** 6 провайдерів додаються як `ScraperProvider` без змін архітектури. Сумарна оцінка ~6 людино-днів + тести (≥80% coverage, testing.md). Кожен — окремий PRD перед кодом (правило проєкту).
2. **Tier B** — після MVP, по одному, з окремою верифікацією (Sens PoW, Folio data-source, Bukva/Ranok robots-політика).
3. **Tier C** — не код, а трек переговорів/feed (provider-integration-strategy §3–4). Лишити `blocked`/`disabled` у scrape health, не показувати у публічному search (§5 того ж доку).
4. **Жодного публічного product-feed/API в індустрії немає** — підтверджено. Rozetka Seller API — єдиний документований, але marketplace-only.
5. **Caveat:** усі «м'які CF» (Megogo, Readeat, Laboratory, Grenka) можуть посилити захист — закласти моніторинг `detectProviderBlock` і не вважати їх вічно-зеленими.

> За правилом проєкту: **код під цих провайдерів не пишеться до підтвердження відповідного PRD.** Цей док — research, не дозвіл на імплементацію.
