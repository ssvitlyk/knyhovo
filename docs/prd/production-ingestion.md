# PRD: Production Ingestion Framework

> **Статус:** Чорновик (технічний контракт). **Дата:** 2026-06-29.
> **Тип:** проєктування. Цей документ **не** містить production-коду і **не** дозволяє імплементацію
> до затвердження (правило проєкту: код для нової фічі не пишеться до підтвердження PRD).
>
> **Призначення:** офіційний технічний контракт на перший production-етап ingestion — інфраструктурний
> фундамент, який має бути готовий **до** підключення Knigoland / Laboratory / BookChef / BookClub.
>
> **Спирається на (не дублює):**
> [ingestion-pipeline-production-review.md](../research/ingestion-pipeline-production-review.md) — джерело
> прогалин та roadmap; [canonical-matcher-final-audit.md](../research/canonical-matcher-final-audit.md) —
> межі canonical-якості; [provider-integration-strategy.md](../research/provider-integration-strategy.md) —
> типологія адаптерів і active/blocked/disabled; [infrastructure.md](infrastructure.md) — Railway/Cron і
> **відкриті питання #2 (retry) та #3 (on-demand trigger)**, які цей PRD формально закриває;
> [wishlist.md](wishlist.md) — alert-engine лишається поза скоупом.

---

## 1. Goals

**Production Ingestion Framework** — це operational/observability шар навколо вже наявного
provider-agnostic пайплайна (`run-scrape → provider → fetcher → parser → matcher → persistence`), який
робить регулярний автоматичний запуск **спостережуваним, відновлюваним і безпечним при масштабуванні**.

Він **не** змінює core-логіку скрапінгу, matching чи persistence. Він додає те, чого бракує для переходу
від «працює при ручному запуску» до «працює без нагляду в production» (повний перелік прогалин — у
[review §5](../research/ingestion-pipeline-production-review.md)).

**Які проблеми вирішує:**

| Проблема (зафіксована в review) | Наслідок без фреймворку |
|--------------------------------|--------------------------|
| Розклад живе поза репо, не версіонується | Непрозорий, не ревʼюється production-trigger |
| Логи неструктуровані (`console.log`), без run-id | Дебаг production-інциденту повільний |
| Метрики лише в `scrape_runs` + консоль, без export | Немає трендів і алертингу деградації |
| Немає liveness/readiness `/health` + DB-probe | Оркестратор не знає, чи процес/БД живі |
| Немає retry на transient-помилки | Випадковий network-blip → хибний FAILED-run |
| Немає dry-run | Не можна перевірити нового провайдера без запису в БД |

**Чому ДО підключення Knigoland/Laboratory/BookChef/BookClub:**

1. **Діагностика matcher масштабується з провайдерами.** Аудит показав residual false fuzzy-merge та false
   BUNDLE/VOLUME-drop (~14–20 реальних товарів на cap-300). Кожен новий провайдер лінійно збільшує цей шум.
   Без metrics export і canonical-health regresії будуть **невидимі** до ручної перевірки БД.
2. **Чотири нові провайдери = чотири нові джерела збоїв.** Без structured logging + operational-alert
   кожен збій вимагатиме ручного розслідування плоских логів.
3. **Dry-run потрібен як gate підключення.** Кожен PR5–PR8 має пройти dry-run прогін (preview matching +
   persist без мутації БД) перед бойовим запуском. Без dry-run wiring провайдера = одразу writes у production.
4. **Дешевше один раз.** Інфраструктура, побудована раз на provider-agnostic контракті, обслуговує всі
   майбутні провайдери без повторної роботи (див. §9).

---

## 2. Scope

### IN

- **Production Runner** — стабілізований CLI-entry для запуску повного refresh з production-семантикою
  (exit-коди, idempotent skip, alert-hook на провал) поверх наявного `runFullCatalogRefresh`.
- **Scheduler readiness** — декларативний розклад у репо (Railway Cron config) + закриття infrastructure
  open question #3 (on-demand trigger) як свідоме рішення.
