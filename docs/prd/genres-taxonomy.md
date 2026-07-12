# Genres / TAXONOMIC Collections PRD

> **Тип:** PRD (feature). **Статус:** Чорновик (2026-07-12).
> **Гілка:** `feat/genres-taxonomy`.
>
> **Правило проєкту:** код під цю фічу **не пишеться** до підтвердження цього PRD (фаза G0).
>
> **Споріднені доки:** [book-metadata.md](./book-metadata.md) (патерн «enrichment живе на listing,
> canonical-рівень обирає детерміновано» — цей PRD його наслідує),
> [ksd-graphql-api.md](../research/ksd-graphql-api.md) (GraphQL-поле `categories` у КСД),
> [ye-bookstore-provider.md](../research/ye-bookstore-provider.md) (Book-Ye заблокований Cloudflare),
> [collections-sql-performance.md](./collections-sql-performance.md) (SQL-фіди, які цей PRD не змінює).

---

## 1. TL;DR / Що будуємо

Нормалізована жанрова таксономія Knyhovo, яка:

- **збирає** сирі жанрові/категорійні сигнали провайдерів (breadcrumbs, GraphQL categories,
  JSON-LD genre) у нову колонку `provider_listings.raw_categories`;
- **мапить** їх у канонічні жанри Knyhovo через таблицю правил `genre_mappings`
  (provider + sourceCategory → canonical genre);
- **призначає** `canonical_books.genre_id` детермінованим mapping engine з precedence-правилами;
- **активує** TAXONOMIC-колекції: `GET /api/collections` повертає жанри,
  `GET /api/collections/hub.genres` непорожній, жанрові сторінки `/zhanry/<slug>` працюють;
- покриває **існуючі** книги (backfill CLI) та **нові** скрапи (автоматично при повному циклі);
- працює на staging і production **без залежності від локального `prisma/seed.ts`**.

### Проблема (стан на 2026-07-12)

| Шар | Стан |
|-----|------|
| Frontend (`CollectionsNav`, `/zhanry/[slug]`) | Готовий, споживає `hub.genres` |
| Collections API/service/repository | Готові: TAXONOMIC-фіди, лічильники, поріг, 301 для тонких жанрів |
| `canonical_books.genre_id` | Заповнюється **лише** `prisma/seed.ts` (демо-дані) |
| Скрапери | **Жоден** екстрактор не збирає категорії; у `RawProviderListing` немає поля |
| Staging | `GET /api/collections` → 0 TAXONOMIC; `hub.genres` порожній |

Це прогалина у data pipeline, не фронтенд-баг: сигнал жанру ніде не збирається і не
зберігається, тому жоден жанр не набирає книг.

## 2. Що ми явно НЕ будуємо

- **AI-класифікацію** жанрів у v1 (можливий пізніший fallback-етап — окреме рішення з власним PRD/розділом).
- **Multi-genre** прив'язку (M2M) — v1 має один primary genre; схема лишає шлях до M2M без ре-скрапу (§4).
- **Ієрархію жанрів** — підкатегорії провайдерів мапляться у плоскі top-level жанри.
- **User-created genres** та будь-який user-facing tagging.
- **Editorial-колекції** та їхнє наповнення (окремий трек).
- **Зміни ranking/popularity** — сортування фідів не змінюється.
- **Загальний metadata enrichment**, не пов'язаний із жанрами.
- **Vivat category-catalog crawl** (`/category/[...code]`) — окремий scraper-workstream, дивись §14 (ризики).
- **Yakaboo / Book-Ye extraction** — джерела недоступні (403 / Cloudflare), явно out of scope v1.

## 3. Продуктові рішення

### 3.1 Затверджені (2026-07-12)

| # | Питання | Рішення |
|---|---------|---------|
| 1 | Один жанр чи кілька? | **Один primary genre** (`canonical_books.genre_id`). Сирі сигнали зберігаються окремо — міграція на M2M пізніше можлива без ре-скрапу. |
| 2 | Канонічний список жанрів | **17 жанрів із seed як база + кандидати-доповнення** (§6.3); фінальний список затверджується при рев'ю цього PRD. |
| 3 | Поріг 30 книг | **30 у production, env-override** `COLLECTIONS_MIN_GENRE_BOOK_COUNT`; на staging тимчасово знижений (пропозиція: 5). Поведінка приховування (hub-фільтр + 301 → `/dobirky`) зберігається. |
| 4 | Конфлікт провайдерів | **Provider-priority** (за зразком `METADATA_PROVIDER_PRIORITY` у `discovery/metadata-selection.ts`) + бонус за згоду ≥2 провайдерів (§4.3). |

### 3.2 Документовані рішення з рекомендаціями (не блокують, затверджуються разом із PRD)

