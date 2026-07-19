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
```

Опції: `--batch-size=<n>` (default 50; env `SCRAPE_ENRICH_BATCH_SIZE`), `--limit=<n>`;
`SCRAPE_ENRICH_DELAY_MS` (default — enrichment-delay провайдера, 300ms для megakniga).
Кожен batch комітиться окремою транзакцією: kill у будь-який момент втрачає ≤1 batch,
повторний запуск добирає лише ще-не-збагачені рядки (предикат по відсутніх полях).
Прогін фіксується рядком `scrape_runs` з `kind='DESCRIPTION_ENRICHMENT'`.
Повна архітектура (checkpoint/resume, heartbeat, lock, SIGTERM — наступні PR):
`docs/prd/megakniga-resumable-enrichment.md`.

### Запуск на Railway — тільки Job, НЕ Console

**Railway Console заборонена для довгих runs**: Console shell живе, поки живі сесія і ноутбук
оператора; закриття ноутбука вбиває процес (саме так було втрачено багатогодинний megakniga
enrichment 2026-07-19).

Штатний спосіб — one-off Job-сервіс:
1. Дублюй API-сервіс у Railway → сервіс `megakniga-enrich`, той самий repo/образ.
2. Custom start command: `pnpm --filter @knyhovo/api scrape:enrich -- --provider=megakniga`.
3. Env — ті самі, що в API-сервісі (`DATABASE_URL` обов'язково).
4. Restart policy: **On Failure, max 3** (crash → авто-повтор, який добирає решту; graceful
   завершення з exit 0 не рестартує).
5. Після завершення кампанії сервіс вимкнути/видалити.

Перевірка статусу:
```sql
-- kind у БД — mapped-значення 'description-enrichment', НЕ 'DESCRIPTION_ENRICHMENT'
SELECT id, status, items_found, items_updated, errors_count,
       last_heartbeat_at, started_at, finished_at, error_summary, metadata
FROM scrape_runs
WHERE provider = 'megakniga' AND kind = 'description-enrichment'
ORDER BY started_at DESC LIMIT 5;
```

Безпечний перезапуск: просто запустити Job ще раз — уже збагачені рядки не перефетчуються.

## Canonical Matching

Після скрапінгу результат проходить через canonical matching перед записом у БД.
Деталі алгоритму: `docs/prd/canonical-matching.md`.

## [TODO: заповнити при старті packages/scrapers]

- Інтерфейс `ScraperProvider`
- Механізм retry при помилках
- Логування та моніторинг помилок
- Зберігання raw HTML для дебагу
- Rate limiting відносно джерела
