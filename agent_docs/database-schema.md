# Database Schema

> Читай коли: міняєш схему БД, пишеш міграцію, або додаєш нову модель.

## БД

PostgreSQL (конкретна версія — TBD при старті інфраструктури).

## Очікувані таблиці (чорновик)

```
canonical_books       — унікальна книга (title, author, ISBN, ...)
provider_listings     — запис від конкретного провайдера (book_id, provider, url, price, scraped_at)
price_history         — зміна ціни (listing_id, price, recorded_at)
users                 — користувачі (email, magic_link_token, ...)
wishlist_items        — (user_id, book_id, target_price, created_at)
```

## Правила

- Всі зміни схеми — через версіоновані міграції (інструмент TBD: Prisma / Drizzle / Flyway)
- price_history ніколи не видаляється
- canonical_books — єдина точка для wishlist та price alert

## [TODO: заповнити при старті packages/api]

- Повна DDL
- Indexes
- Інструмент міграцій
- Стратегія backup