- **Metrics** — export наявних `ScrapeMetrics` + нові лічильники (`retry_count`, `rate_limited_total`,
  expose `conflictsByReason`, `scrape_duration_ms`).
- **Structured logging** — JSON-логи з `runId`/`provider` context за фасадом наявного `Logger`.
- **Health** — liveness `/health`, readiness (DB ping), persistence-health, canonical-health сигнал.
- **Retry strategy** — bounded exponential backoff + jitter на transient-помилки (закриває infrastructure
  open question #2). Закладається на рівні fetcher.
- **Dry-run** — режим preview без запису в БД через `RunScrapeOptions`.
- **Observability** як наскрізна якість усіх вищезгаданих.

### OUT

- **Нові providers** (Knigoland/Laboratory/BookChef/BookClub) — наступний етап (§9), окремі PRD/PR.
- **Canonical matcher improvements** — лише **спостереження** за конфліктами тут; виправлення
  over-merge/false-drop — окремий matcher-PRD (межі — в [audit](../research/canonical-matcher-final-audit.md)).
- **Provider adapter typology** (`ApiProvider`/`FeedProvider`/`DisabledProvider`) — описано в
  [provider-integration-strategy](../research/provider-integration-strategy.md), реалізація поза цим скоупом.
- **API endpoints** (search, book page) — окрім нових health/metrics-роутів.
- **Web / UI.**
- **Wishlist refresh та Alert Engine** — наявна логіка [wishlist.md](wishlist.md) не змінюється; цей
  фреймворк додає лише **operational** alerts на ingestion (≠ price/availability alerts).
- **Worker + queue (BullMQ/Redis)** — post-MVP за [infrastructure.md](infrastructure.md); тут лишаємось на Cron.
- **Backup-стратегія БД** (infrastructure open question #1) — не входить.

---

## 3. Current Architecture

Фактична схема (підтверджена в [review §2](../research/ingestion-pipeline-production-review.md)):

```
Scheduler            зовнішній Railway Cron (env SCRAPE_TRIGGERED_BY), розклад поза репо
   │
   ▼
run-scrape           packages/api/src/scripts/run-scrape.ts  (hard-coded список провайдерів)
   │                 → runFullCatalogRefresh()  refresh/full-catalog.refresh.ts
   │                    ├─ acquireRefreshLock()  refresh/concurrency-guard.ts
   │                    └─ per-provider try/catch (ізоляція) + startScrapeRun()/finishScrapeRun()
   ▼
Provider             ScraperProvider  packages/shared/src/types/provider.ts
   │                 реалізації: packages/scrapers/src/providers/<name>/
   ▼
Fetcher              HtmlFetcher / PlaywrightHtmlFetcher  packages/scrapers/src/http/*
   │                 (per-request timeout, БЕЗ retry; browser-manager singleton)
   ▼
Parser               providers/<name>/<name>.parser.ts  (cheerio / GraphQL / sitemap+JSON-LD)
   │                 реєстр product-парсерів: providers/single-product.ts
   ▼
Canonical Matcher    matchOrCreate()  packages/scrapers/src/canonical/match-canonical.ts
   │                 (ISBN → title-gate → fuzzy → matched|created|conflict)
   ▼
Persistence          persistListing()/markUnavailable()  packages/api/src/pipeline/persist-listing.ts
   │                 Prisma $transaction per-listing → canonical_books · provider_listings
   │                 recordPriceChange() → price_history (APPEND-ONLY)  price-history/*
   ▼
Metrics              ScrapeMetrics (in-memory)  pipeline/types.ts · pipeline/metrics.ts
   │                 → persist у scrape_runs  refresh/scrape-run.repository.ts  (без real-time export)
   ▼
Health               derived  refresh/refresh-health.ts + route.ts  (GET /api/refresh/health)
   │                 (8–9 issue-типів; немає liveness/readiness/DB-probe)
   ▼
Logs                 Logger { info; error } → console.log/error  pipeline/types.ts
   │                 (неструктуровано, без run-id)
   ▼
Alerts               ТІЛЬКИ price/availability (wishlist)  refresh/events.ts · alert-notify.ts
                     (operational-alerts для ingestion ВІДСУТНІ)
```

**Висновок зі схеми:** усі етапи від Provider до Persistence — **готові й provider-agnostic**. Production
Ingestion Framework додає рівні Scheduler / Metrics-export / Health / Logs / operational-Alerts і
наскрізний Retry/Dry-run, **не торкаючись** Provider→Persistence ядра.

---

## 4. Functional Requirements

### FR-1. Production Runner
- Стабільний entry-point для FULL_CATALOG refresh з production-семантикою.
- **Exit-коди:** `0` — ≥1 провайдер SUCCESS/PARTIAL; `1` — всі провайдери FAILED; idempotent skip
  (overlap) → `0` з лог-повідомленням (поведінка вже є, формалізується контрактом).
- Має викликати **operational-alert hook** при exit≠0 (канал — §FR-6).
- **Не змінює** наявний `runFullCatalogRefresh` core; обгортка/контракт навколо нього.

### FR-2. Scheduler
- Розклад **декларативний і версіонований у репо** (Railway Cron config), не лише в дашборді.
- Провайдери запускаються **рознесено в часі** (staggering) для зниження пікового навантаження й anti-bot ризику.
- Розділення розкладів за `ScrapeRunKind` (FULL_CATALOG vs WISHLIST_REFRESH — kinds уже існують).
- Інтервал береться з env (`SCRAPE_INTERVAL_HOURS`, наявна конвенція).
- **On-demand trigger (infrastructure open Q#3):** для цього етапу — **свідомо OUT** (лишаємось на Cron;
  webhook/admin-trigger → post-MVP worker). Рішення фіксується тут як закриття відкритого питання.

### FR-3. Retry (закриває infrastructure open Q#2)
- **Тільки transient-помилки:** network reset / DNS / timeout / 5xx (крім 503).
- **Ніколи не ретраїмо:** 429/503 (навмисний rate-limit стоп — лишається як є), 403/anti-bot
  (`detectProviderBlock`), parse-помилки (детермінований дефект).
- **Рівень:** fetcher (`HtmlFetcher.fetch`) — найвужче місце, де відомо, що це мережева операція.
  Pipeline/provider шари **не** ретраять (інакше дублі запитів/товарів).
- **Параметри:** max 2–3 спроби, base 0.5–1s, factor 2, full jitter, сумарний час ≤ `timeoutMs`.
- Кожна спроба інкрементить `retry_count`; вичерпання → помилка в `errors[]` як зараз.

### FR-4. Logging
- Перехід на **structured JSON** (pino) **за фасадом наявного `Logger`** (інтерфейс не ламається).
- Кожен запис містить `runId` (= `scrape_runs.id`), `provider`, `level`, timestamp.
- Логувати тривалість фаз (scrape / match / persist), причини conflict-drop із прикладом URL,
  blocked-page класифікацію, retry-події.

### FR-5. Metrics
- **Export** наявних метрик: `GET /metrics` (Prometheus text format) на базі `scrape_runs` + лічильники процесу.
- Набір (✅ є / ➕ новий): `scrape_duration_ms`➕(expose), `products_parsed`✅, `canonical_created`✅,
  `canonical_merged`✅, `conflicts`✅ + `conflicts_by_reason`➕(expose), `provider_failures`➕,
  `retry_count`➕, `rate_limited_total`➕, `skipped_products`✅, `price_history_inserted`✅,
  `availability_updated`✅, `listings_created/updated`✅, `persist_errors`✅.
- Persist у `scrape_runs` лишається джерелом правди; export — read-only поверх нього.

### FR-6. Health
- **Liveness** `GET /health` → `{ status: "ok" }` (виконує acceptance з [infrastructure §2](infrastructure.md), ще не реалізовано).
- **Readiness** — DB ping (готовність приймати роботу).
- **Persistence-health** — connectivity + tx error-rate сигнал.
- **Canonical-health** — conflict-rate spike (порог на `conflicts/scraped`) як сигнал деградації matching.
- Наявний derived `GET /api/refresh/health` **зберігається** (provider/parser health).
- Health живить **operational-alert** канал (email/Slack) на критичні issue + exit≠0.

### FR-7. Dry-run
- Прапор `dryRun?: boolean` через `RunScrapeOptions`.
- При `dryRun=true`: pipeline виконує scrape → match → **computes outcome без запису в БД** (no-op persist),
  метрики рахуються як завжди → повний preview результату для нового провайдера.
- Жодних записів у `canonical_books`/`provider_listings`/`price_history`, жодного `scrape_runs` row
  у режимі dry-run (або позначений `kind=MANUAL` + явний `dryRun` маркер у metadata — рішення на impl).
- Це **gate** для підключення майбутніх провайдерів (§9).

### FR-8. Failure isolation (підтвердити/зберегти)
- Per-provider try/catch + per-listing try/catch — **уже є**, контракт фіксує: не регресувати.
- Додати **circuit-awareness** (необовʼязково в цьому етапі): сигнал «провайдер FAILED N разів поспіль»
  у health (м'який, не блокуючий).

### FR-9. Rate limiting
- Наявна поведінка зберігається: 429/503 → стоп провайдера **без retry**, сигнал у `outcome.rateLimited`.
- Додати лічильник `rate_limited_total` (FR-5) та structured-log запис.
- Inter-request delay (`delayMs`/`descriptionDelayMs`) лишається; staggering (FR-2) знижує сукупний тиск.

---

## 5. Non-functional Requirements

| Якість | Вимога |
|--------|--------|
| **Performance** | Export метрик і health-probe — O(1)/легкий запит, не сканують повний каталог; logging не блокує I/O пайплайна. Retry не подовжує сумарний run понад `timeoutMs` × спроби. |
| **Reliability** | Transient-збій не призводить до хибного FAILED (retry); один провайдер не валить інших; dangling RUNNING завжди підчищається. |
| **Idempotency** | Повторний запуск дає той самий стан БД (наявна check-then-act upsert + append-only price_history). Overlapping run → idempotent skip. Dry-run — повністю без побічних ефектів. |
| **Scalability** | Provider-agnostic контракт: додавання 5-го…8-го провайдера не змінює фреймворк. Staggering і per-provider ізоляція тримають навантаження лінійним. |
| **Observability** | Кожен run має `runId`, structured-логи, експортовані метрики й health-сигнал. Деградація matching/parser видима **до** ручної перевірки. |
| **Recoverability** | Після краху run закривається як FAILED (best-effort) і не блокує наступний (lock sweep). Health показує stuck/failed-streak. Retry відновлює transient. |
| **Maintainability** | `Logger` фасад зберігається; export читає `scrape_runs` (одне джерело правди); жодних змін у Provider→Persistence ядрі; зміни адитивні. |

---

## 6. PR Breakdown

> Порядок і назви узгоджені з roadmap у [review §7](../research/ingestion-pipeline-production-review.md).

| PR | Назва | Зміст | Залежить від |
|----|-------|-------|--------------|
| **PR1** | Production Runner + Scheduler readiness | Декларативний Cron-config у репо; production-семантика runner (exit-коди, idempotent skip формалізовано); alert-hook stub на exit≠0; staggering. **Включає structured logging (pino) за фасадом `Logger`** — бо весь подальший observability спирається на run-id. | — |
| **PR2** | Metrics | `GET /metrics` (Prometheus) на базі `scrape_runs`; нові лічильники `retry_count`, `rate_limited_total`, `provider_failures`; expose `conflicts_by_reason`, `scrape_duration_ms`. | PR1 (run-id у логах/контексті) |
| **PR3** | Health | Liveness `/health`; readiness + DB ping; persistence-health; canonical-health (conflict-rate spike); підключення health → operational-alert канал. | PR2 (canonical-health використовує метрики conflict-rate) |
| **PR4** | Retry + Dry-run | Bounded exponential backoff + jitter на fetcher-рівні (transient only) з інкрементом `retry_count`; `dryRun` прапор через `RunScrapeOptions` (no-op persist, метрики рахуються). | PR2 (`retry_count` метрика), PR3 (dry-run як gate перевіряється health/metrics) |

**Залежності (чому саме так):**
- **PR1 — фундамент:** run-id + structured logs мають існувати першими, інакше метрики й health не мають
  до чого привʼязувати контекст. Scheduler readiness тут, бо production-запуск без декларативного розкладу
  не має сенсу тестувати далі.
- **PR2 після PR1:** метрики експортуються з контекстом run-id (з PR1) і додають лічильники, на які
  спирається canonical-health у PR3.
- **PR3 після PR2:** canonical-health (conflict-rate) і operational-alert споживають метрики PR2.
- **PR4 останній:** retry додає метрику `retry_count` (потребує PR2-інфраструктури), а dry-run як **gate**
  має сенс лише коли metrics+health уже показують результат preview-прогону (PR2+PR3).

---

## 7. Acceptance Criteria

**PR1 — Production Runner + Scheduler + structured logging — Done коли:**
- [ ] Розклад описаний декларативно у репо (Railway Cron config), не лише в дашборді.
- [ ] Runner повертає `0` при ≥1 SUCCESS/PARTIAL, `1` коли всі FAILED, idempotent-skip при overlap → `0`.
- [ ] Усі логи — структуровані JSON із `runId` та `provider`; наявний `Logger` інтерфейс не зламано.
- [ ] Провайдери стартують рознесено (staggering підтверджено в конфізі).
- [ ] Alert-hook викликається при exit≠0 (хоча б stub-канал).
- [ ] Тести: unit на exit-семантику + lint/typecheck зелені; жодних змін у Provider→Persistence ядрі.

**PR2 — Metrics — Done коли:**
- [ ] `GET /metrics` віддає Prometheus-формат із усіма метриками §FR-5.
- [ ] Нові лічильники (`retry_count`, `rate_limited_total`, `provider_failures`) присутні й коректні.
- [ ] `conflicts_by_reason` та `scrape_duration_ms` експонуються.
- [ ] Export read-only (не мутує `scrape_runs`); coverage нового модуля ≥ 80%.

**PR3 — Health — Done коли:**
- [ ] `GET /health` → `{ status: "ok" }` (liveness).
- [ ] Readiness робить реальний DB ping і відображає недоступність БД.
- [ ] Persistence-health і canonical-health (conflict-rate spike) повертають сигнал.
- [ ] Operational-alert тригериться на критичні health-issue.
- [ ] `GET /api/refresh/health` не зрегресував; тести ≥ 80%.

**PR4 — Retry + Dry-run — Done коли:**
- [ ] Retry спрацьовує **лише** на transient (network/timeout/5xx≠503); 429/503/403/parse — без retry.
- [ ] Backoff обмежений (max спроби, jitter, сумарно ≤ timeout); `retry_count` інкрементиться.
- [ ] `dryRun=true` дає повний preview (метрики рахуються) **без жодного запису** в БД (перевірено тестом, що рахує DB-writes = 0).
- [ ] Детерміновані тести (mock fetcher/clock, без random без seed); coverage ≥ 80%.

---

## 8. Risks

| Ризик | Що може піти не так | Контроль |
|-------|---------------------|----------|
| **Retry маскує справжній блок** | Ретраї на помилці, яку прийняли за transient, насправді — anti-bot/rate-limit → зайвий тиск, ескалація блоку | Жорсткий allowlist transient-кодів; 429/503/403 явно виключені; `retry_count` під моніторингом |
| **Dry-run розходиться з реальним persist** | No-op persist не відтворює точну логіку запису → preview бреше | Dry-run проходить **той самий** matcher/compute шлях; різниця лише в фінальному write; тест паритету outcome |
| **Логування ламає сумісність** | Заміна console на pino змінює формат, від якого хтось залежить (Railway log parsing) | Зберегти `Logger` фасад; JSON — адитивно; перевірити Railway dashboard читабельність |
| **Metrics export тягне БД** | `/metrics` на кожен scrape повний запит → навантаження на Postgres | Легкі агреговані запити по `scrape_runs`; кеш/інтервал; не сканувати каталог |
| **Canonical-health дає шум** | Поріг conflict-rate надто чутливий → фальшиві алерти при додаванні провайдера | Поріг калібрується на cap-100/300 baseline з [audit](../research/canonical-matcher-final-audit.md); warning, не блокер |
| **Scope creep у matcher** | Спокуса «підправити» false-drop тут | Явний OUT (§2); matcher — окремий PRD; тут лише спостереження |
| **Зміна ядра попри контракт** | PR випадково чіпає Provider→Persistence | Acceptance кожного PR вимагає «жодних змін у ядрі»; code-review гейт |
| **On-demand trigger тиск** | Запит «а давайте webhook зараз» | Зафіксовано OUT (FR-2), post-MVP worker; не розширювати скоуп |

---

## 9. Future Extensions

Після завершення цього етапу стає можливим **без зміни архітектури фреймворку**:

- **Knigoland** (sitemap index → sub-sitemaps) — wiring + smoke + dry-run прогін.
- **Laboratory** (sitemap → per-product JSON-LD) — те саме.
- **BookChef** (sitemap → per-product JSON-LD) — те саме.
- **BookClub** (GraphQL API) — те саме (адаптер уже сумісний з контрактом `ScraperResult`).

Кожен наступний провайдер:
- реєструється у provider-списку (provider-agnostic pipeline не змінюється);
- проходить **dry-run як gate** (preview matching/persist без мутації БД — FR-7);
- одразу отримує structured-логи (run-id), експортовані метрики, health-сигнал і canonical-health
  моніторинг конфліктів — тобто **його регресії видимі з першого запуску**.

Далі (поза цим етапом, окремі PRD): provider adapter typology
[`ApiProvider`/`FeedProvider`/`DisabledProvider`](../research/provider-integration-strategy.md);
matcher over-merge/false-drop fixes; worker + queue (BullMQ/Redis) і on-demand trigger.

---

## 10. Final Verdict

Порядок **PR1 → PR2 → PR3 → PR4, і весь етап ДО провайдерів** — оптимальний з трьох причин:

1. **Спостережуваність — передумова, а не наслідок.** Підключати 4 нові провайдери (×4 джерела збоїв,
   ×4 навантаження на matcher) у систему без structured-логів, експортованих метрик і canonical-health —
   означає діагностувати регресії наосліп. Фреймворк перетворює кожне майбутнє підключення з ризику на
   кероване, спостережуване включення.

2. **Залежності природно лінійні.** Run-id (PR1) → метрики з контекстом (PR2) → health/alert на основі
   метрик (PR3) → retry+dry-run, що спираються на метрики й health для верифікації (PR4). Жоден крок не
   випереджає свою основу; кожен PR самодостатній і testable.

3. **Адитивність зберігає стабільне ядро.** Усе будується **поверх** уже надійного provider-agnostic
   пайплайна (Provider→Persistence не змінюється). Це закриває відкриті питання infrastructure PRD (#2
   retry, #3 trigger), не вводячи ризику в перевірену логіку matching/persistence, і робить підключення
   Knigoland/Laboratory/BookChef/BookClub справою конфігурації + dry-run, а не переписування архітектури.

**Підсумок:** цей PRD — технічний контракт на фундамент. Імплементація PR1–PR4 не починається до його
затвердження; підключення провайдерів (§9) — лише після готового фреймворку.
