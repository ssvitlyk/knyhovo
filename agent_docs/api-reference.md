# API Reference

> Читай коли: пишеш або читаєш API endpoints, додаєш новий маршрут, або змінюєш контракт.

## Конвенції

Дивись: [.claude/standards/api-conventions.md](../.claude/standards/api-conventions.md)

## Error Envelope

Всі помилки повертаються у форматі:

```json
{ "error": { "code": "ERROR_CODE", "message": "Human-readable description." } }
```

### Загальні коди помилок

| Code | HTTP | Опис |
|------|------|------|
| `VALIDATION_ERROR` | 400 | Невалідне тіло запиту або query-параметри |
| `BAD_REQUEST` | 400 | Синтаксично невірний параметр (наприклад, не UUID) |
| `BOOK_NOT_FOUND` | 404 | Книга з заданим id не знайдена |
| `AUTH_REQUIRED` | 401 | Запит вимагає автентифікації (немає або невалідна сесія) |
| `AUTH_INVALID_CODE` | 401 | Невірний або прострочений OTP-код (generic — не розкриває причину) |
| `RATE_LIMITED` | 429 | Перевищено ліміт запитів на код входу |
| `INTERNAL_ERROR` | 500 | Внутрішня помилка сервера |

---

## Books

### `GET /api/search`

Пошук книг по title/author (case-insensitive substring).

**Query params:** `q` (required), `page` (default 1), `pageSize` (default 20, max 50)

