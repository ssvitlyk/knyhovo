# PRD: Megakniga Resumable Enrichment (Railway Job + checkpoint/resume поверх scrape_runs)

> **Статус:** Чорновик v2 — очікує затвердження. **Гілки (після затвердження):** по одній на PR, `feat/megakniga-enrichment-pr1..pr5`.
>
> **v2 (2026-07-19):** переглянуто за зауваженнями власника — job-таблиця `provider_enrichment_jobs`
> **видалена** на користь розширення `scrape_runs`; список виключень провайдерів замінено
> capability `enrichmentMode`; імплементація розбита на 5 незалежних PR з Railway Job як
> першочерговим; default batch size 50.
> **v2.1 (2026-07-19):** зафіксовано cursor-контракт для випадкових UUID (Варіант A — snapshot
> semantics, §4.3); розділено SIGINT/SIGTERM з exit-code контрактом і захистом від restart loop
> (§4.7, §5).
>
> **Споріднені доки:** [megakniga-provider.md](./megakniga-provider.md) (provider v1),
> [stale-scrape-recovery.md](./stale-scrape-recovery.md) (heartbeat/reap),
> [refresh-architecture-w10.md](./refresh-architecture-w10.md) (scrape_runs lifecycle),
> [../research/megakniga-provider.md](../research/megakniga-provider.md) (recon).
>
> **Правило:** код не пишеться до затвердження цього PRD.

---

## 1. Проблема / Root cause

Повний Megakniga enrichment (~27,848 listing URL) сьогодні можливий лише як
`SCRAPE_ENRICH_DESCRIPTIONS=true pnpm --filter @knyhovo/api scrape` з інтерактивної Railway
Console. Останній запуск було вбито закриттям ноутбука: `scrape_run` лишився `RUNNING` зі stale
`last_heartbeat_at`, частковий persist встиг записати 5,397 `provider_listings`, багатогодинний
прогрес втрачено.

Root cause — чотири незалежні архітектурні факти:

1. **Enrichment виконується в пам'яті всередині `provider.scrape()`**
   (`packages/scrapers/src/providers/megakniga/megakniga.scraper.ts:126-138` →
   `enrichProductDetails`). Він мутує in-memory масив listings; **жодного запису в БД до
   завершення всього scrape()**. Persist-цикл (`packages/api/src/pipeline/run-scrape.ts`, одна
   `$transaction` на listing) стартує лише після повернення `scrape()`. Смерть процесу на
   будь-якому етапі = втрата всієї enrichment-роботи.
2. **Прив'язка до інтерактивної сесії.** Railway Console shell — child-процес сесії; закриття
   ноутбука/розрив WebSocket → termination. Це не штатний спосіб запуску багатогодинних job.
   **Це первинна проблема — вона усувається першим PR, ще до появи checkpoint.**
3. **Немає checkpoint і resume.** Єдиний «resume» — coarse `skipDescriptionUrls`
   (`run-scrape.ts:64-82`): працює лише для URL, що встигли persist-нутись, і вимагає повного
   re-crawl каталогу.
4. **Немає graceful shutdown і живого progress.** У `packages/api/src` немає жодного
   SIGTERM/SIGINT-обробника; лічильники `scrape_runs` пишуться один раз у `finishScrapeRun` — до
   кінця run у БД видно 0.

Наслідок для даних: persist убито на 5,397 із ~27.8k → **~22.4k listings взагалі не записані**,
їхня enrichment-робота втрачена повністю.

## 2. Мета

Довгий Megakniga enrichment: (а) запускається як **неінтерактивний one-shot процес** (Railway
Job, не Console) — незалежність від ноутбука з першого ж PR; (б) переживає deploy/restart/SIGTERM
з graceful stop + checkpoint; (в) resumable та idempotent; (г) показує живий прогрес у БД.

## 3. Не-цілі (v1)

- Регулярний incremental enrichment (новинки) — пізніший режим; v1 = первинний backfill + ручні
  повторні прогони.
- Лагодження single-product refresh для megakniga (`PROVIDER_ENUM_TO_NAME` у
  `packages/api/src/refresh/http-target-fetcher.ts:28-33` не містить MEGAKNIGA) — окремий фікс;
  цей PRD той шлях не чіпає.
- Паралельність fetch (concurrency > 1) — sequential з delayMs, як сьогодні.
- Нові сервіси/scheduler-и/coordinator-и — **не вводяться взагалі** (див. §4.1).

## 4. Proposed architecture

### 4.0 Принцип: реюз існуючої інфраструктури (аудит)

