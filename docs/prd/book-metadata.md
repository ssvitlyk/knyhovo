# Book Metadata Enrichment PRD («Про видання»)

> **Тип:** PRD (feature). **Статус:** Затверджено (2026-07-10).
> **Гілка (пропозиція):** `feat/book-metadata-enrichment`.
>
> **Правило проєкту:** код під цю фічу **не пишеться** до підтвердження цього PRD.
>
> **Споріднені доки:** [discovery-w9.md](./discovery-w9.md) (W9a F2 — description enrichment,
> чий product-page fetch ця фіча перевикористовує),
> [canonical-matcher-final-audit.md](../research/canonical-matcher-final-audit.md) (обовʼязковий
> аудит перед будь-яким наповненням ISBN — ризик false merges),
> [ksd-graphql-api.md](../research/ksd-graphql-api.md) (джерело метаданих для КСД).

---

## 1. TL;DR

- **Що:** наповнити блок «Про видання» на Book Details реальними даними: **Видавництво, Мова,
  Формат (обкладинка), Серія, Рік видання, ISBN**. Сьогодні з шести полів до даних підключений
  лише ISBN — і той `null` для більшості книг, бо каталог-скрейпи ISBN не віддають.
- **Як:** розширити наявний per-book product-page enrichment pass (W9a F2) — **той самий fetch**,
  що вже забирає опис, додатково витягує метадані видання. **Нуль додаткових HTTP-запитів.**
- **Де зберігати:** нові nullable-колонки на `provider_listings` (за патерном W9a §9:
  enrichment живе на listing, canonical-рівень обирає значення детерміновано).
- **UI:** `BookMeta.tsx` вже рендерить усі шість рядків із плейсхолдером «Уточнюємо…» —
  лишається лише підставити значення з розширеного `BookDetailsDto`.

## 2. Проблема (стан на 2026-07-09)

Сторінка книги (приклад: `books/ac5e734e-3ad6-45d9-bb50-c44d34b8d2c7`, «Навіки Токіо», Vivat)
показує «Уточнюємо…» в усіх шести полях. Причини по шарах:

| Шар | Стан |
|-----|------|
| `BookMeta.tsx` (web) | 5 із 6 полів hard-coded `null`; лише ISBN читається з DTO |
| `BookDetailsDto` (api) | має тільки `isbn` + `description`; полів метаданих немає |
| `provider_listings` (db) | колонок publisher/language/format/series/publication_year немає |
| Скрапери | каталог-скрейп не бачить метаданих (їх немає на картках); product-page pass (W9a F2) витягує лише опис |

Плейсхолдер «ми збираємо інформацію… зазвичай до одного дня» зараз **нездійсненна обіцянка**
для цих полів — пайплайна, який би їх колись наповнив, не існує.

## 3. Джерела даних по провайдерах

**Vivat — verified live recon 2026-07-09** (`__NEXT_DATA__ → props.pageProps.product.allCharacteristics`,
сторінка `/product/naviky-tokio/`):

| Поле | `code` у allCharacteristics | Приклад |
|------|------------------------------|---------|
| Видавництво | `publisher_code_entityelement` | `Vivat` |
| Мова | `language` | `Українська` |
| Формат | `book_cover` | `Тверда` |
| Серія | `product_series` | `Навіки Токіо` |
| Рік видання | `pub_year` | `2023` |
| ISBN | `ean_isbn` | `9789669829283` |
| (опційно) Сторінки | `pages_num` | `352` |

Інші провайдери (порядок впровадження за наявністю structured-джерела):

- **BookChef** — JSON-LD `@type:Product` на сторінці товару вже містить `isbn`/`gtin13`;
  видавництво/мова — recon потрібен.
- **КСД (book-club)** — GraphQL API (див. research doc); поля метаданих — recon потрібен.
- **Yakaboo** — таблиця характеристик на product-сторінці; recon потрібен.
- **Laboratory / Knigoland** — recon TBD.

v1 може стартувати з **Vivat only** (source verified) + graceful `null` для решти —
UI-плейсхолдер уже це підтримує.

## 4. Scope v1

1. **Scrapers.** Розширити enrichment pass: узагальнити `enrichDescriptions` до
   `enrichProductDetails` — provider-specific extract повертає `{ description, metadata }`
   з одного HTML. Нові optional-поля на `RawProviderListing`: `publisher?`, `language?`,
   `format?`, `series?`, `publicationYear?`; `isbn` — наявне поле, наповнюється з product-сторінки.
   Значення зберігаються **як текст провайдера** (без нормалізації словників у v1);
   санітизація до plain text + розумні ліміти довжини на межі скрейпу.
2. **DB.** Nullable-колонки на `provider_listings`: `publisher`, `language`, `format`,
   `series`, `publication_year INT`. Міграція Prisma. `canonical_books` **не** чіпаємо.
3. **Persistence.** `persist-listing.ts`: за патерном W9a — ніколи не перезаписувати відоме
   значення на `null` (graceful enrichment).
4. **ISBN → canonical.** Listing-рівень наповнюється завжди; **перенос на
   `canonical_books.isbn` та участь у matching — окреме рішення** після прогону
   canonical-matcher аудиту (див. §6). У v1 ISBN для UI читається selection-правилом
   із listings, як cover/description.
5. **API.** `BookDetailsDto` + nullable-поля: `publisher`, `language`, `format`, `series`,
   `publicationYear`. Selection через provider-priority (той самий механізм, що
   `description-selection.ts`). Жодних нових endpoints.
6. **Web.** `BookMeta.tsx`: підставити значення з DTO (рядки й плейсхолдер уже є —
   мінімальний diff, frozen-дизайн не змінюється).

## 5. Не в scope

- Нормалізація значень (словники мов/форматів), фільтри й фасети за метаданими.
- Перекладач, вага, розмір, тип паперу (є в джерелі — відкладено до потреби UI).
- Рендеринг HTML будь-де (тільки plain text — правило W9a зберігається).
- Зміна canonical matching (лише окреме рішення у §4.4 після аудиту).

## 6. Ризики

| Ризик | Наслідок | Мітигація |
|-------|----------|-----------|
| ISBN enrichment → canonical matching | Наповнення ISBN заднім числом може зіштовхнути наявні canonical-книги (false merge / ISBN_CONFLICT) | ISBN у v1 живе лише на listing; перенос на canonical — окремим кроком після прогону аудиту matcher |
| Вартість скрейпу | Немає: той самий product-page fetch, що W9a F2 | Enrichment лишається opt-in (env-флаг) з delayMs |
| Різношерсті значення провайдерів | «Тверда» vs «Тверда обкладинка» між провайдерами | v1 показує значення як є (selection бере одне джерело за пріоритетом) |
| Зміна структури `__NEXT_DATA__` у Vivat | Extract повертає null | Той самий graceful-null контракт, що в description pass |

## 7. Acceptance

- Сторінка «Навіки Токіо» після refresh з увімкненим enrichment показує всі 6 полів
  «Про видання» + опис (жодного «Уточнюємо…» для книги з Vivat-листингом).
- Книга без метаданих у провайдера деградує до плейсхолдера, сторінка функціональна.
- Тести: unit на extract/selection (fixtures з реальної структури), integration на
  `GET /api/books/:id` з новими полями; coverage нових модулів ≥ 80%.
