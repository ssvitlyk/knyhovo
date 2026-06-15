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

### W4b і далі (майбутнє) — Trigger engine + Email

Наступні кроки (не реалізовані):
- [ ] Trigger engine: після scrape-run перевіряти `alerts` з `status = ACTIVE` — якщо `lowestPrice ≤ targetPriceAmount`, записувати `status = TRIGGERED` та надсилати email.
- [ ] Resend SDK інтеграція.
- [ ] Email шаблони (HTML): назва книги, нова ціна, посилання.
- [ ] Cooldown механізм (TBD: скільки разів надсилати якщо ціна залишається низькою).
- [ ] Логування відправлених листів.
- [ ] Retry при помилці відправки.

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