| Інфраструктура | Рішення |
|---|---|
| `scrape_runs` + `ScrapeRunKind.DESCRIPTION_ENRICHMENT` | **Реюз.** Enum-значення існує з W10 і ніколи не використовувалось — enrichment run стає його першим споживачем. Нова таблиця НЕ створюється (§4.2) |
| `startScrapeRun`/`finishScrapeRun` (`scrape-run.repository.ts`) | Реюз as-is (kind-agnostic) + 2 нові маленькі функції: checkpoint counters/cursor, пошук resume-рядка |
| Heartbeat (`heartbeatScrapeRun`, `startHeartbeat`) | Реюз as-is — вони вже працюють над `scrape_runs` |
| Stale reap (`reapStaleRuns`, `concurrency-guard.ts`) | Реюз: параметризувати kinds (сьогодні hardcode GUARDED_KINDS); та сама staleness-логіка й conditional-UPDATE mutex |
| Locking | Патерн guard + DB-гарантія partial unique index, scoped **лише** на kind=DESCRIPTION_ENRICHMENT (§4.6). FULL_CATALOG lock не чіпається: enrichment його не блокує і ним не блокується |
| CLI-патерни (`run-scrape.ts`, `genre-backfill-args.ts`) | Реюз: чистий args-парсер, `process.exitCode`, `finally`-disconnect, pino |
| Keyset+batch-tx патерн (`genres/backfill.ts`) | Реюз ідіоми: keyset по `id`, одна транзакція на batch, cursor = безпечна точка resume |
| Fetcher/retry/extractor (`FetchHtmlFetcher`, `fetchWithRetry`, `extractMegaknigaProductDetails`, `isRateLimited`) | Реюз as-is; extractor лише re-export-ується з root `@knyhovo/scrapers` |

Нових абстракцій **нуль**: немає job manager-а, немає окремого lifecycle. Весь новий код — один
engine-модуль + CLI-скрипт + config-map extractor-ів (аналог існуючого `SINGLE_PRODUCT_PARSERS`).

### 4.1 Розділення discovery і enrichment; capability `enrichmentMode`

**Discovery (catalog scrape) — без змін по суті.** `scrape --provider=megakniga` проходить ~450
сторінок (~5–10 хв), персистить listings, завершується без enrichment.

**Режим enrichment — capability провайдера, не список виключень.** У `ScraperProvider`
(`packages/shared/src/types/provider.ts`) додається опційне поле:

```ts
/** Як провайдер збагачується деталями продукту. Default: 'inline'. */
readonly enrichmentMode?: 'inline' | 'background';
```

- `inline` (default, усі чинні провайдери) — як сьогодні: `enrichDescriptions` всередині
  `scrape()`.
- `background` (**megakniga**) — pipeline (`run-scrape.ts`) знімає `enrichDescriptions` перед
  викликом `scrape()` і логує редірект: `megakniga: enrichmentMode=background, inline enrichment
  skipped — use 'pnpm --filter @knyhovo/api scrape:enrich -- --provider=megakniga'`.

Жодного `if (provider === 'megakniga')` у pipeline; рішення декларує сам провайдер. Той самий
capability далі гейтить CLI: `scrape:enrich` приймає лише провайдерів з
`enrichmentMode === 'background'` (і наявним extractor-ом у config-map).

**Background enrichment** — новий тонкий шар у `packages/api`:

```
packages/api/src/enrichment/
  engine.ts        # batch-цикл: candidates → fetch → extract → batch-commit → checkpoint
  providers.ts     # map провайдер → { extractor, delayMs, timeoutMs } (патерн SINGLE_PRODUCT_PARSERS)
packages/api/src/scripts/
  run-enrichment.ts, run-enrichment-args.ts   # CLI (патерн run-genre-backfill)
```

Правила запису = чинні graceful-правила persist (`persist-listing.ts`): кожне з полів
`isbn / description / publisher / format / rawCategories / coverUrl` пишеться **лише якщо**
incoming непорожнє **і** поточне в БД порожнє (fill-only) → повторна обробка ідемпотентна за
визначенням.

### 4.2 Чому scrape_runs, а не нова таблиця (рішення v2)

`scrape_runs` вже має все, що мала б job-таблиця: `status`, `started_at`, `finished_at`,
`last_heartbeat_at`, `error_summary`, `metadata`, counters, індекс `(provider, kind, startedAt)`
— плюс готові heartbeat/reap/repository. Бракує лише **cursor** і **живого processed-лічильника**.
Концептуальна різниця («ledger прогонів» vs «довгоживучий job») знімається так: **один запуск
процесу = один рядок** (ledger-семантика збережена), а checkpoint **передається між рядками** —
resume читає cursor останнього незавершеного DESCRIPTION_ENRICHMENT-рядка. Кампанія = ланцюжок
рядків, кожен зі своєю атрибуцією (тривалість, помилки, trigger) — це навіть краще для
спостережуваності, ніж один мутований job-рядок.

Дві нові additive-колонки на `scrape_runs`:

```prisma
cursor          String?  // останній оброблений provider_listings.id; NOT NULL ⇔ run resumable
itemsProcessed  Int      @default(0) @map("items_processed")  // живий processed (у т.ч. без запису)
```

