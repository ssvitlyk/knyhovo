# packages/web

UI пакет. Стек TBD (очікується Next.js).

> Код не пишеться до підтвердження `docs/prd/web-mvp.md`.

## Що тут живе

- Сторінки: пошук, сторінка книги, wishlist
- UI компоненти
- Клієнтська логіка (пошук, wishlist через localStorage до входу)

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
