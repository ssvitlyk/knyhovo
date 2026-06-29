# Ingestion Pipeline — Production Readiness Review

> **Тип:** аудит архітектури (read-only). Документ **не** змінює production behavior, не підключає
> нових провайдерів і не містить production-коду. Він фіксує поточний стан ingestion pipeline та
> roadmap для регулярного production-запуску перед підключенням наступних провайдерів.
>
> **Дата:** 2026-06-29 · **Scope:** `packages/api` (pipeline + refresh), `packages/scrapers`, `packages/shared`.

---

## 1. Executive summary

Pipeline **архітектурно зрілий для ручного / cron-запуску** трьох підключених провайдерів
(Yakaboo, Vivat, Book-Ye). Сильні сторони вже на місці: чітка provider-agnostic абстракція,
двошарова error-isolation (per-provider + per-listing), concurrency guard проти overlapping-runs,
run tracking у таблиці `scrape_runs`, багатий набір in-memory метрик і derived health-endpoint.

Для **регулярного production-запуску** (з ростом до 7 провайдерів) бракує переважно
**operational / observability** шару, а не core-логіки:

| Прогалина | Вплив | Пріоритет |
|-----------|-------|-----------|
| Немає декларативного scheduler у репо (лише зовнішній cron) | Розклад непрозорий, не версіонується | **P0** |
| Логування неструктуроване (`console.log`), без run-id у рядках | Дебаг production-інцидентів важкий | **P0** |
| Немає real-time metrics export (лише `scrape_runs` + консоль) | Немає трендів / алертингу | **P1** |
| Немає liveness/readiness `/health` + DB-probe | Немає сигналу «процес живий / БД доступна» | **P1** |
| Немає retry/backoff на transient-помилки | Випадкові network-збої → false FAILED | **P1** |
| Немає dry-run mode | Не можна перевірити нового провайдера без запису в БД | **P2** |
| Canonical matcher: residual false-merge / false-drop | Масштабується з кожним провайдером | **P1** (моніторинг) |

**Вердикт:** аудит **не є блокером** для подальшого розвитку. Рекомендований шлях — закрити
observability/resilience прогалини (PR1–PR4) **до** wiring нових провайдерів (PR5–PR8), бо кожен
новий провайдер навантажує canonical matcher і робить діагностику без метрик/health болісною.

---

## 2. Architecture diagram

```
                          ┌─────────────────────────────────────────────┐
                          │  Trigger: CLI `pnpm scrape` / external cron   │
                          │  env SCRAPE_TRIGGERED_BY = MANUAL|CRON|SYSTEM │
                          └───────────────────────┬───────────────────────┘
                                                  │
   packages/api/src/scripts/run-scrape.ts  ──────▶│  parseTriggeredBy() · hard-coded provider list
                                                  │  (Yakaboo, Vivat, Book-Ye)
                                                  ▼
   packages/api/src/refresh/full-catalog.refresh.ts ── runFullCatalogRefresh()
                                                  │
            acquireRefreshLock() ◀────────────────┤  concurrency-guard.ts (W10.6)
            (refuse overlap)                      │
                                                  ▼
                              ┌──── per provider: refreshProvider() try/catch ────┐
                              │                                                    │
        startScrapeRun() ─────┤  scrape-run.repository.ts → scrape_runs (RUNNING)  │
                              │                                                    │
                              ▼                                                    │
   packages/api/src/pipeline/run-scrape.ts ── runScrapePipeline()                  │
                              │                                                    │
     provider.scrape() ───────┤  ScraperProvider  (packages/scrapers)              │  ISOLATION:
        ├─ HtmlFetcher / PlaywrightHtmlFetcher  (timeout, NO retry)                 │  один провайдер
        │     http/html-fetcher.ts · playwright-html-fetcher.ts · browser-manager  │  падає → решта
        └─ parser  (cheerio / GraphQL / sitemap)  providers/<name>/*.parser.ts      │  продовжують
                              │                                                    │
     matchOrCreate() ─────────┤  packages/scrapers/src/canonical/match-canonical.ts │
        (ISBN→title-gate→fuzzy→decide: matched|created|conflict)                    │
                              │                                                    │
     persist (Prisma $tx per listing):                                             │
        ├─ persistListing()       pipeline/persist-listing.ts                      │
        ├─ markUnavailable()      (price=null → availability-only)                 │
        └─ recordPriceChange() → price_history (APPEND-ONLY)                        │
                              │     price-history/{service,repository}.ts          │
                              ▼                                                    │
        finishScrapeRun() ────┤  status SUCCESS|PARTIAL|FAILED + metrics → scrape_runs
                              └────────────────────────────────────────────────────┘
                                                  │
            releaseRefreshLock() ◀────────────────┤  sweep dangling RUNNING → FAILED
                                                  ▼
                              exit 0  /  exit 1 (лише коли ВСІ провайдери впали)

   ── Observability (out-of-band) ──────────────────────────────────────────────
   GET /api/refresh/health   refresh/refresh-health.ts + route.ts
        derived health з scrape_runs + listing freshness (8–9 issue types)
   Logs: console.log/error через Logger interface (pipeline/types.ts)
   Metrics: in-memory ScrapeMetrics → persist у scrape_runs (немає real-time export)
   Alerts: НЕ для ingestion — лише price/availability alerts у wishlist.refresh.ts
```

