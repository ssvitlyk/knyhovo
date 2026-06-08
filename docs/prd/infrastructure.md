# PRD: Infrastructure

> Статус: **Затверджено** (2026-06-08). Рішення зафіксовані внизу документа.
> Залишаються 3 відкриті питання — позначені окремо.

---

## Зафіксовані рішення

| Компонент | Рішення |
|-----------|---------|
| Monorepo | **pnpm workspaces + Turborepo** |
| Frontend | **Next.js 15, App Router, Tailwind CSS, shadcn/ui** |
| Backend | **Fastify** |
| Database | **PostgreSQL 16 + Prisma** |
| Hosting | **Railway** (web + api + db + cron), регіон **Frankfurt** |
| CI | **GitHub Actions** (lint → typecheck → test) |
| CD | **Railway autodeploy** після merge в `main` |
| Preview deployments | **Так** (Railway PR environments) |
| Email provider | **Resend** (Magic Link + price alerts) |
| Scrapers MVP | **Railway Cron**, кожні 12 годин, `SCRAPE_INTERVAL_HOURS` конфігурується |
| Scrapers post-MVP | Окремий worker з queue (BullMQ + Redis або подібне) |

## Відкриті питання

| # | Питання | Блокує |
|---|---------|--------|
| 1 | **Backup стратегія PostgreSQL** — Railway автоматичний backup чи окремий скрипт? | Production readiness |
| 2 | **Retry стратегія скрапера** — скільки спроб, який backoff, що робити після вичерпання? | Scraper reliability |
| 3 | **On-demand тригер** — чи потрібна можливість запустити scraper поза розкладом (webhook / адмін UI)? | Scraper архітектура |

---

## 1. Monorepo Tool

### Рішення: pnpm workspaces + Turborepo

**Чому обрано:**
- `turbo.json` декларує залежності між задачами: `build shared → build api/web` автоматично
- Локальний та remote cache (Turborepo Remote Cache): CI не перебудовує незмінені пакети
- Паралельний запуск незалежних задач з коробки
- де-факто стандарт для Next.js монорепо

**Відхилено:**
- *pnpm без Turborepo* — відсутнє кешування та задекларовані залежності між задачами
- *Nx* — надмірна складність для 4 пакетів і малої команди

### Acceptance Criteria

- `pnpm install` у корені встановлює залежності всіх пакетів
- `turbo run build` будує пакети в правильному порядку (`shared` → `api`, `shared` → `web`)
- `turbo run test` запускає тести паралельно
- CI cache: повторний запуск без змін не перебудовує пакети

---

## 2. Backend Framework

### Рішення: Fastify

**Чому обрано:**
- TypeScript-first: типізація схем через Zod або TypeBox
- Мінімальний boilerplate для 6–8 endpoints MVP
- Активна підтримка; `@fastify/jwt`, `@fastify/cors` — готові плагіни
- Підходить для Railway деплою (не serverless, тому cold start не критичний)

**Відхилено:**
- *NestJS* — overkill для MVP: зайвий boilerplate, DI overhead
- *Express* — фактично maintenance mode, немає TypeScript-first ядра

### Acceptance Criteria

- API стартує локально за < 2 секунди
- Всі endpoints мають TypeScript-типізовані request/response через `packages/shared`
- Помилки повертають консистентний JSON формат (визначити у `.claude/standards/api-conventions.md`)
- Health check endpoint: `GET /health` → `{ status: "ok" }`

---

## 3. Frontend

### Рішення: Next.js 15 + App Router + Tailwind CSS + shadcn/ui

**Чому обрано:**
- App Router — офіційний напрям Next.js; Pages Router не стартуємо у 2025+
- React Server Components: пошукова сторінка рендериться на сервері
- Tailwind CSS + shadcn/ui: UI компоненти з повним контролем над кодом, без vendor lock-in на design system
- Railway деплой Next.js підтримує нативно

**Відхилено:**
- *Next.js 14* — немає причини стартувати на старшій версії для нового проєкту
- *Vercel hosting* — все на Railway для MVP, щоб уникнути двох платформ

### Acceptance Criteria

- `packages/web` компілюється без TypeScript помилок
- Пошукова сторінка — Server Component (рендер на сервері, не SPA)
- Tailwind config налаштований для монорепо (shared config у `packages/shared` або root)
- shadcn/ui компоненти ініціалізовані у `packages/web`

