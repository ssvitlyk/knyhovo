# PRD: AI Discovery (Future)

> Статус: Stub — не розробляється до стабілізації MVP та накопичення даних.
> Код не пишеться до підтвердження цього PRD.

## Контекст

Knyhovo MVP будується з чистим data foundation:
- canonical book entities з дедуплікацією між провайдерами
- append-only price history
- wishlist зі ставленням користувача до книг

Цей фундамент — необхідна передумова для AI-enhanced функцій. AI-можливості не блокують і не змінюють MVP roadmap (S0–S11).

## Стратегічний вектор

Після стабільного MVP і достатнього обсягу даних відкриваються наступні напрями:

### Semantic Search
- Query understanding замість keyword matching
- Приклад: "детектив у повоєнній Франції" → релевантні результати без точного збігу назви
- Передумова: обсяг canonical books, якісні метадані

### Book Recommendations
- Similar book suggestions на сторінці книги (жанр, автор, серія)
- Series-aware: наступна книга в серії
- Wishlist-based: "якщо тобі сподобалось X, спробуй Y"
- Price-aware: "схожа книга зараз дешевша"

### "What to Read Next"
- Персональні рекомендації на основі wishlist та читацької активності
- Передумова: достатня wishlist history

## Explicit Out of Scope (навіть у цьому PRD)

- LLM chat або conversational interface
- AI-generated reviews або summaries
- Повністю автономний recommendation engine без editorial control

## Передумови для старту

- [ ] MVP стабільний у production (S0–S11 завершені)
- [ ] Canonical matching покриває ≥ 90% книг від двох провайдерів
- [ ] Достатній обсяг даних (визначити threshold перед стартом)
- [ ] Wishlist активно використовується (є сигнал від користувачів)

## Відкриті питання

1. Який мінімальний обсяг даних достатній для релевантних рекомендацій?
2. Self-hosted embeddings (Ollama) vs. hosted API (OpenAI/Cohere)?
3. Vector DB: Pgvector (у PostgreSQL) vs. окремий сервіс?
4. A/B testing framework для оцінки якості рекомендацій?
5. Privacy: які дані про користувача можна використовувати для персоналізації?
