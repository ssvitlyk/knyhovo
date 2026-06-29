# PRD: Wishlist

> Статус: Затверджено.
> Wishlist — окрема продуктова фіча. W0–W4a реалізовано; W4b (Alerts Engine) — затверджено до реалізації.

## Business Goals

- Утримати користувача після першого пошуку через персональний wishlist
- Конвертувати пасивного відвідувача в активного через price alert
- Wishlist як самостійний модуль із власним циклом розвитку

## Що робимо (MVP)

- Анонімний wishlist через localStorage (до входу)
- Реєстрація та вхід через **Email Magic Link** (Resend)
- Після входу — merge localStorage wishlist → account wishlist
- Встановлення цільової ціни для кожної книги у wishlist
- Email-сповіщення (Resend) при падінні ціни ≤ цільової

## Що НЕ робимо (в MVP)

- Email + password авторизація
- Google OAuth або інші провайдери
- Публічні / спільні wishlist
- Рекомендації, сповіщення про нові книги автора
- Імпорт існуючих списків
- Соціальні функції

## Декомпозиція

| Крок | Опис | Примітка |
|------|------|----------|
| **W0: Auth Decision** | Визначити auth бібліотеку, механізм merge | **Блокер для W1–W3** |
| W1: Domain model | `WishlistItem` (userId, bookId, targetPrice, createdAt) | Після W0 |
| W2: API | CRUD wishlist endpoints | Після W1 |
| W3: UI | Сторінка wishlist, кнопка "Додати", редагування ціни | Після W2 |
| W4a: Alert model + API | `Alert` (intent, targetPrice), CRUD endpoints, read-time derive | ✅ Реалізовано |
| W4b: Alerts Engine | Outbox + email delivery (Resend), back-in-stock, safety | Затверджено (нижче) |

## Auth — зафіксовані рішення (W0)

- **MVP Auth: Email Magic Link** через Resend
- Email + password — **не в MVP**
- Google OAuth — **не в MVP**
- Анонімний wishlist зберігається у **localStorage**
- Після Magic Link login — **merge** localStorage → account wishlist
- Детальна реалізація merge описується при старті W0, не реалізується зараз

## Acceptance Criteria

**W0 (gate — без цього W1–W3 не починаються)**
- Обрано auth бібліотеку
- Визначено механізм merge localStorage → account
- Merge сценарій покритий тестами перед релізом

**W1 Domain**
- `WishlistItem`: userId, bookId, targetPrice (nullable), createdAt
- Один користувач — один wishlist у MVP
- Книга може бути у wishlist без targetPrice

**W2 API**
- `GET /wishlist` → wishlist з актуальними цінами
- `POST /wishlist` → додати книгу
- `DELETE /wishlist/:bookId` → видалити
- `PATCH /wishlist/:bookId` → оновити targetPrice

**W3 UI**
- Кнопка "Додати до wishlist" на сторінці книги
- Wishlist показує поточну ціну і targetPrice поряд
- Візуальна позначка коли поточна ціна ≤ targetPrice

**W4a Alerts (реалізовано)**
- `Alert` per wishlist item: `intent`, `targetPriceAmount`, dedup-маркери
- CRUD: `PUT/PATCH/DELETE /api/wishlist/:bookId/alert`
- Read-time `deriveAlertStatus` (active/paused/triggered/unavailable)
- Детекція подій та dedup-логіка (`refresh/events.ts`, `refresh/alert-dedup.ts`)

## W4b: Alerts Engine (затверджено)

> Реалізує доставку email поверх наявного W4a. Деталі стану — `agent_docs/alert-engine.md`.

### Trigger scope (v1)
- **Price-drop**: найнижча in-stock ціна книги `≤ targetPriceAmount` (intent `custom-price`/`favourable-price`).
- **Back-in-stock**: окремий тип сповіщення з власним dedup-ключем — один email на перехід `OUT_OF_STOCK → IN_STOCK`; re-arm лише після повторного спостереження `OUT_OF_STOCK`.
- **OUT (v2)**: «новий дешевший провайдер», digest, intent-и `any-drop`/`below-current`.

### Архітектура (instant per-refresh, outbox)
Інтеграція у наявний `WISHLIST_REFRESH` run (без окремого cron):
1. **Detect + persist** — без змін.
2. **Enqueue** (рефактор `alert-notify.ts`): оцінка dedup → `INSERT notification_deliveries (PENDING)`, idempotent через `dedupKey @unique`. Маркери `Alert` тут **не** оновлюються.
3. **Dispatch** (inline): читає `PENDING` → render → Resend send. Успіх → `SENT` + оновлення dedup-маркера `Alert` + `providerMessageId`; збій → `FAILED` + `attempts++` + `lastError`.