| Питання | Рекомендація | Обґрунтування |
|---------|--------------|---------------|
| Ієрархія «підкатегорія → жанр»? | **Ні.** Підкатегорії провайдерів мапляться в плоскі top-level жанри через `genre_mappings`. | Ієрархія не потрібна жодному поточному UI; мапінг-таблиця дає той самий ефект дешевше. |
| Дитячі, підручники, комікси, нонфік, бізнес, психологія, історія, фентезі, романтика, трилери — окремі жанри? | **Так**, і більшість уже у списку 17 (дитячі, комікси, бізнес, психологія, історія, фентезі, романтика, трилери, наук-поп). Підручники — поки ні (кандидат, §6.3). | Список 17 уже є live URL-контрактом (`/zhanry/*`). |
| Що робити, коли мапінг відсутній? | Книга лишається без жанру (`genre_id = null`); пара `(provider, категорія)` потрапляє в **unmapped-репорт** (§8.3) для курації. Жодних автослагів із провайдерських назв. | Керована якість: жанр з'являється тільки через явне правило. |
| Приховувати жанри з < порога книг? | **Так**, поточна поведінка зберігається (hub-фільтр + 301 → `/dobirky`), поріг стає конфігурованим. | UX «порожніх полиць» гірший за відсутність жанру. |
| Тимчасово знизити поріг на staging? | **Так**, `COLLECTIONS_MIN_GENRE_BOOK_COUNT=5` на staging до набору покриття. | E2E-верифікація до повного backfill. |
| Out-of-stock книги на жанрових сторінках? | **Включені, сортуються останніми** — поточна поведінка фідів (`ORDER BY e.in_stock DESC` перший ключ; фільтр `in_stock=1` доступний). Без змін. | Консистентно з рештою колекцій; лічильник жанру рахує всі книги (як зараз `countBooksByGenre`). |
| Чи перезаписувати жанр на кожному скрапі? | **Ні.** Скрап лише оновлює сирий сигнал; призначення — окремий пас із правилами перезапису (§4.4). `MANUAL` недоторканний. | Мандат «не перезаписувати канонічний жанр наосліп». |

### 3.3 Відкриті питання до рев'ю PRD

1. Фінальний список жанрів: чи додаємо когось із кандидатів §6.3 одразу в v1?
2. Значення порога на staging (пропозиція 5).
3. Чи вмикати post-scrape hook (`GENRE_ASSIGN_AFTER_SCRAPE`) одразу в G5, чи лишити тільки CLI на перший цикл?

## 4. Архітектура

### 4.1 Порівняння варіантів

| | A: лише `genre_id` | B: M2M `canonical_book_genres` (+primary flag) | C: mapping-таблиця provider+category→genre |
|---|---|---|---|
| Вплив на read-path | Нульовий — `countBooksByGenre`, taxonomic-фіди, `?genre=` уже ключуються на `genreId` | Переписує всі SQL-фіди колекцій, лічильники hub, індекси | Read-path не торкається |
| Корекція без ре-скрапу | Ні — призначення є єдиним записом; помилковий мапінг невідновний | Та сама проблема, якщо не зберігати сирий сигнал | **Так** — сигнал і правила відділені від призначення |
| Ризик migration dead end | Низький: M2M пізніше — адитивна міграція, seed з `genreId` | Найбільша upfront-ціна за нульовий v1-виграш | Немає; суто адитивно |

**Рішення: гібрид A + C.** `CanonicalBook.genreId` лишається єдиним канонічним призначенням;
додаються сирий сигнал, таблиця правил і метадані призначення. B свідомо відкладено.

### 4.2 Чотири шари

| Шар | Де живе |
|-----|---------|
| 1. Сирий сигнал провайдера | `provider_listings.raw_categories text[]` (provider-native текст, root→leaf) |
| 2. Нормалізований канонічний жанр | `collections` rows `type=TAXONOMIC` (без змін) + checked-in реєстр `packages/api/src/genres/taxonomy.ts` |
| 3. Правила мапінгу | таблиця `genre_mappings` + curated seed `packages/api/src/genres/mappings.seed.ts` |
| 4. Канонічне призначення | `canonical_books.genre_id` + `genre_source` / `genre_confidence` / `genre_updated_at` |

### 4.3 Precedence і confidence

Пріоритет провайдерів за якістю сигналу (форма — як `METADATA_PROVIDER_PRIORITY`):

```
GENRE_PROVIDER_PRIORITY = ['book-club', 'bookchef', 'laboratory', 'knigoland', 'vivat', 'yakaboo', 'book-ye']
```

Алгоритм на канонічну книгу (чисті функції, без IO, без clock — детерміновано):

1. **Кандидати per-listing:** кожен елемент `raw_categories` нормалізується
   (`normalizeCategoryKey`, §5.3) і шукається у мапінг-індексі
   `Map<provider, Map<key, {genreId|null, confidence}>>`; промах → fallback у
   провайдер-агностичний словник aliases таксономії (confidence 70). Мапінг із
   `genreId=null` («ignore») відкидає елемент. У межах одного breadcrumb-шляху береться
   лише **найглибший замаплений елемент** — «Фентезі» перемагає «Художню літературу».
2. **Скоринг per-genre крос-провайдерно:**
   `score = max(mappingConfidence по провайдерах) + 25 × (число згодних провайдерів − 1)`, cap 100.
   Це реалізує мандат «verified page category > provider mapping > cross-provider agreement»
   одним монотонним скором: одиничний first-class сигнал КСД дає 90–100, але згода ≥2
   провайдерів може його перебити.
3. **Tie-break:** вищий score → менший індекс найкращого провайдера у `GENRE_PROVIDER_PRIORITY`
   → глибший breadcrumb → slug за абеткою.
4. **Fallback:** кандидатів немає → результат `null`; кожна незамаплена пара
   `(provider, normalizedKey)` іде в unmapped-репорт.

### 4.4 Правила перезапису призначення (assignment layer, не engine)

| Поточний `genre_source` | Дія engine |
|--------------------------|------------|
| `MANUAL` | ніколи не торкається |
| `PROVIDER_MAPPING` | перезаписується, коли новий результат відрізняється (re-mapping авторитетний для власних записів); скидання в `null` при зниклому сигналі — лише з флагом `--clear-stale` (default: призначення лишається — «не перезаписуй відоме порожнім», як у `persist-listing.ts`) |
| `SEED` / legacy `null`-source із непорожнім `genre_id` | перезаписується лише при confidence ≥ 70; інакше лишається |
| без жанру (`genre_id = null`) | призначається, щойно є будь-який результат |

