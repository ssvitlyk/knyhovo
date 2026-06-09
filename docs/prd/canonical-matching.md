# PRD: Canonical Matching

> Статус: Чорновик — CM1–CM4 заповнені (S3b).
> Реалізація алгоритму — S4 (після S3a).

## Business Goals

- Показувати одну книгу з кількома цінами, а не дублікати від провайдерів
- Коректна price history навіть при розбіжностях у назвах між провайдерами
- Новий провайдер додається без ручного мепінгу існуючих книг

## Що робимо

- Алгоритм об'єднання записів Yakaboo + BookClub в один canonical record
- `canonical_books` + `provider_listings` як окремі таблиці (вже реалізовано у S2)
- Canonical record — єдина точка для пошуку, wishlist та price history

## Що НЕ робимо (в MVP)

- Адмін-інтерфейс для ручного виправлення matches
- ML-based matching
- Matching між книгами різних мов

---

## CM1: Поточний алгоритм Telegram-бота

> Джерело: `/Users/sadriller/Documents/AI/books` — виробничий TypeScript код (~2700 рядків).
> Провайдери: Yakaboo, Vivat, BookClub, Knigoland, Bohdan Books та ін. (10+).

### Крок 1 — Фільтрація вхідних пропозицій

Перед matching відсіюється все нефізичне:
- Електронні книги: "epub", "pdf", "fb2", "електронна книга"
- Аудіокниги: "аудіокнига", "mp3", "audiobook"
- Нефізичні товари: настільні ігри ("настільна гра"), ноти, канцтовари
- Маркери стану знімаються із заголовку: "з пошкодженням", "(уцінка)", "(брак)"

### Крок 2 — Нормалізація

**`normalizeText()`** (базова функція):
1. Видалення діакритики (à→a, ñ→n тощо)
2. Lowercase
3. `ґ → г` (рівнозначні для пошуку)
4. Standalone `й → і` (тільки як окреме слово: "й" у "синій" залишається)
5. Видалення пунктуації (залишаються тільки літери, цифри, пробіли)
6. Collapse whitespace

**`normalizeTitle()`**:
- Виклик `normalizeText()`
- Видалення "Книга N", "Том N", "Частина N", "Vol. N", "Part N" — щоб "Книга 1" і "Книга 2" однієї серії не злипалися
- Видалення косметичних варіантів у дужках: "(суперобкладинка)", "(нова суперобкладинка)"

**`normalizeAuthor()`**:
- Split по `,`, `;`, `&`
- Слова всередині кожного імені сортуються (→ порядок слів не важливий)
- Самі автори сортуються між собою (→ порядок кількох авторів не важливий)

**`normalizeIsbn()`**:
- Видалення всього крім цифр та `X`
- ISBN-10 → ISBN-13 з перерахунком check digit

### Крок 3 — Matching (перший прохід, `findMatch()`)

```
1. ISBN exact match
   - Якщо обидва мають валідний ISBN і вони збігаються → 100% confidence
   - Виняток: bundle ≠ single → блок (навіть при збігу ISBN)

2. Exact key match
   - normalizedTitle + normalizedAuthor збігаються точно → 95% confidence

3. Fuzzy matching
   a. Рахується titleSim = transliterationSimilarity(coreTitle, coreTitle)
      + boost: wordSuffixContainment (один заголовок є суфіксом/префіксом іншого, мін. 3 слова)
      + boost: wordSequenceOverlap (найдовша спільна послідовність слів, мін. 3)
      → effectiveTitleSim = max(titleSim, containment, overlap)
   b. Якщо effectiveTitleSim < 0.82 → skip
   c. authorSim = transliterationSimilarity(normalizedAuthor, normalizedAuthor)
   d. Якщо authorSim < 0.75 → skip
   e. score = effectiveTitleSim×0.50 + authorSim×0.25 + volumeScore×0.15 + editionScore×0.10
   f. confidence = round(score × 100)
   g. Auto-merge якщо confidence ≥ 70
```

**`transliterationSimilarity()`**: якщо обидва рядки в одному алфавіті — Levenshtein similarity; якщо різні — конвертація і порівняння в обох напрямках, повертає maximum.

