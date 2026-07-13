# BookChef Incremental Scraping PRD

> **Тип:** PRD (інфраструктура скрапінгу). **Статус:** Затверджено (2026-07-13).
> **Гілка досліджень:** `feature/bookchef-incremental-scraping-research`.
>
> **Споріднені доки:** [bookchef-provider.md](./bookchef-provider.md) (базовий провайдер),
> [refresh-architecture-w10.md](./refresh-architecture-w10.md) (refresh-пайплайн).
>
> **Правило проєкту:** код під цю фічу **не пишеться** до підтвердження цього PRD.

---

## 1. TL;DR

- **Проблема:** `BookChefScraper` кожен прогін фетчить усі ~14 692 сторінки товарів із
  `sitemap_products.xml` серійно з delay 500ms → повний прогін ≈ 2–4 год і ~14.7k запитів
  до BookChef.
- **Знахідка (live-recon 2026-07-13):** `<lastmod>` у sitemap живий і надійний — присутній на
  всіх URL, оновлюється батчами кожні ~20 хв (cron на боці BookChef), реальний потік змін
  **~50–500 URL/день**. Альтернативні сигнали мертві: немає `ETag`/`Last-Modified`
  (`cf-cache-status: DYNAMIC`), немає RSS, немає публічного API.
- **Рішення:** sitemap-diff incremental scraping — зберігати per-URL watermark
  (`source_lastmod`) у новій таблиці `provider_scrape_state`, фетчити лише нові/змінені URL;
  weekly full scrape як reconciliation + вбудована shadow-валідація довіри до lastmod.
- **Виграш:** ~300–500 фетчів/добу замість 14 692 (~30–60× менше навантаження на BookChef),
  час прогону з годин до хвилин.
- **Reusability:** механізм загальний (`packages/scrapers/src/sitemap/`); BookChef — перший
  користувач, Laboratory — наступний кандидат, Knigoland — після живої валідації lastmod.
- **Оцінка:** ~3 дні реалізації + 1 тиждень shadow-валідації у проді перед перемиканням режиму.

---

## 2. Зберігання стану: таблиця `provider_scrape_state`

Нова таблиця (Prisma-модель), **без FK** на `provider_listings` — стан навмисно існує і для
URL без business-row:

| Поле | Тип | Опис |
|---|---|---|
| `provider` | `Provider` enum | частина ключа |
| `url` | `String` | sitemap `<loc>`; частина ключа |
| `source_lastmod` | `timestamptz?` | watermark: lastmod останнього успішно обробленого фетчу |
| `last_seen_in_sitemap_at` | `timestamptz` | коли URL востаннє бачили в успішно розпарсеному sitemap |
| `last_fetched_at` | `timestamptz?` | коли сторінку востаннє реально фетчили |

**Індекси:**
- `@@unique([provider, url])` — головний ключ доступу: покриває завантаження state-map провайдера
  (лівий префікс) і point-lookup/upsert. Той самий паттерн, що на `provider_listings`.
- `@@index([provider, last_seen_in_sitemap_at])` — для TTL-sweep і vanished-count запитів.
  При ~15k рядків/провайдер це гігієна, але індекс дешевий.
- Індекс на `source_lastmod` **не потрібен**: diff проти sitemap рахується в пам'яті по
  завантаженій map, не SQL-запитом.

**Чому не колонка на `provider_listings` (відхилений Варіант А)** — функціональні причини:
- Row у `provider_listings` з'являється лише після успішного persist; `markUnavailable`
  повертає `skipped-new-no-price` для нових лістингів без ціни
  ([persist-listing.ts:256-258](../../packages/api/src/pipeline/persist-listing.ts)) → таким URL
  нема куди писати watermark → вічний перефетч.
- `provider_listings.url` = JSON-LD `offers.url`, а sitemap говорить `<loc>` — ключі можуть
  не збігатися (перевірка day-0, §8).
- Змішує crawl-bookkeeping у business-таблицю, яку читають UI та health-check.

**Відхилений Варіант В** (snapshot-blob у `scrape_runs.metadata`): 15k-JSON на прогін,
без upsert-семантики, необмежене зростання.

**Ops-важіль:** `DELETE FROM provider_scrape_state WHERE provider='bookchef'` = чистий
force full recrawl без дотику до business-даних.

### 2.1 Політика очищення (таблиця без FK)

- **TTL-sweep наприкінці успішного weekly full**: `DELETE WHERE provider = X AND
  last_seen_in_sitemap_at < now() - RETENTION` (default **90 днів**, env-конфігурований).
  Не виконується в incremental-прогонах.
