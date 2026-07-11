# PRD: Collections SQL Performance (SQL-first, агрегатна таблиця — контингентно)

> Статус: **Затверджено.** · 2026-07-11 (rev. 3 після рев'ю)
> Продовження інциденту staging `/dobirky` (502 → PR #90). PR #90 прибрав stampede
> (коалесинг + SWR + семафор), але самі білди лишилися повільними. Цей PRD усуває
> повільність. Зв'язок з [refresh-architecture-w10](refresh-architecture-w10.md):
> незалежні за кодом; опційна фаза B цього PRD стикується з W10-cron.
>
> **Rev. 2 (рев'ю власника):** (1) SQL-first — спершу доводимо виграш чистими
> SQL-запитами без нових таблиць, агрегатна таблиця лише якщо виміряний результат
> не досягає цілей; (2) якщо таблиця знадобиться — мінімальний набір полів, без
> дублювання дешево-дериваних значень; (3) `wishlistCount` у жодному разі не
> живе в агрегаті скрап-даних — інший життєвий цикл; (4) додано baseline-метрики.
>
> **Rev. 3 (рев'ю власника):** (1) виправлено логіку history-фідів — деривати
> history рахуються по **всьому** eligible candidate set ДО сортування і
> `LIMIT/OFFSET`, per-page lateral застосовний лише до display-only збагачення;
> (2) явно зафіксовано, що саме це — ймовірна точка провалу gate, яка активує
> фазу B; (3) критерій «без seq scan» замінено на кількісні plan-критерії
> (cost/rows/buffers/latency); (4) заміри розділено: page query / total count /
> hub counters; (5) окрема кеш-політика для wishlist-derived фідів.

---

## 1. Baseline (виміряно 2026-07-11 проти staging API, після деплою PR #90)

**Масштаб даних** (з API; прямий доступ до staging БД відсутній — Railway TCP proxy):

| Показник | Значення |
|---|---|
| Книг із ціною (pool `populyarne-zaraz`) | **30 187** |
| З них «новинки» (`createdAt >= now() - interval '30 days'`) | 7 546 |
| Активних колекцій | 34 (17 публічно резолвиться) |
| `price_history` | необмежена глибина на лістинг, тягнеться цілком у кожен білд |

**Латентності** (curl до `api-staging-79f0.up.railway.app`):

| Сценарій | Час |
|---|---|
| Теплий кеш (будь-який ендпоінт) | 0.26–0.31s |
| Холодний білд однієї колекції | 2.0–7.9s |
| Найважчі: `rekordno-nyzka-tsina` / `najbilsh-bazhani` / `knyhovyk-radyt` | 4.5–10.3s |
| Хвіст черги семафора при 17 конкурентних холодних | **18.9s** |
| До PR #90 той самий burst | 502 (сторінка падала у фолбек) |

Причини (простежено по коду):

1. **`findAllCanonicalBooks` — вся таблиця без `where`**, з усіма
   `provider_listings` і **всією `price_history`** (nested select,
   `repository.ts:49-71`) — на кожен некешований запит будь-якого ендпоінта
   (`buildHubComputeContext`, `service.ts:103`).
2. Dynamic-фіди рахуються в JS (`computeDynamicPool`, `service.ts:284-354`);
   `znyzhky`/`ponyzhena-tsina`/`rekordno-nyzka-tsina` сканують повну history
   на кожну книгу; mapper (`mapper.ts:59-98`) повторно дериває
   cheapest/oldPrice/discount для кожної книги відповіді.
3. Hub: ~25 послідовних дрібних запитів — `findCollectionBySlug` ×11 +
   `findCollectionItemBookIds` на кожну курировану колекцію
   (`service.ts:460-471, 490-495`).
4. Пагінація — `slice()` після повної побудови й сортування пулу в пам'яті;
   сторінка з 24 книг будує весь фід.
5. `getAllCollections` / `getCollectionDetail` не кешуються взагалі.

## 2. Цілі (acceptance — вимірюється тим самим способом, що baseline)

Заміри ведуться **окремо для трьох класів запитів** (методологія — та сама
у baseline C2 і після):

| Метрика (staging, холодний кеш) | Baseline | Ціль |
|---|---|---|
| **Page query** фіда (24 книги, WHERE+ORDER BY+LIMIT) | у складі 2–10.3s білда | **< 200ms** |
| **Total count** фіда (той самий WHERE) | — (рахується зі slice) | **< 100ms** |
| **Hub counters** (усі лічильники хаба разом) | у складі 2.5s hub-білда | **< 300ms** |
| Холодний білд одного фіда end-to-end | 2–10.3s | **< 300ms** |
| Повний холодний `/dobirky` (11 запитів) | до ~19s хвіст | **< 1.5s** |
| 502 під холодним burst | 0 (завдяки семафору) | 0 без опори на семафор |
| Порядок книг у кожному фіді | — | ідентичний до/після (снапшот на сіді) |

**Plan-критерії** (замість наївного «без seq scan»; збираються через
`EXPLAIN (ANALYZE, BUFFERS)` на staging-обсязі):

- execution time кожного запиту в межах цілей таблиці вище;
- оброблені rows пропорційні **eligible candidate set** відповідного фіда
  (novynky ≈ 7.5k, znyzhky-кандидати тощо), а не `books × history`;
- shared buffers read/hit без повного прочитання `price_history` для
  не-history-фідів; для history-фідів — обмежене top-1-per-listing читання;
- при подвоєнні history (перевіряється на сіді з подвоєною історією) latency
  і оброблені rows **не зростають лінійно**, як зростали б при повному
  скануванні history — допустиме обмежене/логарифмічне зростання,
  характерне для top-1 index-доступу; абсолютна стабільність cost не
  вимагається.

Контракти незмінні: `CollectionBookDto` байт-у-байт, `per_page=24`, shape
hub/books/list, жодних UI-змін.

## 3. Фаза A — чистий SQL, без нових таблиць (основний план)

### 3.1 Read-шлях

- **Зняти `findAllCanonicalBooks`-контекст.** Кожен фід — власний запит із
  `WHERE`/`ORDER BY`/`LIMIT/OFFSET` (пагінація в SQL; `total` — `count()` з тим
  самим `where`):
  - `populyarne-zaraz`: join `wishlist_items` (groupBy/lateral), order
    `in_stock DESC, wishlist_count DESC, created_at DESC`;
  - `novynky`: `created_at >= now() - 30d` (+ індекс §3.3), кеп 25% — `LIMIT`;
  - `najbilsh-bazhani`: `wishlist_count > 0`, order desc — той самий join;
  - `znyzhky` / `ponyzhena-tsina` / `rekordno-nyzka-tsina` (**history-фіди**):
    history-деривати (максимальна історична > поточної; ціна as-of `now()-7d`;
    all-time-low з ≥2 точок) є **фільтром та/або ключем сортування**, тому
    рахуються в SQL по **всьому eligible candidate set** (усі priced-книги)
    ДО `ORDER BY` і `LIMIT/OFFSET` — lateral/subquery top-1 по `price_history`
    на кожного кандидата, з наявними індексами `(providerListingId, recordedAt)`
    і `(providerListingId, priceAmount)`. Звузити цей обчислювальний обсяг до
    сторінки неможливо за визначенням фіда.
- Поля, що беруть участь у `WHERE`/`ORDER BY` (in_stock, min-ціна,
  wishlist_count, history-деривати history-фідів), рахуються по всьому
  candidate set у самому запиті; **display-only** збагачення (cover,
  offersCount, oldPrice/discount на не-history-фідах, storeName) — lateral
  лише для 24 книг повернутої сторінки.
- **Порядок обчислень перевернуто для display-збагачення:** SQL звужує до
  сторінки, mapper збагачує лише її (сьогодні вся деривація йде в JS по
  всьому каталогу незалежно від сторінки).
- TAXONOMIC: `WHERE genre_id = ?`; EDITORIAL: join `collection_items`
  (індекси є).
- Hub: лічильники = `COUNT(*)` з тими самими `where`; слаги — один
  `findMany({ slug: { in } })` замість 11 `findUnique`; item-counts — один
  `groupBy` по `collection_items`.
- `getAllCollections` / `getCollectionDetail` — кешуються так само, як
  books/hub.
- **Кеш-політика розділена за джерелом даних фіда:**

  | Клас фіда | Приклади | TTL |
  |---|---|---|
  | scrape-derived (міняється 1–2×/добу) | novynky, znyzhky, ponyzhena-tsina, rekordno-nyzka-tsina, taxonomic, editorial | 30 хв |
  | **wishlist-derived** (міняється на кожну дію користувача) | najbilsh-bazhani, populyarne-zaraz (wishlist-ключ сортування), hub (містить їхні лічильники) | 5 хв (як зараз) |

- Кеш-шар PR #90 лишається без змін (страховка, не милиця).

### 3.2 `wishlistCount` — окремий потік

`wishlistCount` **не змішується** зі скрап-даними (інший життєвий цикл,
змінюється на кожну дію користувача): завжди рахується live — індексований
`groupBy`/join по `wishlist_items` (новий індекс §3.3). На сторінку з 24 книг
це один дешевий запит/join.

### 3.3 Індекси (єдина зміна схеми у фазі A)

- `wishlist_items`: `@@index([canonicalBookId])` — лічильники (сьогодні groupBy
  без індексу по ключу).
- `canonical_books`: `@@index([createdAt])` — novynky.
- За результатами `EXPLAIN`: опційно `provider_listings`
  `@@index([canonicalBookId, availability, priceAmount])` для min-price
  агрегату.

### 3.4 Вимірювальний gate

Після фази A — заміри проти staging тим самим методом, що baseline (§1),
**окремо**: page query, total count, hub counters (плюс end-to-end фіда і
повний `/dobirky`). **Якщо цілі §2 досягнуто — фаза B не виконується і
агрегатна таблиця не створюється.** Результати замірів додаються у цей PRD.

**Ймовірна точка провалу — названа заздалегідь:** history-фіди (§3.1), де
top-1-агрегат по `price_history` мусить пройти по всьому candidate set
(~30k книг) до сортування. Якщо саме їхні page query / count не вкладаються
в цілі §2 при прийнятних планах — це і є тригер фази B; решта фідів на
фазу B не впливають (їхні агрегати history не потребують).

## 4. Фаза B — контингентна: мінімальний `book_price_stats`

Виконується **лише** якщо gate §3.4 показав, що history-агрегати в lateral-SQL
не вкладаються в цілі (єдиний реалістичний кандидат на провал — три
history-залежні фіди на великій історії).

Мінімальна таблиця — **тільки history-дериват, нічого дешево-дериваного**:

```prisma
model BookPriceStats {
  canonicalBookId     String   @id @map("canonical_book_id")
  oldPriceAmount      Int?     @map("old_price_amount")      // найвища історична > поточної
  discountPercent     Int?     @map("discount_percent")
  priceLookbackAmount Int?     @map("price_lookback_amount") // ціна ~7 днів тому
  isAllTimeLow        Boolean  @default(false) @map("is_all_time_low")
  updatedAt           DateTime @updatedAt @map("updated_at")
  book CanonicalBook @relation(fields: [canonicalBookId], references: [id], onDelete: Cascade)
  @@index([discountPercent])
  @@map("book_price_stats")
}
```

- **Без** `coverUrl`, `cheapestProvider`, `minPrice`, `inStock`, `offersCount`
  (деривляться індексованим SQL по `provider_listings` у фазі A) і **без**
  `wishlistCount` (§3.2 — окремий життєвий цикл).
- Оновлення — **лише скрап-потік**: хук у `persist-listing.ts` (точковий
  recompute книги при зміні ціни/наявності) + CLI `stats:rebuild`
  (backfill у міграції; нічний safety net через W10-cron). Жодних оновлень
  з user-шляхів — таблиця похідна тільки від scrape-даних, дрейф можливий
  лише при пропущеному хуку й лікується rebuild-ом.
- `computeBookPriceStats(rows)` — чиста функція, переносить
  `highestHistoricalAbove`/`priceAroundLookback`/`isAllTimeLow`
  (`service.ts:231-272`) з юніт-тестами еквівалентності.

## 5. Чого НЕ робимо (non-goals)

- Жодних змін контрактів API і UI.
- Пошук (`/api/search`) — окрема робота.
- Жодних змін canonical matching, persist-правил, скраперів.
- Materialized view — відхилено: `REFRESH ... CONCURRENTLY` усієї view після
  кожного скрапу дорожчий за точковий recompute, і Prisma-міграції з view
  незручні.
- Redis/зовнішній кеш — не потрібен при швидких білдах.

## 6. Фази / PR-и

| PR | Обсяг | Залежності |
|---|---|---|
| **C0** | Цей PRD; затвердження | — |
| **C1** | Фаза A: індекси (§3.3) + SQL-фіди + hub-батчі + SQL-пагінація + кеш list/detail + розділена TTL-політика (30 хв scrape-derived / 5 хв wishlist-derived, §3.1); снапшот-тести порядку до/після | C0 |
| **C2** | Вимірювальний gate проти staging (§3.4); результати — у PRD | C1 |
| **C3** | *(лише якщо gate провалено)* Фаза B: `book_price_stats` + persist-хук + `stats:rebuild` + backfill + тести еквівалентності | C2 |
| **C4** | (опц., з W10.6) нічний `stats:rebuild` у cron — лише якщо C3 відбувся | C3, W10 |

## 7. Ризики

- **Поведінкова еквівалентність фідів:** SQL-порядок має відтворити поточні
  tie-break-и (включно з `outOfStockLast`) — снапшот-тести на сідовій БД:
  той самий вхід → той самий порядок id до/після C1.
- **History-фіди — головний кандидат на провал gate** (§3.4): повний
  candidate-set прохід по history до сортування. Мітигація — gate C2 з
  роздільними замірами і контингентна фаза B, а не превентивна таблиця.
- **Wishlist-derived фіди зі свіжістю 5 хв:** підняття їхнього TTL зробило б
  «Обране читачами» сліпим до нових бажанок на пів години — тому кеш-політика
  розділена (§3.1), а не єдина.
- **Backfill-міграція (фаза B) на Railway:** `migrate deploy` виконується на
  старті сервісу (8c63a6f) — backfill ідемпотентний і батчами, без довгих
  lock-ів.
- **Дрейф `book_price_stats` ↔ лістинги (фаза B):** єдиний писар — скрап-потік;
  нічний rebuild; тести еквівалентності.

## 8. Тести (coverage нових модулів ≥ 80%, детерміновані)

- **Снапшот еквівалентності (C1):** для кожного фіда порядок id, `total`,
  пагінація збігаються з поточною JS-реалізацією на сідових даних.
- **Unit (C1):** SQL-білдери фідів (умови/сортування), hub-батчі.
- **Unit (C3, якщо буде):** `computeBookPriceStats` — еквівалентність
  `highestHistoricalAbove`/`priceAroundLookback`/`isAllTimeLow` на фікстурах
  (без history, 1 точка, null-ціни, out-of-stock).
- **Integration (C3, якщо буде):** зміна ціни у persist → stats оновлені;
  rebuild лагодить штучний дрейф.
- **Регресія контракту:** наявні collections route/dto тести — без змін.

## 9. Verification

- `pnpm typecheck && pnpm lint && pnpm test` зелені.
- Заміри C2 проти staging тим самим методом, що §1, з роздільними цифрами
  page query / total count / hub counters; цілі §2 досягнуто.
- `EXPLAIN (ANALYZE, BUFFERS)` ключових фідів відповідає plan-критеріям §2
  (latency, rows ∝ candidate set, buffers, стабільність cost при подвоєнні
  history).