**Жорсткі блоки (merge не відбувається):**
- bundle ≠ single (пакет книг vs окрема книга)
- volumeNumber 1 ≠ volumeNumber 2 (коли обидва явно задані)
- parent-series title ("Війна старого") проти specific-volume canonical ("Книга 2. Бригади привидів")

**ISBN conflict у боті** — якщо один з кандидатів має інший валідний ISBN, candidate пропускається (продовжується пошук далі). Це може призвести до false negative: два записи для однієї книги, якщо ISBN у провайдерів помилковий.

### Крок 4 — Другий прохід (`sanitizeCanonicalBooks()`)

Після першого проходу — batch deduplication:
1. Групування за ключем `[normalizedTitle, volumeNumber, isBundle]`
2. Merge між групами за трьома критеріями:
   - Слова автора одного є підмножиною слів автора іншого + words subset у назвах
   - Обидва є special edition варіантами (суперобкладинка, колекційне) одного ISBN
   - Jaccard similarity meaningful tokens ≥ 0.80

---

## CM2: Задокументований алгоритм покроково

Повний алгоритм бота:

```
RawBookOffer[]
  → [Filter] відсіюємо non-physical, non-book
  → [Strip] знімаємо маркери стану з title
  → [For each offer]:
      normTitle = normalizeTitle(offer.title)
      normAuthor = normalizeAuthor(offer.author)
      isbn = normalizeIsbn(offer.isbn)  ← якщо valid

      → findMatch(existingCanonicals, offer):
          1. ISBN exact match → merge (confidence 100)
          2. Key exact match → merge (confidence 95)
          3. Fuzzy → merge if confidence ≥ 70
          4. No match → createCanonical()

  → [Second pass] sanitizeCanonicalBooks():
      group by titleKey → merge compatible groups
      → final CanonicalBook[]
```

---

## CM3: Відомі проблеми та Edge Cases

### Таблиця edge cases

| # | Категорія | Приклад (реальний з бота) | Поведінка бота | Ризик для Knyhovo |
|---|-----------|--------------------------|----------------|-------------------|
| 1 | Серія у заголовку одного провайдера | Yakaboo: `"Гра Престолів"` / BookClub: `"Пісня льоду й полум'я. Книга 1. Гра Престолів"` | wordSuffixContainment boost → merge | Без boost → два canonical records |
| 2 | `й` vs `і` у назвах | `"Пісня льоду й полум'я"` ↔ `"Пісня льоду і полум'я"` | `й→і` нормалізація → exact match | Без нормалізації → miss |
| 3 | ISBN-10 vs ISBN-13 | `"0-06-112008-1"` ↔ `"9780061120084"` | ISBN-10→13 конвертація → match | Без конвертації → miss |
| 4 | Порядок слів у імені автора | `"Коцюбинський Михайло"` ↔ `"Михайло Коцюбинський"` | Sort words in author → match | Без sort → miss |
| 5 | Серія-батько vs конкретний том | `"Війна старого"` ↔ `"Книга 2. Бригади привидів"` | Hard block: parent-series guard | Без guard → false positive merge |
| 6 | Один провайдер без ISBN | Yakaboo: isbn=null / BookClub: isbn="9786177933105" | Fuzzy fallback → може merge або miss | ISBN lookup не спрацює; потрібен fuzzy |
| 7 | Косметичні видання | `"Гаррі Поттер (суперобкладинка)"` ↔ `"Гаррі Поттер"` | Stripping `(суперобкладинка)` → same normalizedTitle → merge | Без stripping → два records |
| 8 | Скорочення імені автора | `"Дж. Р. Р. Толкін"` ↔ `"Джон Рональд Руел Толкін"` | authorSimilarity < 0.75 → miss у боті; не вирішено | False negative у Knyhovo теж |

### Відкриті питання по edge cases

