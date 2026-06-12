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
