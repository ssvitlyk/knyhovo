/* ═══════════════════════════════════════════════════════════════════
   wl-buying-reasons.js — «Зараз вигідно купити» · бізнес-рівень (мотор
   рекомендацій), НЕ презентація. Чистий JS, без React/JSX — завантажується
   звичайним <script> (НЕ text/babel) ДО wl22-app.jsx, щоб
   window.KnyhovoBuyingReasons існував, коли Babel виконає компонент-скрипти.

   Ревізія 2026-07-08 (довіра до даних): залишено ЛИШЕ 3 причини, кожна з
   яких доводить РЕАЛЬНИЙ історичний рух ціни за власним щоденним
   трекінгом Knyhovo. BEST_OFFER / BIG_DISCOUNT / BACK_IN_STOCK / GOOD_DEAL
   були видалені з enum: вони або порівнювали книгарні між собою (не
   історію), або спирались на «знижку» як таку (percent-off), або взагалі
   не були ціновою подією. Ніякого фолбеку — книга без сигналу нижче
   просто не потрапляє в цю секцію.

   Ідея фічі: «Зараз вигідно купити» відповідає на питання «які книги з
   бажанок варто купити просто зараз?», спираючись ЛИШЕ на те, що сама
   Knyhovo відстежила з часом — ніколи на «стару ціну» чи заявлений
   відсоток знижки книгарні. Мета — довіра: «Knyhovo допомагає купити у
   правильний момент», а не «ця книгарня стверджує, що є знижка».

   Повна специфікація: «Claude Code - Buying Reason Engine.md».
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* Platform-independent enum — той самий контракт для web/mobile/backend. */
  var BuyingReason = Object.freeze({
    TARGET_REACHED: 'TARGET_REACHED',
    LOWEST_90_DAYS: 'LOWEST_90_DAYS',
    PRICE_DROPPED: 'PRICE_DROPPED',
  });

  /* Пріоритет — від найсильнішої причини до найслабшої. Індекс = ранг сортування. */
  var PRIORITY = [
    BuyingReason.TARGET_REACHED,
    BuyingReason.LOWEST_90_DAYS,
    BuyingReason.PRICE_DROPPED,
  ];
  var RANK = {};
  PRIORITY.forEach(function (r, i) { RANK[r] = i; });

  /* Визначає ЄДИНУ причину купівлі для однієї книги з бажанок, або null,
     якщо жодна умова не виконана (книга лишається у звичайних бажанках).
     book: {
       price,        // поточна відстежувана ціна (наша книгарня)
       prevPrice?,   // Knyhovo's OWN last tracked price at the previous
                      // daily check — НІКОЛИ store-side "old price"/"was"
       targetPrice?, // цільова ціна, яку задав користувач
       min90?,       // мінімальна ціна за останні 90 днів (власний трекінг)
     } */
  function evaluateBook(book) {
    if (!book || typeof book.price !== 'number') return null;
    var price = book.price;
    var prev = typeof book.prevPrice === 'number' ? book.prevPrice : null;

    /* 1 · Досягнуто вашої цілі */
    if (typeof book.targetPrice === 'number' && price <= book.targetPrice) {
      return { reason: BuyingReason.TARGET_REACHED, savingsUAH: Math.max(0, (prev != null ? prev : book.targetPrice) - price) };
    }
    /* 2 · Найнижча за 90 днів */
    if (typeof book.min90 === 'number' && price <= book.min90) {
      return { reason: BuyingReason.LOWEST_90_DAYS, savingsUAH: Math.max(0, (prev != null ? prev : book.min90) - price) };
    }
    /* 3 · Подешевшала — будь-яке зниження з моменту попередньої перевірки
       Knyhovo (немає окремого порогу «великої знижки» — розмір знижки не
       змінює причину, лише порядок усередині цієї групи, див. §6). */
    if (prev != null && price < prev) {
      return { reason: BuyingReason.PRICE_DROPPED, savingsUAH: Math.max(0, prev - price) };
    }
    return null; /* немає підстави → лишається у звичайних бажанках */
  }

  /* Оцінює весь каталог і повертає ЛИШЕ книги з підставою, відсортовані за
     силою причини, а всередині групи — за грошовою економією (спадно).
     Ніякого ліміту й ніякого штучного заповнення — довжина результату =
     скільки книг реально пройшло перевірку (може бути 0). */
  function evaluateCatalog(books) {
    var out = [];
    (books || []).forEach(function (b) {
      var verdict = evaluateBook(b);
      if (verdict) out.push(Object.assign({}, b, verdict));
    });
    out.sort(function (a, b) {
      var r = RANK[a.reason] - RANK[b.reason];
      if (r !== 0) return r;
      if (b.savingsUAH !== a.savingsUAH) return b.savingsUAH - a.savingsUAH;
      return String(a.title).localeCompare(String(b.title), 'uk');
    });
    return out;
  }

  global.KnyhovoBuyingReasons = {
    BuyingReason: BuyingReason,
    PRIORITY: PRIORITY,
    evaluateBook: evaluateBook,
    evaluateCatalog: evaluateCatalog,
  };
})(window);
