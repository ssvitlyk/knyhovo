# Megakniga Provider PRD

> **Тип:** PRD (per-provider). **Статус:** Затверджено (2026-07-19, директива власника «реалізуй згідно PRD»).
> **Гілка:** `feat/megakniga-provider`.
>
> **Recon виконано (2026-07-19)** проти живого `www.megakniga.com.ua` — повний звіт:
> [megakniga-provider.md](../research/megakniga-provider.md). Ключове:
> - **Yii2 (PHP) SSR без challenge.** Cloudflare лише як CDN; plain fetch повертає повний HTML.
> - **API немає.** Live-search CSRF-захищений і не використовується.
> - **Discovery = catalog crawl лістингів** `/catalog/knigi/pageN?per-page=64` (~26–28k книг).
>   Sitemap `lastmod` фейковий → інкрементальність через lastmod **не працює**.
> - **Лістинги містять ціну + наявність** → дешевий регулярний price-scrape без сторінок товару.
> - **ISBN лише на сторінці товару** (microdata `mpn`/`identifier`) → enrichment pass.
> - robots.txt забороняє `/search`; каталог і sitemap відкриті.
>
> Підхід v1 (затверджено цим PRD): **catalog-crawl discovery (клон vivat-патерну) + опційний
> enrichment через сторінку товару**, **без Playwright**, **без зміни архітектури/shared-контрактів**.
> **Стандарт:** [provider-implementation-guide.md](./provider-implementation-guide.md) (структура,
> contract, тести, acceptance — цей PRD його **не дублює**, а конкретизує під Megakniga).
> **Споріднені доки:** [megakniga-provider.md](../research/megakniga-provider.md) (recon; розділи 10–11 —
> reference implementations і suggested defaults), vivat — еталон catalog-crawl пайплайну.

---

## 1. TL;DR

- **Що:** `MegaknigaScraper implements ScraperProvider` зі slug `'megakniga'`: пагінований crawl
  лістингів `/catalog/knigi`, парсинг карток у `RawProviderListing[]`, опційний enrichment
  (ISBN/опис/видавець/палітурка/breadcrumbs) зі сторінки товару.
- **Транспорт:** `FetchHtmlFetcher`. **Без Playwright.**
- **Slug:** `megakniga` (один токен; `megaknigaPriceToKopecks`, клас `MegaknigaScraper`).

## 2. Що будуємо (v1 scope)

1. **Listing crawl:** `/catalog/knigi/pageN?per-page=64`, per-page=64. Stop-критерії:
   (а) сторінка не додала жодного нового URL (за межами останньої повертається остання — dedupe
   по URL, патерн yakaboo); (б) `options.maxPages` / провайдер-локальний default.
2. **Парсер картки лістингу** (`.product-list-item`): title (`.product-list-name`), url, author
   (`.authors-block a`), price (`data-price` форми або `.price`), old-price ігнорується для
   `price` (беремо актуальну), availability (`.product-available-container`), cover
   (`data-src`/`data-original`, lazy-load placeholder ігнорувати). ISBN у лістингу **немає** → null.
3. **Enrichment (opt-in, через `enrichProductDetails`):** сторінка товару →
   ISBN (`itemprop="mpn"`/`"identifier"`, fallback текст «Код товару / ISBN:»), publisher
   (текст «Виробник:», **не** `itemprop="brand"`), format («Обкладинка: Тверда/М'яка»),
   description (блок «Опис товару», sanitize), rawCategories (breadcrumb root→leaf, без «Головна»).
   Товар без маркера «Паперова книга» — не книга → відповідні метадані не застосовуються.
4. **Single-product refresh:** `parseMegaknigaProduct(html)` → `{price, availability}` з microdata
   (`itemprop="price"`, `itemprop="availability"` InStock/OutOfStock) + реєстрація у
   `SINGLE_PRODUCT_PARSERS`.
5. **Реєстрація (три точки за guide):** `ProviderName` union (shared), `providers/index.ts`,
   `SINGLE_PRODUCT_PARSERS`.

## 3. Що НЕ будуємо у v1

Повний список — recon розділ 12 (Not required): без Playwright, сесій/CSRF, live-search,
GraphQL/JSON API, `/search`-discovery, lastmod-інкрементальності, проксі/anti-detection.
Також поза scope v1: sitemap bootstrap, incremental URL diff, category-aware crawling,
publisher normalization (recon розділ 17 — future improvements).

## 4. Мапінг `RawProviderListing`

| Поле | Джерело (лістинг) | Джерело (enrichment) |
|---|---|---|
| `provider` | `'megakniga'` | — |
| `title` | `.product-list-name` текст | — |
| `author` | `.authors-block a` текст, або null | — |
| `isbn` | null | microdata `mpn`/`identifier` → нормалізація за guide §2.7 |
| `price` | `data-price` → kopecks (`Money`, UAH) | — (роздрібна; «Ціна опт» ігнорується) |
| `url` | href картки → абсолютний `https://www.megakniga.com.ua/...` | — |
| `availability` | `in_stock`/«Є в наявності» → `in-stock`; «Товар очікується» → `out-of-stock`; інакше `unknown` | microdata `availability` |
| `coverUrl` | `data-src`/`data-original` → абсолютний URL | повнорозмірна `data-echo` якщо доступна |
| `description` | — | «Опис товару» (sanitize) |
| `publisher` | — | «Виробник:» |
| `format` | — | «Обкладинка:» |
| `rawCategories` | — | breadcrumbs без «Головна»/«Каталог» |
| `language`, `publicationYear`, `series` | null — **обмеження джерела** (recon розділ 16) | — |

Ціна: `megaknigaPriceToKopecks("432.10") → 43210`; невалідна/відсутня ціна → guide §2.9
(skip з підрахунком, не помилка).

## 5. Defaults (з recon розділу 11)

`delayMs` 400 (listing) / 300 (enrichment); `concurrency` 1 (listing) / до 3 (enrichment);
`timeoutMs` 15000; `maxRetries` 2 через `fetchWithRetry`; `per-page` 64; провайдер-локальний
default max сторінок лістингу з override через `options.maxPages`.

## 6. Tests

За guide §3 і патерном vivat (`__fixtures__` з реальних сторінок): parser-тести (лістинг:
картки/ціни/наявність/обкладинки/dedupe; product: microdata, «Виробник», «Обкладинка», ISBN,
не-книга без «Паперова книга»), product-state тести (in-stock/out-of-stock/невалідна ціна),
scraper-тести з injected fake fetcher (пагінація+stop, enrichment, errors[]). Coverage ≥80%.
Фікстури: реальні сторінки з recon (лістинг категорії, лістинг зі знижками `price-old`,
товар in-stock, товар out-of-stock).

## 7. Acceptance criteria

- `pnpm lint` · `pnpm typecheck` · `pnpm test` зелені (окрім відомих red-тестів develop base).
- Live smoke (вручну): scrape 1–2 сторінок лістингу повертає ≥60 listings з ціною й URL;
  enrichment одного товару повертає ISBN.
- Жодних змін shared `ScraperOptions`/`RawProviderListing`.
