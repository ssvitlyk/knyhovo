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

## PRD

| PRD | Статус |
|-----|--------|
| [docs/prd/web-mvp.md](docs/prd/web-mvp.md) | Затверджено |
| [docs/prd/discovery-w9.md](docs/prd/discovery-w9.md) | Затверджено |
| [docs/prd/wishlist.md](docs/prd/wishlist.md) | Чорновик |
| [docs/prd/canonical-matching.md](docs/prd/canonical-matching.md) | Чорновик |
| [docs/prd/ai-discovery.md](docs/prd/ai-discovery.md) | Stub (future) |