Мапінг лічильників для kind=DESCRIPTION_ENRICHMENT (документується в коді):
`itemsFound` = totalCount кандидатів на старті; `itemsUpdated` = listings, реально збагачені
(записані); `itemsProcessed` = пройдені (включно з fetch-fail і сторінками без даних);
`errorsCount` = failed; `metadata` = { batchSize, delayMs, force, limit, resumedFromRunId }.
Для enrichment-рядків counters оновлюються **після кожного batch**, не лише в кінці (усуває
«0 до самого кінця»).

**Статуси — без зміни enum.** Семантика для DESCRIPTION_ENRICHMENT:

| Статус | Значення | cursor |
|---|---|---|
| `RUNNING` | активний | останній batch |
| `SUCCESS` | черга вичерпана, без помилок | **NULL** (очищається) |
| `PARTIAL` | (а) зупинено достроково — SIGTERM / rate-limit / `--limit` → resumable; (б) черга вичерпана з помилками → cursor NULL | NOT NULL ⇔ resumable |
| `FAILED` | аварія / stale-reap | NOT NULL → resumable |

Інваріант: **`cursor IS NOT NULL` ⇔ є що продовжувати.** Ручне скасування кампанії = SQL
`UPDATE ... SET cursor = NULL` (документується). INTERRUPTED/CANCELLED enum-значення не
потрібні — нуль змін існуючих enum.

Job-таблиця була б виправдана лише за потреби довгоживучого мутованого стану поза ledger
(пріоритети, черги кількох кампаній, scheduling) — цього в scope немає.

### 4.3 Черга кандидатів (детермінована, keyset)

```sql
SELECT id, url FROM provider_listings
WHERE provider = 'megakniga'
  AND id > $cursor                       -- keyset, НЕ OFFSET
  AND ( $force OR isbn IS NULL OR description IS NULL OR publisher IS NULL
        OR format IS NULL OR raw_categories = '{}' )
ORDER BY id ASC
LIMIT $batchSize;
```

- `id` (PK, uuid): стабільний порядок; keyset не пропускає й не дублює рядки, навіть коли
  batch-update виводить рядки з предиката. Нового індексу не треба (~28k рядків, PK-скан).
- Cursor потрібен не лише для швидкості: без нього назавжди-незбагачувані рядки (не-книги,
  сторінки без ISBN) вічно стояли б на початку черги й повторно фетчились кожен рестарт.
- `--force` ігнорує предикат (re-enrichment; fill-only все одно не затирає наявні значення).
- `itemsFound` (totalCount) рахується один раз при старті run.

**Cursor-контракт для випадкових UUID (Варіант A — snapshot semantics).**
`provider_listings.id` — `@default(uuid())`, тобто **випадковий UUID v4, не монотонний**;
колонки `created_at` у таблиці немає. Наслідок, який фіксуємо прямо: listing, створений
паралельним catalog scrape **під час** активної кампанії, отримує випадковий id, який може
лексикографічно стояти **до** поточного cursor — і тоді в поточну кампанію не потрапить.

Обраний контракт (найпростіший надійний для v1; Варіант B — composite keyset по
`(created_at, id)` — відхилено: вимагав би нової колонки `created_at` + backfill + індекс без
реальної вигоди):

1. Кампанія стартує з cursor NULL і **повністю покриває всі candidates, що існували на момент
   старту** — прохід іде по всьому id-простору, випадковість UUID на це не впливає.
2. Рядки, створені під час кампанії, **можуть** бути підхоплені (якщо їхній id > поточного
   cursor), але це **не гарантується і не заявляється**.
3. Гарантія доїдання: пропущені рядки лишаються un-enriched → предикат кандидатів матчить їх →
   **наступна кампанія** (новий запуск після завершення поточної, cursor NULL) підбирає їх
   гарантовано. Штатний спосіб «доїсти» новинки після великого catalog scrape — просто запустити
   `scrape:enrich` ще раз.
4. `itemsFound` (totalCount) — оцінка на момент старту run; фактичний processed може відхилятися
   на кількість mid-campaign рядків. Acceptance criteria **не** заявляють повного покриття рядків,
   створених після старту кампанії.

Тест на цю семантику — §9 рядок 14.

### 4.4 Batch-цикл

```
run = резюмувати чи створити scrape_run (kind=DESCRIPTION_ENRICHMENT)   // §4.5, §4.6
stopHeartbeat = startHeartbeat(run.id)          // існуючий, interval 60s, unref
loop:
  if (signal.aborted) break                     // §4.7
  batch = nextCandidates(cursor, batchSize)
  if (batch.empty) → SUCCESS/PARTIAL, cursor=NULL; break
  for listing of batch:
    if (signal.aborted) break                   // не брати нові елементи
    try   { html = fetchWithRetry(url); details = extract(html) }
    catch (rateLimited) → commit зібраного, PARTIAL('rate limited'), exit
    catch (err)         → failed++, зразок у errorSummary    // один fail не валить batch
    sleep(delayMs)
  $transaction([ fill-only UPDATE-и listings,
                 checkpoint run { cursor=last(batch).id, counters+=, lastHeartbeatAt } ],
               { timeout: 60_000 })              // retry ×2 з backoff; далі FAILED (cursor цілий)
  log progress + ETA                             // §4.8
finally: stopHeartbeat(); finishScrapeRun(...); prisma.$disconnect()
```