Призначення виконується **не** в `persistListing` (скрап-транзакція лише зберігає
`raw_categories`), а окремим пасом: engine потребує крос-провайдерного погляду на книгу,
а редагування мапінгів має бути re-runnable у будь-який момент.

### 4.5 Manual assignment contract

> **MANUAL assignment — абсолютний lock.** Книгу з `genre_source = 'manual'` **не можуть**
> змінювати за жодних умов:
>
> - scraper / persist-пайплайн;
> - mapping engine;
> - `genres:backfill` (включно з `--clear-stale`);
> - будь-який перерахунок confidence;
> - provider priority;
> - aliases;
> - майбутні оновлення мапінгів (`mappings.seed.ts` / `genre_mappings`).
>
> Єдиний спосіб змінити MANUAL-призначення — ручне редагування адміністратором або
> окремий maintenance-скрипт, запущений свідомо. Це правило не має винятків і не
> допускає двоякого трактування; воно дублює перший рядок таблиці §4.4 саме для того,
> щоб його неможливо було «оптимізувати» при реалізації.

### 4.6 Genre assignment explainability

Разом із результатом (`genreId`, `confidence`) mapping engine повертає коротке
**runtime-пояснення** (explanation) — людиночитний рядок про те, звідки взявся жанр.
Використовується **виключно** для логування, `--dry-run`, backfill-репортів і дебагу.

Приклади:

- `KSD category "Бізнес"`
- `BookChef breadcrumb "Художня література → Фентезі"`
- `Alias "Науково-популярна література"`
- `Agreement: KSD + BookChef`

Явні межі:

- це **НЕ** нова колонка БД (нічого не персиститься);
- це **НЕ** частина API/DTO;
- це **НЕ** persistence у будь-якій формі;
- це лише explainability/debug output у логах і звітах.

Мета — щоб через пів року по логу backfill/dry-run можна було за секунди зрозуміти,
чому конкретна книга отримала саме цей жанр, без відтворення стану engine вручну.

## 5. Data model

Одна **адитивна** Prisma-міграція (`add_genre_signals_and_mappings`); без data-backfill
усередині, без table rewrite (нові колонки nullable або з default).

### 5.1 Нові/змінені моделі

```prisma
enum GenreSource {
  SEED             @map("seed")              // demo seed.ts
  PROVIDER_MAPPING @map("provider-mapping")  // mapping engine
  MANUAL           @map("manual")            // кураторський override; engine не торкається
  @@map("genre_source")
}

model CanonicalBook {
  // ...існуючі поля...
  genreId         String?      @map("genre_id")           // без змін
  genreSource     GenreSource? @map("genre_source")       // як призначено поточний genreId
  genreConfidence Int?         @map("genre_confidence")   // 0–100 на момент призначення; null для SEED/MANUAL
  genreUpdatedAt  DateTime?    @map("genre_updated_at")
}

model ProviderListing {
  // ...існуючі поля...
  /// Сирий категорійний сигнал, root→leaf (breadcrumb-провайдери) або
  /// unordered (KSD categories). Provider-native текст (лише trim/whitespace-collapse).
  /// Порожній = сигнал ще не зібраний. Graceful: скрап без категорій ніколи
  /// не очищає раніше зібране значення.
  rawCategories String[] @default([]) @map("raw_categories")
}

model GenreMapping {
  id             String   @id @default(uuid())
  provider       Provider
  /// Нормалізований ключ (genres/normalize.ts): для book-club — category slug,
  /// для breadcrumb-провайдерів — lowercased whitespace-collapsed назва.
  sourceCategory String   @map("source_category")
  /// FK на TAXONOMIC collections row. NULL = явний «ignore» (відоме сміття
  /// типу «Акції» зникає з unmapped-репорту).
  genreId        String?  @map("genre_id")
  /// 0–100. Leaf/специфічні категорії 90–100, широкі корені («Художня література») 40–60.
  confidence     Int      @default(100)
  notes          String?
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  genre Collection? @relation("GenreMappingGenre", fields: [genreId], references: [id])

  @@unique([provider, sourceCategory])
  @@index([genreId])
  @@map("genre_mappings")
}

// Collection отримує back-relation:
//   genreMappings GenreMapping[] @relation("GenreMappingGenre")
```

### 5.2 Що свідомо НЕ додається

- `Collection.internalKey`/aliases-колонки — таксономія (slug, key, name, aliases, icon,
  displayOrder) є checked-in кодом (§6); БД-рядок — проєкція через `genres:sync`.
- Окрема таблиця сигналів `ProviderCategorySignal` — `text[]`-колонка покриває обидва
  read-патерни (join при призначенні; `unnest(...) GROUP BY` для репорту) без нових join-ів
  у скрап-транзакції. Escape hatch: таблицю можна вивести з колонки пізніше без ре-скрапу.
- GIN-індекс на `raw_categories` — репорт офлайновий full scan; додати пізніше за потреби.
- Новий `ScrapeRunKind` — backfill крос-провайдерний і не скрапить; `scrape_runs.provider`
  NOT NULL робить рядок семантично хибним. Observability = structured logs + репорт.

### 5.3 Нормалізація (`genres/normalize.ts`)

