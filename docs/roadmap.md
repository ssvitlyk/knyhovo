# Knyhovo — Roadmap реалізації

> Затверджено: 2026-06-08.
> Код для кожного етапу починається тільки після підтвердження відповідного PRD.

---

## Правила виконання roadmap

- **Одна сесія = один етап.** Не поєднувати кілька сесій в одну.
- **Не переходити до наступного етапу** без green typecheck + test + lint поточного.
- **Не змінювати scope етапу** без явного підтвердження під час сесії.
- **Великі зміни** (нова фіча, зміна архітектури) — тільки через PRD у `docs/prd/`.
- **Не комітити напряму в `main`.** Тільки через PR після зеленого CI.

---

## Порядок виконання

```
S0: Monorepo setup
    ↓
S1: Shared types
    ↓
S2: Database schema + Prisma
    ↓
S3a: Scraper Yakaboo          S3b: Canonical Matching дослідження
    ↓                                ↓
         S4: Canonical Matching реалізація
                    ↓
         S5: Scraper BookClub + Railway Cron
                    ↓
              S6: API Books
                    ↓
            S7: Web пошук + книга
                    ↓
            S8: Auth Magic Link
                    ↓
               S9: Wishlist
                    ↓
           S10: Price Alert Engine
                    ↓
         S11: Railway деплой + CI/CD
```

> **S3a і S3b виконуються паралельно** — вони незалежні між собою і можуть йти одночасно після S2 і S1 відповідно.

---

## S0 — Monorepo Setup

**Мета:** робочий монорепозиторій з порожніми пакетами та CI skeleton.

**Що робимо:**
- `package.json` у корені з pnpm workspaces
- `pnpm-workspace.yaml`
- `turbo.json` з pipeline: lint → typecheck → test → build
- `tsconfig.base.json` у корені (strict, paths)
- Порожні `packages/web`, `packages/api`, `packages/scrapers`, `packages/shared` з мінімальним `package.json` і `tsconfig.json`
- `.github/workflows/ci.yml`: install → turbo lint/typecheck/test
- `.gitignore`, `.nvmrc`

**Залежності:** немає.

**Acceptance Criteria:**
- `pnpm install` успішно завершується у корені
- `turbo run typecheck` проходить (порожні пакети — 0 помилок)
- CI запускається на PR і показує green

---

## S1 — Shared Domain Types

**Мета:** єдине джерело типів для всього монорепо.

**Що робимо:**
- `packages/shared/src/types/`: `Book`, `CanonicalBook`, `ProviderListing`, `PriceHistory`, `WishlistItem`, `User`
- `ScraperProvider` інтерфейс
- `packages/shared/src/index.ts` — re-export всього
- Unit тести на типи (type-level або runtime guards)

**Залежності:** S0.

**Acceptance Criteria:**
- `import type { CanonicalBook } from '@knyhovo/shared'` працює у будь-якому пакеті
- Всі типи мають JSDoc з поясненням purpose
- `turbo run typecheck` green

---

## S2 — Database Schema + Prisma

**Мета:** версіонована схема БД, локальний PostgreSQL через Docker.

**Що робимо:**
- `packages/api/prisma/schema.prisma`: таблиці `canonical_books`, `provider_listings`, `price_history`, `users`, `wishlist_items`
- Перша міграція `prisma migrate dev`
- `docker-compose.yml` у корені: PostgreSQL 16
- Seed script для тестових даних
- Prisma Client доступний у `packages/api`, типи re-exported у `packages/shared`

**Залежності:** S1 (типи мають відповідати схемі).

**Acceptance Criteria:**
- `docker compose up && pnpm prisma migrate dev` — без помилок
- Seed дає записи у `canonical_books` та `provider_listings`
- `price_history` не має DELETE/UPDATE у коді
- `turbo run typecheck` green

---

## S3a — Scraper: Yakaboo *(паралельно з S3b)*

**Мета:** перший робочий скрапер, що повертає структуровані дані.

**Що робимо:**
- `packages/scrapers/src/providers/yakaboo/`: реалізація `ScraperProvider`
- HTML парсинг (cheerio або playwright — вирішити під час сесії)
- Нормалізація полів: title, author, ISBN, price, url, provider
- Unit тести з fixture HTML (збережені реальні сторінки)
- Логування: початок, кінець, кількість книг, помилки

**Залежності:** S1 (`ScraperProvider` інтерфейс).

