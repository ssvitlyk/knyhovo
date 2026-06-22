# PRD: W10 Refresh Architecture (scrape scheduling + run tracking)

> Статус: **Чорновик — очікує затвердження.** Технологічний стек: **Fastify** + **Prisma/PostgreSQL** +
> наявні скрапери (`packages/scrapers`). W10 — це **інфраструктурний шар оновлення даних** поверх уже
> реалізованого provider-agnostic пайплайну скрапу. Канонічний matching, правила персистентності та скрапери
> **не переписуються** — W10 будує навколо них планування, ізоляцію, трекінг прогонів і пріоритетний
> wishlist-refresh.
>
> **Правило вирішення конфліктів:** коли цей PRD суперечить попереднім обговоренням — перемагає PRD щодо
> **scope**. Перевага меншому scope, мінімуму нового коду, graceful degradation і перевикористанню наявних
> модулів. Реальний транспорт email — **поза scope** цього PRD.

---

## 1. Overview

Knyhovo має робочий Discovery W9a (обкладинки, описи, Author Shelf, wishlist-обкладинки, price history,
price alerts), але **немає інфраструктури оновлення даних**:

- Скрап запускається лише вручну: `pnpm --filter @knyhovo/api scrape`
  (`packages/api/src/scripts/run-scrape.ts`).
- Немає аудиту прогонів — метрики живуть лише в пам'яті (`packages/api/src/pipeline/types.ts`,
  `ScrapeMetrics`).
- Немає окремого, частішого шляху оновлення для книг у wishlist / з активними алертами.
- **Alert trigger engine та email не реалізовані** — є лише `ConsoleMailer`
  (`packages/api/src/auth/mailer.ts`); статуси `TRIGGERED`/`UNAVAILABLE` деривуються на читанні
  (`packages/api/src/wishlist/alert/service.ts`, `deriveAlertStatus`).
- UI у 5+ місцях обіцяє «щодня о 08:00» / «оновлюємо ціни щодня» — claim **наразі неправдивий**.

**Мета:** надійна архітектура оновлення даних книгарень — повний catalog refresh, пріоритетний
wishlist/alert refresh, ізоляція провайдерів, трекінг прогонів, безпечні правила перезапису, готовність до
cron-деплою. Кінцевий результат робить claim «щодня» правдивим.

### Підтверджені рішення
- **Cron-платформа MVP:** Railway cron-сервіс, що запускає one-shot refresh-команду. Конфіг лише
  описуємо; імплементація — W10.6.
- **Обсяг алертів у W10:** детекція подій + модель дедуплікації. Реальний транспорт email (Resend) — поза
  scope.
- **Homepage claim:** архітектура має зробити «щодня» правдивим; до запуску cron — пом'якшити формулювання.

---

## 2. Goals

- **Регулярність.** Повний catalog refresh 1–2×/добу на провайдера; wishlist refresh кожні 2–4 год.
- **Ізоляція.** Падіння одного провайдера не валить решту прогону.
- **Прозорість.** Кожен прогон фіксується рядком `scrape_runs` з лічильниками та per-provider health.
- **Пріоритет wishlist.** Книги у wishlist / з активним alert оновлюються частіше й точково (без краулу
  каталогу), з детекцією подій ціни/наявності.
- **Безпека даних.** Документовані й підтверджені правила перезапису; жодного видалення listing через один
  пропущений скрап.
- **Готовність до cron.** Стейтлес one-shot команди, придатні для зовнішнього планувальника.

### Non-goals
- Реальний email-транспорт, HTML-шаблони, retry відправки.
- Admin UI/дашборд (лише API-основа у W10.5).
- Фактичний деплой Railway / Dockerfile (опис у W10.6).
- Зміни canonical matching, нові провайдери, зміни правил persist-listing.
- Description enrichment у звичайному refresh (лишається окремим opt-in).

---

## 3. Architecture

