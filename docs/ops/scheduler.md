# Ingestion Scheduler (Railway Cron)

> **Статус:** PR1 Production Ingestion Framework. Декларативний розклад інжесту, версіонований у репо.
> Спирається на [docs/prd/production-ingestion.md](../prd/production-ingestion.md) §FR-2.

Розклад скрапінгу описаний **декларативно** через Railway config-as-code, а не лише в дашборді.
Кожен запуск — окремий Railway cron-сервіс, який стартує за розкладом, виконує один прогін і виходить
(збігається з нашим `process.exitCode`-патерном у [run-scrape.ts](../../packages/api/src/scripts/run-scrape.ts)).

## Конфіг-файли

| Файл | Kind | Команда | Cron (UTC) |
|------|------|---------|------------|
| [packages/api/railway.scrape-catalog.json](../../packages/api/railway.scrape-catalog.json) | FULL_CATALOG | `pnpm --filter @knyhovo/api scrape` | `0 2 * * *` |
| [packages/api/railway.scrape-wishlist.json](../../packages/api/railway.scrape-wishlist.json) | WISHLIST_REFRESH | `pnpm --filter @knyhovo/api scrape:wishlist` | `0 5 * * *` |

## Підключення на Railway

Railway config-as-code: **один `cronSchedule` на сервіс**, час — у UTC, мінімальна частота — кожні 5 хв.

1. Створи окремий Railway-сервіс для кожного розкладу (FULL_CATALOG, WISHLIST_REFRESH).
2. У Settings → **Config-as-code path** вкажи відповідний файл (`packages/api/railway.scrape-catalog.json`
   або `packages/api/railway.scrape-wishlist.json`). `startCommand` і `cronSchedule` беруться з файла.
3. Виставʼ env `SCRAPE_TRIGGERED_BY=CRON` на кожному сервісі (мапиться у `ScrapeRunTrigger.CRON`).
4. `DATABASE_URL` та інші спільні env — як у решти сервісів.

## Staggering (рознесення в часі)

FULL_CATALOG (`0 2 * * *`) і WISHLIST_REFRESH (`0 5 * * *`) свідомо рознесені у часі, щоб знизити піковий
тиск на БД і провайдерів та anti-bot ризик. Concurrency guard у будь-якому разі відмовить у
overlapping-прогоні (idempotent skip → exit 0), але рознесення розкладів усуває непотрібні відмови.

Провайдери **всередині** одного FULL_CATALOG-прогону вже виконуються послідовно (цикл у
[full-catalog.refresh.ts](../../packages/api/src/refresh/full-catalog.refresh.ts)), тож додаткове
рознесення провайдерів у часі на цьому етапі не потрібне.

## `restartPolicyType: "NEVER"`

Обрано навмисно: при exit≠0 (усі провайдери впали) Railway **не** перезапускає прогін автоматично —
наступний запуск відбудеться за наступним cron-тіком. Retry на transient-помилки буде доданий на
fetcher-рівні у PR4, а не як перезапуск усього скрейпу.

## Env-конвенції

| Env | Призначення | Default |
|-----|-------------|---------|
| `SCRAPE_TRIGGERED_BY` | `MANUAL` \| `CRON` \| `SYSTEM` — класифікація прогону | `MANUAL` |
| `SCRAPE_INTERVAL_HOURS` | операційна конвенція інтервалу (enforced cron-розкладом, не кодом) | `12` |
| `LOG_LEVEL` | рівень structured-логів (pino) | `info` |

## Ручний one-shot запуск

```bash
pnpm scrape            # FULL_CATALOG (потребує DATABASE_URL)
pnpm scrape:wishlist   # WISHLIST_REFRESH
```

## On-demand trigger

Webhook / admin-trigger поза розкладом — **OUT** на цьому етапі (закриває infrastructure open Q#3):
лишаємось на Cron; on-demand trigger — post-MVP разом із worker + queue.
