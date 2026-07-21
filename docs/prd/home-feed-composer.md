# PRD: Home Feed Composer (композиційний шар над candidate feeds)

> **Тип:** PRD (feature). **Статус:** Затверджено (rev. 3) · 2026-07-21.
> **Гілка:** `feat/home-feed-composer`.
> **Правило проєкту:** код під цю фічу не пишеться до підтвердження цього PRD (виконано — PRD затверджено).
> **Джерело:** аналіз Home/collections (2026-07-21) + прямий обхід коду: `packages/web/src/app/page.tsx`,
> `packages/web/src/components/home/{data.ts,Shelf.tsx}`, `packages/web/src/app/dobirky/page.tsx`,
> `packages/web/src/lib/collections/allocate.ts` (+тест), `packages/api/src/collections/{route,service,repository,mapper,dto,schema,cache}.ts`.
> **Споріднені:** [collections-sql-performance.md](./collections-sql-performance.md), [home-page.md](./home-page.md), [genres-taxonomy.md](./genres-taxonomy.md).

---

## 0. Changelog

**rev. 2 → rev. 3:**
- **`ComposeOptions` більше не містить `providerShareLimit`.** Composer приймає абстрактний **`diversityPolicy`** (стратегія `bucketCapFor(take)`), тож повністю незалежний від конкретної бізнес-політики. Конкретна політика (`floor(take × 1/3)`) визначається в **Home Builder** і інжектиться в composer.
- **Розділення відповідальностей** — додано примітку: побудова `FeedCandidate` (candidate-adapter) і побудова фінального Home DTO (response-mapper) — **окремі відповідальності**, навіть якщо поки реалізуються в одному Home Builder.

**rev. 1 → rev. 2:**

- **Тришарова архітектура:** Candidate feeds → **Generic Feed Composer** (чистий primitive) → **Home Builder** → `GET /api/home`. Composer відокремлено від Home.
- **Generic API composer-а:** `SectionSpec` + `FeedCandidate`, довільна кількість секцій, **нуль** hardcoded знань про popular/novynky/knyhovyk, Fastify, Prisma, HTTP, cache, wishlist, slug, display order, UI.
- **Provider identity:** `storeName` (display) замінено на machine-readable **provider id (enum)**; відсутній provider → окремий bucket `UNKNOWN`.
- **Diversity:** прибрано hardcoded `softProviderCap=4`; введено `providerShareLimit=1/3`, `effectiveCap = floor(take × providerShareLimit)` (take=12 → 4). Strict dedup > diversity.
- **Candidate limits:** прибрано magic numbers; `candidateLimit = take × candidateMultiplier` (editorial ×3, novynky ×5, popular ×10 → 36/60/120 як наслідок).
- **Editorial:** остаточно — allocation №1, curated order незмінний, diversity НЕ застосовується, strict dedup застосовується.
- **Allocation vs Display:** обидва — у **Home layout**, не в Composer.
- **Contract:** `GET /api/home` віддає лише `key + books`; presentation (title/CTA/eyebrow) — у web.
- **Future extensibility:** доданий §12 — composer як reusable primitive (Home/Email/Push/Landing/Recommendations), без побудови universal engine.
- **Open questions:** усі закриті → §17 «Locked decisions».
- **Acceptance / Testing:** оновлено під generic composer, provider enum, share-limit, multipliers, PR-розбиття.

---

## 1. Problem statement

Home (`web/src/app/page.tsx`) збирається на web трьома **незалежними** викликами `GET /api/collections/:slug/books` (`getHomeShelves`, `web/src/components/home/data.ts`): `populyarne-zaraz`, `novynky`, `knyhovyk-radyt`. Підтверджено кодом:

1. **Немає cross-section дедуплікації** (нуль `dedup/usedIds/shown` у collections-шляху). Relevance «Популярне» (`wishlist_count DESC, created_at DESC`) і «Новинки» (`created_at DESC`) майже збігаються → одна `canonicalBook` в обох секціях.
2. **Немає provider-диверсифікації.** Provider бере участь лише як tie-break у `listing_pick` і як `storeName` display. Магазин із найбільшим каталогом (нині Книголенд) володіє найдешевшими оферами найбільшої частки книг → секції майже повністю з його книг.
3. **SQL-фіди не є проблемою** — семантика коректна й відтюнінгована (<200 ms, C2). Бракує **окремого композиційного шару**.