Інваріанти: HTTP-фаза поза транзакцією; транзакція = лише batch UPDATE-и + checkpoint, атомарно
(«torn batch» неможливий — cursor завжди безпечна точка resume, патерн `genres/backfill.ts`);
жодної гігантської транзакції; падіння одного fetch не валить run.

**Batch size — default 50** (CLI `--batch-size` > env `SCRAPE_ENRICH_BATCH_SIZE`). Компроміс:
- *Commit overhead:* мізерний за будь-якого розміру — batch-транзакція коштує мілісекунди проти
  ~40с HTTP-фази batch-у (50 × (fetch ~500мс + delay 300мс)); 22.4k / 50 ≈ 450 комітів на всю
  кампанію — шум на тлі 5–7 год fetch-ів.
- *Rollback cost:* fail транзакції переробляє ≤1 batch — 50 дешевше за 100.
- *Restart cost:* kill між checkpoint-ами втрачає ≤1 batch ≈ 40с роботи (при 100 — ~80с).
Оскільки commit overhead не масштабується помітно, а обидві ціни падають удвічі — 50.

### 4.5 Resume + stale recovery

Порядок при старті CLI:

1. Взяти останній `scrape_runs`-рядок `(provider, kind=DESCRIPTION_ENRICHMENT)`.
2. `RUNNING` зі свіжим heartbeat (< `SCRAPE_HEARTBEAT_TIMEOUT_MINUTES`, ті самі env, що у
   stale-scrape-recovery) → чіткий exit: `enrichment already running (run <id>, heartbeat <ts>)`.
3. `RUNNING` stale → reap існуючим conditional-UPDATE-mutex (умова staleness повторена у WHERE;
   живий процес, що встиг heartbeat, скасовує reap) → `FAILED`, cursor лишається.
4. Останній рядок з `cursor IS NOT NULL` (PARTIAL/FAILED) → **новий** run-рядок зі стартовим
   cursor звідти, `metadata.resumedFromRunId` для трасування.
5. Інакше (SUCCESS / cursor NULL / рядків немає) → новий run з cursor NULL (з початку черги).

Ідемпотентність — на двох рівнях: cursor (не переробляти пройдене) і предикат + fill-only
(навіть з cursor NULL уже enriched рядки не перефетчуються/не перезаписуються). Запуск після
завершеної кампанії чесно скаже «0 candidates» і закриється SUCCESS.

Resume успадковує snapshot-контракт §4.3: продовження з cursor покриває решту id-простору
кампанії; рядки, створені під час неї з id < cursor, доїдає наступна кампанія (крок 5 —
новий run з cursor NULL).

### 4.6 Locking (один активний enrichment на провайдера)

Реюз патерну guard + мінімальна DB-гарантія:

- Partial unique index (raw SQL у міграції; **scoped лише на enrichment-kind** — нуль впливу на
  FULL_CATALOG/WISHLIST/MANUAL):
  ```sql
  CREATE UNIQUE INDEX "scrape_runs_one_active_enrichment"
  ON "scrape_runs" ("provider", "kind")
  WHERE "status" = 'RUNNING' AND "kind" = 'DESCRIPTION_ENRICHMENT';
  ```
- Старт = звичайний `startScrapeRun` (INSERT RUNNING): конкурент ловить unique violation
  (P2002) → «already running», exit 1. Race-free без advisory lock і без нових механізмів.
- Перед стартом — reap stale enrichment-рядків: `reapStaleRuns` параметризується списком kinds
  (сьогодні hardcode `GUARDED_KINDS`; виклики guard-а передають старий список — поведінка
  FULL_CATALOG/WISHLIST не змінюється ні на біт).
- `GUARDED_KINDS` не розширюється: enrichment не блокує catalog refresh і навпаки — enrichment
  пише лише fill-only-поля, які megakniga catalog scrape не постачає; row-level locks Postgres
  достатньо.

### 4.7 Graceful shutdown: SIGINT ≠ SIGTERM, exit-code контракт

Обидва сигнали запускають той самий graceful-шлях (`AbortController.abort()`; другий сигнал =
негайний exit): engine не бере нових елементів, дає завершитись in-flight fetch-у (обмежений
`timeoutMs` 15с), комітить зібране + checkpoint (cursor = останній **повністю оброблений**
listing — цілого batch не чекаємо, шлях виходу вкладається у ~15–20с), run → `PARTIAL`,
heartbeat-таймер стоп, `$disconnect()`. Engine приймає `AbortSignal` параметром — тестується без
реальних сигналів. Різниця — лише в **exit code**, бо семантика різна:

- **SIGINT — ручна зупинка оператором.** `errorSummary='SIGINT: graceful stop at cursor <id>,
  processed N/M'`, **exit 0**. Оператор зупинив свідомо — авто-рестарт не потрібен.
- **SIGTERM — зупинка платформою (Railway redeploy/restart/host migration).**
  `errorSummary='SIGTERM: ...'`, **exit 75** (`EX_TEMPFAIL` з sysexits — «тимчасовий стан,
  повторити»). Non-zero → restart policy **On Failure** перезапускає команду → новий процес
  resume-иться з checkpoint (§4.5). Нотатка: при redeploy Railway у будь-якому разі стартує нову
  інстанцію незалежно від exit code старої — код 75 покриває решту SIGTERM-сценаріїв
  (restart/migration) і робить контракт однозначним.

**Повний exit-code контракт CLI:**

| Код | Коли | Ефект під On Failure |
|---|---|---|
| **0** | SUCCESS; черга вичерпана з помилками (PARTIAL, cursor NULL); SIGINT; **rate-limit stop** (щоб рестарт-цикл не бив сайт — продовження вручну/наступним запуском); «already running» skip (прецедент: `RefreshAlreadyRunningError` → exitCode 0 у `production-runner.ts`); спрацював no-progress guard | без рестарту |
| **75** | SIGTERM graceful; вичерпані retry batch-транзакції (transient DB — рестарт з fresh-конекшеном може допомогти; cursor цілий) | авто-рестарт → resume |
| **1** | конфігураційні/невідновлювані помилки: невалідні args/env, невідомий провайдер, провайдер без `enrichmentMode='background'`, відсутній `DATABASE_URL` | рестарт не допоможе; цикл обмежить max retries + no-progress guard |

**Захист від restart loop (двошаровий):**

1. **Платформа:** restart policy On Failure з **max 3 retries** — верхня межа за будь-яких умов.
2. **No-progress guard у CLI:** перед стартом порахувати послідовні попередні
   FAILED/PARTIAL-runs `(provider, kind=DESCRIPTION_ENRICHMENT)` з `items_processed = 0`
   (жодного просування cursor). Якщо ≥ 3 поспіль — не стартувати: закритися з логом
   `'restart loop guard: 3 consecutive runs made no progress'`, `errorSummary` у FAILED-рядку,
   **exit 0** (навмисно нульовий — розриває цикл навіть за misconfigured policy Always).
   Причина, що не resumable або повторювана (той самий config-fail), таким чином гарантовано
   не зациклюється: вона або одразу exit 1 (без сенсу рестартити), або впирається у guard.

### 4.8 Observability

Кожен batch → структурований pino-лог:

```
enrichment megakniga run=<uuid> batch=12 processed=600/22451 ok=574 failed=26
cursor=<uuid> elapsed=8m12s eta=~4h10m
```

ETA — лінійна екстраполяція за середнім часом batch. Живий прогрес у БД — сам run-рядок
(counters оновлюються кожен batch, heartbeat кожні 60с); SQL-перевірка — §5.

### 4.9 CLI (точна форма)

`packages/api/package.json`:

```json
"scrape:enrich": "turbo run build --filter=@knyhovo/scrapers && tsx src/scripts/run-enrichment.ts"
```

```
pnpm --filter @knyhovo/api scrape:enrich -- --provider=megakniga [опції]

  --provider=<name>     обов'язковий; лише провайдери з enrichmentMode='background'
  --batch-size=<n>      default 50 (або env SCRAPE_ENRICH_BATCH_SIZE)
  --limit=<n>           обробити максимум N і зупинитись PARTIAL (smoke/канарейка)
  --force               ігнорувати предикат «чого бракує»
  --dry-run             порахувати кандидатів + показати стан останнього run, без fetch/запису
```

Невідомий прапорець → помилка (патерн `genre-backfill-args.ts`). Env: `SCRAPE_ENRICH_BATCH_SIZE`
(50), `SCRAPE_ENRICH_DELAY_MS` (300 = чинний megakniga default), heartbeat — існуючі
`SCRAPE_HEARTBEAT_INTERVAL_SECONDS` / `SCRAPE_HEARTBEAT_TIMEOUT_MINUTES`. Усе — в `.env.example`.

## 5. Railway execution (runbook — піде в agent_docs)

**Штатний спосіб: one-off Railway Job-сервіс. Railway Console — заборонений для довгих runs.**

1. **Первинний backfill:** новий сервіс `megakniga-enrich` з тим самим repo/образом і custom
   start command `pnpm --filter @knyhovo/api scrape:enrich -- --provider=megakniga`; env ті самі,
   що в API-сервісі. Restart policy **On Failure, max 3**. Після завершення кампанії сервіс
   вимкнути/видалити.