`normalizeCategoryKey(raw)`: NFC → trim → collapse whitespace → lowercase → зрізати хвостові
лічильники («Фентезі (123)») → зрізати обрамні слеші. Застосовується при **пошуку** в мапінгу;
при **збереженні** `raw_categories` — лише trim/collapse (текст лишається provider-native,
щоб правила можна було виправляти і бекфілити без ре-скрапу). Хелпер `leafFirst(path)` —
ітерація leaf→root.

## 6. Canonical Genre Taxonomy

### 6.1 Реєстр — checked-in код

`packages/api/src/genres/taxonomy.ts`:

```ts
export interface CanonicalGenre {
  readonly slug: string;          // СТАБІЛЬНИЙ, ніколи не змінюється (URL /zhanry/<slug>)
  readonly key: string;           // англійський internal key
  readonly name: string;          // українська display-назва — вільно перейменовується
  readonly description: string;
  readonly icon: string;
  readonly displayOrder: number;
  readonly aliases: readonly string[]; // нормалізовані; fallback, коли немає provider-мапінгу
}
export const CANONICAL_GENRES: readonly CanonicalGenre[] = [ /* 17 нижче */ ];
```

`prisma/seed.ts` рефакториться, щоб **імпортувати** `CANONICAL_GENRES` замість власного
inline-масиву — демо і прод не можуть розійтися.

### 6.2 Базові 17 жанрів (slug-и — live URL-контракт, беруться з seed verbatim)

| slug (stable) | Назва (укр) | key (internal) | Aliases (приклади) | Відомі provider-мапінги |
|---|---|---|---|---|
| `fantastyka` | Фантастика | `science-fiction` | sci-fi, science fiction, наукова фантастика | з G2-репорту |
| `fentezi` | Фентезі | `fantasy` | fantasy, фентезі | BookChef «Фентезі» (`/khudozhnia-literatura/fentezi`) |
| `tryllery` | Трилери | `thriller` | thriller, трилер, саспенс | з G2-репорту |
| `detektyvy` | Детективи | `detective` | detective, детектив, кримінальний роман | з G2-репорту |
| `zhahy` | Жахи | `horror` | horror, горор | з G2-репорту |
| `young-adult` | Young Adult | `young-adult` | YA, підліткова література | з G2-репорту |
| `klasyka` | Класика | `classics` | classics, класична література | з G2-репорту |
| `romantyka` | Романтика | `romance` | romance, любовні романи | з G2-репорту |
| `samorozvytok` | Саморозвиток | `self-development` | self-help, мотивація, особистісний розвиток | з G2-репорту |
| `psykholohiia` | Психологія | `psychology` | psychology, психологія | з G2-репорту |
| `biznes` | Бізнес | `business` | business, менеджмент, економіка | з G2-репорту |
| `biohrafii` | Біографії | `biography` | biography, мемуари, автобіографія | з G2-репорту |
| `dytiachi` | Дитячі | `children` | children's books, дитяча література | з G2-репорту |
| `komiksy` | Комікси | `comics-manga` | comics, manga, манга, графічні романи | з G2-репорту |
| `istoriia` | Історія | `history` | history, історична література | з G2-репорту |
| `naukovo-populiarni` | Науково-популярні | `popular-science` | popular science, наук-поп, science | з G2-репорту |
| `khudozhnia-proza` | Художня проза | `literary-fiction` | fiction, сучасна проза; **обережно:** «художня література» як широкий корінь мапиться сюди лише з низькою confidence (40–60) | Laboratory/Knigoland/BookChef корені «Художня література» |

Колонка «Відомі provider-мапінги» наповнюється у G3 з реального distinct-репорту категорій
(після G2 на staging); тут зафіксовано лише те, що підтверджено фікстурами.

### 6.3 Кандидати на додавання (на затвердження при рев'ю PRD)

| slug | Назва | key | Підстава |
|---|---|---|---|
| `poeziia` | Поезія | `poetry` | стандартна категорія всіх укр. книгарень |
| `kulinariia` | Кулінарія | `cooking` | стандартна категорія |
| `mystetstvo` | Мистецтво і культура | `arts-culture` | стандартна категорія |
| `viiskova-sprava` | Військова справа | `military` | Laboratory JSON-LD `Book.genre: "Військова справа"` — підтверджений живий сигнал |
| `inozemni-movy` | Книги іноземними мовами | `foreign-language` | Knigoland breadcrumb «Білінгва. Книги іноземними мовами» — підтверджений сигнал |

Підручники (`textbooks`) свідомо **не** пропонуються у v1: нішеве покриття у поточних
провайдерів, легко додати append-only пізніше.

### 6.4 SEO-політика / стабільність slug

- **Slug immutable.** Перейменування жанру = зміна лише `name` у `taxonomy.ts` + `genres:sync`;
  URL не змінюється, 301 не потрібен.
- **Видалення** жанру = `isActive=false` (sync ніколи не видаляє рядок — він далі задовольняє
  FK `genre_id`). Тонкі/вимкнені жанри вже мають 301 → `/dobirky` (існуюча поведінка detail).
- **Додавання** = append у `CANONICAL_GENRES` (+ мапінги) → sync → backfill → жанр
  з'являється у hub автоматично після перетину порога. Жодного frontend-коду.
- Публічні slug-и походять **виключно** з `taxonomy.ts`. `raw_categories` і
  `genre_mappings.sourceCategory` — internal-only, ніколи не серіалізуються у
  `CollectionDto` (DTO не змінюється).
