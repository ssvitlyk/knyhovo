# Alert Engine

> Читай коли: зміни у логіці price alert, email-відправці, або додавання нового типу сповіщень.

## Стан реалізації

> **Модель сповіщень v2 (`docs/prd/notifications-model-v2.md`) — чинна.** Цей файл
> описує реалізацію; продуктові рішення й контракт — у PRD. Записи нижче про
> `deriveAlertStatus`, `alert_intent` та чотири режими стосуються **старої** моделі
> й лишені лише як історія.

### Що змінилось у v2

| Було | Стало |
|------|-------|
| 4 режими (`any-drop`, `below-current`, `favourable-price`, `custom-price`) | 3 режими (`any-drop`, `good-price`, `my-price`); `below-current` злився в `any-drop` |
| `intent` — write-only лейбл, рушій його не читав | `mode` — селектор резолвера; рушій працює лише з **AlertPolicy** |
| поріг присилав клієнт, API приймав будь-яке число | поріг рахує **сервер**; `threshold` у тілі дозволений лише для `my-price` |
| статус = порівняння `lowestPrice <= target` при читанні | стан = **факт**: `paused` / `unavailable` / `reached` (є маркер листа) / `armed` |
| три різні означення «найнижчої ціни» | одна канонічна ціна: `src/pricing/canonical-price.ts` |
| `PUT` віддавав `{ok:true}` | `PUT` віддає повний об'єкт сповіщення |

### AlertPolicy — єдиний словник рушія

`packages/api/src/wishlist/alert/policy.ts`:

| Поле | Сенс |
|------|------|
| `threshold` | ціна, досягнення якої є подією (копійки) |
| `baseline` | ціна, від якої міряється наступне зниження; `null` для статичних політик |
| `rearmPolicy` | `follow-down` (після листа поріг і база опускаються) \| `static` |
| `thresholdBasis` / `thresholdProof` | походження порогу + рядок-доказ для UI та листа |
| `lifecycle` | `active` \| `paused` — єдиний **збережений** стан |

**Резолвер** (`alert/resolver.ts`) — єдине місце, де режим стає поведінкою. Виконується
один раз, при create/update. Нижче за резолвер про режими не знає ніхто.

| Резолвер | threshold | baseline | rearm | порог значущості |
|----------|-----------|----------|-------|------------------|
| `any-drop` | канонічна ціна | те саме | `follow-down` | застосовується |
| `good-price` | формула (`alert/good-price.ts`) | — | `static` | ні |
| `my-price` | число користувача | — | `static` | ні |

`good-price` віддає `PENDING_CALIBRATION`, доки не завершене дослідження
(`docs/research/good-price-threshold-study.md`) — режим показується неактивним,
**без цифри**, і `PUT` віддає `409 INSUFFICIENT_HISTORY`. Заповнити формулу = змінити
один файл; API, DTO, рушій і UI лишаються як є.

### Стан (read-time)

`alert/service.ts#deriveAlertState` — **без жодного порівняння цін**:

```
1. lifecycle === 'paused'        → 'paused'
2. канонічної ціни немає         → 'unavailable'
3. lastNotifiedAt != null        → 'reached'   (ми справді написали)
4. інакше                        → 'armed'
```

Маркер пишеться лише диспетчером і лише після успішної відправки, а при заміні порогу
(`upsertAlert`) очищується — саме це робить `reached` твердженням «ми написали про
поточний поріг», а не результатом обчислення.

### Порог значущості зниження

Конфігурація, не константа продукту (PRD §4): `ALERT_MIN_DROP_ABS` (копійки) і
`ALERT_MIN_DROP_PCT` (%), обидва як **І**, кожен вимикається нулем. Дефолти —
`alerts/config.ts#DEFAULT_SIGNIFICANCE`, калібрування — те саме дослідження.
Застосовується лише до `follow-down` політик.

### Історія: W4a (реалізовано) — Persistence + API + Read-time derivation

- Схема БД: таблиця `alerts` + enums `alert_status`, `alert_intent`.
- REST API: `PUT/PATCH/DELETE /api/wishlist/:bookId/alert`.
- Алерт у відповіді `GET /api/wishlist` як поле `alert`.
- `deriveAlertStatus` виводив статус порівнянням цін — **замінено** на `deriveAlertState`.
- `TRIGGERED`/`UNAVAILABLE` в enum ніколи не записувались — у v2 значення прибрані міграцією.

### W4b — Alerts Engine (реалізовано 2026-06-29)

Живий ланцюг: Railway cron `0 5 * * *` UTC (`railway.scrape-wishlist.json`) →
`scrape:wishlist` → `run-wishlist-refresh.ts` → `runWishlistRefresh` →
`runAlertNotificationsForBooks` (enqueue в outbox) → `dispatchPendingDeliveries` (Resend).
Обидві фази non-fatal. **Каденс — раз на добу**, не «кожні 2–4 год»; `0 5 * * *` UTC —
це 08:00 за Києвом літом і 07:00 зимою, тому копірайт у UI — «щоранку».

Принцип: маркер = «успішно надіслано», не «вирішено надіслати».

