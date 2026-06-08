# Scraper Development

> Читай коли: створюєш новий скрапер або модифікуєш існуючий провайдер.

## MVP провайдери

- Yakaboo (`packages/scrapers/yakaboo/`)
- BookClub (`packages/scrapers/book-club/`)

## Як додати нового провайдера

1. Створи директорію `packages/scrapers/<provider-name>/`
2. Реалізуй інтерфейс `ScraperProvider` з `packages/shared` (поля: title, author, ISBN, price, url, provider)
3. Зареєструй провайдер у registry (TBD при старті)
4. Напиши unit тести з реальними прикладами відповідей

## Частота скрапінгу

- Default: **кожні 12 годин**
- Значення конфігурується через env variable `SCRAPE_INTERVAL_HOURS`

## Canonical Matching

Після скрапінгу результат проходить через canonical matching перед записом у БД.
Деталі алгоритму: `docs/prd/canonical-matching.md`.

## [TODO: заповнити при старті packages/scrapers]

- Інтерфейс `ScraperProvider`
- Механізм retry при помилках
- Логування та моніторинг помилок
- Зберігання raw HTML для дебагу
- Rate limiting відносно джерела
