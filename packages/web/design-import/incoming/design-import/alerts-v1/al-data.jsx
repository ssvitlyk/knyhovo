// Knyhovo · Price Alerts extension (W4) — shared mock data, icons, intent
// definitions & format helpers. Composes nothing visual itself; consumed by
// al-core.jsx + the canvas files. Exports window.ALData.
'use strict';

/* ── Demo content (clearly fictional placeholder, matches Book Details demo) ── */
const AL_BOOK = {
  title: 'Відьмак. Останнє бажання',
  author: 'Анджей Сапковський',
  store: 'Yakaboo',
  current: 240,     // сьогоднішня найкраща ціна
  typicalLow: 285,  // нижня межа «типової ціни» з Price History (285–318 ₴)
};

// Wishlist demo rows — one per alert lifecycle state.
const AL_ROWS = {
  saved:   { title: 'Кобзар', author: 'Тарас Шевченко', store: 'Книгарня «Є»', price: 299, alert: null },
  watch:   { title: 'Відьмак. Останнє бажання', author: 'Анджей Сапковський', store: 'Yakaboo', price: 240, alert: { state: 'watch', intent: 'below', target: 240 } },
  trig:    { title: 'Тигролови', author: 'Іван Багряний', store: 'Yakaboo', price: 228, old: 280, target: 240, alert: { state: 'trig', intent: 'below', target: 240 } },
  paused:  { title: 'Місто', author: 'Валер’ян Підмогильний', store: 'Rozetka', price: 265, alert: { state: 'paused', intent: 'good', target: 240 } },
  unavail: { title: 'Інтернат', author: 'Сергій Жадан', store: '—', price: null, alert: { state: 'unavail', intent: 'below', target: 250 } },
};

const alUah = (n) => (n == null ? '—' : n + ' ₴');

/* ── Alert intents — the three configuration choices.
   Under the hood each sets wishlist_items.target_price (копійки). The user
   picks intent; Книговик picks the number. `needsHistory` options depend on
   Price-History typicalRange and degrade when it is missing. ── */
const AL_INTENTS = [
  {
    key: 'any', label: 'Будь-яке зниження', icon: 'trending-down',
    desc: 'Книговик напише, щойно ціна впаде.',
    priceFor: () => null, noteFor: () => 'за будь-якого зниження',
  },
  {
    key: 'below', label: 'Нижче за поточну', icon: 'tag',
    desc: 'Повідомимо, коли стане дешевше за сьогодні.',
    priceFor: (b) => b.current, noteFor: (b) => 'нижче ' + b.current + ' ₴',
  },
  {
    key: 'good', label: 'Вигідна ціна', icon: 'sparkle', needsHistory: true,
    desc: 'Коли ціна впаде до вигідного діапазону книги.',
    priceFor: (b) => b.typicalLow, noteFor: (b) => 'нижче ' + b.typicalLow + ' ₴',
  },
];
const AL_INTENT = Object.fromEntries(AL_INTENTS.map((i) => [i.key, i]));

/* ── Icons — Lucide path data, 2px round-cap stroke (DS icon spec). ──────────
   `circle` glyphs draw an enclosing circle (info / clock / check-circle). ── */
const AL_ICON = {
  bell:        { p: ['M10.268 21a2 2 0 0 0 3.464 0', 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326'] },
  'bell-ring': { p: ['M10.268 21a2 2 0 0 0 3.464 0', 'M22 8c0-2.3-.8-4.3-2-6', 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326', 'M4 2C2.8 3.7 2 5.7 2 8'] },
  'bell-off':  { p: ['M10.268 21a2 2 0 0 0 3.464 0', 'M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8c0-.538.05-1.064.144-1.573', 'm2 2 20 20', 'M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05'] },
  'bell-dot':  { p: ['M10.268 21a2 2 0 0 0 3.464 0', 'M13.916 2.314A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673 9 9 0 0 1-.585-.665'], dot: [18, 5, 3] },
  tag:         { p: ['M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z', 'M7 7h.01'] },
  'trending-down': { p: ['M16 17h6v-6', 'm22 17-8.5-8.5-5 5L2 7'] },
  sparkle:     { p: ['M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z'] },
  check:       { p: ['M20 6 9 17l-5-5'] },
  'check-circle': { circle: true, p: ['m9 12 2 2 4-4'] },
  clock:       { circle: true, p: ['M12 6v6l4 2'] },
  info:        { circle: true, p: ['M12 16v-4', 'M12 8h.01'] },
  'triangle-alert': { p: ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3', 'M12 9v4', 'M12 17h.01'] },
  pencil:      { p: ['M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z', 'm15 5 4 4'] },
  x:           { p: ['M18 6 6 18', 'm6 6 12 12'] },
  'chevron-down': { p: ['m6 9 6 6 6-6'] },
  'arrow-right': { p: ['M5 12h14', 'm12 5 7 7-7 7'] },
  bookmark:    { p: ['m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'] },
  'bookmark-check': { p: ['m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z', 'm9 10 2 2 4-4'] },
  menu:        { p: ['M4 12h16', 'M4 6h16', 'M4 18h16'] },
};

function ALIcon({ name, size = 16 }) {
  const ic = AL_ICON[name] || AL_ICON.bell;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ic.circle ? <circle cx="12" cy="12" r="10"></circle> : null}
      {ic.p.map((d, i) => <path key={i} d={d}></path>)}
      {ic.dot ? <circle cx={ic.dot[0]} cy={ic.dot[1]} r={ic.dot[2]} fill="currentColor" stroke="none"></circle> : null}
    </svg>
  );
}

window.ALData = {
  BOOK: AL_BOOK, ROWS: AL_ROWS, INTENTS: AL_INTENTS, INTENT: AL_INTENT,
  uah: alUah, Icon: ALIcon,
};