- Механіка 301-редиректів для перейменувань у v1 не будується — вона не потрібна, поки slug
  незмінний.

## 7. Provider extraction strategy

Спільний хелпер `packages/scrapers/src/lib/extract-breadcrumbs.ts`: чистий, ніколи не кидає;
парсить `application/ld+json`-блоки, знаходить `@type: "BreadcrumbList"`, повертає
`itemListElement[].item.name ?? .name` у порядку `position`, відкидаючи перший елемент-«Головну»
(home crumb / назва магазину) і останній, якщо він дорівнює назві товару (title передається
викликачем).

| Провайдер | Джерело / data path | Catalog vs product | Нормалізація | Fallback | Надійність | Тест-стратегія |
|---|---|---|---|---|---|---|
| **Book Club / КСД** | GraphQL `productPage.categories[] {slug, name}` — додати `categories { slug name }` до `PRODUCT_PAGE_FIELDS` (`book-club/constants.ts`); зберігаємо **slugs** (стабільні first-class ключі) | productPage-батч і є джерелом лістингів каталожного скрапу — сигнал на кожен лістинг кожен ран | slug as-is | поле відсутнє → `[]` | **Найвища** (non-null API-поле, підтверджено recon `ksd-graphql-api.md`) | розширити `book-club.parser.test.ts`: categories присутні/відсутні у batch-відповіді |
| **BookChef** | JSON-LD `BreadcrumbList` на product page (напр. `Художня Література → Фентезі`); виклик `extractBreadcrumbs` у `parseBookChefListing` поряд з існуючою description-екстракцією | sitemap-driven: product page — первинний fetch, сигнал безкоштовний | names, root→leaf | breadcrumb відсутній → `[]` | Висока (є в усіх 3 product-фікстурах) | фікстурні asserts точного `rawCategories` |
| **Laboratory** | JSON-LD `Book.genre` (одиничний рядок, напр. «Військова справа») → `[genre]`; fallback — breadcrumb microdata | sitemap-driven product fetch — безкоштовно | одиничний рядок | microdata breadcrumbs | Висока (найчистіший одиничний сигнал серед HTML-провайдерів) | фікстури: genre-поле + microdata-fallback |
| **Knigoland** | JSON-LD `BreadcrumbList` **тільки**; поле `Product.genre` — сміття (tagline магазину), явно ігнорується з коментарем у коді | sitemap-driven (~50k сторінок) — безкоштовно | names, root→leaf; варіативність кореня по секціях поглинається мапінг-рядками, не парсером | `[]` | Висока через BreadcrumbList | окремий тест: tagline у `genre` НЕ потрапляє у `rawCategories` |
| **Vivat** | **Немає надійного джерела у v1.** У product `__NEXT_DATA__.allCharacteristics` жанру немає (верифіковані codes: publisher/language/book_cover/product_series/pub_year/ean_isbn/pages_num/product_type). Єдиний потенційний сигнал — category-catalog URLs `/category/[...code]` → окремий workstream, out of scope | — | — | — | Слабка | — |
| **Yakaboo** | **Немає джерела:** плаский каталог `/ua/books.html`, product pages 403 (bot protection) | — | — | — | Немає | — |
| **Book-Ye** | **Blocked:** Cloudflare Managed Challenge site-wide (Tier C). Категорія існує в Magento URL-шляху, але недосяжна | — | — | — | Blocked | — |

**Зміни у спільних типах:** `RawProviderListing` (`packages/shared/src/types/provider.ts`)
отримує `readonly rawCategories?: readonly string[] | null`; персистований `ProviderListing`
DTO — `readonly rawCategories: readonly string[]`.

**Persistence (`packages/api/src/pipeline/persist-listing.ts`):**
- create-гілка: `rawCategories: listing.rawCategories?.filter(нетривіальні) ?? []`;
- update-гілка: graceful — записуємо лише коли скрап дав непорожній масив; порожній результат
  **ніколи не очищає** раніше зібраний сигнал (дзеркало існуючих правил для
  cover/description/metadata).

Skip-set-и `pipeline/run-scrape.ts` не змінюються: три sitemap-провайдери і так фетчать
product pages кожен повний ран, КСД — GraphQL-батч; `METADATA_ENRICHED_PROVIDERS`
лишається `['vivat']`.

## 8. Backfill strategy

**Ключове обмеження:** сирі сторінки не зберігаються (у `provider_listings` немає rawPayload),
тому **перше** наповнення `raw_categories` вимагає одного повного скрап-циклу після деплою G2.
Після цього всі корекції мапінгу та повторні призначення — **DB-only назавжди**, без ре-скрапу.

### 8.1 Два CLI (патерн `src/scripts/run-scrape.ts`: tsx entry, prisma, logger, `$disconnect`, `process.exitCode`)

```json
"genres:sync":     "tsx src/scripts/run-genre-sync.ts",
"genres:backfill": "tsx src/scripts/run-genre-backfill.ts"
```

**`genres:sync`** — upsert `CANONICAL_GENRES` → `collections` (по unique `slug`; оновлює
name/description/icon/displayOrder, **ніколи** slug; TAXONOMIC-рядки, зниклі з таксономії →
`isActive=false`) і `mappings.seed.ts` → `genre_mappings` (по unique `(provider, sourceCategory)`).
Ідемпотентний, секунди, підтримує `--dry-run`. Саме він — а не Prisma data-міграція і не
`seed.ts` — доставляє 17 жанрів на staging/production.

**`genres:backfill`** (`pnpm --filter @knyhovo/api genres:backfill`):