- **EC-6 (ISBN відсутній):** якщо один провайдер не дає ISBN — чи достатньо fuzzy threshold 0.85 для надійного match? Відповідь отримаємо після S3a (реальні дані Yakaboo/BookClub).
- **EC-8 (скорочення авторів):** "Дж. Р. Р. Толкін" залишається false negative у MVP; вирішення — поза S4 scope.

---

## CM4: Новий алгоритм для Knyhovo

### Зафіксовані рішення

| Питання | Рішення | Обґрунтування |
|---------|---------|---------------|
| Основний сигнал | **ISBN-first** | Коли обидва провайдери дають ISBN → детерміновано |
| Fallback | **Fuzzy title + author** | Адаптовано з бота, спрощено для 2 провайдерів |
| Title threshold | **0.85** | Вищий за ботовий 0.82 — менша кількість провайдерів → менше false positive прийнятно |
| Author threshold | **0.80** | Вищий за ботовий 0.75 — та сама причина |
| Final score threshold | **0.85** | Фінальний weighted score для auto-merge |
| Online vs Batch | **Online** | 2 провайдери, малий обсяг → matching під час scrape run; no batch job у MVP |
| ISBN conflict | **Skip + log** | Не force-merge; залишаємо як окремі canonical records; логуємо для ручного review |
| ISBN відсутній | **Fuzzy fallback** | Якщо isbn=null у обох або одного — переходимо до fuzzy |

### Стратегія вирішення конфліктів

**ISBN conflict** (обидва мають ISBN, але різні):
- Можлива причина: помилковий ISBN у провайдера, або різні видання/комплекти
- Дія: skip auto-merge; log `{ provider_a, isbn_a, title_a, provider_b, isbn_b, title_b }`; залишаємо два окремих canonical records
- Вирішення: manual review або автоматичне у S4 після аналізу реальних даних

**Low confidence** (fuzzy score < 0.85):
- Дія: create new canonical record
- Дублі, що виникнуть, вирішуються вручну або у batch cleanup

**No author** у одного провайдера:
- Якщо title match ≥ 0.92 → merge з penalty (authorSim = 0.8)
- Якщо title match < 0.92 → skip (не можемо підтвердити)

### Дані для matching

З `provider_listings` використовуємо:
- `title` → normalizeTitle() in-memory
- `author` → normalizeAuthor() in-memory
- `isbn` → normalizeIsbn() in-memory

> **Важливо:** `normalizedTitle` та `normalizedAuthor` у MVP **не зберігаються** у БД.
> Нормалізація виконується in-memory під час кожного matching run.
> `canonical_books` у S2 містить тільки raw `title`, `author`, `isbn`.
> Рішення про persist normalized fields — відкладено до S4, якщо аналіз продуктивності покаже потребу.

### Псевдокод нового алгоритму