Принцип: **один refresh = одна команда = один рядок `scrape_runs`**. Зовнішній планувальник (Railway cron)
лише запускає команду; вся логіка, ізоляція й трекінг — у `packages/api`.

### Дві сутності прогону
1. **Full catalog refresh** (`FULL_CATALOG`) — обходить каталог кожного провайдера
   (`scraper.scrape({ maxPages, timeoutMs, delayMs })`), як зараз. Description enrichment **вимкнено**.
2. **Wishlist refresh** (`WISHLIST_REFRESH`) — НЕ краулить каталог. Бере відомі `provider_listings.url`
   для книг у wishlist / з активним alert і пере-фетчить кожну product-сторінку точково. Детектує
   price-drop / back-in-stock / out-of-stock / зниклий listing і пише події алертів.

Обидві проходять через спільний шар персистентності (`packages/api/src/pipeline/persist-listing.ts`) —
правила перезапису однакові.

### Provider isolation
Кожен провайдер — в окремому try/catch (як уже в `run-scrape.ts`). Падіння одного → `PARTIAL` для прогону,
решта довершує роботу. Кожен провайдер отримує власний `scrape_runs`-запис (per-provider granularity).

### Module boundaries (нове)
```
packages/api/src/
  refresh/
    scrape-run.repository.ts   # CRUD scrape_runs: start(), finishSuccess/Partial/Failed(), latestHealth()
    full-catalog.refresh.ts    # orchestrate FULL_CATALOG per provider (обгортка над runScrapePipeline)
    wishlist.refresh.ts        # збирає target URLs, точково пере-фетчить, детектує події
    refresh-targets.ts         # запит: які (provider,url) у wishlist/active-alert scope
    events.ts                  # типи AlertEvent (price-drop/back-in-stock/out-of-stock/listing-gone)
  scripts/
    run-scrape.ts              # → тонкий CLI для FULL_CATALOG
    run-wishlist-refresh.ts    # новий CLI для WISHLIST_REFRESH
  pipeline/                    # БЕЗ ЗМІН логіки; додаємо лічильники у ScrapeMetrics
```
Точкова пере-фетч одного listing перевикористовує наявні скрапери: парсери product-сторінок уже є
(`extractYakabooProductDescription` тощо) і fetcher-абстракцію `HtmlFetcher`. Можливо знадобиться маленький
публічний метод «спарсити одну product-сторінку в `RawProviderListing`» — уточнюється у W10.3.

---

## 4. DB Changes

Один новий enum-набір + одна таблиця у `packages/api/prisma/schema.prisma` (Prisma migrate).

### `scrape_runs`
```prisma
model ScrapeRun {
  id                   String          @id @default(uuid())
  provider             Provider                            // per-provider granularity
  kind                 ScrapeRunKind                       // FULL_CATALOG | WISHLIST_REFRESH | MANUAL | DESCRIPTION_ENRICHMENT
  status               ScrapeRunStatus @default(RUNNING)   // RUNNING | SUCCESS | PARTIAL | FAILED
  startedAt            DateTime        @map("started_at")
  finishedAt           DateTime?       @map("finished_at")
  durationMs           Int?            @map("duration_ms")
  itemsFound           Int             @default(0) @map("items_found")
  itemsUpdated         Int             @default(0) @map("items_updated")
  priceChanges         Int             @default(0) @map("price_changes")
  availabilityChanges  Int             @default(0) @map("availability_changes")
  errorsCount          Int             @default(0) @map("errors_count")
  errorSummary         String?         @map("error_summary")   // truncated, перші N помилок
  metadata             Json?                                   // maxPages, timeoutMs, delayMs, targetCount
  @@index([provider, kind, startedAt])
  @@map("scrape_runs")
}
```
**Per-provider latest health** — не нова таблиця, а запит «останній `ScrapeRun` на `(provider, kind)` за
`startedAt`», інкапсульований у `latestHealth()`.