```
--dry-run              обчислити + репорт, нуль записів
--batch-size=500       книг на keyset-сторінку (default 500)
--cursor=<bookId>      resume з canonicalBook id (keyset по id)
--only-unassigned      лише genre_id IS NULL (швидкий перший пас)
--clear-stale          дозволити PROVIDER_MAPPING → null при зниклому сигналі
--report[=path]        unmapped- та ambiguous-репорти (default stdout-таблиця)
```

Потік: (1) один раз завантажити мапінг-індекс + aliases; (2) keyset-пагінація
`canonical_books` за `id > cursor` з `listings.select(provider, rawCategories)`; (3) engine →
diff проти `(genreId, genreSource, genreConfidence)`, `MANUAL` пропускається; (4) на батч —
одна `$transaction` лише зі зміненими `update`; (5) прогрес-рядок на батч
(`assigned/changed/unchanged/manual-skipped/no-signal, cursor=<lastId>`) — логований cursor і є
механізмом resume; пас повністю ідемпотентний, тож повний перезапуск завжди безпечний;
(6) фінальні репорти: unmapped (`provider | rawCategory | normalizedKey | listingCount | exampleUrl`,
сортування за count desc; окремий `unnest(...) GROUP BY`-варіант у `genres/repository.ts` для ad-hoc)
та ambiguous (§8.4).

Аргументи парсяться чистим `genre-backfill-args.ts` (тестований, як `scrape-env.ts`).

Оцінка: ~60k книг / 500 ≈ 120 сторінок — одиниці хвилин. **Не** всередині Prisma-міграції;
міграція G1 — тільки схема.

### 8.2 Rollback

```sql
UPDATE canonical_books
SET genre_id = NULL, genre_source = NULL, genre_confidence = NULL, genre_updated_at = NULL
WHERE genre_source = 'provider-mapping';
```

(документується у PR G4; `MANUAL`/`SEED` не зачіпаються).

### 8.3 Unmapped-категорії

Кожна незамаплена пара `(provider, normalizedKey)` спостережувана через `--report`. Робочий
цикл курації: G2-скрап → `genres:backfill --dry-run --report` → додати мапінги/ignore-рядки в
`mappings.seed.ts` → `genres:sync` → `genres:backfill`. Пізніше — опційний щотижневий
`--dry-run --report` cron (out of scope v1).

### 8.4 Ambiguous report

Другий тип звіту поряд з unmapped. Книга потрапляє в **ambiguous-репорт**, якщо:

- різниця score між двома найкращими жанрами-кандидатами менша або дорівнює порогу
  (пропозиція: ≤ 5), **або**
- кілька жанрів мають однаковий score (спрацював tie-break §4.3).

Приклад запису:

```
«Дюна» (isbn 978…)
  fentezi      91   BookChef breadcrumb "Художня література → Фентезі"
  fantastyka   90   KSD category "Фантастика"
```

Такі книги **не є помилкою**: призначення все одно відбувається за звичайними
детермінованими правилами §4.3 (score → provider priority → depth → slug). Репорт існує
лише для ручної перевірки і покращення mapping rules (підняти/знизити confidence,
додати точніший leaf-мапінг). **Жодної нової логіки призначення це не додає** —
це виключно observability поверх уже описаного алгоритму.

## 9. TAXONOMIC collection creation

- **Materialized rows, dynamic membership** (без змін): жанри — рядки `collections`,
  членство/лічильники — через `canonical_books.genre_id` (`groupBy`, всі книги без фільтра наявності).
- **Доставка рядків:** `genres:sync` (§8.1). Не `seed.ts` (демо-дані, не для прод) і не SQL
  data-міграція (не re-runnable при перейменуваннях).
- **Deploy-порядок:** `prisma migrate deploy` → `genres:sync` → повний скрап-цикл (наповнює
  `raw_categories`) → `genres:backfill`.
- **Slug-и стабільні** (§6.4); лічильники — існуючий `countBooksByGenre`; поріг —
  `COLLECTIONS_MIN_GENRE_BOOK_COUNT` env (default 30), обидва місця застосування
  (hub-фільтр, 301 detail) читають одну константу в `collections/service.ts`.
- **Empty-state:** жанри нижче порога приховані у hub і 301-редиректяться на `/dobirky` —
  поведінка не змінюється; на порожньому проді до backfill користувач бачить те саме, що зараз.
- **Нові жанри:** append у таксономію → sync → backfill → автоматично видимі після порога.
- **Кеш:** лишається TTL-only (hub 5 хв, taxonomic books 60 хв). Кеш — per-process in-memory,
  CLI з іншого процесу фізично не може його інвалідувати без адмін-endpoint; для ~добового
  циклу призначення це прийнятно (документована межа: до 60 хв staleness списків книг жанру
  після backfill; hub — до 5 хв). Ескалація до invalidation-endpoint — лише якщо призначення
  стане intra-day.

## 10. Фази / PR-декомпозиція

### G0 — PRD approval
Цей документ. Gate: затвердження. Коду немає.

### G1 — Схема + таксономія + sync (PR 1)
- **Scope:** міграція §5.1 (enum `GenreSource`, 3 колонки `canonical_books`,
  `raw_categories`, таблиця `genre_mappings`); `genres/taxonomy.ts`, `genres/normalize.ts`,
  `genres/sync.ts`, `run-genre-sync.ts`; рефактор `seed.ts` на імпорт таксономії.
- **Залежності:** немає. **Міграції:** одна адитивна.
- **Команди:** `pnpm --filter @knyhovo/api exec prisma migrate dev`,
  `pnpm --filter @knyhovo/api genres:sync --dry-run`.
