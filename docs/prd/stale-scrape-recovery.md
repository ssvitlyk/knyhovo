# PRD: Stale RUNNING scrape recovery (heartbeat)

**Статус:** Затверджено (вимоги сформульовані власником продукту 2026-07-14)

## 1. Проблема

`acquireRefreshLock()` (W10.6, `packages/api/src/refresh/concurrency-guard.ts`) блокує новий
refresh, поки існує RUNNING-рядок у `scrape_runs` серед GUARDED_KINDS (FULL_CATALOG,
WISHLIST_REFRESH). Якщо контейнер убито (SIGKILL, OOM, Railway redeploy), `finally` не
виконується, `releaseRefreshLock()` не викликається — RUNNING лишається назавжди, і всі
наступні refresh падають з `RefreshAlreadyRunningError`, поки хтось руками не зробить UPDATE.

Рішення «reap за `startedAt` > N годин» відхилено: uncapped-провайдер (Knigoland) легітимно
працює години; reap живого прогону зламав би взаємну ексклюзивність (два паралельні scrape
пишуть у БД одночасно). Живий процес відрізняється від мертвого не тривалістю, а тишею —
тому heartbeat.

## 2. Рішення

### 2.1 Схема

Nullable-колонка `last_heartbeat_at TIMESTAMP(3) NULL` у `scrape_runs`
(`lastHeartbeatAt DateTime?` у Prisma). При створенні прогону `lastHeartbeatAt = startedAt`.

### 2.2 Heartbeat під час прогону

Основний механізм — **interval-таймер** на весь час прогону провайдера: кожні
`SCRAPE_HEARTBEAT_INTERVAL_SECONDS` (default 60) виконується
`UPDATE scrape_runs SET last_heartbeat_at = now() WHERE id = $runId AND status = 'RUNNING'`.

Чому таймер, а не тільки checkpoint «після batch persist / сторінки»: у FULL_CATALOG фаза
скрапу (`provider.scrape()`) може тривати години без жодного persist-checkpoint (Knigoland,
description enrichment) — checkpoint-only heartbeat зробив би живий прогін «мертвим» і його
б reaped. Таймер покриває обидві фази. Помилки heartbeat-запиту swallowed (best-effort
liveness signal, ніколи не валить прогін). Таймер `unref()`-нутий і зупиняється у `finally`.

### 2.3 Stale-lock recovery при acquire

Перед перевіркою «чи щось RUNNING» `acquireRefreshLock()` виконує reap: для кожного
RUNNING-рядка GUARDED_KINDS, що вважається stale, — атомарний conditional UPDATE:

```sql
UPDATE scrape_runs
SET status='FAILED', finished_at=now(), duration_ms=..., error_summary='Reaped stale heartbeat'
WHERE id=$id AND status='RUNNING' AND <умова staleness повторена у WHERE>;
```

Staleness:
- `lastHeartbeatAt IS NOT NULL` і `lastHeartbeatAt < now() - SCRAPE_HEARTBEAT_TIMEOUT_MINUTES`
  (default 15 хв);
- backward compat: `lastHeartbeatAt IS NULL` (рядки до міграції) → fallback на
  `startedAt < now() - SCRAPE_STALE_STARTEDAT_TIMEOUT_HOURS` (default 24 год) — щедрий поріг
  лише для legacy-рядків.

### 2.4 Атомарність / гонки

Reap-UPDATE — це mutex: продовжити старт може лише процес, чий UPDATE реально змінив рядок
(`count === 1`). Якщо кандидат був знайдений, але UPDATE повернув `count === 0` (конкурент
уже reaped його, або живий процес встиг оновити heartbeat) — acquire кидає
`RefreshAlreadyRunningError`. Умова staleness повторюється у WHERE, тож heartbeat між
SELECT і UPDATE скасовує reap.

### 2.5 Конфіг

- `SCRAPE_HEARTBEAT_INTERVAL_SECONDS` — default 60;
- `SCRAPE_HEARTBEAT_TIMEOUT_MINUTES` — default 15;
- `SCRAPE_STALE_STARTEDAT_TIMEOUT_HOURS` — default 24 (тільки для legacy-рядків без heartbeat).

Парсинг за патерном `scrape-env.ts` (невалідне значення → default).

## 3. Тести (обов'язково)

1. Normal run: `startScrapeRun` ставить `lastHeartbeatAt = startedAt`; heartbeat оновлює;
   finish закриває без reap.
2. Stale RUNNING recovery: старий heartbeat → reap у FAILED з `error_summary='Reaped stale
   heartbeat'`, новий lock видано.
3. Живий scrape не reclaim-иться: старий `startedAt`, свіжий `lastHeartbeatAt` → acquire
   кидає `RefreshAlreadyRunningError`.
4. Legacy fallback: `lastHeartbeatAt = NULL` + `startedAt` свіжіший за 24 год → НЕ reaped
   (throw); старший за 24 год → reaped.
5. Конкурентний старт: reap-UPDATE повертає `count: 0` → другий процес кидає
   `RefreshAlreadyRunningError`, не стартує.

## 4. Поза скоупом

- Гонка check-then-act самого W10.6 guard (два процеси без жодного stale-рядка можуть
  одночасно пройти `isRefreshRunning`) — існувала до цього PRD; кандидат на
  `pg_advisory_lock` окремим PRD.
- Resume перерваного прогону (reap завжди закриває як FAILED; наступний cron перезапускає).