- Чому 90 днів, а не одразу: (а) URL може тимчасово випасти з sitemap (глітч генерації) —
  миттєве видалення запускає цикл «new URL → повний фетч»; (б) vanished-рядки — сировина для
  майбутньої deactivation-policy (retention > її observation window); (в) обсяг тривіальний,
  cleanup — гігієна, не перформанс.
- Захист від mass-delete: `last_seen_in_sitemap_at` просувається лише при успішно розпарсеному
  sitemap — разовий збій не наближає рядки до TTL. Додатковий guard: скіпнути sweep, якщо total
  sitemap цього прогону аномально малий проти попереднього.
- Видалення state-рядка при живому листингу безпечне: якщо URL повернеться в sitemap —
  трактується як новий → повний фетч → watermark відновлюється.

### 2.2 Батчування записів (full-прогін)

- **Presence** (`last_seen_in_sitemap_at`, ~14.7k рядків) — chunked `updateMany`/`INSERT … ON
  CONFLICT` (чанки 1–5k). Природна форма реалізації, per-row не пишеться взагалі.
- **Нові state-рядки** (перший full: ~14.7k) — `createMany({skipDuplicates})` чанками.
- **Watermark-upserts** — **не батчувати**: +1 statement усередині вже існуючих per-listing
  транзакцій (full і сьогодні робить 14.7k транзакцій). Батчування зламало б атомарність
  watermark⇔persist заради невимірного виграшу — відхилена оптимізація; вузьке місце full —
  фетчі (500ms delay), не БД.

---

## 3. Семантика `lastSeenAt` і фікс health-check (v1 scope)

- `provider_listings.lastSeenAt` зберігає поточну семантику: «сторінку реально фетчили і
  лістинг підтверджено» (так її пишуть
  [persist-listing.ts](../../packages/api/src/pipeline/persist-listing.ts):132,176,265;
  [persist-refresh.ts](../../packages/api/src/refresh/persist-refresh.ts):65,95).
  Присутність у sitemap живе окремо в `provider_scrape_state.last_seen_in_sitemap_at`.
- **Обов'язковий фікс у тому ж PR:** stale-listings health-check
  ([refresh-health.ts](../../packages/api/src/refresh/refresh-health.ts):266-277, поріг 72h /
  ratio 0.5) під incremental гарантовано хибно спрацьовує (на 4-й день після weekly full >90%
  listings «stale»). Для sitemap-incremental провайдерів staleness =
  `max(lastSeenAt, last_seen_in_sitemap_at)`.

---

## 4. Watermark: advance разом із persist, в одній транзакції

Правило по outcome персистенції:

| Outcome | Watermark |
|---|---|
| `created` / `updated` / `marked-unavailable` | upsert `source_lastmod` **усередині того самого `prisma.$transaction`**, що й persistListing/markUnavailable — атомарність: watermark просунувся ⇔ business-дані збережені |
| `skipped-new-no-price` (свідомий детермінований skip) | standalone-запис watermark: фетч+парс успішні, рішення не персистити детерміноване; без advance ці URL перефетчувались би вічно |
| fetch error / parse error / DB error | watermark **не рухається** → авто-retry наступного прогону |

Вартість: +1 upsert у вже існуючу per-listing транзакцію (~300–500/прогін incremental).

**Поведінка при rollback транзакції (явно):**
- Rollback відкочує **обидва** записи атомарно (business-дані + watermark) → state зберігає
  старий `source_lastmod` → наступний прогін бачить новіший sitemap-lastmod → URL автоматично
  потрапляє у `toFetch`. Жодної компенсаційної логіки, жодного partial state.
- Rollback одного лістинга не зриває прогін: цикл продовжується, помилка в `errorsCount`,
  прогін завершується як `partial`.
- Падіння самого watermark-upsert усередині транзакції відкочує і business-запис — ціна
  атомарності; прийнятно (найгірший наслідок = повторний фетч однієї сторінки).
- Crash процесу посеред прогону: watermarks просунуті лише для закомічених лістингів → решта
  ретраїться наступним прогоном (природний resume без спеціального коду).
- Батчевий апдейт `last_seen_in_sitemap_at` окремий та ідемпотентний; може просунутись для
  лістинга з відкоченим persist — коректно: presence ≠ watermark, рішення про refetch
  керується виключно watermark-ом.

---

## 5. Cadence: incremental 12h + weekly full (reconciliation)

- Дві cron-entries на Railway; режим через CLI-арг (`--mode=full|incremental`) — видно у
  cron-рядку. Weekly full зсунути відносно 12h-слоту incremental.
