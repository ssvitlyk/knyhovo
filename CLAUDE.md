# Knyhovo

Пошук паперових книг та порівняння цін у Yakaboo і BookClub, з wishlist та email-алертами.

> **Правило:** Код для нової фічі не пишеться до підтвердження відповідного PRD у `docs/prd/`.

## Команди

Монорепо (turbo): `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build`

Web: `pnpm --filter @knyhovo/web dev` (потребує API на :3000 для реальних результатів)

## Пакети

| Пакет | Що робить |
|-------|-----------|
| [packages/web](packages/web/CLAUDE.md) | UI |
| [packages/api](packages/api/CLAUDE.md) | REST API |
| [packages/scrapers](packages/scrapers/CLAUDE.md) | Скрапери провайдерів |
| [packages/shared](packages/shared/CLAUDE.md) | Shared типи та domain entities |

## Agent docs — читай лише за тригером

| Читай коли... | Документ |
|---------------|----------|
| приймаєш рішення про структуру або пакети | [agent_docs/architecture.md](agent_docs/architecture.md) |
| пишеш або читаєш API endpoints | [agent_docs/api-reference.md](agent_docs/api-reference.md) |
| міняєш схему БД або пишеш міграцію | [agent_docs/database-schema.md](agent_docs/database-schema.md) |
| створюєш або змінюєш скрапер | [agent_docs/scraper-development.md](agent_docs/scraper-development.md) |
| зміни у price alert або email | [agent_docs/alert-engine.md](agent_docs/alert-engine.md) |
| пишеш тести або налаштовуєш CI | [agent_docs/testing-guide.md](agent_docs/testing-guide.md) |
| досліджуєш/реалізуєш КСД (book-club) через GraphQL API | [docs/research/ksd-graphql-api.md](docs/research/ksd-graphql-api.md) |

## PRD

| PRD | Статус |
|-----|--------|
| [docs/prd/web-mvp.md](docs/prd/web-mvp.md) | Затверджено |
| [docs/prd/discovery-w9.md](docs/prd/discovery-w9.md) | Затверджено |
| [docs/prd/refresh-architecture-w10.md](docs/prd/refresh-architecture-w10.md) | Чорновик |
| [docs/prd/wishlist.md](docs/prd/wishlist.md) | Чорновик |
| [docs/prd/canonical-matching.md](docs/prd/canonical-matching.md) | Чорновик |
| [docs/prd/bookchef-provider.md](docs/prd/bookchef-provider.md) | Чорновик |
| [docs/prd/laboratory-provider.md](docs/prd/laboratory-provider.md) | Чорновик |
| [docs/prd/knigoland-provider.md](docs/prd/knigoland-provider.md) | Чорновик |
| [docs/prd/nashformat-provider.md](docs/prd/nashformat-provider.md) | Deferred/Blocked |
| [docs/prd/ai-discovery.md](docs/prd/ai-discovery.md) | Stub (future) |