2. **Як відбувається авто-resume (два механізми, обидва зводяться до «команда запускається
   знову, CLI сам знаходить checkpoint»):**
   - *Redeploy/restart/migration:* Railway стартує нову інстанцію зі start command → CLI
     виконує §4.5 (reap stale за потреби → новий run з cursor попереднього) — exit code старого
     процесу тут ролі не грає;
   - *Self-exit non-zero (crash, SIGTERM→75, transient DB→75):* On Failure перезапускає команду
     (до 3 разів) → той самий resume-шлях. Graceful exit 0 (SUCCESS/SIGINT/rate-limit/guard)
     рестарту не викликає.
3. **Обов'язкова верифікація фактичної поведінки Railway (задача PR1, результати — у runbook;
   не припускати наперед):**
   - чи трактує Railway цю конфігурацію як one-off Job або довгоживучий Service, і чи
     відрізняється поведінка restart policy для exit 0 / non-zero у кожному режимі;
   - фактичний **SIGTERM drain window** (скільки часу до SIGKILL) і чи конфігурується він
     (напр. `RAILWAY_DEPLOYMENT_DRAINING_SECONDS`); наш shutdown-шлях розрахований на ~15–20с
     (§4.7) — якщо фактичний drain коротший, підняти його налаштуванням або скоротити shutdown
     (abort in-flight fetch без очікування);
   - що показує Railway UI/логи для завершеного one-off процесу (Completed vs Crashed).
   До підтвердження цих фактів exit-code контракт §4.7 вважається робочою гіпотезою PR1;
   якщо реальність відрізняється — runbook і §4.7 коригуються в PR1, до PR5.
4. **Статус (SQL):**
   ```sql
   -- kind у БД — mapped-значення 'description-enrichment' (не Prisma-ім'я DESCRIPTION_ENRICHMENT)
   SELECT id, status, items_processed, items_updated, items_found, errors_count,
          cursor, last_heartbeat_at, started_at, finished_at, error_summary
   FROM scrape_runs
   WHERE provider = 'megakniga' AND kind = 'description-enrichment'
   ORDER BY started_at DESC LIMIT 5;
   ```
5. **Безпечний перезапуск:** перезапустити Job — stale RUNNING буде reap-нутий, новий run
   продовжить з cursor. Скасувати кампанію: `UPDATE scrape_runs SET cursor = NULL WHERE id='<id>'`.
6. **Доїдання новинок після великого catalog scrape:** повторний запуск `scrape:enrich`
   (нова кампанія з cursor NULL) — див. snapshot-контракт §4.3.

## 6. Що робити з поточним станом даних (5,397 listings + stale run)

1. Stale `scrape_runs` RUNNING-рядок — нічого руками: наступний guarded refresh reap-не його
   штатно (`Reaped stale heartbeat`).
2. Записані 5,397 рядків валідні (частина вже enriched) — нічого не видаляти.
3. Порядок відновлення: (а) звичайний catalog scrape megakniga → дозаписати ~22.4k listings
   (~5–10 хв); (б) enrichment job — предикат сам візьме все не-enriched і пропустить enriched.
   Міграції даних не потрібно.

## 7. План імплементації — 5 незалежних PR

Кожен PR окремо reviewable і deployable; після кожного система в робочому стані.

| PR | Обсяг | Deployable-стан після merge |
|---|---|---|
| **PR1 — Railway Job / Worker** | Capability `enrichmentMode` у shared + `MegaknigaScraper.enrichmentMode='background'` + pipeline знімає inline-флаг з логом; мінімальний `scrape:enrich` CLI: предикат-вибірка, in-memory keyset у межах процесу, fetch+extract, **batch-commit кожні 50**, run-рядок через існуючі `startScrapeRun`/`finishScrapeRun` (counters в кінці); re-export extractor-а з root scrapers; **емпірична верифікація поведінки Railway (§5.3): Job vs Service, drain window, реакція restart policy на exit 0/non-zero — результати в runbook**; runbook (Railway Job, заборона Console); `.env.example` | **Основна проблема усунена:** enrichment живе в Railway Job, не залежить від ноутбука. Kill втрачає ≤1 batch (усе закомічене лишається); рестарт продовжує «по предикату» (enriched рядки випадають з черги) |
| **PR2 — Background pipeline hardening** | Per-item error isolation (fail не валить batch), rate-limit early-stop (`isRateLimited`), `--force`/`--limit`/`--dry-run`, progress+ETA логи, **per-batch update існуючих counters** (`itemsUpdated`/`errorsCount`) через нову маленьку repository-функцію | Живий прогрес у БД під час run; стійкість до поганих сторінок і 429/503 |
| **PR3 — Checkpoint / Resume** | Міграція №1: `cursor` + `items_processed` на `scrape_runs`; персистентний cursor у batch-транзакції; resume-логіка §4.5 (кроки 1, 4, 5); семантика «cursor NULL ⇔ done»; idempotency-тести | Рестарт продовжує точно з checkpoint; назавжди-незбагачувані рядки не зациклюють чергу |
| **PR4 — Heartbeat + stale recovery + lock** | Wire існуючого `startHeartbeat`; параметризація `reapStaleRuns` по kinds + reap enrichment-рядків при старті; міграція №2: partial unique index → P2002 = «already running» | Мертвий run авто-закривається; два паралельні jobs неможливі на рівні БД |
| **PR5 — Graceful SIGINT/SIGTERM + recovery-тести** | Обробники SIGINT/SIGTERM → AbortController; розділені exit-коди (SIGINT→0, SIGTERM→75) і повний exit-code контракт §4.7; **no-progress restart-loop guard**; повний pg-recovery-suite (kill/resume/stale/lock/loop-guard e2e); фіналізація доків (megakniga PRD note, CLAUDE.md, узгодження runbook з фактами PR1) | Deploy/restart Railway завершує run контрольовано з checkpoint; SIGTERM→75 авто-рестартується й resume-иться, SIGINT→0 лишається зупиненим; loop із non-resumable причини неможливий |