## 2. Goals

- Ввести **Generic Feed Composer** — reusable, доменно-незалежний primitive: набір ранжованих секцій кандидатів → cross-section exclusion + soft provider diversification → фінальні секції.
- Ввести **Home Builder** — доменний шар, що знає Home/layout/candidate feeds/cache і **використовує** composer.
- **Жодного повтору `canonicalBookId`** між секціями Home.
- **Provider diversity без жорстких квот**; орієнтир — не більше `floor(take × 1/3)` = 4/12 від одного provider, коли є релевантні альтернативи.
- **Backend — єдине джерело композиції** (Home не збирає секції й не робить dedup у web); один виклик `GET /api/home`.
- **Детермінізм**: однаковий вхід кандидатів → однаковий вихід (testing-rule «без random/часу»).
- Наявні `GET /api/collections/:slug/books`, `/hub`, `/:slug` — **незмінні**.

## 3. Non-goals

- Не переписуємо SQL feeds; не змінюємо логіку `populyarne-zaraz`/`novynky`.
- Жодних DB schema/migrations.
- Жодного universal recommendation engine; жодної персоналізації (per-user candidate sources).
- Жодних змін публічних DTO (composer оперує **внутрішнім** `FeedCandidate`; відповідь віддає наявний `CollectionBookDto`).
- Не переводимо `/dobirky` hub на новий composer у фазі 1 (frontend `allocate()` лишається; міграція — §16 «Future», окремо).
- Не будуємо page-level (cross-shelf) provider-балансування — diversity лише **per-shelf**.

## 4. Current architecture

**Home (web):** `page.tsx` → `getHomeShelves()` → `Promise.all([loadShelf('populyarne-zaraz'), loadShelf('novynky'), loadShelf('knyhovyk-radyt')])` → кожен `GET /api/collections/:slug/books?page=1&per_page=24` (`cache:'no-store'`) → `isPriced` → `slice(0,12)`. Без дедупу/diversity/кешу.

**Collections API:** `route.ts` (4 публічні маршрути); `service.getCollectionBooks` → `cache.getOrSet('books:{slug}:{params}')` → `resolveFeed` → per-slug SQL (`queryDynamicFeedIds`/`queryNovynkyIds`/`queryEditorialFeedIds` на stateless `candidateCte`) → `findCanonicalBooksByIds` → `mapper.toCollectionBookDto`. Кеш in-process Map + SWR + семафор(4); `wishlistCount`/`isWishlisted` — після кешу. `schema.ts` жорстко вимагає `per_page===24`.

**Наявний композиційний механізм — `allocate()` (ТІЛЬКИ `/dobirky`, frontend):** `web/src/lib/collections/allocate.ts` —
```ts
allocate<T extends {id:string}>(specs:{key:string;take:number;pool:readonly T[]}[]): Record<string,T[]>
```
Жадібний cross-section dedup зі спільним `used=Set<id>`; спеки в порядку пріоритету; over-fetch через `SHELF_PAGES`; розміри `SHELF_TAKES`; allocation ≠ display. Є юніт-тести.

**Що перевикористовуємо / узагальнюємо:**

| Наявне (`allocate`) | Рішення |
|---|---|
| Жадібний cross-section dedup, spec `{key,take,pool}`, спільний `used` | **Фундамент** нового generic composer (алгоритм + форма spec). |
| `SHELF_PAGES`/`SHELF_TAKES` over-fetch+розміри | **Узагальнити** у Home layout (`candidateMultiplier`, `take`), без magic numbers. |
| Розділення allocation/display | **Перевикористати як принцип** (у Home layout, не в composer). |
| Немає provider-diversity | **Узагальнити:** soft provider-cap із `providerShareLimit` (§8). |
| Живе у web, знає про DTO | **Винести в backend** як доменно-незалежний primitive; web-hub мігрує пізніше — **без** другої паралельної копії diversity. |