**Scope**: price-drop (політика) + back-in-stock (окремий тип, один email на перехід
OUT→IN, re-arm після повторного OUT). Розсилка **не** фільтрує за режимом — усі три
режими надсилають листи однаково.

Чеклист W4b:
- [x] PR1: `notification_deliveries` + enums, маркери back-in-stock, prefs + `unsubscribeToken`.
- [x] PR2: `alert-notify.ts` → enqueue; back-in-stock dedup; unit-тести.
- [x] PR3: `AlertMailer` порт, шаблони, dispatch + retry/backoff + rate-limit + unsubscribe-гейт.
- [x] PR4: dispatch wired у `wishlist.refresh.ts`, mailer-factory, config, CLI.
- [x] PR5a: `GET /api/notifications/unsubscribe`, `GET/PATCH /api/notifications/preferences`.
- [ ] PR5b: web-UI — per-alert back-in-stock тогл.

### Env (W4b)

| Env | Опис | Default |
|-----|------|---------|
| `RESEND_API_KEY` | ключ Resend; без нього — ConsoleAlertMailer (нічого не шле) | — |
| `ALERT_FROM_EMAIL` | From-адреса | `Knyhovo <alerts@knyhovo.com>` |
| `ALERT_BASE_URL` | база для лінків (книга + unsubscribe) | `https://knyhovo.com` |
| `ALERT_MAX_EMAILS_PER_DAY` | rate-limit на користувача (rolling 24h) | `20` |
| `ALERT_MIN_DROP_ABS` | мінімальне зниження в копійках (`0` — вимкнено) | `1000` |
| `ALERT_MIN_DROP_PCT` | мінімальне зниження у % від бази (`0` — вимкнено) | `2` |

Safety: cooldown 24 год (однакова подія), rate limit 20/добу, retry cap 3 з backoff
1m/5m/30m через `nextAttemptAt` (5xx/network — retry, 4xx — `SKIPPED`),
unsubscribe через токен + `List-Unsubscribe`. Prefs — поля на `User`.

---

## Архітектура алертів (v2)

### Моделі

- **Alert** — один per wishlist item (`@unique wishlist_item_id`). Каскадно видаляється разом з `WishlistItem`.
- Власник порогу — `alerts.target_price_amount` / `target_price_currency`; політику доповнюють
  `baseline_amount`, `rearm_policy`, `threshold_basis`, `threshold_proof`.
- `alerts.intent` — **deprecated**, лишений на один реліз для rollback-безпеки; пишеться
  похідним від `mode`. Логіка його не читає.
- `wishlist_items.target_price_amount/currency` — **дропнуті** міграцією `20260726120000_alert_policy`.

### Історія: AlertIntent (стара модель, не використовується)

| Slug | Що стало |
|------|----------|
| `any-drop` | → mode `any-drop` |
| `below-current` | → mode `any-drop` (був тим самим сценарієм із замороженою базою) |
| `favourable-price` | → mode `good-price` |
| `custom-price` | → mode `my-price` |

### Модулі

| Файл | Відповідальність |
|------|-----------------|
| `pricing/canonical-price.ts` | **єдине** означення канонічної ціни (pure + один SQL-агрегат) |
| `wishlist/alert/policy.ts` | AlertPolicy, `isSignificantDrop`, `applyRearm` |
| `wishlist/alert/resolver.ts` | `resolveAlertPolicy` — режим → політика, лише на create/update |
| `wishlist/alert/good-price.ts` | джерело порогу «вигідної ціни» (формула — після дослідження) |
| `wishlist/alert/dto.ts` | AlertDto: `state`, `mode`, `threshold`, `baseline`, `thresholdProof`, `notifiedAt` |
| `wishlist/alert/repository.ts` | `WishlistAlertRow`, `upsertAlert` (політика + очищення маркера), `applyRearmToAlert`, dedup-хелпери |
| `wishlist/alert/service.ts` | `deriveAlertState`, `toLifecycle`, `setAlert` (володіє порогом), pause/remove |
| `wishlist/alert/schema.ts` | `parseSetAlertBody` (`{mode, threshold?}`), `parsePauseAlertBody` |
| `wishlist/alert/route.ts` | `registerWishlistAlertRoute` (PUT віддає повний об'єкт) |
| `books/price-history/alert-preview.ts` | `alertPolicyPreview` — прев'ю режимів для конфігуратора |
| `refresh/alert-dedup.ts` | чистий рушій над політикою (без знання режимів) |

### Коди помилок `PUT .../alert`

| Код | HTTP | Коли |
|-----|------|------|
| `THRESHOLD_REQUIRED` | 422 | `my-price` без числа |
| `THRESHOLD_NOT_ALLOWED` | 422 | поріг присланий для режиму, яким володіє сервер |
| `THRESHOLD_NOT_BELOW_CURRENT` | 422 | `my-price` ≥ поточної ціни (спрацював би одразу) |
| `NO_CANONICAL_PRICE` | 422 | немає жодної in-stock пропозиції |
| `INSUFFICIENT_HISTORY` | 409 | `good-price` без калібрування/історії |

## Email провайдер

**Resend** — реалізовано для:
- Magic Link (авторизація)
- Price alert + back-in-stock (`alerts/mailer.ts`, `alerts/templates.ts`) — з 2026-06-29