**Acceptance Criteria:**
- Скрапер повертає `ProviderListing[]` без запису у БД
- Unit тести покривають: успішний парсинг, відсутній ISBN, помилка мережі
- `turbo run test` green

---

## S3b — Canonical Matching: дослідження + алгоритм *(паралельно з S3a)*

**Мета:** зрозуміти поточний алгоритм Telegram-бота та спроектувати новий.

**Що робимо:**
- CM1: аналіз Telegram-бота — як він зараз об'єднує книги
- CM2: документування поточного алгоритму у `docs/prd/canonical-matching.md`
- CM3: список відомих проблем з реальними прикладами
- CM4: проектування нового алгоритму (ISBN-first + fuzzy fallback)
- Прийняти рішення: fuzzy поріг, обробка конфліктів, online vs batch

**Залежності:** S1 (типи).

**Acceptance Criteria:**
- `docs/prd/canonical-matching.md` заповнений до CM4 включно
- Алгоритм задокументований (псевдокод або flowchart)
- Визначено: fuzzy поріг, стратегія конфліктів, timing

---

## S4 — Canonical Matching: реалізація

**Мета:** робочий matching модуль з покриттям реальних кейсів.

**Що робимо:**
- `packages/scrapers/src/canonical/`: реалізація алгоритму з CM4
- ISBN lookup → fuzzy title+author як fallback
- Запис у `canonical_books` + `provider_listings` через Prisma
- Unit тести: кейси з CM3 (відомі проблеми Telegram-бота)

**Залежності:** S2 (БД), S3a (дані для тестів), S3b (алгоритм).

**Acceptance Criteria:**
- Одна книга від двох провайдерів → один `canonical_books` запис
- Новий провайдер не вимагає змін в алгоритмі
- Покриття unit тестами всіх кейсів з CM3
- Fuzzy matching не дає false positive на книгах з однаковим автором і різними назвами
- `turbo run test` green

---

## S5 — Scraper: BookClub + Railway Cron

**Мета:** другий провайдер і автоматичний запуск за розкладом.

**Що робимо:**
- `packages/scrapers/src/providers/book-club/`: реалізація `ScraperProvider`
- Unit тести з fixture HTML аналогічно S3a
- Entry point `packages/scrapers/src/index.ts`: запускає всі провайдери → matching → запис у БД
- Railway Cron конфігурація: `SCRAPE_INTERVAL_HOURS=12`

**Залежності:** S4 (matching), S3a (Yakaboo як еталон).

**Acceptance Criteria:**
- BookClub скрапер повертає коректні `ProviderListing[]`
- Помилка одного провайдера не зупиняє інший
- `pnpm scrapers:run` локально заповнює БД реальними даними
- Railway Cron job запускається за розкладом (перевірити у Railway dashboard)
- `turbo run test` green

---

## S6 — API: Books

**Мета:** REST API для пошуку та сторінки книги.

**Що робимо:**
- Fastify сервер `packages/api/src/server.ts`
- `GET /health`
- `GET /books?q=` — повнотекстовий пошук по `canonical_books`
- `GET /books/:id` — деталі + `provider_listings` + `price_history`
- Типи request/response з `packages/shared`
- Integration тести з тестовою PostgreSQL БД
- Заповнити `.claude/standards/api-conventions.md`

**Залежності:** S2 (БД), S1 (типи).

**Acceptance Criteria:**
- `GET /books?q=кобзар` повертає релевантні результати
- `GET /books/:id` повертає пропозиції та price history
- Response format відповідає `api-conventions.md`
- Integration тести: знайдено, не знайдено, невалідний id
- `turbo run test` green

---

## S7 — Web: пошук + сторінка книги

**Мета:** базовий UI без auth і wishlist.

**Що робимо:**
- Next.js 15 App Router setup у `packages/web`
- Tailwind CSS + shadcn/ui ініціалізація
- Заповнити `.claude/standards/component-conventions.md`
- Сторінка пошуку: Server Component, форма, результати з цінами
- Сторінка книги `/books/[id]`: деталі, пропозиції, price history
- Базовий responsive layout (mobile-first)

**Залежності:** S6 (API), S1 (типи).

**Acceptance Criteria:**
- Пошук повертає результати з цінами від провайдерів
- Сторінка книги показує всі пропозиції і price history
- Рендер на сервері (Server Component): перевірити через `view-source`
- Виглядає коректно на 375px
- `turbo run typecheck` і `turbo run lint` green