## 5. Proposed architecture (тришарова)

```
Layer 1 — Candidate feeds        packages/api/src/collections/repository.ts   (БЕЗ ЗМІН)
   │  ранжовані id per feed (internal-виклик з великим candidateLimit)
   ▼
Layer 2 — GENERIC FEED COMPOSER  packages/api/src/feed-composer/*             (новий, ЧИСТИЙ)
   │  compose(sections: SectionSpec[], opts) → Record<key, FeedCandidate[]>
   │  знає лише: FeedCandidate{id, providerId}, SectionSpec{key,take,candidates,diversify}
   │  НЕ знає: Home, Fastify, Prisma, HTTP, cache, wishlist, slug, display order, UI
   ▼
Layer 3 — HOME BUILDER           packages/api/src/home/service.ts             (новий, доменний)
   │  знає Home layout, candidate feeds, cache, wishlist; будує FeedCandidate[]; кличе composer;
   │  кешує home:v1; декорує wishlist; мапить у CollectionBookDto; переставляє у display-порядок
   ▼
Layer 4 — GET /api/home          packages/api/src/home/route.ts               (тонкий HTTP)
   ▼
web Home — один fetch, лише render (presentation у web)
```

Композиція нічого не пише в БД, не робить N+1 (працює над уже завантаженими кандидатами).

### 5.1 Generic Feed Composer — контракт (доменно-незалежний)

```ts
// providerId — непрозорий рядок-бакет для composer; домен постачає enum-значення або 'UNKNOWN'.
interface FeedCandidate { readonly id: string; readonly providerId: string }

interface SectionSpec {
  readonly key: string;                       // непрозорий ідентифікатор секції
  readonly take: number;                       // скільки взяти
  readonly candidates: readonly FeedCandidate[]; // у relevance-порядку постачальника
  readonly diversify: boolean;                 // false → лише dedup + порядок (курована секція)
}
// diversityPolicy — АБСТРАКТНА стратегія; composer не знає жодної конкретної бізнес-політики
// (ані «1/3», ані «floor», ані «provider»). Значення визначає caller (Home Builder).
interface DiversityPolicy {
  /** Скільки кандидатів дозволено на один bucket у секції розміром `take`,
   *  перш ніж надлишок відкладається в relaxation-прохід. */
  readonly bucketCapFor: (sectionTake: number) => number;
}
interface ComposeOptions { readonly diversityPolicy: DiversityPolicy }

function compose(
  sections: readonly SectionSpec[],            // порядок масиву = ALLOCATION order (визначає caller)
  opts: ComposeOptions,
): Record<string /*key*/, FeedCandidate[]>;
```

Алгоритм (чистий, детермінований):
- спільний `used = Set<id>` на всі секції — **strict dedup, найвищий пріоритет**;
- секції обробляються в порядку масиву (= allocation order, задає Home Builder);
- **diversify=false** (курована): беремо перші `take` невикористаних кандидатів у наданому порядку; `providerId` ігнорується;
- **diversify=true**: `cap = opts.diversityPolicy.bucketCapFor(take)`; один прохід у relevance-порядку — кандидат береться, якщо `bucketCount[providerId] < cap`, інакше відкладається в `overflow` (порядок збережено); **relaxation-fallback**: якщо після проходу `< take`, добираємо з `overflow` по порядку (послаблення cap), доки `take` або пул вичерпано;
- composer **не** знає значення `'UNKNOWN'` спеціально — це просто ще один непрозорий bucket; composer **не** знає, що bucket означає «provider» чи що cap = «1/3» — це задає `diversityPolicy` ззовні.

Composer **не** містить: Home, назв секцій, slug, Fastify, Prisma, HTTP, cache, wishlist, display order, UI. Підтримує довільну кількість секцій із будь-якими `key`.

### 5.2 Home Builder — доменний шар