---

## 4. Database та ORM

### Рішення: PostgreSQL 16 + Prisma

**Чому обрано:**
- PostgreSQL 16: актуальна версія, підтримується Railway managed service
- Prisma: `prisma generate` автоматично типізує клієнт зі схеми; простий migrations workflow; Prisma Studio для dev

**Відхилено:**
- *Drizzle* — менша зрілість, нестабільні migrations у порівнянні з Prisma
- *Kysely* — надмірна складність для CRUD; raw SQL доступний через Prisma `$queryRaw` при потребі

### Acceptance Criteria

- Схема БД версіонована через `prisma migrate`
- `price_history` — append-only: UPDATE/DELETE відсутні у кодовій базі
- `docker compose up` піднімає локальний PostgreSQL 16 для розробки
- Prisma Client типи доступні у `packages/shared` (re-export або mapping)

---

## 5. Scrapers: архітектура та розклад

### Рішення: Railway Cron (MVP) → окремий worker (post-MVP)

**MVP архітектура:**
- Scraper запускається як Railway Cron job кожні 12 годин
- Прямий доступ до PostgreSQL через Prisma
- Помилка одного провайдера не зупиняє інших (ізоляція на рівні try/catch per provider)
- `SCRAPE_INTERVAL_HOURS=12` у Railway env

**Post-MVP міграція:**
- Окремий worker сервіс з queue (BullMQ + Redis)
- On-demand тригер через API endpoint або webhook

**Відкриті питання цієї секції:**
- Retry стратегія при помилці (TBD — відкрите питання #2)
- On-demand тригер (TBD — відкрите питання #3)

### Acceptance Criteria

- Scraper запускається без ручного втручання за розкладом
- Логи кожного запуску доступні у Railway dashboard
- Помилка Yakaboo не зупиняє BookClub scraper і навпаки
- `SCRAPE_INTERVAL_HOURS` змінюється без перекомпіляції

---

## 6. Hosting

### Рішення: Railway, регіон Frankfurt

**Конфігурація сервісів на Railway:**

| Сервіс | Тип | Примітка |
|--------|-----|----------|
| `web` | Railway Service | `packages/web`, Next.js 15 |
| `api` | Railway Service | `packages/api`, Fastify |
| `db` | Railway PostgreSQL | Managed, PostgreSQL 16, Frankfurt |
| `scrapers` | Railway Cron | `packages/scrapers`, кожні 12 годин |

**Чому Frankfurt:**
- Найближчий EU регіон до України; мінімальна latency для українських користувачів

**Відхилено:**
- *VPS* — DevOps overhead (SSL, backup, reverse proxy) недоречний для MVP
- *Supabase* — дублювання з Resend auth; pausing free tier несумісний з cron
- *Vercel+Railway* — два dashboards, два billing для MVP несуттєвої переваги

**Відкрите питання цієї секції:**
- Backup стратегія PostgreSQL (TBD — відкрите питання #1)

### Acceptance Criteria

- `git push main` → автоматичний деплой `web` і `api` через Railway autodeploy
- HTTPS на всіх ендпоінтах (Railway забезпечує автоматично)
- Env variables: зберігаються у Railway, не у git
- Preview environment створюється для кожного PR автоматично
- Регіон всіх сервісів: Frankfurt (`europe-west`)

---

## 7. CI/CD

### Рішення: GitHub Actions (CI) + Railway autodeploy (CD)

**CI pipeline (GitHub Actions):**

```
PR opened / updated:
  1. pnpm install (з cache)
  2. turbo run lint
  3. turbo run typecheck
  4. turbo run test
     └─ integration tests: PostgreSQL service у GitHub Actions
  → merge заблоковано якщо будь-який крок red

Merge to main:
  Railway autodeploy: web + api
  Railway Cron: незмінно активний
```

**Branch protection (налаштувати у GitHub):**
- `main` — direct push заборонений
- Required status checks: `lint`, `typecheck`, `test`
- Require PR before merge

### Acceptance Criteria

- PR не можна merge якщо CI red
- `main` захищена branch protection rules
- Деплой після merge займає < 5 хвилин
- Rollback доступний через Railway (попередній deploy зберігається)
- GitHub Actions secrets і Railway env variables не дублюються (Railway — джерело правди для runtime secrets)
