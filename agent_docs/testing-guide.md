# Testing Guide

> Читай коли: пишеш тести або налаштовуєш CI для будь-якого пакету.

## Що і де тестувати

| Тип | Де | Що покривати |
|-----|----|--------------|
| Unit | кожен пакет | бізнес-логіка, domain, canonical matching |
| Integration | `packages/api` | API endpoints з реальною (тестовою) БД |
| Smoke | окремо | критичні flows: пошук, wishlist, алерт |

## Правила

Дивись: [.claude/rules/testing.md](../.claude/rules/testing.md)

## CI pipeline (налаштувати при старті)

```
lint → typecheck → unit tests → integration tests → smoke tests
```

## [TODO: заповнити при старті]

- Інструмент тестування (Vitest / Jest)
- Test database setup / teardown
- Fixtures та фабрики для тестових даних
- Як запускати тести локально
- Coverage report конфігурація
