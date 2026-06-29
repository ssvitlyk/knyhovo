# Alert Engine

> Читай коли: зміни у логіці price alert, email-відправці, або додавання нового типу сповіщень.

## Стан реалізації

### W4a (реалізовано) — Persistence + API + Read-time derivation

W4a постачає:
- Схема БД: таблиця `alerts` + enums `alert_status`, `alert_intent` (Prisma schema).
- REST API для управління алертами: `PUT/PATCH/DELETE /api/wishlist/:bookId/alert`.
- Алерт додається до відповіді `GET /api/wishlist` як поле `alert` у кожному `WishlistItemDto`.
- **Статус виводиться (derive) при читанні** (`packages/api/src/wishlist/alert/service.ts#deriveAlertStatus`) — не записується у БД.
- `TRIGGERED` та `UNAVAILABLE` у Prisma enum зарезервовані; у W4a вони ніколи не записуються.

### W4b — Alerts Engine (затверджено, в реалізації)

> Повний дизайн: `docs/prd/wishlist.md` → секція «W4b: Alerts Engine».

Уже реалізовано (W10.3/W10.4): детекція подій (`refresh/events.ts`), чистий dedup
(`refresh/alert-dedup.ts`), оркестрація (`refresh/alert-notify.ts`, наразі оновлює
маркери inline і **не** шле email).

**Затверджений підхід — instant per-refresh + outbox** (інтеграція у наявний
`WISHLIST_REFRESH` run, без окремого cron):

1. **Enqueue** (рефактор `alert-notify.ts`): оцінка dedup для price-drop + back-in-stock
   → `INSERT notification_deliveries (PENDING)`, idempotent через `dedupKey @unique`.
   Маркери `Alert` тут **не** оновлюються.
2. **Dispatch** (inline, новий): `PENDING` → render → Resend send. Успіх → `SENT` +
   оновлення dedup-маркера `Alert` + `providerMessageId`; збій → `FAILED` + `attempts++`.

Принцип: маркер = «успішно надіслано», не «вирішено надіслати».
**Критично**: прибрати оновлення маркера з enqueue-фази ([alert-notify.ts:74](../packages/api/src/refresh/alert-notify.ts#L74)) — інакше збій email втрачає лист.

**Scope v1**: price-drop (`lowestPrice ≤ targetPriceAmount`) + back-in-stock (окремий тип,
один email на перехід OUT→IN, re-arm після повторного OUT). OUT: новий дешевший провайдер,
digest, intent-и `any-drop`/`below-current` — v2.

Чеклист реалізації:
- [x] PR1: `notification_deliveries` + enums, маркери back-in-stock на `Alert`, prefs + `unsubscribeToken`, міграція, repository.
- [x] PR2: рефактор `alert-notify.ts` → enqueue; back-in-stock dedup (окремий ключ); unit-тести.
      Back-in-stock детекція — через rising-edge маркер `last_notified_availability` (перша поява книги не шле alert). dedupKey price-drop=`<alertId>:price:<lowest>`, back-in-stock=`<alertId>:stock:<run ISO>`. Маркер price оновлюється лише у dispatch (PR3).
- [x] PR3: `AlertMailer` порт (`alerts/mailer.ts`: Console/Resend-адаптер/Fake), шаблони (`alerts/templates.ts`), dispatch (`alerts/dispatch.ts`) + retry/backoff + rate-limit + unsubscribe-гейт. ResendAlertMailer бере мінімальний ін'єктований клієнт (без імпорту `resend` у src — конструювання у PR4).
- [x] PR4: dispatch wired у `wishlist.refresh.ts` (instant, ін'єктований порт `dispatch`), mailer-factory (`alerts/mailer-factory.ts` — єдиний імпорт `resend`), config (`alerts/config.ts`), CLI `run-wishlist-refresh.ts`. Summary у логах/результаті; Prometheus email-лічильники — follow-up (наразі /metrics scrape_runs-derived).
- [x] PR5a: API — `GET /api/notifications/unsubscribe` (public, one-click), `GET/PATCH /api/notifications/preferences` (auth), модуль `notifications/` + тести.
- [ ] PR5b: web-UI — сторінка налаштувань сповіщень + per-alert back-in-stock тогл.

### Env (W4b)

| Env | Опис | Default |
|-----|------|---------|
| `RESEND_API_KEY` | ключ Resend; без нього — ConsoleAlertMailer (нічого не шле) | — |
| `ALERT_FROM_EMAIL` | From-адреса | `Knyhovo <alerts@knyhovo.com>` |
| `ALERT_BASE_URL` | база для лінків (книга + unsubscribe) | `https://knyhovo.com` |
| `ALERT_MAX_EMAILS_PER_DAY` | rate-limit на користувача (rolling 24h) | `20` |

Safety: cooldown 24 год (однакова подія), rate limit 20/добу, retry cap 3 з backoff
1m/5m/30m через `nextAttemptAt` (5xx/network — retry, 4xx — `SKIPPED`),
unsubscribe через токен + `List-Unsubscribe`. Prefs — поля на `User`.

---

## Архітектура алертів (W4a)

### Моделі

- **Alert** — один per wishlist item (`@unique wishlist_item_id`). Каскадно видаляється разом з `WishlistItem`.
- Власник порогу ціни — `alerts.target_price_amount` / `target_price_currency`.
- `wishlist_items.target_price_amount/currency` — **deprecated**, збережені для зворотної сумісності, не використовуються логікою W4+.

### AlertIntent

| Slug | Опис |
|------|------|
| `any-drop` | Будь-яке зниження ціни |
| `below-current` | Ціна нижча за поточну |
| `favourable-price` | Сприятлива ціна (алгоритм — TBD) |
| `custom-price` | Користувацький поріг (`targetPriceAmount`) |

### Derivation логіка (read-time)

```
deriveAlertStatus(persisted, lowestPrice, offersCount):
  1. persisted.status === 'PAUSED'                          → 'paused'
  2. offersCount === 0                                      → 'unavailable'
  3. lowestPrice != null && lowestPrice.amount ≤ target     → 'triggered'
  4. else                                                   → 'active'
```

Реалізація: `packages/api/src/wishlist/alert/service.ts#deriveAlertStatus`.
Тести: `packages/api/src/wishlist/alert/__tests__/service.test.ts`.

### Модулі

| Файл | Відповідальність |
|------|-----------------|
| `wishlist/alert/dto.ts` | AlertDto, re-export AlertStatus/AlertIntent з shared |
| `wishlist/alert/repository.ts` | WishlistAlertRow, findWishlistItemId, upsertAlert, setAlertStatus, deleteAlert |
| `wishlist/alert/service.ts` | deriveAlertStatus (pure), setAlert, setAlertPaused, removeAlert |
| `wishlist/alert/schema.ts` | parseSetAlertBody, parsePauseAlertBody, parseAlertParams (reuse) |
| `wishlist/alert/route.ts` | registerWishlistAlertRoute (PUT/PATCH/DELETE) |

## Email провайдер

**Resend** — планується для:
- Magic Link (авторизація) — вже реалізовано
- Price alert (сповіщення про зниження ціни) — майбутнє (W4b+)
