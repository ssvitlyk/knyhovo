# Scraper Development

> Читай коли: створюєш новий скрапер або модифікуєш існуючий провайдер.

## MVP провайдери

- Yakaboo (`packages/scrapers/yakaboo/`)
- BookClub (`packages/scrapers/book-club/`)

## Як додати нового провайдера

1. Створи директорію `packages/scrapers/<provider-name>/`
2. Реалізуй інтерфейс `ScraperProvider` з `packages/shared` (поля: title, author, ISBN, price, url, provider)
3. Зареєструй провайдер у registry (TBD при старті)
4. Напиши unit тести з реальними прикладами відповідей

## Частота скрапінгу

- Default: **кожні 12 годин**
- Значення конфігурується через env variable `SCRAPE_INTERVAL_HOURS`

> **MVP**: немає окремого scheduler-сервісу. Scrape запускається вручну:
> ```bash
> pnpm --filter @knyhovo/api scrape
> ```
> Для recurring local runs використовуй OS cron/launchd. Приклад crontab:
> ```
> 0 */12 * * * cd /path/to/knyhovo && pnpm --filter @knyhovo/api scrape
> ```

## Background enrichment (scrape:enrich)

Провайдери з великим каталогом декларують `enrichmentMode: 'background'` у своєму класі
(v1: **megakniga**, ~27k товарів). Для них pipeline **знімає** `SCRAPE_ENRICH_DESCRIPTIONS`
(catalog scrape не робить жодного product-page запиту), а деталі (ISBN/опис/видавець/палітурка/
категорії) заповнює окремий job поверх уже записаних `provider_listings`:

```bash
pnpm --filter @knyhovo/api scrape:enrich -- --provider=megakniga            # повний прохід
pnpm --filter @knyhovo/api scrape:enrich -- --provider=megakniga --limit=20 # smoke
pnpm --filter @knyhovo/api scrape:enrich -- --provider=megakniga --dry-run  # черга + останній run, без fetch
pnpm --filter @knyhovo/api scrape:enrich -- --provider=megakniga --force    # re-walk усіх рядків
```

Опції: `--batch-size=<n>` (default 50; env `SCRAPE_ENRICH_BATCH_SIZE`), `--limit=<n>`,
`--dry-run` (розмір черги + стан останнього run, нуль запитів/записів), `--force`
(ігнорує предикат «чого бракує» — корисно після розширення extractor-а; fill-only правила
все одно не затирають наявні значення); `SCRAPE_ENRICH_DELAY_MS` (default — enrichment-delay
провайдера, 300ms для megakniga).
Кожен batch комітиться однією транзакцією разом із checkpoint-ом run-рядка (`cursor` +
лічильники): kill у будь-який момент втрачає ≤1 batch, а наступний запуск **продовжує точно з
persisted cursor** останнього зупиненого run (PARTIAL/FAILED з `cursor IS NOT NULL`) — без
re-fetch пройденого, включно з назавжди-незбагачуваними сторінками. Інваріант: `cursor IS NOT
NULL` ⇔ кампанії є що продовжувати; `cursor NULL` = черга вичерпана (кампанія завершена).
Скасувати кампанію вручну: `UPDATE scrape_runs SET cursor = NULL WHERE id='<id>'`.
Прогін фіксується рядком `scrape_runs` з `kind='DESCRIPTION_ENRICHMENT'`; лічильники
(`items_found`/`items_updated`/`items_processed`/`errors_count`) і `cursor` оновлюються
**після кожного batch** — SQL нижче показує живий прогрес під час run, лог кожного batch
містить processed/total, cursor і ETA.
**Heartbeat + stale recovery + lock (PR4).** Активний run пише liveness-сигнал
`last_heartbeat_at` кожні `SCRAPE_HEARTBEAT_INTERVAL_SECONDS` (default 60с). На старті CLI
reap-ить **лише** stale DESCRIPTION_ENRICHMENT-рядки (heartbeat мовчить довше
`SCRAPE_HEARTBEAT_TIMEOUT_MINUTES`, default 15хв) → `FAILED` з `error_summary='Reaped stale
heartbeat'`, **cursor лишається** — новий run одразу resume-иться з нього
(`metadata.resumedFromRunId` = reap-нутий run). FULL_CATALOG/WISHLIST guard-и це не зачіпає ні
в який бік. Подвійний запуск неможливий на рівні БД: partial unique index
`scrape_runs_one_active_enrichment` (один RUNNING enrichment на провайдера) — другий процес
отримує чітке `enrichment already running (provider=…, run=…, heartbeat=…)`, нічого не створює
і виходить з кодом 1.
**Graceful shutdown + exit-code контракт (PR5).** SIGINT і SIGTERM запускають той самий
graceful-шлях через `AbortController`: engine не бере нових fetch-ів, дає завершитись in-flight
fetch-у, комітить зібраний prefix batch-у, checkpoint-ить cursor на **останній повністю
оброблений** listing, закриває run як `PARTIAL` (resumable), зупиняє heartbeat і від'єднує
Prisma. **Другий** той самий сигнал — негайний hard-exit (єдиний `process.exit` у CLI). На
нормальному шляху `process.exit()` не використовується — лише `process.exitCode`.

Exit-код визначає **одна** pure-функція `exitCodeForReason` (`src/enrichment/lifecycle.ts`):