- Тягне кандидатів через **collections `repository`** напряму (не через HTTP) з `candidateLimit` (§6) — один запит на feed, обходить `per_page=24`.
- З `CollectionBookRow` (де є `listings` з `provider`-enum) будує `FeedCandidate{ id: canonicalBookId, providerId }`, де `providerId` = provider-enum **найдешевшого показаного listing** (та сама вибірка, що дає `storeName`), або **`'UNKNOWN'`**, якщо priced-офера немає. **Публічний DTO не змінюється** — `providerId` живе лише у внутрішньому candidate.
- Задає **allocation order** (порядок `SectionSpec[]`), **take**, **diversify** per section, `providerShareLimit` — усе з `HOME_LAYOUT`.
- Кличе `compose(...)`, отримує id per section, мапить у `CollectionBookDto` (наявний mapper), **переставляє секції у display-порядок**, кешує, декорує wishlist після кешу.
- **Конкретна `diversityPolicy` живе тут** (не в composer): `{ bucketCapFor: (take) => Math.floor(take * providerShareLimit) }`, `providerShareLimit = 1/3` з `HOME_LAYOUT`. Home Builder інжектить її в `compose(...)`.

> **Примітка — розділення відповідальностей.** Усередині Home Builder дві **окремі відповідальності**, навіть якщо поки що співіснують в одному модулі: (1) **candidate-adapter** — `CollectionBookRow → FeedCandidate{id, providerId}` (вхід composer-а; знає про provider-enum/`UNKNOWN`); (2) **response-mapper** — `picked ids → CollectionBookDto` + reorder у display-порядок (вихід для web; знає про presentation-контракт). Composer стоїть між ними й не знає про жодну. Це навмисний seam: коли з'являться інші builder-и (email/push), кожен матиме власний candidate-adapter і власний response-mapper понад тим самим composer-ом; за потреби ці дві відповідальності легко винести в окремі файли без зміни composer-а.

## 6. Candidate pool strategy

- Фінальна полиця: `take = 12`.
- **`candidateLimit = take × candidateMultiplier`** (жодних magic numbers). Home defaults:
  - editorial (`knyhovyk-radyt`): **×3** → 36;
  - novynky: **×5** → 60;
  - popular: **×10** → 120.
- `HOME_LAYOUT` (Home Builder) — єдине джерело: `{ providerShareLimit, sections:[{key, slug, take, candidateMultiplier, diversify}], displayOrder }`; значення env-overridable для тюнінгу без релізу.
- Composer б'є repository напряму з `candidateLimit` як `perPage` (функції приймають `perPage`) — один запит на feed.
- Нижня межа: `novynky` (кеп 25% каталогу, `planNovynkyPool`) може віддати < 60 на малому каталозі — очікувано; §10 fallback.

## 7. Cross-section dedup rules

- Одна `canonicalBook` на Home — **максимум один раз**; ключ — **`canonicalBookId`**.
- Editorial (`knyhovyk-radyt`) — **allocation №1**, резервує першим.
- novynky виключає взяте editorial; popular виключає взяте editorial+novynky.
- Реалізація — спільний `used=Set<canonicalBookId>` у composer (strict, найвищий пріоритет над diversity).

## 8. Provider diversity algorithm

- **Без жорстких квот.** Детермінований greedy soft-cap за **provider id (enum)**, не за `storeName`. Відсутній provider → bucket **`UNKNOWN`**.
- **Політика — абстрактна для composer-а.** Composer консультується лише з `opts.diversityPolicy.bucketCapFor(take)` (§5.1) і не знає ні «provider», ні «1/3». Конкретна політика Home — `bucketCapFor(take) = floor(take × providerShareLimit)`, `providerShareLimit = 1/3` → для `take=12` cap = **4** — визначена в Home Builder (§5.2) та інжектиться в composer.
- Алгоритм — soft-cap + relaxation (§5.1, diversify=true): не пускає (cap+1)-шу книгу bucket-а, доки є кандидати інших buckets під cap; relaxation добирає з overflow, щоб полиця не лишалась неповною.
- **Пріоритет:** strict canonical dedup **>** diversity. Diversity ніколи не створює дублікат і ніколи не лишає полицю неповною, якщо є невикористані валідні кандидати.
- **Editorial:** `diversify=false` — provider-penalty **не** застосовується (курований `sort_order` зберігається), лише strict dedup.