---

## S8 — Auth: Magic Link

**Мета:** реєстрація та вхід через Email Magic Link (Resend).

**Що робимо:**
- Resend SDK у `packages/api`
- `POST /auth/magic-link` — надіслати листа
- `GET /auth/verify?token=` — верифікація, видача сесії
- JWT або cookie-based сесія після верифікації
- Email шаблон Magic Link (HTML через Resend)
- UI: форма email, сторінка "перевірте пошту", redirect після входу
- Auth middleware у Fastify для захищених routes

**Залежності:** S6 (API), S7 (Web UI).

**Acceptance Criteria:**
- Повний flow: email → лист → клік → залогінений
- Token одноразовий: повторний клік → помилка
- Token має TTL (наприклад, 15 хвилин)
- `POST /auth/magic-link` з некоректним email → 422
- Захищені routes → 401 без валідної сесії
- `turbo run test` green

---

## S9 — Wishlist

**Мета:** персональний wishlist з цільовою ціною і merge після входу.

**Що робимо:**
- API endpoints: GET/POST/DELETE/PATCH `/wishlist`
- localStorage wishlist для анонімних користувачів
- Merge localStorage → account wishlist після Magic Link login
- UI: кнопка "Додати до wishlist" на сторінці книги
- Сторінка wishlist: поточна ціна + targetPrice, позначка досягнення
- Integration тести для всіх endpoints

**Залежності:** S8 (Auth), S7 (Web), S6 (API).

**Acceptance Criteria:**
- Анонімний користувач додає книгу до localStorage wishlist
- Після входу — localStorage wishlist зливається з account wishlist
- `GET /wishlist` повертає wishlist з актуальними цінами
- Видалення і редагування targetPrice працює
- `turbo run test` green

---

## S10 — Price Alert Engine

**Мета:** email-сповіщення при падінні ціни нижче цільової.

**Що робимо:**
- Після кожного scraper run: порівняти нові ціни з `wishlist_items.target_price`
- Якщо нова ціна ≤ targetPrice → email через Resend
- Email шаблон: назва книги, нова ціна, посилання
- Cooldown механізм (рішення приймається під час сесії)
- Логування відправлених alerts

**Залежності:** S9 (Wishlist), S5 (Scrapers).

**Acceptance Criteria:**
- При ціні ≤ targetPrice — email надсилається через Resend
- Email містить: назву книги, нову ціну, пряме посилання
- Повторний alert не надсилається якщо ціна не змінилась після першого
- Помилка відправки не зупиняє обробку інших wishlist items
- Integration тест з mock Resend client
- `turbo run test` green

---

## S11 — Railway деплой + CI/CD фіналізація

**Мета:** production-ready деплой і захищений CI pipeline.

**Що робимо:**
- Railway project: 4 сервіси (web, api, db, scrapers cron), регіон Frankfurt
- Env variables у Railway (не у git)
- GitHub branch protection: required checks, no direct push to `main`
- `.github/workflows/ci.yml`: повний pipeline з PostgreSQL service для integration тестів
- Railway preview environments для PR
- Smoke test після деплою: health check, пошук, wishlist flow

**Залежності:** S10 (всі фічі завершені).

**Acceptance Criteria:**
- `git push main` → Railway деплоїть web і api автоматично
- PR → preview environment створюється
- CI red → merge заблокований
- `GET /health` на prod URL → `{ status: "ok" }`
- Scraper cron запускається у Railway dashboard
- Env variables відсутні у git history
- `turbo run test` green на CI з реальним PostgreSQL service

---

## Зведена таблиця

| Сесія | Що | Залежності |
|-------|----|------------|
| S0 | Monorepo setup | — |
| S1 | Shared types | S0 |
| S2 | DB schema + Prisma | S1 |
| S3a ⟂ S3b | Scraper Yakaboo / Canonical Matching дослідження | S1 (S3a, S3b незалежні) |
| S4 | Canonical Matching реалізація | S2 + S3a + S3b |
| S5 | Scraper BookClub + Cron | S4 |
| S6 | API Books | S2 + S1 |
| S7 | Web пошук + книга | S6 |
| S8 | Auth Magic Link | S6 + S7 |
| S9 | Wishlist | S8 + S7 + S6 |
| S10 | Price Alert Engine | S9 + S5 |
| S11 | Railway + CI/CD | S10 |
