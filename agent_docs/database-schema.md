# Database Schema

> Читай коли: міняєш схему БД, пишеш міграцію, або додаєш нову модель.

## БД

PostgreSQL 16 (локально — Docker, production — Railway managed).

## ORM

Prisma 6.x. Схема: `packages/api/prisma/schema.prisma`.
Міграції: `packages/api/prisma/migrations/`.

## Локальне середовище

```bash
# 1. Запустити PostgreSQL
docker compose up -d

# 2. Створити packages/api/.env (gitignored)
echo 'DATABASE_URL="postgresql://knyhovo:knyhovo@localhost:5432/knyhovo"' > packages/api/.env

# 3. Застосувати міграції
pnpm --filter @knyhovo/api db:migrate

# 4. Заповнити тестовими даними
pnpm --filter @knyhovo/api db:seed

# 5. Prisma Studio (браузер)
pnpm --filter @knyhovo/api db:studio
```

## Enums

```sql
CREATE TYPE "provider" AS ENUM ('yakaboo', 'book-club');
CREATE TYPE "currency" AS ENUM ('UAH');
CREATE TYPE "availability" AS ENUM ('in-stock', 'out-of-stock', 'unknown');
```

Prisma-назви: `Provider.YAKABOO`, `Provider.BOOK_CLUB`, `Currency.UAH`, `Availability.IN_STOCK`, `Availability.OUT_OF_STOCK`, `Availability.UNKNOWN`.

## Таблиці

### canonical_books

Унікальний запис книги. Єдина точка для wishlist, price alert та пошуку.

```sql
CREATE TABLE "canonical_books" (
    "id"         TEXT        PRIMARY KEY,
    "title"      TEXT        NOT NULL,
    "author"     TEXT        NOT NULL,
    "isbn"       TEXT,                      -- nullable; ISBN-13 або ISBN-10
    "created_at" TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "canonical_books_isbn_idx" ON "canonical_books"("isbn");
```

**Правило:** isbn не має unique constraint — якість ISBN досліджується у S3b/S4.

### provider_listings

Запис книги від конкретного провайдера. Один `canonical_books` може мати кілька listings від різних провайдерів або кілька видань від одного.

```sql
CREATE TABLE "provider_listings" (
    "id"               TEXT      PRIMARY KEY,
    "canonical_book_id" TEXT     NOT NULL REFERENCES "canonical_books"("id"),
    "provider"         "provider" NOT NULL,
    "title"            TEXT      NOT NULL,   -- назва як на сайті провайдера
    "author"           TEXT      NOT NULL,
    "isbn"             TEXT,
    "price_amount"     INTEGER   NOT NULL,   -- копійки, завжди >= 0
    "price_currency"   "currency" NOT NULL,
    "url"              TEXT      NOT NULL,
    "last_seen_at"     TIMESTAMP NOT NULL,
    "availability"     "availability" NOT NULL DEFAULT 'unknown'
);

CREATE UNIQUE INDEX "provider_listings_provider_url_key"
    ON "provider_listings"("provider", "url");

CREATE INDEX "provider_listings_provider_canonical_book_id_idx"
    ON "provider_listings"("provider", "canonical_book_id");
```

### price_history

**append-only: INSERT тільки. UPDATE і DELETE заборонені.**

Незмінний лог змін ціни. Нові записи додаються при кожному scrape run якщо ціна змінилась.

```sql
CREATE TABLE "price_history" (
    "id"                  TEXT      PRIMARY KEY,
    "provider_listing_id" TEXT      NOT NULL REFERENCES "provider_listings"("id"),
    "price_amount"        INTEGER   NOT NULL,
    "price_currency"      "currency" NOT NULL,
    "recorded_at"         TIMESTAMP NOT NULL
);

CREATE INDEX "price_history_provider_listing_id_recorded_at_idx"
    ON "price_history"("provider_listing_id", "recorded_at");
```

**Перевірка відповідності:**
```bash
grep -r "priceHistoryPoint\.\(update\|delete\)" packages/
# Очікуваний результат: порожньо
```

### users

Зареєстровані користувачі (auth через Magic Link — реалізується у S8).

```sql
CREATE TABLE "users" (
    "id"         TEXT      PRIMARY KEY,
    "email"      TEXT      NOT NULL UNIQUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### login_codes

Одноразові OTP-коди для passwordless входу. Код зберігається у вигляді HMAC-SHA256 хешу.

```sql
CREATE TABLE "login_codes" (
    "id"          TEXT      PRIMARY KEY,
    "user_id"     TEXT      NOT NULL REFERENCES "users"("id"),
    "code_hash"   TEXT      NOT NULL,              -- HMAC-SHA256 hex (не plaintext)
    "expires_at"  TIMESTAMP NOT NULL,
    "consumed_at" TIMESTAMP,                        -- null = ще не використано
    "attempts"    INTEGER   NOT NULL DEFAULT 0,    -- лічильник невдалих спроб
    "created_at"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "login_codes_user_id_idx" ON "login_codes"("user_id");
CREATE INDEX "login_codes_expires_at_idx" ON "login_codes"("expires_at");
```

**Правила:**
- `code_hash` — HMAC-SHA256 з `AUTH_SECRET`, ніколи plaintext
- Rate-limit рахує ВСІ записи (включно consumed/expired) у вікні
- `attempts >= maxVerifyAttempts` → код споживається й подальші спроби відхиляються

### sessions

Серверні сесії після успішного OTP-входу. Token зберігається у вигляді SHA-256 хешу.

```sql
CREATE TABLE "sessions" (
    "id"         TEXT      PRIMARY KEY,
    "user_id"    TEXT      NOT NULL REFERENCES "users"("id"),
    "token_hash" TEXT      NOT NULL UNIQUE,         -- SHA-256 hex opaque token
    "expires_at" TIMESTAMP NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
```

**Правила:**
- Token надсилається клієнту у httpOnly cookie `kn_session`; у БД — лише хеш
- TTL: 30 днів за замовчуванням
- Expired сесії очищуються при наступному `request-code` запиті

### wishlist_items

Персональний wishlist. Один запис per книга per користувач.

```sql
CREATE TABLE "wishlist_items" (
    "id"                    TEXT      PRIMARY KEY,
    "user_id"               TEXT      NOT NULL REFERENCES "users"("id"),
    "canonical_book_id"     TEXT      NOT NULL REFERENCES "canonical_books"("id"),
    "target_price_amount"   INTEGER,          -- null = алерт не налаштований
    "target_price_currency" "currency",
    "created_at"            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("user_id", "canonical_book_id")
);
```

## Правила

- Всі зміни схеми — через `prisma migrate dev` (версіоновані міграції)
- `price_history` — append-only: тільки INSERT у `packages/api` кодовій базі
- `canonical_books` — єдина точка для wishlist та price alert
- Гроші зберігаються у найменших одиницях (копійки): `349.99 UAH → 34999`
- `canonical_books.isbn` — індексовано, але не unique (до S4 canonical matching)

## Package scripts (`packages/api`)

| Script | Команда |
|--------|---------|
| `db:generate` | `prisma generate` |
| `db:migrate` | `prisma migrate dev` |
| `db:seed` | `prisma db seed` |
| `db:studio` | `prisma studio` |
| `db:reset` | `prisma migrate reset` |

## Backup стратегія

TBD при старті S11 (Railway managed PostgreSQL має вбудований backup).