## 9. Allocation order vs Display order

Обидва — у **Home layout** (`HOME_LAYOUT`), **не** в composer:

- **Allocation order** (порядок `SectionSpec[]`, хто резервує першим): **1. knyhovyk · 2. novynky · 3. popular**. Причина: вузькі/куровані резервують дефіцитних кандидатів першими; широкий `popular` (`WHERE TRUE`) добирає останнім і завжди наповнюється залишком.
- **Display order** (`HOME_LAYOUT.displayOrder`, що бачить користувач): **1. popular · 2. novynky · 3. knyhovyk**.

## 10. Fallback behavior

- Бракує книг після dedup+diversity → **послаблювати provider penalty** (relaxation, §5.1 крок 2).
- **Не** віддавати < `take` лише через diversity, доки є невикористані валідні кандидати будь-якого provider.
- **Не** віддавати дублікати між секціями, доки є невикористані валідні кандидати (dedup суворіший).
- **Повне перекриття пулу:** секція повертає скільки лишилось (можливо <12/0); порожня секція **ховається** (наявна web-поведінка `if (books.length===0) return null`); логується (§14).
- **Пріоритет правил:** dedup (жорсткий) > заповнення до `take` (relaxation) > diversity (м'який).

## 11. API — де живе Composer

| Варіант | + | − |
|---|---|---|
| **A. `GET /api/home` (composed на backend)** | єдине джерело композиції; один виклик з web; кеш composed; reusable для email/push; один запит на feed через repository | новий маршрут + модулі |
| B. Server-side composer у web | менше backend-роботи | композиція у web (порушує мету); дублює `allocate`; немає server-кешу; не reusable; впирається у `per_page=24` |
| C. Розширити collections API | без нового маршруту | змішує контракт collections; каламутить кеш-ключі; hub має іншу семантику |

**Рекомендація — A (`GET /api/home`).** Реалізує «backend — єдине джерело композиції», кешує composed, обходить `per_page=24` через repository, робить composer reusable — **без** universal engine.

**Розміщення коду:**
- `packages/api/src/feed-composer/composer.ts` — Layer 2, чиста функція + типи (`FeedCandidate`, `SectionSpec`, `DiversityPolicy`, `ComposeOptions`); повні unit-тести. Нуль доменних/інфра-залежностей.
- `packages/api/src/home/{service.ts, layout.ts, mapper glue}` — Layer 3 (`buildHome`/`getHome`, `HOME_LAYOUT`, побудова `FeedCandidate` з `provider`-enum, конкретна `diversityPolicy`).
- `packages/api/src/home/route.ts` — `registerHomeRoute(app, prisma, authDeps?)` → `GET /api/home` (публічний; guest → `isWishlisted:false`); реєстрація в `app.ts`.
- Наявні collections-маршрути — **не чіпаємо**.

**Контракт `GET /api/home` (лише `key + books`):**
```
{ shelves: [ { key: 'popular',  books: CollectionBookDto[] },   // у DISPLAY-порядку
             { key: 'novynky',  books: CollectionBookDto[] },
             { key: 'knyhovyk', books: CollectionBookDto[] } ] }
```
Усі title/CTA/eyebrow — у web.

## 12. Future extensibility

Generic Feed Composer (Layer 2) — **reusable primitive** для майбутніх доменних builder-ів понад тими самими типами `SectionSpec`/`FeedCandidate`:
- **Home Builder** (цей PRD);
- **Email digest builder** (без браузера — той самий composer над per-user/загальними пулами);
- **Push builder**;
- **Landing pages** (тематичні набори секцій);
- **Recommendations** (коли з'являться per-user candidate sources).

Кожен — **новий доменний builder + нове джерело кандидатів**, composer незмінний. **Цей PRD НЕ будує universal recommendation engine і НЕ додає персоналізацію** — лише лишає primitive придатним до повторного використання.

## 13. Caching implications

- Composed Home — **окремий версійований ключ** `home:v1` через `getOrSet` (coalescing + SWR + семафор(4)).
- Кеш **не змішує композиції**: ключ залежить від версії/складу layout (зміна `HOME_LAYOUT` → інша версія).
- **TTL = 5 хв** (composed містить wishlist-derived `popular`), як wishlist-derived у collections-sql-performance §3.1.
- `wishlistCount`/`isWishlisted` — **не** в кеші; декоруються після кешу.
- **Guest і Auth отримують ОДНАКОВУ композицію** (user-agnostic dedup/diversity); різниця лише `isWishlisted` post-cache.
- Обмеження (наявне): кеш in-process per-instance.

## 14. Observability

Structured-логи на побудову (без PII): розмір пулу кожного feed (fetched vs limit); скільки відкинуто dedup-ом per section; **розподіл `providerId` у кожній фінальній полиці** (перевірка `effectiveCap`); чи спрацював relaxation; недозаповнені секції (<take) і причина; latency (candidate fetch + compose) + cache hit/miss. Метрики: `home.shelf.max_provider_share`, `home.shelf.underfilled_count`, `home.compose.duration_ms`.

## 15. Performance budget

- **Composer**: чистий O(Σ|candidates|) над ~(36+60+120)=216 → мікросекунди.
- **Candidate over-fetch**: 3 repository-запити (по одному на feed) з `candidateLimit`; `popular` (~81 ms у C2) з limit 120 — обмежений `LIMIT`, індексований. Профіль ≈ `/dobirky` cold (1.187 s, 0×502 burst).
- **Цілі (staging, метод C2):** `GET /api/home` warm **< 300 ms**; cold **< 1.2 s**; **0×502** під конкурентний cold burst.
- Web: один виклик замість трьох.

## 16. Rollout plan

Адитивно, без перемикача поведінки наявних поверхонь:
1. **PR1 — Generic Feed Composer.** `feed-composer/composer.ts` + типи + unit-тести. Нуль wiring, нуль доменних залежностей.
2. **PR2 — `GET /api/home` + Home Builder.** `home/{service,layout,route}.ts`, candidate-fetch через collections `repository`, `provider`-enum → `FeedCandidate`, кеш `home:v1`, wishlist-декор, реєстрація в `app.ts`. Integration-тести + regression collections. Endpoint живе, ще не споживається.
3. **PR3 — Web adoption.** `page.tsx`/`data.ts` → один виклик `GET /api/home`; прибрати web-збірку 3 секцій; degraded = hero без полиць; візуальна перевірка light/dark + брейкпоінти.
4. **PR4 (опц.) — Tuning + observability.** env-ручки (`providerShareLimit`, multipliers, TTL) + логи/метрики §14 + latency-заміри staging у PRD.
5. **Пізніше (окремо):** hub на спільний composer (усунути дубль web-`allocate`); нові доменні builder-и (email/push) понад тим самим primitive.

## 17. Locked decisions (усі колишні open questions закрито)

1. **Diversity scope** — тільки **per-shelf** (12); page-level — поза scope.
2. **Provider identity** — machine-readable **provider enum** (з `provider_listings.provider` найдешевшого показаного listing); відсутній → **`UNKNOWN`** bucket. **Не** `storeName`.
3. **Diversity cap** — composer приймає **абстрактний `diversityPolicy`**; конкретна Home-політика `bucketCapFor(take) = floor(take × providerShareLimit)`, `providerShareLimit = 1/3` (=4 при take=12) — визначена в Home Builder, не в composer; однаково для popular і novynky.
4. **Editorial** — allocation №1; `diversify=false` (curated `sort_order` незмінний); strict dedup застосовується.
5. **Candidate limits** — `candidateLimit = take × candidateMultiplier`; multipliers editorial ×3 / novynky ×5 / popular ×10 (→36/60/120); env-overridable.
6. **Home v1 склад** — рівно **3 секції** (popular, novynky, knyhovyk); `HOME_LAYOUT` дозволяє додати майбутні секції конфігом без зміни composer.
7. **Contract** — `GET /api/home` → `{ shelves:[{key, books}] }`; presentation у web.
8. **TTL** — **5 хв**; wishlist post-cache.
9. **Guest/Auth** — **однакова композиція**; різниця лише `isWishlisted`.
10. **Degraded state** — `/api/home` впав → web показує **hero без полиць** (як при поточних помилках); окремого retry-блока не додаємо.

## 18. Risks and mitigations

| Ризик | Мітигація |
|---|---|
| Голодування пізніх секцій | Over-fetch (`candidateLimit`); порожня секція ховається |
| Diversity ріже relevance | Soft-cap лише відкладає; relaxation зберігає relevance у тірах; `providerShareLimit` env-ручка |
| Полиця < take через diversity | Relaxation гарантує заповнення, доки є кандидати |
| Дубль greedy-логіки (web `allocate` + backend composer) | Backend — джерело правди; hub мігрує пізніше; не створювати паралельну копію diversity |
| Кеш змішує композиції | Версійований `home:v1`, залежний від layout |
| `per_page=24` → 5 викликів popular | Composer б'є repository напряму з `candidateLimit` |
| Editorial diversity псує намір | `diversify=false` для editorial (locked §17.4) |
| `provider`-enum недоступний у candidate | Home Builder бере enum з `CollectionBookRow.listings` (не з DTO); відсутній → `UNKNOWN` |
| In-process кеш при горизонт. масштабі | Наявне обмеження; спільний кеш — окремий трек |

## 19. Acceptance criteria

- **Generic composer незалежний від Home і від бізнес-політики** — модуль `feed-composer` не імпортує нічого з `home`/Fastify/Prisma/HTTP/cache/wishlist; **не містить `1/3`/`provider`/`floor`** — лише консультується з інжектованим `diversityPolicy.bucketCapFor(take)`; unit-тести працюють на синтетичних `SectionSpec`/`FeedCandidate` + фіктивному `diversityPolicy` без БД.
- **Provider id, не `storeName`** — Home candidate-adapter кладе provider-enum у `FeedCandidate.providerId`; відсутній → `UNKNOWN`. Composer bucket-агностичний.
- **Diversity policy** — конкретна `bucketCapFor(take)=floor(take×1/3)` живе в Home Builder; для take=12 жоден bucket не перевищує 4, коли є альтернативи.
- **Розділення відповідальностей** — candidate-adapter (`Row→FeedCandidate`) і response-mapper (`ids→CollectionBookDto`+display reorder) — окремі, composer між ними не знає про жодну (тест: підміна response-mapper не зачіпає composer/adapter).
- **`candidateMultiplier`** — ліміти виводяться з `take × multiplier` (36/60/120), не magic numbers.
- **Жодного повтору `canonicalBookId`** між Home shelves.
- **12 книг у кожній секції** за достатнього пулу; за відсутності альтернатив — все одно заповнюється (relaxation), не ріжеться заради diversity.
- **Deterministic output** — той самий вхід кандидатів → той самий вихід (snapshot).
- **Один `GET /api/home`** віддає `{shelves:[{key,books}]}`; presentation у web.
- **Existing collections API не змінюється** — `:slug/books`/`/hub`/`/:slug` regression зелена.
- **Reusable composer** — доведено тим, що Home Builder — єдиний доменний споживач, а composer не містить Home-специфіки (тест: другий синтетичний builder у unit-тесті компонує інші секції без змін composer).
- **Editorial** — curated order незмінний, diversity не застосована, dedup застосований.
- **Кеш не змішує композиції** (версійований ключ; composed окремо від per-feed); guest/auth — однакова композиція.
- **Тести**: PR1 unit (composer), PR2 integration (`/api/home`), regression (collections); **staging latency** виміряно (warm <300ms, cold <1.2s, 0×502 burst).

## 20. Recommended architecture (підсумок)

Тришарова: **Candidate feeds** (без змін) → **Generic Feed Composer** (чистий primitive: strict dedup + soft bucket-cap через **абстрактний `diversityPolicy`** з relaxation, довільні секції, `FeedCandidate{id,providerId}` — без знань про Home/provider/«1/3») → **Home Builder** (`HOME_LAYOUT`: allocation `knyhovyk→novynky→popular`, display `popular→novynky→knyhovyk`, `candidateMultiplier` 3/5/10, конкретна `diversityPolicy` `floor(take×1/3)`, `provider`-enum candidate-adapter + окремий response-mapper, кеш `home:v1` 5хв, wishlist post-cache) → **`GET /api/home`** (`key+books`). Provider — enum, не storeName; UNKNOWN-bucket. Editorial: allocation №1, без diversity, curated order. Наявні collections-маршрути незмінні. Composer reusable для майбутніх email/push/landing/recommendations — без universal engine.

## 21. Implementation status (2026-07-21, гілка `feat/home-feed-composer`)

**Реалізовано (обов'язковий scope §2).** Тришаровий pipeline доведено до робочого стану:

- **Layer 2 — Generic Feed Composer** — `packages/api/src/feed-composer/{types,composer,errors,index}.ts`. Чиста детермінована `compose()`, strict dedup + soft bucket-cap (абстрактний `diversityPolicy`) + relaxation. Нуль доменних/інфра-імпортів (є тест-guard на це). 24 unit-тести.
- **Layer 3 — Home Builder** — `packages/api/src/home/{layout,candidate-adapter,response-mapper,service,dto,observability,route}.ts`. `HOME_LAYOUT` (allocation `knyhovyk→novynky→popular`, display `popular→novynky→knyhovyk`, multipliers 3/5/10, `providerShareLimit=1/3`), candidate-adapter (`Row→FeedCandidate` з provider-enum / `UNKNOWN`), окремий response-mapper (`ids→CollectionBookDto`+reorder), кеш `home:v1` (5 хв, наявний `getOrSet` coalescing/SWR/семафор), wishlist decoration post-cache. 17 integration-тестів.
- **Layer 4 — `GET /api/home`** — публічний, guest/auth однакова композиція, `isWishlisted` різниться; зареєстровано в `app.ts`.
- **Provider identity** — `providerId` = provider-enum найдешевшого показаного listing через спільний `cheapestListing()` (винесено з mapper; `CollectionBookDto` не змінено).
- **Candidate loading** — прямий виклик collections `repository`/`resolveFeed` з `candidateLimit`, один запит на feed, без HTTP і без `per_page=24`.
- **Web** — `page.tsx`/`data.ts` на один `GET /api/home` (`lib/api/home.ts`); стару збірку трьох fetch прибрано; presentation через key→config; degraded = hero без полиць; порожня shelf не рендериться.
- **Observability** — structured `[home]` JSON-лог на build (fetched vs limit, selected, dedup drops, providerId distribution, effective cap, relaxation, underfilled, candidate-fetch/compose/total ms, `max_provider_share`, `underfilled_count`), без PII; без окремого metrics-фреймворку.
- **Regression** — усі наявні collections-тести зелені; публічні contracts і `per_page===24` не змінено.

**Відхилення від букви PRD (свідомі, узгоджуються з духом):**
1. `compose()` повертає `ComposeResult { sections: ComposedSection[] }` (масив із per-section `diagnostics`), а не літеральний `Record<key, FeedCandidate[]>` (§5.1) — щоб органічно віддати diagnostics §14 без другого проходу. Home Builder мапить за `key`.
2. `HOME_LAYOUT` — статична константа; env-overrides (§6/§7) **не** реалізовано (щоб не будувати config-фреймворк заради цього PR) — тюнінг-ручки лишаються майбутнім треком (§16 PR4).
3. Бекенд **опускає порожні полиці** з відповіді (не завжди віддає всі 3 ключі) — реалізує §10 «порожня секція ховається» у джерелі; web додатково гардить.

**НЕ перевірено:** staging latency (warm <300 ms / cold <1.2 s / 0×502) — немає доступу до staging; лишається пунктом deployment-checklist (§15). Coverage-числа не згенеровано (`@vitest/coverage-v8` не встановлено); нові generic-модулі покриті тестами по всіх гілках.