- **Self-heal auto-full** (fail open у full, ніколи у «фетчити нічого»):
  - state порожній для провайдера;
  - останній FULL-прогін старший ~10 днів (читається зі `scrape_runs`) — покриває мовчки
    зламаний weekly cron;
  - sitemap розпарсився, але без жодного `lastmod` (зміна формату).
- **Observability у `scrape_runs.metadata`** (Json, без міграції enum): `mode`,
  `sitemapTotal`, `unchangedSkipped`, `toFetch`, `vanishedFromSitemap`.
- **Метрики ефективності** (incremental-прогони, metadata + підсумковий лог):
  `savedFetches = sitemapTotal − toFetch`, `savedPercent`, `estimatedSavedTimeMs =
  savedFetches × (avgFetchMs + delayMs)`, де `avgFetchMs` — фактична середня тривалість фетчів
  цього прогону. Видимий доказ виграшу і базис для рішення про подальші оптимізації
  (напр. concurrency pool).

---

## 6. Reusable механізм: модуль `packages/scrapers/src/sitemap/`

- `parseSitemapEntries(xml) → {loc, lastmod?}[]` — консолідує три майже ідентичні copy-paste
  парсери (`parseBookChefSitemap`, `parseLaboratorySitemap`, `parseKnigolandSitemap`);
  нормалізація форматів lastmod: date-only (Laboratory `2026-06-26`) і RFC3339 з наносекундами
  (Knigoland). Підтримка flat `<urlset>` і sitemap-index із фільтром під-sitemap-ів (Knigoland).
- Чиста функція `planIncrementalFetch(entries, known) → {toFetch, unchangedCount}`.
- **Контракт** ([provider.ts](../../packages/shared/src/types/provider.ts)):
  `ScraperOptions.knownSourceLastmod?: ReadonlyMap<string, string>` — прецедент уже є:
  `skipDescriptionUrls` будується в
  [pipeline/run-scrape.ts](../../packages/api/src/pipeline/run-scrape.ts):64-81 з БД і
  передається у `scrape()`. Listings отримують `sourceLastmod`; якщо day-0 покаже
  `loc ≠ offers.url` — loc-keyed блок `sitemap?: {entries, fetched}` на `ScraperResult`.
- **Sitemap-фетчинг залишається у скраперах** (не в pipeline): переплетений з
  provider-специфічним HTTP (injectable `HtmlFetcher`, `classifyBlockedPage` на сам
  sitemap-респонс, топологія flat/index). Pipeline лише постачає known-state на вході і зберігає
  стан на виході. Скрапери лишаються DB-free.
- Черговість адопції: **BookChef у v1**; Laboratory — наступний кандидат (date-only lastmod →
  day-рівень diff, все одно корисно); Knigoland — **спочатку жива валідація** (fixtures
  натякають на generation-time lastmod → може бути марний). У v1 Laboratory/Knigoland не чіпати.

---

## 7. Shadow-валідація incremental vs full (вбудований механізм)

- Кожен FULL-прогін (за наявності state) спершу обчислює incremental-план по pre-run снепшоту
  state (`planIncrementalFetch`), утримує його, виконує повний scrape як зараз, після
  персистенції порівнює: множина listings з реально зафіксованими price/availability-змінами
  (`recordPriceChange` цього прогону) vs предиктнута `toFetch`.
- Результат у `scrape_runs.metadata`:
  `validation: {predictedCount, actualChangedCount, missedUrls[], recall, precision}`.
  Непорожній `missedUrls` → warning у refresh-health.
- **Дві метрики з різними ролями:**
  - `recall` = |predicted ∩ actualChanged| / |actualChanged| — **метрика безпеки**, gate
    перемикання (**≥99%**): lastmod не пропускає цінові зміни.
  - `precision` = |predicted ∩ actualChanged| / |predicted| — **метрика ефективності**, перехід
    не блокує. Інтерпретація обережна: predicted-без-price-зміни може бути реальною
    metadata/description-зміною, невидимою у `price_history`. Орієнтири: 20–30% — уже величезний
    виграш; одиниці % — сигнал generation-time lastmod → incremental втрачає сенс.
- **Health warning `low-lastmod-precision`**: precision останнього FULL-прогону з
  validation-даними < порога (env, default **5%**; 5–10% — зона уваги). Guard-и: лише
  FULL-прогони з validation і вибіркою `predictedCount ≥ ~100`, лише після shadow-тижня.
  Реакція: повернути провайдера на full-режим.
