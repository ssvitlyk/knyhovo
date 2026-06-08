# API Conventions

> Заповнити при старті `packages/api`. Поки стек не визначено — це шаблон.

## Naming

- [ ] REST resource naming (plural nouns, kebab-case)
- [ ] URL структура (`/api/v1/...` чи без версії?)

## Response Envelope

- [ ] Структура успішної відповіді
- [ ] Структура помилки (код, message, details?)

## Pagination

- [ ] Cursor-based чи offset-based?
- [ ] Формат параметрів (`cursor`, `limit` / `page`, `pageSize`)

## Versioning

- [ ] URL versioning (`/v1/`) чи header-based?

## Authentication

- Magic Link через Resend. Деталі — в `docs/prd/wishlist.md` (секція W0).