---

## 3. Stage-by-stage аналіз

### 3.1 Scheduler

| | |
|---|---|
| **Поточна реалізація** | Немає вбудованого scheduler. Запуск через CLI `pnpm scrape` або зовнішній cron (Railway). `SCRAPE_TRIGGERED_BY` мапиться в `ScrapeRunTrigger` (MANUAL/CRON/SYSTEM). Інтервал — конвенція 12h (`SCRAPE_INTERVAL_HOURS`), не enforced у коді. |
| **Відповідальні модулі** | [packages/api/src/scripts/run-scrape.ts](../../packages/api/src/scripts/run-scrape.ts), [docs/prd/refresh-architecture-w10.md](../prd/refresh-architecture-w10.md) §6 |
| **Готово** | Idempotent skip при overlapping-run (concurrency guard); trigger-классифікація; коректні exit-коди для cron. |
| **Бракує** | Декларативний розклад у репо; staggering провайдерів; розділення розкладів FULL_CATALOG vs WISHLIST_REFRESH у конфізі; алерт «всі провайдери впали». |
| **Ризики** | Розклад живе поза репо → не версіонується, не ревʼюється; одночасний старт усіх провайдерів дає пік навантаження та anti-bot ризик. |
| **Рекомендації** | Декларативний cron-конфіг (Railway service / `crontab` у репо) + документований one-shot command; рознести провайдери в часі; винести інтервал у env, прочитаний кодом. |

### 3.2 Provider

| | |
|---|---|
| **Поточна реалізація** | Контракт `ScraperProvider { name; scrape(options?) }`; `scrape()` ніколи не throw — помилки в `result.errors[]`. 7 провайдерів реалізовано, **3 підключено** у `run-scrape.ts`. |
| **Відповідальні модулі** | [packages/shared/src/types/provider.ts](../../packages/shared/src/types/provider.ts); `packages/scrapers/src/providers/<name>/` |
| **Готово** | Provider-agnostic pipeline (новий провайдер не потребує змін у core); типобезпечний контракт; опційне enrichment описів. |
| **Бракує** | Реєстр провайдерів захардкоджений у script (немає декларативного registry); немає per-provider конфігу (timeout/delay/maxPages) поза кодом. |
| **Ризики** | Wiring-помилки при додаванні провайдерів; складно вмикати/вимикати провайдер без редеплою. |
| **Рекомендації** | Винести список провайдерів у конфіг/registry із per-provider опціями; feature-flag на провайдера. **(NB: за обмеженням аудиту — не чіпаємо зараз `run-scrape.ts`.)** |

### 3.3 Fetcher