- **Тести:** `normalize.test.ts`; `taxonomy.test.ts` (17 slug-ів заморожені, унікальність
  slug/key); ідемпотентність sync (подвійний запуск = no diff; rename міняє name, не slug) —
  pg-патерн `collections/__tests__/feeds.pg.test.ts`.
- **Acceptance:** staging змігрований; 17 TAXONOMIC-рядків існують; hub досі показує 0 жанрів
  (лічильники < порога) — жодних user-visible змін.
- **Rollback:** адитивні колонки/таблиця — revert deploy; `migrate resolve --rolled-back` або
  drop-forward міграція.

### G2 — Provider extraction + persistence (PR 2)
- **Scope:** поле у shared-типах; `lib/extract-breadcrumbs.ts`; КСД constants+parser;
  bookchef/laboratory/knigoland parsers; graceful-write у `persist-listing.ts`.
- **Залежності:** G1 (колонка існує). **Міграції:** немає.
- **Тести:** розширення parser-тестів 4 провайдерів на фікстурах (точні `rawCategories`;
  knigoland: tagline-`genre` ігнорується); `extract-breadcrumbs.test.ts`; розширення
  `pipeline/__tests__/run-scrape.test.ts` (порожній масив не очищає збережене).
- **Acceptance:** повний ран на staging →
  `SELECT provider, count(*) FILTER (WHERE cardinality(raw_categories)>0) …` показує ≥80%
  покриття для book-club/bookchef/laboratory і ≥60% для knigoland.
- **Rollback:** revert scraper-змін; зібрані дані інертні й нешкідливі.

### G3 — Mapping engine + curated mappings (PR 3)
- **Scope:** `mapping-engine.ts`, `mappings.seed.ts` (курований з distinct-репорту staging),
  `assignment.ts`, `report.ts`; sync розширюється upsert-ом мапінгів.
- **Залежності:** G2-дані на staging (для курації). **Міграції:** немає.
- **Тести:** table-driven `mapping-engine.test.ts` (один провайдер; згода перемагає пріоритет;
  leaf над root; ignore-мапінги; alias-fallback; tie-breaks); unit-тести правил перезапису
  `assignment.ts` (патерн `fake-prisma.ts`). Coverage ≥80% модуля.
- **Acceptance:** dry-run по staging-знімку мапить ≥60% книг із сигналом; unmapped-репорт
  переглянутий.
- **Rollback:** чистий код, revert PR.

### G4 — Backfill CLI + наповнення staging (PR 4)
- **Scope:** `run-genre-backfill.ts`, `genre-backfill-args.ts`.
- **Залежності:** G3. **Міграції:** немає.
- **Команди:** `pnpm --filter @knyhovo/api genres:backfill --dry-run --report`, потім реальний ран.
- **Тести:** args-тести (дзеркало `scrape-env.test.ts`); pg-інтеграційний: сід книг+лістингів+
  мапінгів → пас → перевірка призначень, `MANUAL` недоторканний, другий ран нічого не пише,
  cursor-resume еквівалентний, dry-run нічого не пише.
- **Acceptance:** backfill на staging завершено; ≥N жанрів перетнули
  `COLLECTIONS_MIN_GENRE_BOOK_COUNT=5`; репорт заархівований; повторний ран — no-op.
- **Rollback:** SQL §8.2.

### G5 — Активація API (PR 5)
- **Scope:** env-driven поріг у `collections/service.ts`; опційний env-gated
  (`GENRE_ASSIGN_AFTER_SCRAPE=true`) post-scrape hook в `refresh/production-runner.ts`
  (той самий код-шлях `assignment.ts` — нічні скрапи тримають жанри свіжими без cron-змін).
- **Залежності:** G4 виконаний на staging. **Міграції:** немає.
- **Тести:** розширення collections route-тестів (поріг з env; 301 тонкого жанру поважає
  override); тест hook-а поряд із `refresh/__tests__/full-catalog.refresh.test.ts`.
- **Acceptance:** staging `GET /api/collections/hub` повертає непорожній `genres[]`;
  `/api/collections/<slug>/books` — пагінація, default `price_asc`, коректні лічильники;
  тонкі жанри — 301.
- **Rollback:** unset env-змінних → точно попередня поведінка.

### G6 — Frontend-верифікація і моніторинг (PR лише якщо знайдено прогалини)
- **Scope:** очікувано **0 коду** — `CollectionsNav` і `/zhanry/[slug]` вже споживають
  незмінені DTO. Чекліст: nav-чіпи з реальними жанрами та іконками; `/zhanry/<slug>`
  пагінація/фільтри/OOS-last; UX 301 тонкого жанру; hub на prod (до backfill) vs staging (після).
- **Acceptance:** product sign-off на staging з порогом 5 → прод-backfill з default 30.

## 11. Тести (зведення)

- **Mapping unit:** table-driven кейси engine (§10 G3) — precedence, згода, leaf-first,
  ignore, aliases, tie-breaks, unknown category → null + репорт.
- **Extractor fixtures:** 4 провайдери + `extract-breadcrumbs` (реальні fixture-фрагменти);
  knigoland-tagline негативний тест.
- **Persistence integration:** `run-scrape.test.ts` — create/update гілки `raw_categories`,
  «порожнє не очищає».
- **Conflict/precedence:** engine-тести + assignment-правила перезапису (MANUAL/SEED/
  PROVIDER_MAPPING/unassigned).