| Код | Коли | Railway On Failure |
|---|---|---|
| **0** | SUCCESS; queue вичерпано з помилками (PARTIAL, cursor NULL); `--limit`; контрольований rate-limit (429/503); **SIGINT** (ручна зупинка); спрацював no-progress guard | без рестарту |
| **75** | **SIGTERM** (платформа); circuit breaker; transient crash / вичерпані retry batch-транзакції — cursor цілий | авто-рестарт → resume з cursor |
| **1** | already-running (lock); config-помилка (невалідні args/env, невідомий провайдер, без background-mode, відсутній `DATABASE_URL`) | рестарт не допоможе |

SIGINT vs SIGTERM — свідома різниця: оператор зупинив вручну (0, лишається зупиненим) vs платформа
redeploy/restart (75, авто-resume). Джерело сигналу пише у `metadata.stopReason`.

**Circuit breaker (PR5).** `SCRAPE_ENRICH_CIRCUIT_BREAKER_THRESHOLD` (default 10) послідовних
інфраструктурних падінь (timeout/DNS/connection/5xx — **НЕ** 429/503) зупиняють run, щоб масова
недоступність сайту не пройшла всі ~27k listing fetch-fail-ами. Успішний fetch скидає лічильник.
При спрацюванні: успішний prefix закомічено, cursor **не проходить** необроблений хвіст (лишається
на безпечній точці), run → `PARTIAL` (resumable), exit 75. 429/503 лишаються окремим rate-limit
сценарієм (exit 0).

**No-progress restart-loop guard (PR5).** Другий шар захисту від нескінченного Railway restart
(перший — On Failure max 3). Перед стартом CLI рахує послідовні попередні runs з
`items_processed=0`: якщо їх ≥ `SCRAPE_ENRICH_MAX_NO_PROGRESS_RESTARTS` (default 3) — не стартує,
пише FAILED-маркер з `stopReason='no-progress-guard'` і виходить **0** (навмисно — розриває цикл
навіть за misconfigured policy Always). Маркер сам має `items_processed=0`, тож guard лишається
активним до втручання оператора (розслідувати; run із прогресом скидає лічильник). Кампанія
трасується метаданими: `campaignRootRunId`, `resumeAttempt`, `startCursor`, `startItemsProcessed`,
`stopReason`.

Повна архітектура: `docs/prd/megakniga-resumable-enrichment.md` (§4.7, §3, §4).

### Запуск на Railway — тільки Job, НЕ Console

**Railway Console заборонена для довгих runs**: Console shell живе, поки живі сесія і ноутбук
оператора; закриття ноутбука вбиває процес (саме так було втрачено багатогодинний megakniga
enrichment 2026-07-19).

Штатний спосіб — one-off Job-сервіс:
1. Дублюй API-сервіс у Railway → сервіс `megakniga-enrich`, той самий repo/образ.
2. Custom start command: `pnpm --filter @knyhovo/api scrape:enrich -- --provider=megakniga`.
3. Env — ті самі, що в API-сервісі (`DATABASE_URL` обов'язково).
4. Restart policy: **On Failure, max 3**. Exit 75 (SIGTERM/circuit breaker/transient crash) →
   авто-рестарт, який resume-иться з cursor; exit 0 (SUCCESS/SIGINT/rate-limit/`--limit`/
   no-progress guard) не рестартує; exit 1 (already-running/config) рестарт не лікує. Разом із
   CLI-side no-progress guard це унеможливлює нескінченний restart loop.
5. Після завершення кампанії сервіс вимкнути/видалити.

Перевірка статусу:
```sql
-- kind у БД — mapped-значення 'description-enrichment', НЕ 'DESCRIPTION_ENRICHMENT'
SELECT id, status, items_processed, items_updated, items_found, errors_count,
       cursor, last_heartbeat_at, started_at, finished_at, error_summary, metadata
FROM scrape_runs
WHERE provider = 'megakniga' AND kind = 'description-enrichment'
ORDER BY started_at DESC LIMIT 5;
```

Безпечний перезапуск: просто запустити Job ще раз — CLI сам знайде останній зупинений run і
продовжить з його cursor (`metadata.resumedFromRunId` показує ланцюжок кампанії); уже збагачені
рядки в жодному разі не перефетчуються. Рядок, що завис у RUNNING після kill -9, наступний
запуск reap-не автоматично (stale heartbeat → FAILED, cursor цілий) і продовжить з його
checkpoint — руками нічого закривати не треба.

Як читати стан run-а (SQL вище):
- **живий**: `status='running'` і `last_heartbeat_at` свіжіший за
  `SCRAPE_HEARTBEAT_TIMEOUT_MINUTES` (default 15 хв) — `now() - last_heartbeat_at < interval
  '15 minutes'`;
- **stale (мертвий процес)**: `status='running'`, а heartbeat старший за поріг — наступний
  `scrape:enrich` закриє його як FAILED (`Reaped stale heartbeat`) і resume-неться з його
  cursor; чіпати вручну не потрібно;
- **другий паралельний запуск** при живому run завершується одразу: `enrichment already
  running (provider=…, run=<id>, heartbeat=<ts>)` — без run-рядка і без записів.

## Canonical Matching

Після скрапінгу результат проходить через canonical matching перед записом у БД.
Деталі алгоритму: `docs/prd/canonical-matching.md`.

## [TODO: заповнити при старті packages/scrapers]

- Інтерфейс `ScraperProvider`
- Механізм retry при помилках
- Логування та моніторинг помилок
- Зберігання raw HTML для дебагу
- Rate limiting відносно джерела
