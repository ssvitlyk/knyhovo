# Architecture

> Читай коли: приймаєш рішення про структуру модулів, пакетів або залежностей між ними.

## Monorepo структура

```
packages/
  web/        — UI (стек TBD)
  api/        — REST API (стек TBD)
  scrapers/   — Провайдери Yakaboo, BookClub та майбутні
  shared/     — Типи, domain entities, утиліти
```

## Ключові принципи

- `packages/shared` — єдине джерело типів. Пакети імпортують звідти, не визначають власні копії.
- Скрапери — незалежні провайдери. Додавання нового провайдера не змінює core-логіку.
- Canonical matching — окремий шар між скраперами та БД. Деталі: `docs/prd/canonical-matching.md`.
- API не знає про UI фреймворк; Web не знає про БД.

## Залежності між пакетами

```
web       → shared (типи)
api       → shared (типи)
scrapers  → shared (типи)
api       ← scrapers (через чергу або direct call — TBD)
```

## [TODO: заповнити при старті]

- Стек кожного пакету
- Спосіб комунікації між scrapers і api (queue / cron / direct)
- Схема деплою
- Monorepo tool (turborepo / nx / звичайний workspace)