- **Тиждень 1 після деплою: cron лишається на daily FULL** (поведінка прод не змінюється),
  валідація збирає recall щодня. Перемикання на incremental — при recall ≥99% за 7 днів.
- Після переходу механізм не вимикається: **кожен weekly full — permanent self-audit** довіри
  до lastmod; зміна семантики lastmod на боці BookChef проявиться у метриках і health-warning,
  а не мовчазною втратою цінових змін.
- Обмеження: description-only зміни через `price_history` не ловляться — прийнятно (пріоритет
  ціна/наявність; description реконсилюється weekly full). Поодинокі misses можуть бути
  артефактами transient-збоїв — розслідувати, не панікувати.

---

## 8. Day-0 gate: `offers.url ≡ <loc>`

Перед стартом реалізації (~1 год): порівняти JSON-LD `offers.url` із sitemap `<loc>` на ~20
товарах BookChef. Визначає ключування контракту:
- збігаються (ймовірно) → усе ключується одним URL, listings просто отримують `sourceLastmod`;
- різняться → скрапер повертає loc-keyed mapping `loc → listingUrl`
  (блок `sitemap?: {entries, fetched}` на `ScraperResult`) — інакше транзакційне зшивання
  watermark⇔persist неможливе.

> **Результат (2026-07-13): PASSED — 16/16 точних збігів** на рівномірній вибірці sitemap.
> Контракт ключується одним URL; loc-keyed mapping не потрібен. `ScraperResult` усе ж несе
> блок `sitemap.entries` — не для mapping-у, а для presence-апдейту і shadow-валідації
> (pipeline потребує повний список `{url, lastmod}` незалежно від ключування).

---

## 9. Deactivation зниклих URL — свідомо поза scope

Сьогодні full scrape теж ніколи не деактивує зниклі URL (ходить лише по sitemap) — регресії
немає. v1 лише збирає `last_seen_in_sitemap_at` + логує vanished-count → follow-up policy
обговорюється з даними, не спекуляціями.

---

## 10. План реалізації (~3 дні + тиждень shadow-валідації)

| День | Обсяг |
|---|---|
| Day 0 | Перевірка `loc ≡ offers.url` (гейт для контракту, §8) |
| Day 1 | Контракт у shared; модуль `scrapers/src/sitemap/` + unit-тести; Prisma-міграція `provider_scrape_state` |
| Day 2 | Адопція у `BookChefScraper`; wiring у pipeline/run-scrape.ts (load map → pass → watermark у per-listing транзакції + батчевий presence); фікс refresh-health.ts |
| Day 3 | CLI `--mode` + shadow-валідація (recall/precision + health-warnings: missed-changes, low-lastmod-precision) + метрики ефективності + TTL-sweep + Railway cron entries + docs |
| Тиждень 1 | Прод: daily FULL із shadow-валідацією → при recall ≥99% перемкнути cron на incremental (12h) + weekly full |

Тести за правилами repo: unit для sitemap-модуля і планувальника (чисті функції), integration
для pipeline-wiring і health-check, coverage нових модулів ≥ 80%, детерміновані (lastmod у
фікстурах, mock часу).

---

## 11. Що НЕ реалізовуємо

- Conditional GET / ETag (BookChef не віддає), RSS / API (не існують).
- Auto-deactivation зниклих listings (окремий follow-up з даними, §9).
- Scheduler у repo (окремий відомий P0 gap, не тут).
- Міграцію Laboratory/Knigoland на incremental у v1.
- `fetch_status` колонку, per-URL fetch-log таблицю, snapshot-blob.
- Concurrency pool для BookChef — корисно, але severable: serial 500ms по ~500 URL ≈ 4 хв;
  навіть bulk-touch 11.7k ≈ 2 год — у межах сьогоднішнього envelope.

---

## 12. Ризики та мітигації

| Ризик | Мітигація |
|---|---|
| lastmod пропускає promo-ціни (окремі таблиці Laravel, що не торкають `updated_at`) | shadow-валідація: тиждень daily-FULL з recall-метрикою перед перемиканням + permanent self-audit на кожному weekly full |
| bulk-touch день (спостережено 11.7k URL 2026-06-23) → incremental ≈ full | прийнятна деградація; watermark-модель авто-догоняє при перериванні |
| Зміна формату sitemap (зник lastmod) | fail-open у full-режим |
| Weekly cron мовчки зламався | auto-full, якщо останній FULL старший ~10 днів |
| stale-listings false alarm під incremental | фікс health-check у v1: `max(lastSeenAt, last_seen_in_sitemap_at)` |
| lastmod деградує до generation-time | health warning `low-lastmod-precision` (<5%) → повернення на full |
