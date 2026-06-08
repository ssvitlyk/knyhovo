# PRD: Wishlist

> Статус: Чорновик — не затверджено.
> Wishlist — окрема продуктова фіча. Код не пишеться до підтвердження цього PRD.

## Business Goals

- Утримати користувача після першого пошуку через персональний wishlist
- Конвертувати пасивного відвідувача в активного через price alert
- Wishlist як самостійний модуль із власним циклом розвитку

## Що робимо (MVP)

- Анонімний wishlist через localStorage (до входу)
- Реєстрація та вхід через **Email Magic Link** (Resend)
- Після входу — merge localStorage wishlist → account wishlist
- Встановлення цільової ціни для кожної книги у wishlist
- Email-сповіщення (Resend) при падінні ціни ≤ цільової

## Що НЕ робимо (в MVP)

- Email + password авторизація
- Google OAuth або інші провайдери
- Публічні / спільні wishlist
- Рекомендації, сповіщення про нові книги автора
- Імпорт існуючих списків
- Соціальні функції

## Декомпозиція

| Крок | Опис | Примітка |
|------|------|----------|
| **W0: Auth Decision** | Визначити auth бібліотеку, механізм merge | **Блокер для W1–W3** |
| W1: Domain model | `WishlistItem` (userId, bookId, targetPrice, createdAt) | Після W0 |
| W2: API | CRUD wishlist endpoints | Після W1 |
| W3: UI | Сторінка wishlist, кнопка "Додати", редагування ціни | Після W2 |
| W4: Alert integration | Тригер email при ціні ≤ targetPrice | Після W2 |

## Auth — зафіксовані рішення (W0)

- **MVP Auth: Email Magic Link** через Resend
- Email + password — **не в MVP**
- Google OAuth — **не в MVP**
- Анонімний wishlist зберігається у **localStorage**
- Після Magic Link login — **merge** localStorage → account wishlist
- Детальна реалізація merge описується при старті W0, не реалізується зараз

## Acceptance Criteria

**W0 (gate — без цього W1–W3 не починаються)**
- Обрано auth бібліотеку
- Визначено механізм merge localStorage → account
- Merge сценарій покритий тестами перед релізом

**W1 Domain**
- `WishlistItem`: userId, bookId, targetPrice (nullable), createdAt
- Один користувач — один wishlist у MVP
- Книга може бути у wishlist без targetPrice

**W2 API**
- `GET /wishlist` → wishlist з актуальними цінами
- `POST /wishlist` → додати книгу
- `DELETE /wishlist/:bookId` → видалити
- `PATCH /wishlist/:bookId` → оновити targetPrice

**W3 UI**
- Кнопка "Додати до wishlist" на сторінці книги
- Wishlist показує поточну ціну і targetPrice поряд
- Візуальна позначка коли поточна ціна ≤ targetPrice

**W4 Alerts**
- При оновленні ціни — перевірити wishlist items з targetPrice
- Якщо нова ціна ≤ targetPrice → email через Resend (один раз per trigger)
- Email: назва книги, нова ціна, посилання

## Майбутній розвиток (поза MVP)

- Публічні та приватні wishlist
- Спільні wishlist (сім'я, друзі)
- Рекомендації на основі wishlist
- Сповіщення про нові книги улюбленого автора
- Імпорт існуючих списків

## Відкриті питання

1. **Auth бібліотека** — яка конкретно? (TBD у W0)
2. **Ліміт книг у wishlist** — 50 / 200 / без ліміту?
3. **Cooldown алертів** — якщо ціна тримається низькою кілька тижнів, скільки email надсилати?