| | |
|---|---|
| **Поточна реалізація** | Інтерфейс `HtmlFetcher { fetch(url, timeoutMs) }`. Дві реалізації: `FetchHtmlFetcher` (native fetch + AbortController) і `PlaywrightHtmlFetcher` (browser, для Cloudflare-challenge у Book-Ye). `browser-manager.ts` — singleton lazy-load. |
| **Відповідальні модулі** | `packages/scrapers/src/http/html-fetcher.ts` · `playwright-html-fetcher.ts` · `browser-manager.ts` · `blocked-page.ts` |
| **Готово** | Per-request timeout (10s; 30s для Playwright); browser-reuse; anti-bot/challenge детекція; lazy-load Playwright (не роздуває не-browser consumers). |
| **Бракує** | **Немає retry** на transient-помилки; немає jitter-delay між спробами; немає proxy-rotation; timeout фіксований у провайдері, не централізований. |
| **Ризики** | Одиничний network-blip → провайдер позначається FAILED без потреби; Playwright-browser може «зависнути» (частково мітигується auto-restart). |
| **Рекомендації** | Bounded exponential backoff + jitter саме тут (див. §5.2); централізована retry-обгортка навколо `fetch()`. |

### 3.4 Parser

| | |
|---|---|
| **Поточна реалізація** | Per-provider парсери (`<name>.parser.ts`): cheerio (Yakaboo/Vivat/Book-Ye), GraphQL JSON (BookClub), sitemap + JSON-LD (BookChef/Laboratory/Knigoland). Реєстр product-page парсерів у `single-product.ts`. Помилки збираються в `errors[]`, не throw. |
| **Відповідальні модулі** | `packages/scrapers/src/providers/<name>/<name>.parser.ts`; `providers/single-product.ts` |
| **Готово** | Помилка одного card/page не ламає пагінацію; фільтрація не-паперових форматів; нормалізація ціни (грн→копійки) та availability. |
| **Бракує** | Немає parser-health сигналу в реальному часі (selector-drift детектиться лише пост-фактум у refresh-health); немає сирого-HTML архіву для post-mortem. |
| **Ризики** | Зміна верстки провайдера → тихий drop товарів; виявляється тільки на наступному health-розрахунку. |
| **Рекомендації** | Логувати parse-rate (parsed / expected) на сторінку; опційно зберігати сирий HTML при аномаліях для дебагу. |

### 3.5 Canonical Matcher