```
// Виконується під час scrape run для кожного нового ProviderListing
// existingBooks — вибірка з canonical_books (з БД)
// normalizedTitle/normalizedAuthor обчислюються in-memory, не зберігаються

function matchOrCreate(
  listing: ProviderListing,
  existingBooks: CanonicalBook[]
): { action: 'merge' | 'create' | 'conflict'; canonicalId?: string } {

  const normTitle  = normalizeTitle(listing.title)   // in-memory
  const normAuthor = normalizeAuthor(listing.author) // in-memory
  const normIsbn   = listing.isbn ? normalizeIsbn(listing.isbn) : null

  // ── Step 1: ISBN exact match ──────────────────────────────────────────
  if (normIsbn !== null) {
    for (const book of existingBooks) {
      const bookIsbn = book.isbn ? normalizeIsbn(book.isbn) : null

      if (bookIsbn === normIsbn) {
        return { action: 'merge', canonicalId: book.id }
      }

      // ISBN conflict: обидва мають ISBN, але різні
      if (bookIsbn !== null && bookIsbn !== normIsbn) {
        // Можливо: помилковий ISBN або різні видання
        // Не merge автоматично; залишаємо окремими; логуємо
        log('isbn_conflict', { listing, conflicting_book: book })
        // Продовжуємо перебір — можливо, інший canonical matches
        continue
      }
    }
  }

  // ── Step 2: Exact normalized key match ───────────────────────────────
  for (const book of existingBooks) {
    const bookNormTitle  = normalizeTitle(book.title)   // in-memory
    const bookNormAuthor = normalizeAuthor(book.author) // in-memory

    if (normTitle === bookNormTitle && normAuthor === bookNormAuthor) {
      return { action: 'merge', canonicalId: book.id }
    }
  }

  // ── Step 3: Fuzzy fallback ───────────────────────────────────────────
  let bestCandidate: CanonicalBook | null = null
  let bestScore = 0

  for (const book of existingBooks) {
    const bookNormTitle  = normalizeTitle(book.title)
    const bookNormAuthor = normalizeAuthor(book.author)

    const titleSim = fuzzyScore(normTitle, bookNormTitle)
    if (titleSim < 0.85) continue

    let authorSim: number
    if (!normAuthor || !bookNormAuthor) {
      // Один із провайдерів не надає автора
      if (titleSim >= 0.92) {
        authorSim = 0.80 // penalty за непідтвердженого автора
      } else {
        continue // недостатньо впевнені без автора
      }
    } else {
      authorSim = fuzzyScore(normAuthor, bookNormAuthor)
      if (authorSim < 0.80) continue
    }

    // Ваги: title важливіший за автора для 2-провайдерного MVP
    const score = titleSim * 0.65 + authorSim * 0.35
    if (score > bestScore) {
      bestScore = score
      bestCandidate = book
    }
  }

  if (bestScore >= 0.85 && bestCandidate !== null) {
    return { action: 'merge', canonicalId: bestCandidate.id }
  }

  // ── Step 4: No match — create new canonical ──────────────────────────
  return { action: 'create' }
}

// fuzzyScore: Levenshtein-based similarity після normalizeText()
// fuzzyScore(a, b) = 1 - levenshtein(a, b) / max(a.length, b.length)
```

### Рекомендації для реалізації S4

1. **Бібліотека fuzzy matching:** реалізувати власний `levenshtein` (як у боті) або використати `fastest-levenshtein` — не тягнути важку fuzzy-бібліотеку.

2. **Нормалізація авторів:** реалізувати sort-words підхід бота (EC-4). Скорочення імен (EC-8) — поза MVP.

3. **Серія у заголовку (EC-1):** wordSuffixContainment з мін. 2 словами — реалізувати з першої ітерації, бо Yakaboo і BookClub часто форматують по-різному.

4. **`й` → `і` нормалізація (EC-2):** обов'язково з першого дня — пряме джерело false negatives.

5. **ISBN-10 → ISBN-13 конвертація (EC-3):** обов'язково — провайдери можуть давати обидва формати.

6. **Порядок запуску:** matching запускається після кожного scraper run; один прохід без second-pass deduplication у MVP (другий прохід — якщо реальні дані покажуть потребу).

7. **Логування конфліктів:** зберігати в окрему таблицю або structured log file — потрібно для ручного review після перших кількох runs.

8. **Не persist normalized fields зараз:** обчислювати in-memory; рішення про кешування — після аналізу реальних обсягів у S4.

---

## Декомпозиція (оновлена)

| Крок | Опис | Статус |
|------|------|--------|
| CM1 | Аналіз Telegram-бота — поточний алгоритм | ✅ Виконано (S3b) |
| CM2 | Документування поточного алгоритму | ✅ Виконано (S3b) |
| CM3 | Список відомих проблем з прикладами | ✅ Виконано (S3b) |
| CM4 | Проектування нового алгоритму для Knyhovo | ✅ Виконано (S3b) |
| CM5 | Реалізація matching модуля | S4 |
| CM6 | Тестування на реальних даних | S4 |

## Відкриті питання (залишаються)

1. **ISBN якість у Yakaboo/BookClub** — з'ясується після S3a (реальні scraper дані)
2. **EC-8: скорочення авторів** — "Дж. Р. Р. Толкін" vs "Джон Рональд Руел Толкін" — вирішення поза MVP
3. **Second-pass deduplication** — чи потрібна у Knyhovo з 2 провайдерами — вирішити у S4 після перших runs
