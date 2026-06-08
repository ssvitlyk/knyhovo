# PRD: Knyhovo Web MVP

> Статус: Чорновик — не затверджено. Код не пишеться до підтвердження.

## Business Goals

- Єдина точка пошуку паперових книг українською мовою
- Скоротити час порівняння цін між книгарнями
- Сформувати базу лояльних користувачів через wishlist та цінові алерти
- Довести product-market fit на двох провайдерах перед масштабуванням

## Що робимо

- Пошук книг по Yakaboo та BookClub
- Порівняння цін між провайдерами на сторінці книги
- Сторінка книги: всі пропозиції + price history
- Wishlist з цільовою ціною та email-алертами (деталі — `wishlist.md`)
- Провайдерна архітектура: новий скрапер додається без зміни core

## Що НЕ робимо (в MVP)

- Telegram-бот (джерело знань, не архітектурний фундамент)
- Інші книгарні (Rozetka тощо) — архітектура підтримує, але не реалізуємо
- Соціальні функції: спільні wishlist, рекомендації
- Мобільний додаток
- Публічні wishlist, імпорт списків
- Інфраструктура: деплой, rate limiting → окремий `docs/prd/infrastructure.md`

## Декомпозиція

| Епік | Опис | Залежності |
|------|------|------------|
| E1: Scrapers | Yakaboo + BookClub скрапери | — |
| E1a: Canonical Matching | Об'єднання дублікатів від провайдерів | E1, `canonical-matching.md` |
| E2: Database | Схема: canonical_books, provider_listings, price_history | E1a |
| E3: API | REST API: пошук, сторінка книги | E2 |
| E4: Web | UI: пошук, сторінка книги, порівняння цін | E3 |
| E5: Wishlist | Wishlist MVP — окремий PRD, включає Auth | E3 |
| E6: Alerts | Price alert engine + Resend email | E5 |

## Acceptance Criteria

**E1 Scrapers**
- Скрапер повертає: title, author, ISBN, price, url, provider
- Новий провайдер додається без зміни core (тільки новий модуль)
- Default scraping frequency: **12 годин**, конфігурується через env

**E1a Canonical Matching**
- Одна книга від двох провайдерів → один canonical record
- Деталі алгоритму: `docs/prd/canonical-matching.md`

**E2 Database**
- Схема версіонована міграціями
- price_history незмінна (append-only)

**E3 API**
- `GET /books?q=` → результати з цінами по провайдерах
- `GET /books/:id` → деталі + пропозиції + price history
- Типи з `packages/shared`

**E4 Web**
- Пошукова сторінка з ціною від кожного провайдера
- Сторінка книги: price history у вигляді списку або графіку
- Mobile-first верстка

**E5–E6** → `docs/prd/wishlist.md`

## Відкриті питання

1. **Технологічний стек** — не визначено; вирішити до старту E3/E4
2. **Частота скрапінгу** — default 12 годин зафіксовано; чи потрібен on-demand тригер?
3. **Auth** — рішення до E5; деталі в `wishlist.md`