| | |
|---|---|
| **Поточна реалізація** | `matchOrCreate(listing, candidates)` → `matched | created | conflict`. 4 кроки: exact-ISBN → title-gate(0.85) → fuzzy(0.65·tSim+0.35·aSim) → decision(0.85). Conflicts: ISBN_CONFLICT / VOLUME_MISMATCH / BUNDLE_MISMATCH. |
| **Відповідальні модулі** | [packages/scrapers/src/canonical/match-canonical.ts](../../packages/scrapers/src/canonical/match-canonical.ts); `normalize.ts`, `similarity.ts`, `conflicts.ts`, `isbn.ts`. Виклик з [pipeline/run-scrape.ts:62](../../packages/api/src/pipeline/run-scrape.ts#L62). |
| **Готово** | ISBN-шлях rock-solid (0 дублікатів cross-provider у cap-100/cap-300, див. [audit](canonical-matcher-final-audit.md)); conflicts gated за title-similarity; validation-script для replay. |
| **Бракує** | Over-merge detector (зараз метрики ловлять лише under-merge); guard на ISBN_CONFLICT без урахування автора; semantically — VOLUME/BUNDLE «drop» замість «create separate canonical». |
| **Ризики** | З кожним новим провайдером зростає к-сть false fuzzy-merge та false BUNDLE/VOLUME-drop (~14–20 реальних товарів на cap-300 — audit). Масштаб лінійно росте. |
| **Рекомендації** | Expose `conflictsByReason` у метрики й алерт на сплеск; додати over-merge detector до validation; решта — окремий matcher-PR поза цим аудитом. |

### 3.6 Persistence

| | |
|---|---|
| **Поточна реалізація** | Prisma 6 + PostgreSQL 16. **Per-listing транзакція** (`$transaction`): canonical → provider_listing → price_history. `price_history` — append-only; запис снапшоту лише при зміні ціни/availability. `markUnavailable()` для price=null. |
| **Відповідальні модулі** | [pipeline/persist-listing.ts](../../packages/api/src/pipeline/persist-listing.ts); [price-history/service.ts](../../packages/api/src/price-history/service.ts) + `repository.ts`; [prisma/schema.prisma](../../packages/api/prisma/schema.prisma) |
| **Готово** | Атомарність на рівні listing; idempotent upsert-логіка (check-then-act за `(provider,url)`); graceful degradation (null price/cover/description ніколи не перезаписує даними-null); append-only price history. |
| **Бракує** | Немає batch-insert (кожен listing — окрема транзакція → багато round-trips); немає DB-connectivity probe; append-only enforced лише бізнес-логікою, не DB-constraint. |
| **Ризики** | Продуктивність при великих каталогах (N транзакцій); при вичерпанні connection-pool немає раннього сигналу. |
| **Рекомендації** | Розглянути батчинг / `createMany` для нових listing; DB-health probe (див. §6); опційно — DB-тригер проти UPDATE/DELETE на price_history. |

### 3.7 Metrics

| | |
|---|---|
| **Поточна реалізація** | In-memory `ScrapeMetrics` (13 лічильників): scraped, matched, created, conflicts(+byReason), providerListingsCreated/Updated, priceHistoryCreated, availabilityUpdated, skippedNoPrice, errors. Persist у `scrape_runs`; `formatSummary()` у консоль. |
| **Відповідальні модулі** | [pipeline/types.ts](../../packages/api/src/pipeline/types.ts), [pipeline/metrics.ts](../../packages/api/src/pipeline/metrics.ts), [refresh/scrape-run.repository.ts](../../packages/api/src/refresh/scrape-run.repository.ts) |
| **Готово** | Багатий per-run набір; персистенс історії запусків; деривація status (SUCCESS/PARTIAL/FAILED). |
| **Бракує** | Real-time export (Prometheus/OTel); `scrape_duration_ms` per-provider як метрика (є `durationMs` у row, але не експортується); `retry_count`, `rate_limited_total` як лічильники. |
| **Ризики** | Немає трендів/алертингу — деградацію видно тільки вручну в БД/логах. |
| **Рекомендації** | Див. §5.4 — запропонований production-набір метрик + спосіб експорту. |

### 3.8 Logs

| | |
|---|---|
| **Поточна реалізація** | `Logger { info; error }`, дефолт — `console.log/error`. Fastify `logger: false`. Лог містить per-provider summary, errors, rate-limit, тривалість, exit-code. |
| **Відповідальні модулі** | [pipeline/types.ts:25-28](../../packages/api/src/pipeline/types.ts#L25-L28); [full-catalog.refresh.ts:134](../../packages/api/src/refresh/full-catalog.refresh.ts#L134) |
| **Готово** | Базове покриття ключових подій; інʼєктований Logger (тестопридатний). |
| **Бракує** | Структуроване логування (JSON); run-id / provider у кожному рядку; рівні (debug/warn); тривалість фаз; conflict-drop із прикладами URL. |
| **Ризики** | Дебаг production-інциденту по плоских console-рядках без correlation-id — повільний. |
| **Рекомендації** | Перейти на pino (структуровані JSON-логи), додати `runId`/`provider` context; зберегти `Logger` інтерфейс як фасад. |

### 3.9 Health

| | |
|---|---|
| **Поточна реалізація** | `GET /api/refresh/health` — derived health з `scrape_runs` + listing freshness, 8–9 issue-типів (no-successful-run, latest-run-failed, suspicious-empty-success, failure-streak, selector-drift, high-error-count, stale-listings, running-too-long, refresh-lock-stuck). |
| **Відповідальні модулі** | [refresh/refresh-health.ts](../../packages/api/src/refresh/refresh-health.ts), [refresh/route.ts](../../packages/api/src/refresh/route.ts) |
| **Готово** | Сильний provider-level health; частковий parser-health (selector-drift, empty-success); виявлення застряглих run. |
| **Бракує** | Liveness `/health` + readiness (DB ping); canonical-health (conflict-rate spike, over-merge); persistence-health (DB connectivity, tx error-rate). |
| **Ризики** | Немає сигналу «процес живий / БД доступна» для оркестратора; canonical-деградація невидима. |
| **Рекомендації** | Див. §6 — повний набір health-індикаторів. |

### 3.10 Alerts

| | |
|---|---|
| **Поточна реалізація** | Alerts існують **лише для price/availability** (wishlist), не для ingestion-операцій. Детекція подій (PRICE_DROP, BACK_IN_STOCK, OUT_OF_STOCK, LISTING_GONE) + email-дедуп. |
| **Відповідальні модулі** | [refresh/events.ts](../../packages/api/src/refresh/events.ts), [refresh/wishlist.refresh.ts](../../packages/api/src/refresh/wishlist.refresh.ts), `refresh/alert-notify.ts` |
| **Готово** | Чиста transition-матриця подій; per-book дедуп нотифікацій; graceful (null-price не тригерить хибних подій). |
| **Бракує** | **Operational alerts** для ingestion: «всі провайдери впали», «provider X FAILED N разів поспіль», «conflict-rate spike», «scrape застряг >6h». Зараз це лише exit-code + health-endpoint, який ніхто не опитує автоматично. |
| **Ризики** | Тиха деградація ingestion — поки хтось не подивиться `/api/refresh/health` вручну. |
| **Рекомендації** | Operational-alert канал (email/Slack) на основі health-issues; тригер на exit≠0 у scheduler. |

---

## 4. Спеціальні перевірки

### 4.1 Failure isolation

- **Падіння одного provider:** ізольоване — `refreshProvider()` має власний try/catch
  ([full-catalog.refresh.ts:94-178](../../packages/api/src/refresh/full-catalog.refresh.ts#L94-L178)).
  Провайдер закривається як FAILED, решта продовжують. Exit=1 лише коли **всі** впали.
- **Partial failures:** per-listing try/catch ([pipeline/run-scrape.ts:70-99](../../packages/api/src/pipeline/run-scrape.ts#L70-L99)).
  Збій listing #5 не відкочує #1–#4 і не зупиняє #6+. Status деривується: errors+нічого-не-записано → FAILED,
  errors+щось-записано → PARTIAL, 0 errors → SUCCESS.
- **Timeout handling:** per-request timeout у fetcher (AbortController / Promise.race). Timeout одного
  запиту = одна помилка в `errors[]`, не краш.
- **Прогалини:** немає circuit-breaker (провайдер, що стабільно падає, все одно опитується щоразу);
  немає automated alert на «всі впали» окрім exit-code; dangling RUNNING підчищається лише наступним
  release/sweep.

**Вердикт:** failure isolation — одна з найсильніших частин. Покращення — operational (alert, circuit-breaker), не структурні.

### 4.2 Retry strategy

- **Чи існує:** **Ні.** Свідоме рішення W10 («errors collected, not thrown; no retry loop»).
- **Чи потрібен exponential backoff:** Так — **лише для transient** (network-reset, DNS, 5xx-крім-503,
  timeout). НЕ для: 429/503 (rate-limit — навмисний стоп), 403/anti-bot, parse-помилок (детермінований дефект).
- **Де має жити retry:** на рівні **fetcher** (`HtmlFetcher.fetch`) — найвужче місце, де відомо, що це
  network-операція. Pipeline/provider шари ретраїти не повинні (інакше — подвійні запити, дублі товарів).
- **Параметри (рекомендація):** max 2–3 спроби, base 500ms-1s, factor 2, full jitter, cap ≤ timeoutMs.
  Кожна спроба ретраю інкрементить `retry_count` метрику.

### 4.3 Logging

- **Чи достатньо для дебагу:** частково. Видно per-provider summary, errors, rate-limit, тривалість.
- **Чого бракує:** структурований формат (JSON), `runId`+`provider` context у кожному рядку, рівні
  логування, тривалість фаз (scrape vs match vs persist), приклади URL для conflict-drop та blocked-page класифікації.
- **Рекомендація:** pino за фасадом наявного `Logger`; кореляція по `scrape_runs.id`.

### 4.4 Metrics (production-набір)

Запропоновані метрики (✅ — вже рахується, ➕ — додати):

| Метрика | Стан | Джерело / нотатка |
|---------|------|-------------------|
| `scrape_duration_ms` (per provider) | ➕ expose | є `scrape_runs.durationMs`, не експортується як метрика |
| `products_parsed` | ✅ | `metrics.scraped` |
| `canonical_created` | ✅ | `metrics.created` |
| `canonical_merged` | ✅ | `metrics.matched` |
| `conflicts` (+ `by_reason`) | ✅ | `metrics.conflicts` / `conflictsByReason` — **expose by_reason** |
| `provider_failures` | ➕ | derive з outcome.status=FAILED |
| `retry_count` | ➕ | новий лічильник на fetcher-рівні (разом з §4.2) |
| `skipped_products` | ✅ | `metrics.skippedNoPrice` |
| `price_history_inserted` | ✅ | `metrics.priceHistoryCreated` |
| `availability_updated` | ✅ | `metrics.availabilityUpdated` |
| `listings_created` / `listings_updated` | ✅ | `providerListingsCreated/Updated` |
| `rate_limited_total` | ➕ | derive з `outcome.rateLimited` |
| `persist_errors` | ✅ | `metrics.errors` |

**Спосіб експорту:** базис уже є (`scrape_runs`). Далі — `GET /metrics` (Prometheus text format) або
push у time-series. Не вимагає змін у core-pipeline — лише читання `scrape_runs` + лічильники процесу.

### 4.5 Health checks

| Індикатор | Стан | Що додати |
|-----------|------|-----------|
| **Provider health** | ✅ derived | вже сильний (8–9 issue-типів у refresh-health) |
| **Parser health** | 🟡 частково | selector-drift, suspicious-empty-success є; додати parse-rate per page |
| **Canonical health** | ❌ | conflict-rate spike alert; over-merge detector (зараз лише under-merge) |
| **Persistence health** | ❌ | DB connectivity probe; tx error-rate; pool-saturation сигнал |
| **Liveness** `/health` | ❌ | простий «процес живий» (для оркестратора) |
| **Readiness** | ❌ | DB ping (готовий приймати роботу) |

### 4.6 Dry-run mode

- **Чи підтримується зараз:** **Ні.** Pipeline завжди пише в БД при наявності ціни. Обмежити можна
  лише `maxPages` (менше сторінок) або mock-fetcher у тестах — це не справжній dry-run.
- **Як краще реалізувати (рекомендація):** прокинути `dryRun?: boolean` через `RunScrapeOptions` →
  у `runScrapePipeline` при `dryRun=true` замінити `$transaction(persistListing)` на no-op, що повертає
  той самий computed-outcome **без запису** (метрики рахуються як завжди). Це дає preview результату
  matching/persist для нового провайдера без мутації БД. Альтернатива — `$transaction` із примусовим
  rollback (повне навантаження на БД, але без коміту). Рекомендований — перший варіант (дешевший).
  **NB:** реалізація — окремий PR, тут лише рекомендація.

### 4.7 Scheduler readiness

Чого бракує для регулярного запуску:
- Декларативний розклад у репо (Railway cron config / `crontab` + one-shot command).
- Staggering провайдерів (не стартувати все одночасно).
- Розділення розкладів FULL_CATALOG vs WISHLIST_REFRESH (kinds уже існують у схемі).
- Lock TTL / stuck-recovery (частково є sweep dangling RUNNING; додати max-age guard).
- Operational alert на провал / exit≠0.
- ✅ idempotent skip при overlap (вже є через concurrency guard).

---

## 5. Missing production components (зведено за пріоритетом)

**P0 — блокери регулярного production-запуску**
- Декларативний scheduler-конфіг у репо + alert на exit≠0.
- Structured logging (pino) з run-id/provider.

**P1 — потрібні незабаром після запуску**
- Metrics export (`/metrics` Prometheus) + нові лічильники (`retry_count`, `rate_limited_total`, expose `by_reason`).
- Liveness/readiness `/health` + DB-probe; persistence-health.
- Retry/backoff на transient (fetcher-рівень).
- Canonical-health: conflict-rate alert + over-merge detector (моніторинг при додаванні провайдерів).

**P2 — покращення якості / зручності**
- Dry-run mode.
- Декларативний provider-registry з per-provider конфігом + feature-flag.
- Batch-insert для persistence; сирий-HTML архів для parser post-mortem; circuit-breaker.

---

## 6. Recommended implementation order

Принцип: **спостережуваність і стійкість — до wiring нових провайдерів.** Кожен новий провайдер
збільшує навантаження на canonical matcher і к-сть даних; без метрик/health/structured-logs діагностика
регресій стає дорогою. Тому інфраструктурні PR (1–4) йдуть першими, провайдери (5–8) — по одному після них.

1. **PR1** — Production runner / scheduler readiness (P0).
2. **PR2** — Metrics export (P1).
3. **PR3** — Health probes (P1).
4. **PR4** — Retry/backoff (P1).
5. *(опційно)* **PR4.5** — Structured logging + dry-run (P0-логи / P2-dry-run).
6. **PR5–PR8** — wiring провайдерів по одному.

---

## 7. Proposed PR breakdown (roadmap)

| PR | Назва | Зміст | Не чіпає |
|----|-------|-------|----------|
| **PR1** | Production runner / scheduler | Декларативний cron-розклад (Railway/repo), env-конфіг інтервалу, staggering, документований one-shot command, alert на all-failed | core pipeline-логіку |
| **PR2** | Metrics | Metrics layer + `/metrics` export (читає `scrape_runs`), нові лічильники `retry_count`/`rate_limited_total`, expose `conflictsByReason` | matching-логіку |
| **PR3** | Health | Liveness `/health` + readiness (DB ping); canonical-health (conflict-rate, over-merge detector); persistence-health | scrape-flow |
| **PR4** | Retry | Bounded exponential backoff + jitter на fetcher-рівні для transient; `retry_count`; 429/503 лишаються без retry | provider/pipeline шари |
| **PR4.5** *(опц.)* | Logging + dry-run | pino structured logs (run-id, provider); `dryRun` прапор через RunScrapeOptions | persist-семантику в non-dry режимі |
| **PR5** | Knigoland wiring | Реєстрація провайдера + smoke | — |
| **PR6** | Laboratory wiring | Реєстрація провайдера + smoke | — |
| **PR7** | BookChef wiring | Реєстрація провайдера + smoke | — |
| **PR8** | BookClub wiring | Реєстрація провайдера (GraphQL) + smoke | — |

---

## 8. Production readiness checklist

**Scheduler / ops**
- [ ] Розклад декларативний і версіонується в репо
- [ ] Провайдери рознесені в часі (staggering)
- [ ] Alert на exit≠0 / «всі провайдери впали»
- [x] Idempotent skip при overlapping run (concurrency guard)
- [x] Коректні exit-коди для cron

**Observability**
- [ ] Structured logging (JSON) з run-id + provider
- [ ] Metrics export (`/metrics` або time-series)
- [ ] `retry_count`, `rate_limited_total`, `conflictsByReason` доступні як метрики
- [x] Per-run метрики персистяться (`scrape_runs`)
- [x] Derived provider-health endpoint

**Health**
- [ ] Liveness `/health`
- [ ] Readiness + DB ping
- [ ] Persistence-health (connectivity, tx error-rate)
- [ ] Canonical-health (conflict-rate spike, over-merge detector)
- [x] Provider/parser health (selector-drift, stale, stuck-run)

**Resilience**
- [ ] Retry/backoff на transient (fetcher)
- [x] Per-provider error isolation
- [x] Per-listing error isolation
- [x] Per-request timeout
- [x] Rate-limit (429/503) без retry, із сигналом
- [ ] Circuit-breaker для хронічно-падаючого провайдера

**Data quality**
- [x] ISBN-matching без cross-provider дублікатів (audit cap-100/300)
- [x] price_history append-only (бізнес-логіка)
- [x] Graceful degradation (null не перезаписує даних)
- [ ] Over-merge detector у validation
- [ ] Моніторинг false BUNDLE/VOLUME-drop при додаванні провайдерів

**Dev experience**
- [ ] Dry-run mode для перевірки нового провайдера
- [ ] Декларативний provider-registry / feature-flags
- [x] Validation-script для canonical matching replay

---

## 9. Висновок

Ingestion pipeline має **здорове архітектурне ядро**: provider-agnostic контракт, надійну
двошарову failure-isolation, concurrency guard, run-tracking і derived health. Це достатньо для
ручного / cron-запуску трьох поточних провайдерів.

Для **регулярного production-запуску** і безпечного росту до 7 провайдерів бракує насамперед
**operational/observability** шару, а не core-логіки: декларативного scheduler, structured logging,
metrics export, справжніх health-probe, retry на transient-помилки та dry-run. Рекомендований порядок —
закрити P0/P1 прогалини (PR1–PR4) **до** wiring нових провайдерів (PR5–PR8), щоб кожне нове підключення
відбувалося з повноцінною спостережуваністю за canonical-matching і станом пайплайна.

> **Можливий наступний крок (поза цим аудитом):** після затвердження roadmap — додати рядок-тригер на
> цей документ у таблицю «Agent docs» кореневого `CLAUDE.md`. Робити лише за окремим погодженням.
