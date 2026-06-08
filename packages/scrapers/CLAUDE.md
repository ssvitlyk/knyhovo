# packages/scrapers

Скрапери провайдерів книгарень.

> Код не пишеться до підтвердження `docs/prd/web-mvp.md` та `docs/prd/canonical-matching.md`.

## MVP провайдери

- `yakaboo/` — Yakaboo скрапер
- `book-club/` — BookClub скрапер

## Як додати провайдера

Детально: [agent_docs/scraper-development.md](../../agent_docs/scraper-development.md)

Коротко: створи директорію `<provider-name>/`, реалізуй `ScraperProvider` інтерфейс із `packages/shared`, зареєструй у registry.

## Що тут НЕ живе

- Canonical matching — окремий шар (деталі у `docs/prd/canonical-matching.md`)
- Запис у БД напряму — через API або окремий job (TBD)
- Типи — тільки з `packages/shared`

## Конфігурація

- `SCRAPE_INTERVAL_HOURS` — частота скрапінгу (default: `12`)