Принцип: маркер = «успішно надіслано», не «вирішено надіслати» → немає втрати/дубля листа, є retry + audit.

### Дані (мінімальні зміни Prisma)
- **`notification_deliveries`** (outbox): `alertId`, `userId`, `canonicalBookId`, `type` (`PRICE_DROP`|`BACK_IN_STOCK`), `status` (`PENDING`|`SENT`|`FAILED`|`SKIPPED`), `triggerPriceAmount?`, `dedupKey @unique`, `attempts`, `lastError?`, `providerMessageId?`, `createdAt`/`sentAt?`/`updatedAt`; індекси `(status, createdAt)`, `(userId, createdAt)`.
  - `dedupKey`: price-drop → `<alertId>:price:<lowestPriceAmount>`; back-in-stock → `<alertId>:stock:<stockCycleToken>`.
- **`Alert`**: додати `lastStockNotifiedAt?`, `lastNotifiedAvailability?` (back-in-stock dedup). Існуючі price-маркери оновлюються тепер у dispatch-фазі.
- **Notification preferences** — поля на `User`: `priceDropEnabled`, `backInStockEnabled` (default true), `unsubscribeToken @unique`, `unsubscribedAt?`.
- **`notification_deliveries`** додатково: `nextAttemptAt DateTime?` — час, до якого доставка не береться у retry.

### Email
- Resend SDK; розширення `Mailer` (`sendAlertEmail`); реалізації `ResendMailer` (prod), `ConsoleMailer` (dev, без ключа), `FakeMailer` (тести).
- Типізовані шаблони → `{ subject, html, text }`; v1: price-drop (назва, нова найнижча ціна, target, провайдер, лінк) + back-in-stock.

### Safety (фінальні значення; env-override)
- **Idempotency**: `dedupKey @unique`.
- **Cooldown**: **24 год** на повтор **однакової події** (`ALERT_COOLDOWN_HOURS=24`). Price-drop додатково шлеться на строго нижчу ціну; back-in-stock — лише на новий перехід OUT→IN.
- **Rate limit**: **20** email/user/добу (`ALERT_MAX_EMAILS_PER_DAY=20`) — через індекс `(userId, createdAt)`.
- **Retry**: cap **3** спроби, backoff **1m → 5m → 30m** (`nextAttemptAt`). 5xx/network — retry, 4xx — `SKIPPED`.
  - _Каденція v1_: dispatch працює всередині `WISHLIST_REFRESH` (кожні 2–4 год), тому `nextAttemptAt` лише гарантує «не раніше» — фактичний retry відбувається на наступному run. Backoff-значення стають точними, якщо пізніше додамо частіший dispatch-tick.
- **Unsubscribe**: `unsubscribeToken` + `List-Unsubscribe` header; one-click → глобальний opt-out (`unsubscribedAt`); prefs-сторінка → per-type тогли.

### W4b Acceptance Criteria
- Падіння найнижчої in-stock ціни ≤ target → рівно один email на досягнення (повторний — лише на строго нижчу ціну).
- Перехід OUT→IN → рівно один back-in-stock email; повтор не шлеться доки книга не вийшла знову з наявності.
- Повторний `WISHLIST_REFRESH` run **не** створює дубль доставки (idempotency).
- Збій Resend → доставка `FAILED`, маркер `Alert` **не** оновлено, retry наступним run до cap.
- Користувач з `unsubscribedAt` або вимкненим per-type прапорцем листа не отримує.
- Усі нові модулі покриті тестами ≥80%, детерміновані (фіксований `now`, `FakeMailer`).

## Майбутній розвиток (поза MVP)

- Публічні та приватні wishlist
- Спільні wishlist (сім'я, друзі)
- Рекомендації на основі wishlist
- Сповіщення про нові книги улюбленого автора
- Імпорт існуючих списків

## Відкриті питання

1. **Ліміт книг у wishlist** — 50 / 200 / без ліміту? (не блокує W4b)
2. **Resend FROM-домен** — `knyhovo.com`? Потрібна DNS-верифікація (ops-залежність до PR email-delivery). Env `ALERT_FROM_EMAIL`.

_Вирішено:_ auth = Email Magic Link (W0); prefs = поля на `User`; cooldown 24 год (однакова подія); rate limit 20/добу; retry 3 з backoff 1m/5m/30m; idempotency = outbox `dedupKey`.
