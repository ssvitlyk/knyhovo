# API Reference

> Читай коли: пишеш або читаєш API endpoints, додаєш новий маршрут, або змінюєш контракт.

## Конвенції

Дивись: [.claude/standards/api-conventions.md](../.claude/standards/api-conventions.md)

## [TODO: заповнити при старті packages/api]

### Books

- `GET /books?q=` — пошук книг
- `GET /books/:id` — деталі книги + пропозиції + price history

### Wishlist

- `GET /wishlist` — wishlist поточного користувача
- `POST /wishlist` — додати книгу
- `DELETE /wishlist/:bookId` — видалити книгу
- `PATCH /wishlist/:bookId` — оновити targetPrice

### Auth

- Magic Link через Resend. Endpoint TBD (залежить від auth бібліотеки).

## Типи помилок

- [ ] Визначити при старті (400, 401, 404, 422, 500 — формат відповіді)