Проміжні відомі обмеження (документуються в PR-описах): до PR3 рестарт повторює лише
failed-рядки з голови черги (bounded кількістю failures); до PR4 захист від подвійного запуску —
організаційний (не запускати два Jobs руками); до PR5 kill = втрата ≤1 batch без graceful-статусу.

## 8. Migration plan / Rollback plan

- **Дві мікро-міграції**, обидві additive до `scrape_runs`: (PR3) дві nullable/default колонки;
  (PR4) partial unique index, scoped на kind=DESCRIPTION_ENRICHMENT. Жодних змін enum, жодних
  нових таблиць, жодних data-backfill. Staging: `migrate deploy` + `--dry-run` smoke; production
  підхоплює через чинний start-скрипт.
- **Rollback коду:** revert відповідного PR — кожен шар незалежний; catalog scrape і провайдери
  працюють без нового модуля. Колонки/індекс без споживачів нешкідливі; drop — окремою міграцією
  за бажання.
- **Runtime rollback:** зупинити Railway Job; batch-атомарність гарантує консистентність, stale
  RUNNING рядок reap-неться штатно.

## 9. Tests (матриця; coverage нових модулів ≥ 80%, детерміновані, без live-запитів)

| # | Сценарій | Тип | PR |
|---|---|---|---|
| 1 | Catalog scrape megakniga без enrichment; `SCRAPE_ENRICH_DESCRIPTIONS=true` + `enrichmentMode='background'` → inline знято, лог-редірект; vivat (inline) — як раніше; без provider-name if-ів | unit (pipeline, мок-провайдери) | 1 |
| 2 | CLI args/env parsing: прапорці, дефолти, невалідні значення, невідомий провайдер / без background-mode | unit | 1, 2 |
| 3 | Batch commit: UPDATE listings атомарний з checkpoint; fail транзакції → retry; «torn batch» неможливий | pg (`*.pg.test.ts`, TEST_DATABASE_URL-gated) | 1, 3 |
| 4 | Один failed fetch: errorsCount++, errorSummary, batch і run живуть | unit (fake fetcher) | 2 |
| 5 | Rate-limit 429/503 → commit зібраного + PARTIAL (resumable), не FAILED | unit | 2 |
| 6 | Progress/counters: після кожного batch itemsUpdated/itemsProcessed/cursor/lastHeartbeatAt оновлені в БД | pg | 2, 3 |
| 7 | Resume: PARTIAL/FAILED з cursor → новий run стартує з cursor, перші рядки не перефетчуються | pg | 3 |
| 8 | Keyset: batch-update кандидатів не спричиняє skip/duplicate; повне покриття без повторів | pg | 3 |
| 9 | Idempotency: після SUCCESS → «0 candidates»; fill-only не затирає наявні isbn/description (у т.ч. з `--force`) | pg + unit | 3 |
| 10 | Stale RUNNING recovery: старий heartbeat → reap → resume; свіжий → «already running» exit; conditional-UPDATE mutex | pg (контрольований clock) | 4 |
| 11 | Lock: другий процес при активному RUNNING → P2002 → чітка помилка, нічого не пише; reapStaleRuns з новим kind-параметром не міняє поведінку GUARDED_KINDS | pg | 4 |
| 12 | Graceful stop: injected AbortSignal посеред batch → нових не бере, commit, PARTIAL, cursor = останній повністю оброблений; exit-код за джерелом сигналу: SIGINT→0, SIGTERM→75 | unit + pg | 5 |
| 13 | End-to-end recovery: kill → resume → complete на посіяному датасеті | pg | 5 |
| 14 | Snapshot-семантика (§4.3): listing, створений між batches активної кампанії з id < cursor, у поточну кампанію не потрапляє; наступна кампанія (cursor NULL) гарантовано його обробляє | pg | 3 |
| 15 | Restart-loop guard: 3 поспіль runs з items_processed=0 → четвертий запуск не стартує, FAILED-рядок з 'restart loop guard', exit 0; run із прогресом скидає лічильник | pg | 5 |
| 16 | Exit-code контракт: config-помилка → 1 без run-рядка; rate-limit → PARTIAL + exit 0; вичерпані retry batch-tx → FAILED + exit 75, cursor цілий | unit | 2, 5 |