**Response 200:**
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Кобзар",
      "author": "Тарас Шевченко",
      "lowestPrice": { "amount": 29900, "currency": "UAH" },
      "offersCount": 2,
      "providers": [
        { "provider": "book-club", "price": { "amount": 29900, "currency": "UAH" } },
        { "provider": "yakaboo",   "price": { "amount": 34900, "currency": "UAH" } }
      ]
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 1,
  "totalPages": 1
}
```

---

### `GET /api/books/:id`

Деталі книги з усіма пропозиціями.

**Path params:** `id` — UUID canonical book

**Response 200:** `BookDetailsDto` (id, title, author, isbn, description, coverUrl, lowestPrice, offersCount, providers)

**Errors:** `BAD_REQUEST` (non-UUID id), `BOOK_NOT_FOUND` (404)

---

### `GET /api/books/:id/price-history`

Chart-ready price history for one canonical book. Returns the most relevant
provider listing's history with computed aggregates. When the book exists but
has no history in the requested period, returns an empty-state response (HTTP
200, all aggregates `null`, `points: []`) — not a 404.

**Path params:** `id` — UUID canonical book

**Query params:**
- `period` — `30d` | `90d` | `1y` | `all` (default: `90d`)

**Response 200 — with history:**
```json
{
  "bookId": "uuid",
  "period": "90d",
  "currency": "UAH",
  "current":  { "amount": 28000, "currency": "UAH", "availability": "in-stock",     "recordedAt": "2026-03-15T00:00:00.000Z" },
  "lowest":   { "amount": 25000, "currency": "UAH", "recordedAt": "2026-02-01T00:00:00.000Z" },
  "highest":  { "amount": 34900, "currency": "UAH", "recordedAt": "2026-01-15T00:00:00.000Z" },
  "typicalRange": { "min": 26000, "max": 32000, "currency": "UAH" },
  "change": { "amount": -2000, "percent": -7 },
  "points": [
    { "amount": 30000, "currency": "UAH", "availability": "in-stock",     "recordedAt": "2026-01-15T00:00:00.000Z" },
    { "amount": 28000, "currency": "UAH", "availability": "in-stock",     "recordedAt": "2026-03-15T00:00:00.000Z" }
  ]
}
```

**Response 200 — empty-state (book exists, no history in window):**
```json
{
  "bookId": "uuid",
  "period": "90d",
  "currency": "UAH",
  "current": null,
  "lowest": null,
  "highest": null,
  "typicalRange": null,
  "change": null,
  "points": []
}
```

**Aggregate rules:**
- `current` — last point (includes `availability`).
- `lowest` / `highest` — points with min / max amount (no `availability` field).
- `typicalRange` — if ≥5 points: sort amounts, drop one min + one max, take remainder range; else lowest/highest amounts.
- `change.amount` = current − first (signed копійки); `change.percent` = rounded %; 0 when first amount ≤ 0.
- Out-of-stock points are included; their stored amount is never zeroed.
- All amounts are integer копійки.

**Errors:**
- `BAD_REQUEST` 400 — `id` is not a valid UUID
- `VALIDATION_ERROR` 400 — `period` is not one of `30d`, `90d`, `1y`, `all`
- `BOOK_NOT_FOUND` 404 — no book with the given UUID exists

---

## Auth

Passwordless OTP (Email + 6-digit code) з серверними opaque-сесіями у httpOnly cookie `kn_session`.

### `POST /api/auth/request-code`

Надіслати 6-значний OTP на email. Якщо користувача ще немає — створює його.

**Body:** `{ "email": "user@example.com" }`

Email нормалізується: trim + toLowerCase на межі API.

**Response 200:** `{ "ok": true }`

**Errors:**
- `VALIDATION_ERROR` 400 — невалідний email
- `RATE_LIMITED` 429 — перевищено ліміт (5 запитів за 15 хв, враховуючи consumed/expired)

---

### `POST /api/auth/verify-code`

Перевірити OTP і отримати сесійну cookie.

**Body:** `{ "email": "user@example.com", "code": "123456" }`

**Response 200:**
```json
{ "user": { "id": "uuid", "email": "user@example.com", "createdAt": "2026-01-01T00:00:00.000Z" } }
```

Відповідь встановлює httpOnly cookie `kn_session` з opaque session token.

**Errors:**
- `VALIDATION_ERROR` 400 — невалідний email або не 6-цифровий код
- `AUTH_INVALID_CODE` 401 — невірний, прострочений, вже використаний код, або перевищено кількість спроб (generic — не розкриває конкретну причину)

---

### `GET /api/auth/me`

Повернути поточного автентифікованого користувача.

Потребує cookie `kn_session`.

**Response 200:**
```json
{ "user": { "id": "uuid", "email": "user@example.com", "createdAt": "2026-01-01T00:00:00.000Z" } }
```

**Errors:** `AUTH_REQUIRED` 401 — відсутня, невалідна або прострочена сесія

---

### `POST /api/auth/logout`

Завершити сесію та очистити cookie.

**Response 200:** `{ "ok": true }` (idempotent — не кидає помилку якщо сесії немає)

---

## Wishlist

Усі endpoints вимагають валідної сесійної cookie `kn_session` (httpOnly). Без неї повертається `AUTH_REQUIRED` 401.

### `GET /api/wishlist`

Повернути wishlist поточного автентифікованого користувача з актуальними цінами.

**Auth:** Required (cookie `kn_session`)

**Response 200:**
```json
{
  "items": [
    {
      "book": {
        "id": "uuid",
        "title": "Кобзар",
        "author": "Тарас Шевченко",
        "isbn": null,
        "coverUrl": null,
        "lowestPrice": { "amount": 29900, "currency": "UAH" },
        "offersCount": 2,
        "providers": [
          {
            "provider": "book-club",
            "price": { "amount": 29900, "currency": "UAH" },
            "availability": "in-stock",
            "url": "https://book-club.com.ua/...",
            "lastSeenAt": "2026-01-01T00:00:00.000Z"
          }
        ]
      },
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

OUT_OF_STOCK listings are excluded from `providers`, `lowestPrice`, and `offersCount`. Books remain in the list even when all providers are OUT_OF_STOCK (`providers: [], lowestPrice: null, offersCount: 0`).

**Errors:** `AUTH_REQUIRED` 401

---

### `POST /api/wishlist`

Додати книгу до wishlist поточного користувача. Ідемпотентний — повторний виклик для тієї самої книги повертає `{ok: true}`.

**Auth:** Required (cookie `kn_session`)

**Body:** `{ "bookId": "uuid" }`

**Response 200:** `{ "ok": true }`

**Errors:**
- `VALIDATION_ERROR` 400 — `bookId` відсутній або не є валідним UUID
- `AUTH_REQUIRED` 401 — відсутня або невалідна сесія
- `BOOK_NOT_FOUND` 404 — книга з заданим `bookId` не знайдена

---

### `GET /api/wishlist/status/:bookId`

Перевірити, чи є книга у wishlist поточного користувача.

**Auth:** Required (cookie `kn_session`)

**Path params:** `bookId` — UUID canonical book

**Response 200:** `{ "inWishlist": true }` або `{ "inWishlist": false }`

**Errors:**
- `VALIDATION_ERROR` 400 — `bookId` не є валідним UUID
- `AUTH_REQUIRED` 401 — відсутня або невалідна сесія

---

### `DELETE /api/wishlist/:bookId`

Видалити книгу з wishlist поточного користувача. Ідемпотентний — якщо книга вже не у wishlist, повертає `{ok: true}`.

**Auth:** Required (cookie `kn_session`)

**Path params:** `bookId` — UUID canonical book

**Response 200:** `{ "ok": true }`

**Errors:**
- `VALIDATION_ERROR` 400 — `bookId` не є валідним UUID
- `AUTH_REQUIRED` 401 — відсутня або невалідна сесія

---

## Wishlist Alerts (W4a)

Усі endpoints вимагають валідної сесійної cookie `kn_session`. Ключ `:bookId` — це `canonicalBookId`; сервер сам знаходить відповідний `wishlist_item` і `alert`.

Поле `alert` додається до кожного елемента у відповіді `GET /api/wishlist`.

### `alert` object у WishlistItemDto

```json
{
  "status": "active",          // derived: "active" | "paused" | "triggered" | "unavailable"
  "intent": "below-current",   // "any-drop" | "below-current" | "favourable-price" | "custom-price"
  "targetPrice": { "amount": 20000, "currency": "UAH" },
  "pausedAt": null             // ISO 8601 string or null
}
```

`alert` = `null` коли алерт не налаштований.

**Статус-derivation (виконується при читанні):**
1. persisted PAUSED → `paused`
2. offersCount = 0 → `unavailable`
3. lowestPrice.amount ≤ targetPriceAmount → `triggered`
4. інакше → `active`

---

### `PUT /api/wishlist/:bookId/alert`

Створити або замінити алерт для книги у wishlist. Завжди скидає статус до ACTIVE.

**Auth:** Required (cookie `kn_session`)

**Path params:** `bookId` — UUID canonical book

**Body:**
```json
{
  "intent": "below-current",
  "targetPrice": { "amount": 20000, "currency": "UAH" }
}
```

- `intent`: required; one of `"any-drop"`, `"below-current"`, `"favourable-price"`, `"custom-price"`
- `targetPrice.amount`: required; positive integer (копійки)
- `targetPrice.currency`: required; `"UAH"`

**Response 200:** `{ "ok": true }`

**Errors:**
- `VALIDATION_ERROR` 400 — невалідне тіло (невідомий intent, amount ≤ 0, не ціле число)
- `AUTH_REQUIRED` 401 — відсутня або невалідна сесія
- `WISHLIST_ITEM_NOT_FOUND` 404 — книга не знайдена у wishlist користувача

---

### `PATCH /api/wishlist/:bookId/alert`

Поставити алерт на паузу або відновити.

**Auth:** Required (cookie `kn_session`)

**Path params:** `bookId` — UUID canonical book

**Body:**
```json
{ "paused": true }
```

- `paused`: required; boolean — `true` = пауза, `false` = відновити

**Response 200:** `{ "ok": true }`

**Errors:**
- `VALIDATION_ERROR` 400 — `paused` відсутній або не boolean
- `AUTH_REQUIRED` 401
- `WISHLIST_ITEM_NOT_FOUND` 404 — книга не у wishlist

---

### `DELETE /api/wishlist/:bookId/alert`

Видалити алерт. Ідемпотентний — якщо алерту немає, але книга є у wishlist, повертає `{ok: true}`.

**Auth:** Required (cookie `kn_session`)

**Path params:** `bookId` — UUID canonical book

**Response 200:** `{ "ok": true }`

**Errors:**
- `VALIDATION_ERROR` 400 — `bookId` не є валідним UUID
- `AUTH_REQUIRED` 401
- `WISHLIST_ITEM_NOT_FOUND` 404 — книга не у wishlist

---

### Нові коди помилок (W4a)

| Code | HTTP | Опис |
|------|------|------|
| `WISHLIST_ITEM_NOT_FOUND` | 404 | Книга не знайдена у wishlist поточного користувача |
