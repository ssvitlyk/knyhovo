# packages/api

REST API пакет. Стек TBD (розглядається Fastify або Express).

> Код не пишеться до підтвердження `docs/prd/web-mvp.md`.

## Що тут живе

- REST endpoints: пошук книг, сторінка книги, wishlist CRUD
- Auth: Email Magic Link через Resend
- Price alert trigger логіка

## Що тут НЕ живе

- Скрапінг — у `packages/scrapers`
- Типи — тільки з `packages/shared`
- Email шаблони — TBD (можливо окремий модуль або інлайн)

## Конвенції

[.claude/standards/api-conventions.md](../../.claude/standards/api-conventions.md) — заповнити при старті.

## Тригери для agent docs

| Питання | Документ |
|---------|----------|
| Endpoint контракти | [agent_docs/api-reference.md](../../agent_docs/api-reference.md) |
| Схема БД | [agent_docs/database-schema.md](../../agent_docs/database-schema.md) |
| Alert логіка | [agent_docs/alert-engine.md](../../agent_docs/alert-engine.md) |
