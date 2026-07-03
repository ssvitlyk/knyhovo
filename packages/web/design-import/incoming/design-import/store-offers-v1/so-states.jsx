// Knyhovo · W6 — Store Offers Intelligence · the 10 states.
// Authored explicitly (this file IS the data spec). Each filled state is a
// best-offer pick + secondary rows carrying intelligence signals. Loading /
// empty / error are body-kinds. Augments window.SO.STATES.
'use strict';

const FOOT = 'Ціни оновлено сьогодні о 08:00';
const EB5 = 'ЦІНИ У 5 КНИГАРНЯХ';
const EB = 'ЦІНИ У КНИГАРНЯХ';

window.SO.STATES = {
  /* 1 — Normal: the everyday panel; every signal type visible at low volume. */
  normal: {
    eyebrow: EB5, footnote: FOOT,
    label: '1 · Звичайний перелік',
    summary: 'Здоровий стан: найкраща ціна = найдешевша й наявна. Вторинні рядки несуть надійність, свіжість і доставку тихою лінією статусу.',
    best: { badge: 'Найкраща ціна', store: 'Yakaboo', price: 240, oldPrice: 320, verified: true,
      reasons: ['Найдешевша серед наявних', 'В наявності зараз', 'Оновлено сьогодні о 08:00'] },
    rows: [
      { store: 'Rozetka', price: 259, oldPrice: 289, avail: 'in', fresh: 'today', verified: true, delivery: '1–3 дні', grouped: 2 },
      { store: 'Книгарня «Є»', price: 265, avail: 'in', fresh: 'today', delivery: 'Безкоштовно від 600 ₴' },
      { store: 'BookChef', price: 280, avail: 'low', fresh: 'today', delivery: 'unknown' },
      { store: 'Nash Format', price: null, avail: 'out', fresh: 'today' },
    ],
  },

  /* 2 — Cheapest offer: price is the whole story; best == cheapest. */
  cheapest: {
    eyebrow: EB5, footnote: FOOT,
    label: '2 · Найдешевша = найкраща',
    summary: 'Коли найдешевша книгарня також наявна та з актуальною ціною — пояснення веде ціною.',
    best: { badge: 'Найкраща ціна', store: 'Yakaboo', price: 228, oldPrice: 310, verified: true,
      reasons: ['На 21 ₴ дешевше за наступну книгарню', 'В наявності зараз', 'Ціна актуальна — оновлено сьогодні'] },
    rows: [
      { store: 'Rozetka', price: 249, avail: 'in', fresh: 'today', verified: true, delivery: '1–3 дні' },
      { store: 'Книгарня «Є»', price: 255, avail: 'in', fresh: 'today', delivery: '2–4 дні' },
      { store: 'BookChef', price: 268, avail: 'in', fresh: 'today', delivery: 'unknown' },
    ],
  },

  /* 3 — Best overall ≠ cheapest: reliability + delivery outweigh a few ₴. */
  bestOverall: {
    eyebrow: EB5, footnote: FOOT,
    label: '3 · Найкращий вибір ≠ найдешевший',
    summary: 'Найдешевша книгарня неперевірена з невідомою доставкою — Книговик радить трохи дорожчий, але надійний варіант, і чесно називає найдешевший.',
    best: { badge: 'Найкращий вибір', store: 'Rozetka', price: 248, verified: true,
      reasons: ['В наявності зараз', 'Перевірена книгарня', 'Оновлено сьогодні о 08:00'],
      note: 'Найдешевша пропозиція — 232 ₴ у BookChef, але книгарню ми ще не перевіряли, а доставку не вказано.' },
    rows: [
      { store: 'BookChef', price: 232, avail: 'in', fresh: 'today', cheapestTag: true, delivery: 'unknown' },
      { store: 'Книгарня «Є»', price: 256, avail: 'in', fresh: 'today', delivery: '2–4 дні' },
      { store: 'Yakaboo', price: 259, avail: 'in', fresh: 'today', verified: true, delivery: '1–3 дні' },
      { store: 'Nash Format', price: null, avail: 'out', fresh: 'today' },
    ],
  },

  /* 4 — Cheapest but stale: lowest price hasn't been re-checked recently. */
  cheapestStale: {
    eyebrow: EB5, footnote: 'Ціни оновлено сьогодні о 08:00 · одну ціну не вдалося оновити',
    label: '4 · Найдешевша, але застаріла',
    summary: 'Найнижчу ціну давно не оновлювали — позначаємо «Ціна могла змінитися», а рекомендуємо книгарню з актуальною ціною.',
    best: { badge: 'Найкращий вибір', store: 'Rozetka', price: 245, verified: true,
      reasons: ['Ціна актуальна — оновлено сьогодні', 'В наявності зараз', 'Перевірена книгарня'],
      note: 'Найдешевша ціна — 229 ₴ у Yakaboo, але її давно не оновлювали.' },
    rows: [
      { store: 'Yakaboo', price: 229, avail: 'in', fresh: 'stale', cheapestTag: true, verified: true },
      { store: 'Книгарня «Є»', price: 258, avail: 'in', fresh: 'today', delivery: '2–4 дні' },
      { store: 'BookChef', price: 272, avail: 'low', fresh: 'today', delivery: 'unknown' },
    ],
  },

  /* 5 — Cheapest but out of stock: lowest price isn't buyable. */
  cheapestOut: {
    eyebrow: EB5, footnote: FOOT,
    label: '5 · Найдешевша, але немає в наявності',
    summary: 'Найнижча ціна — у книгарні, де книги зараз немає. Її видно як доказ перевірки, але рекомендуємо наявний варіант.',
    best: { badge: 'Найкращий вибір', store: 'Rozetka', price: 249, verified: true,
      reasons: ['В наявності зараз', 'Перевірена книгарня', 'Оновлено сьогодні о 08:00'],
      note: 'Найдешевша ціна — 222 ₴ у Yakaboo, але книги зараз немає в наявності.' },
    rows: [
      { store: 'Yakaboo', price: 222, avail: 'out', fresh: 'today', cheapestTag: true, verified: true },
      { store: 'Книгарня «Є»', price: 258, avail: 'in', fresh: 'today', delivery: '2–4 дні' },
      { store: 'BookChef', price: 270, avail: 'in', fresh: 'today', delivery: 'unknown' },
    ],
  },

  /* 6 — Multiple same-price offers: tie broken by delivery + reliability. */
  samePrice: {
    eyebrow: EB5, footnote: FOOT,
    label: '6 · Кілька однакових цін',
    summary: 'Дві книгарні з однаковою ціною — вибір розв’язується швидшою доставкою та перевіреністю, і це сказано прямо.',
    best: { badge: 'Найкращий вибір', store: 'Rozetka', price: 245, verified: true,
      reasons: ['Така сама ціна, як у Yakaboo — 245 ₴', 'Швидша доставка: 1–3 дні', 'Перевірена книгарня'] },
    rows: [
      { store: 'Yakaboo', price: 245, avail: 'in', fresh: 'today', verified: true, sameTag: true, delivery: '3–5 днів' },
      { store: 'Книгарня «Є»', price: 262, avail: 'in', fresh: 'today', delivery: '2–4 дні' },
      { store: 'BookChef', price: 279, avail: 'low', fresh: 'today', delivery: 'unknown' },
    ],
  },

  /* 7 — Provider unavailable: store down + affiliate link down + unknown stock. */
  providerUnavailable: {
    eyebrow: EB5, footnote: 'Ціни оновлено сьогодні о 08:00 · 2 книгарні тимчасово недоступні',
    label: '7 · Книгарня недоступна',
    summary: 'Найдешевші книгарні тимчасово недоступні (магазин лежить · посилання не працює) — рядки лишаються як доказ перевірки, а рекомендуємо доступну.',
    best: { badge: 'Найкраща ціна', store: 'Книгарня «Є»', price: 255, verified: true,
      reasons: ['Найдешевша серед доступних', 'В наявності зараз', 'Оновлено сьогодні о 08:00'],
      note: 'Yakaboo (240 ₴) і Rozetka (252 ₴) дешевші, але зараз недоступні.' },
    rows: [
      { store: 'Yakaboo', price: 240, avail: 'in', fresh: 'today', verified: true, storeDown: true },
      { store: 'Rozetka', price: 252, avail: 'in', fresh: 'today', verified: true, linkDown: true },
      { store: 'BookChef', price: 268, avail: 'unknown', fresh: 'today', delivery: 'unknown' },
    ],
  },

  /* 8 — No offers available. */
  empty: { kind: 'empty', eyebrow: EB, label: '8 · Немає пропозицій',
    summary: 'Книги не знайдено в жодній книгарні. Спокійне пояснення + стеження за наявністю. Без великого маскота (рівень панелі).' },

  /* 9 — Loading skeleton. */
  loading: { kind: 'loading', eyebrow: EB, label: '9 · Завантаження',
    summary: 'Теплі плейсхолдери в розмір реальної панелі (best-блок + рядки) — без зсуву layout. Ніколи холодний сірий.' },

  /* 10 — Error loading offers. */
  error: { kind: 'error', eyebrow: EB, label: '10 · Помилка завантаження',
    summary: 'Локальна, відновлювана помилка. Решта Book Details доступна. «Спробувати ще раз» — ніколи глобальна сторінка помилки.' },
};

window.SO.ORDER = ['normal', 'cheapest', 'bestOverall', 'cheapestStale', 'cheapestOut', 'samePrice', 'providerUnavailable', 'empty', 'loading', 'error'];
