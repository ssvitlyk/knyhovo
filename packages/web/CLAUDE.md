# packages/web

UI пакет. Стек: **Next.js (App Router)** + React + TypeScript (strict). Стилі — портований
frozen design-system (`src/styles/ds/*` токени + класи `kn-*`), без Tailwind.

## Команди

| Команда | Що робить |
|---------|-----------|
| `pnpm --filter @knyhovo/web dev` | Запуск dev-сервера (Next.js) |
| `pnpm --filter @knyhovo/web build` | Production build |
| `pnpm --filter @knyhovo/web typecheck` | `tsc --noEmit` |
| `pnpm --filter @knyhovo/web lint` | ESLint |
| `pnpm --filter @knyhovo/web test` | Vitest (jsdom) |

> Сторінка пошуку (`/search`) інтегрується з реальним `GET /api/search` (S8a).
> Базовий URL API — `API_BASE_URL` (default `http://localhost:3000`).
> Frozen-дизайн-референс лежить у `design-import/` — **тільки для читання**, не копіювати JSX.

## Що тут живе

- Сторінки: пошук (`src/app/search`), далі — сторінка книги, wishlist
- UI компоненти: DS-примітиви (`src/components/ds`), фічеві компоненти (`src/components/search`)
- Клієнтська логіка (пошук через URL query, wishlist через localStorage до входу)

## Що тут НЕ живе

- Бізнес-логіка — у `packages/shared` або `packages/api`
- Типи — тільки з `packages/shared`, не дублювати

## Конвенції

[.claude/standards/component-conventions.md](../../.claude/standards/component-conventions.md) — заповнити при старті.

## Тригери для agent docs

| Питання | Документ |
|---------|----------|
| Структура компонентів | [agent_docs/architecture.md](../../agent_docs/architecture.md) |
| API контракт | [agent_docs/api-reference.md](../../agent_docs/api-reference.md) |