### Дедуплікація алертів (W10.4) — поля на `alerts`, без нової таблиці
```prisma
// додати до моделі Alert:
lastNotifiedAt          DateTime? @map("last_notified_at")
lastNotifiedPriceAmount Int?      @map("last_notified_price_amount")
```
Правило: подія варта сповіщення, якщо ціль досягнута **і** (`lastNotifiedAt is null` **або** поточна
найнижча ціна < `lastNotifiedPriceAmount`). Скидати маркер при виході ціни вище цілі. Email-транспорт поза
scope; W10.4 лише фіксує настання події й оновлює маркер.

**Жодних змін** до `provider_listings` чи `price_history`.

---

## 5. Safe Persistence Rules (підтверджуємо, не змінюємо)

Усе реалізовано в `persist-listing.ts` / `price-history/service.ts`:

| Правило | Місце |
|---|---|
| price оновлюється | `updateData.priceAmount` |
| null price = out-of-stock, НЕ видалення | `markUnavailable()` (лише `availability`+`lastSeenAt`) |
| coverUrl ніколи не затирається null/empty | `if (listing.coverUrl != null && !== '')` |
| description «latest non-empty wins» | `if (listing.description != null && !== '')` |
| ISBN fill-first | `if (existing.isbn === null && ...)` |
| price_history append-only, лише при зміні | `shouldCreateSnapshot()` |
| listing не видаляється через 1 пропуск | upsert нічого не видаляє |

**Stale / availability transitions (нове, лише у wishlist refresh):**
- `lastSeenAt` уже оновлюється щоразу → stale-сигнал обчислюється у застосунку (`now - lastSeenAt`); **без**
  окремого TTL-стовпця.
- Transition matrix → чи писати alert-подію:
  - price A → price B<A та доступний → `price-drop`
  - OUT_OF_STOCK → IN_STOCK → `back-in-stock`
  - IN_STOCK → OUT_OF_STOCK → `out-of-stock`
  - listing 404 / fetch fail → **не змінюємо** price/availability (graceful); не бачено > X днів →
    `listing-stale` (лише сигнал, без видалення).

---

## 6. Scheduling (MVP)

| Job | Частота | Команда |
|---|---|---|
| Full catalog | 1–2×/добу на провайдера (напр. 06:00, опц. 18:00) | `pnpm --filter @knyhovo/api scrape` |
| Wishlist refresh | кожні 2–4 год | `pnpm --filter @knyhovo/api scrape:wishlist` (новий) |
| Description enrichment | окремий opt-in/manual/staged | команда з `enrichDescriptions: true` |
| Manual/admin refresh | пізніше (W10.5) | API endpoint → `MANUAL` run |

**Railway cron (W10.6):** окремий Railway cron-сервіс з тим самим образом API виконує команду за cron-виразом.
Env/secrets — через Railway env vars (security.md). GitHub Actions schedule відхилено (ненадійний час,
secrets з CI).

---

## 7. Operational Safety

- **Rate limits / Cloudflare:** зберігаємо per-provider дефолти (`delayMs`, `timeoutMs`; BookYe → Playwright
  + content-wait, 30s/1000ms). Wishlist refresh точкових сторінок ОБОВ'ЯЗКОВО з `delayMs`-throttle.
- **Без retry-loop за замовчуванням** (security.md + W9 PRD): «errors collected, not thrown».
- **Stop on 429/503 per provider:** перевикористати `isRateLimited()` — зупиняємо саме цього провайдера,
  фіксуємо `PARTIAL`, решта продовжує.
- **Partial success:** ≥1 провайдер-помилка + ≥1 успіх → `PARTIAL` (не `FAILED`).
- **No concurrent run of same provider:** перед стартом перевіряти відсутність свіжого `RUNNING`-запису для
  `(provider, kind)`; якщо є — пропустити з логом (cron-overlap guard).