- **Backfill:** ідемпотентність, resume-еквівалентність, dry-run без записів, `--only-unassigned`.
- **API:** hub genres list, detail 301/поріг з env, books пагінація+сортування, порожні та
  підпорогові жанри.
- **Регресія:** існуючі dynamic/editorial фіди без змін (наявні collections-тести мають
  лишитися зеленими без модифікацій контракту).
- **Правила репо:** coverage нових модулів ≥ 80%; тести детерміновані (engine — без clock/random).

## 12. Acceptance criteria (фіча в цілому)

1. Staging `GET /api/collections` повертає TAXONOMIC-колекції.
2. `GET /api/collections/hub` → `genres` непорожній.
3. Кожен видимий жанр має реальні книги (лічильник ≥ порога, книги відкриваються).
4. Жанрова сторінка повертає пагіновані книги (24/сторінка, default `price_asc`, OOS останні).
5. Нуль залежності від локального `seed.ts` (доставка через migrate + `genres:sync` + backfill).
6. Існуючі книги бекфілнуті (`genre_source='provider-mapping'` там, де є мапінг).
7. Нові скрап-рани призначають жанри автоматично, де мапінг існує (hook або наступний backfill).
8. Незамаплені категорії провайдерів спостережувані (репорт §8.3).
9. Жодного перезапису з джерела нижчої довіри (правила §4.4; `MANUAL` недоторканний).
10. Жодної регресії API-контракту (`CollectionDto`/`CollectionBookDto` незмінні).
11. `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` зелені на кожній фазі.

## 13. Operations & observability

| Метрика / процедура | Джерело |
|---|---|
| % покриття мапінгу (книги з сигналом → книги з жанром) | фінальний summary backfill |
| Кількість незамаплених категорій (по провайдеру) | `--report`; ad-hoc `unnest GROUP BY` у `genres/repository.ts` |
| Книги без жанру (усього / з сигналом) | summary backfill (`no-signal` vs `unmapped`) |
| Per-provider успішність екстракції | SQL `count(*) FILTER (WHERE cardinality(raw_categories)>0)` per provider (G2 acceptance) |
| Прогрес backfill | прогрес-рядок на батч + cursor |
| Staging rollout | migrate → sync → скрап-цикл → backfill; `COLLECTIONS_MIN_GENRE_BOOK_COUNT=5`; верифікація G6 |
| Production rollout | той самий порядок, поріг default 30; перший backfill вручну, hook вмикається після спостереження |
| Rollback | unset env (G5) + SQL §8.2 (G4) + revert PR (G1–G3) |

Обмеження v1: observability — CLI/логи, без дашборда й алертингу (прийнятно, поки курація
ручна; флаг на follow-up при частому дрейфі мапінгів).

## 14. Ризики

1. **Knigoland root-variance** (корінь breadcrumb різний по секціях): поглинається
   мапінг-рядками, але перший unmapped-репорт буде довгим — закласти час курації у G3.
   Пом'якшення: leaf-first — зазвичай мапити треба лише листя.
2. **Vivat без сигналу v1** — vivat-ексклюзиви лишаться без жанру; category-crawl — окремий
   workstream із реальним scope creep. Рішення після виміру coverage gap у G4-репорті.
3. **Yakaboo/Book-Ye нічого не дають** — книги, продавані лише там, без жанру (у них і описів
   сьогодні немає). Метрика «% канонічних книг із ≥1 сигнальним лістингом» у summary.
4. **KSD перейменування category slugs:** мапінг ключується на slug (стабільний); rename
   проявиться як нові unmapped-ключі після наступного скрапу — self-healing через репорт-цикл.
5. **Broad-category noise** («Художня література» на всьому підряд): низька confidence 40–60
   на коренях + leaf-first; залишкові помилки виправляються `MANUAL` (двічі не перезапишеться).
6. **Кеш без інвалідації:** до 60 хв staleness книжкових списків після backfill —
   задокументовано (§9), ескалація лише за intra-day потреби.
7. **Перший цикл потребує повного скрапу** (сторінки не збережені): G2→G4 розтягнуті у часі
   на один production-скрап; планувати backfill після найближчого нічного рану.
8. **`loadCanonicalRows`** (`pipeline/run-scrape.ts`) вантажить canonical_books без select —
   3 нові колонки додають незначний обсяг; за потреби додати `select` (поза scope v1).

## 15. Future evolution (non-goals)

Інформаційний розділ: показує, що архітектура v1 не є dead-end. **Жодних змін у v1 це
не додає** — усе нижче поза scope цього PRD.

```
v1  один primary genre
    (canonical_books.genre_id + genre_source/confidence)
      ↓
v2  primary + secondary genres
    (додаткове поле/масив поверх тих самих сирих сигналів)
      ↓
v3  canonical_book_genres (M2M, primaryGenre flag)
    (адитивна міграція; primary сідиться з genre_id)
```

Поточні рішення вже сумісні з цією еволюцією:

- `raw_categories` зберігає **всі** сигнали кожного лістинга (не лише переможний) —
  secondary/M2M-жанри виводяться з уже накопичених даних без ре-скрапу;
- `genre_mappings` не прив'язана до кардинальності призначення — та сама таблиця правил
  обслуговує і один, і кілька жанрів на книгу;
- `taxonomy.ts` (стабільні slug-и, aliases) не залежить від того, скільки жанрів має книга;
- mapping engine уже обчислює повний ранжований список кандидатів (§4.3) — v2/v3 лише
  споживають більше одного результату замість першого.