## 10. Список змінюваних файлів (сумарно по всіх PR)

**Нові:**
- `packages/api/src/enrichment/engine.ts`, `packages/api/src/enrichment/providers.ts`
- `packages/api/src/scripts/run-enrichment.ts`, `run-enrichment-args.ts`
- `packages/api/prisma/migrations/<ts>_scrape_run_enrichment_cursor/` (PR3),
  `<ts>_scrape_run_enrichment_lock/` (PR4)
- тести: `packages/api/src/enrichment/__tests__/*` (unit + `enrichment.pg.test.ts`), args-тести

**Змінювані:**
- `packages/shared/src/types/provider.ts` (опційний `enrichmentMode` — backward-compatible)
- `packages/scrapers/src/providers/megakniga/megakniga.scraper.ts` (`enrichmentMode='background'`)
- `packages/scrapers/src/index.ts` (re-export `extractMegaknigaProductDetails` + типи)
- `packages/api/prisma/schema.prisma` (2 колонки на ScrapeRun)
- `packages/api/src/pipeline/run-scrape.ts` (strip inline-флага за capability) + тести
- `packages/api/src/refresh/scrape-run.repository.ts` (checkpoint-фунція, resume-пошук)
- `packages/api/src/refresh/concurrency-guard.ts` (kinds-параметр у `reapStaleRuns`)
- `packages/api/src/scripts/scrape-env.ts` (2 env) + тести
- `packages/api/package.json` (script `scrape:enrich`)
- `.env.example`, `agent_docs/scraper-development.md` (runbook §5),
  `docs/prd/megakniga-provider.md` (note), `CLAUDE.md` (рядок PRD)

**Не чіпаємо:** `persist-listing.ts`, `http-target-fetcher.ts`, `GUARDED_KINDS`-поведінку,
існуючі enum, інших провайдерів, FULL_CATALOG/WISHLIST lifecycle.

## 11. Verification (після кожного PR + фінально)

1. `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` — зелені (окрім відомих red-тестів
   develop base).
2. Після PR1: локальний smoke `scrape:enrich -- --provider=megakniga --limit=20` → run-рядок
   kind=DESCRIPTION_ENRICHMENT, 20 оброблено, поля заповнені; повторний запуск не перефетчує їх.
3. Після PR3: імітація interruption — kill після ~5–10 записів → cursor виставлений; повторний
   запуск продовжує (з логів fetcher видно відсутність повторних запитів).
4. Після PR4: два паралельні запуски → другий чітко падає «already running».
5. Після PR5: SIGINT → PARTIAL + checkpoint + exit 0; SIGTERM → PARTIAL + checkpoint + exit 75;
   3 no-progress runs поспіль → guard блокує четвертий.
6. SQL-перевірка run state (§5.3) між запусками. **Без** повного live-прогону на 27k.

## 12. Acceptance criteria

- Catalog scrape megakniga не робить жодного product-page запиту незалежно від
  `SCRAPE_ENRICH_DESCRIPTIONS`; рішення декларується capability, без provider-name if-ів.
- `scrape:enrich` працює як non-interactive Railway command (без TTY, exit-code контракт §4.7).
- **Покриття кампанії — за snapshot-контрактом §4.3:** гарантовано обробляються всі candidates,
  що існували на момент старту кампанії; повне покриття рядків, створених після старту, **не
  заявляється** — їх гарантовано підбирає наступна кампанія.
- **SIGINT** → commit + checkpoint + PARTIAL + **exit 0** (без авто-рестарту).
- **SIGTERM** → commit + checkpoint + PARTIAL + **exit 75** → Railway On Failure перезапускає →
  новий процес продовжує з cursor без дублювання.
- Restart loop неможливий: max 3 retries на платформі + no-progress guard у CLI; non-resumable
  причини завершуються без автоматичного циклу.
- Другий паралельний запуск → «already running» skip (exit 0) без побічних ефектів (DB-гарантія).
- Запуск після kill -9 продовжує з cursor (після stale-reap), нічого не дублює.
- `scrape_runs` показує реальний processed/total під час run (не 0 до кінця).
- Нових таблиць нуль; зміни `scrape_runs` — 2 additive-колонки + 1 partial index.
- Фактична поведінка Railway (Job vs Service, drain, restart policy) верифікована й
  задокументована в runbook у PR1.
- Тест-матриця §9 зелена; наявні тести/провайдери не зламані.