- **Observability:** кожен прогон → рядок `scrape_runs` + `errorSummary`; `latestHealth()` — основа для
  W10.5.

---

## 8. User-Facing Claim

- **До W10.6:** пом'якшити UI-формулювання (напр. «Регулярно оновлюємо ціни в книгарнях», без конкретного
  часу).
- **Після W10.6:** повернути «щодня о 08:00», вирівнявши з фактичним cron-розкладом.
- Фраза про «напишемо на пошту» (`AlertConfig.tsx`) — обіцянка-аванс, доки email-транспорт (поза scope) не
  зроблено: прибрати згадку email до релізу транспорту або позначити «незабаром».

---

## 9. Implementation Phases

| PR | Обсяг | Залежності |
|---|---|---|
| **W10.0** | Цей PRD; затвердження | — |
| **W10.1** | `scrape_runs` schema + міграція + `scrape-run.repository.ts` + запис прогону у `run-scrape.ts`; розширити `ScrapeMetrics` → поля `scrape_runs` | W10.0 |
| **W10.2** | `full-catalog.refresh.ts` — provider-isolated orchestration: per-provider run-record, stop-on-429/503, PARTIAL, concurrency-guard; enrichment off | W10.1 |
| **W10.3** | `wishlist.refresh.ts` + `refresh-targets.ts` + `run-wishlist-refresh.ts` + (за потреби) скрейпер single-page parse; transition matrix → `AlertEvent[]` | W10.1, W10.2 |
| **W10.4** | Тригери алертів: дедуп-поля на `alerts`, правило «варта сповіщення», запис події + маркер. **Без email** | W10.3 |
| **W10.5** | (пізніше) Admin/manual: endpoint `MANUAL` refresh + read-only health на базі `latestHealth()` | W10.1 |
| **W10.6** | (пізніше) Railway cron + Dockerfile/деплой + повернення точного UI-claim | W10.2, W10.3 |

---

## 10. Risks

- **Wishlist пере-фетч навантажує product-сторінки** (особливо Cloudflare-BookYe) → throttle, обмежити
  batch, stop-on-429.
- **Concurrency / cron overlap** → guard через `RUNNING`-стан обов'язковий.
- **Дедуп алертів:** надто агресивний → пропущені сповіщення; слабкий → спам. Покрити тестами на повторних
  прогонах.
- **Скрейпер single-page parse** може бути не публічним для всіх 3 провайдерів → перевірити у W10.3,
  мінімізувати зміни у `packages/scrapers`.
- **Selector drift** (W9a F2 селектори припускалися) → wishlist refresh деградує gracefully, не затираючи
  дані при невдалому парсі.

---

## 11. Tests (coverage нових модулів ≥ 80%, детерміновані)

- **Unit:** `scrape-run.repository` (start/finish/PARTIAL/latestHealth); `refresh-targets` (scope);
  transition matrix; дедуп-правило на серії прогонів.
- **Integration:** `FULL_CATALOG` з мок-провайдером, один падає → `PARTIAL`, решта персистяться, кожен має
  рядок; `WISHLIST_REFRESH` з мок-fetcher (нижча ціна) → price_history snapshot + AlertEvent.
- **Concurrency guard:** другий старт при `RUNNING` пропускається.
- **Persistence-регресія:** null cover/description/price НЕ затирають наявні значення.
- Час/рандом — лише через інжектований clock/мок (testing.md).

---

## 12. Verification

- `pnpm typecheck && pnpm lint && pnpm test` зелені.
- Після W10.1: `pnpm --filter @knyhovo/api scrape` локально (Node 22; БД через docker-compose) → рядок у
  `scrape_runs` з коректними лічильниками й `SUCCESS`/`PARTIAL`.
- Після W10.3: `scrape:wishlist` з тестовою wishlist-книгою та мок-нижчою ціною → новий price_history
  snapshot + зафіксована alert-подія.
- Concurrency-guard: дворазовий запуск підряд → другий пропускається з логом.
