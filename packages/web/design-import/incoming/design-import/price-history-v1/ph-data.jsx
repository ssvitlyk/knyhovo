// Knyhovo · Price History extension (W3) — shared DATA + icons + helpers.
// Mock series only (clearly fictional). Composes window.KnyhovoDesignSystem_9fa616.
// Exports to window.PHData. No new visual language — tokens only.
'use strict';

const PH_DS = window.KnyhovoDesignSystem_9fa616;

const phUah = (n) => n + ' ₴';

/* ── Icons (Lucide path data · 2px stroke · round caps — DS icon spec) ──── */
const PH_ICONS = {
  'trending-down': ['m22 17-8.5-8.5-5 5L2 7', 'M16 17h6v-6'],
  'trending-up': ['m22 7-8.5 8.5-5-5L2 17', 'M16 7h6v6'],
  minus: ['M5 12h14'],
  'chart-line': ['M3 3v18h18', 'm19 9-5 5-4-4-3 3'],
  clock: [{ circle: [12, 12, 10] }, 'M12 6v6l4 2'],
  info: [{ circle: [12, 12, 10] }, 'M12 16v-4', 'M12 8h.01'],
  check: ['M20 6 9 17l-5-5'],
  'check-circle': [{ circle: [12, 12, 10] }, 'm9 12 2 2 4-4'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  'bell-off': ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0', 'm3 3 18 18'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  calendar: ['M8 2v4', 'M16 2v4', { rect: [3, 4, 18, 18, 2] }, 'M3 10h18'],
  search: [{ circle: [11, 11, 8] }, 'm21 21-4.3-4.3'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  eye: ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z', { circle: [12, 12, 3] }],
  'wand': ['m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z'],
};

function PHIcon({ name, size = 18, strokeWidth = 2 }) {
  const parts = PH_ICONS[name] || PH_ICONS.info;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {parts.map((d, i) => {
        if (typeof d === 'string') return <path key={i} d={d}></path>;
        if (d.circle) return <circle key={i} cx={d.circle[0]} cy={d.circle[1]} r={d.circle[2]}></circle>;
        if (d.rect) return <rect key={i} x={d.rect[0]} y={d.rect[1]} width={d.rect[2]} height={d.rect[3]} rx={d.rect[4]}></rect>;
        return null;
      })}
    </svg>
  );
}

/* ── Demo book (matches the frozen Book Details mock) ─────────────────────── */
const PH_BOOK = {
  title: 'Відьмак. Останнє бажання',
  author: 'Анджей Сапковський',
  genreEyebrow: 'ФЕНТЕЗІ · СЕРІЯ «ВІДЬМАК» · КНИГА 1 ІЗ 8',
  current: 240,
  bestStore: 'Yakaboo',
  desc: '«Останнє бажання» відкриває сагу про Ґеральта з Рівії. Збірка оповідань знайомить із головними героями циклу та законами цього світу.',
};

/* ── Price-history series per period ──────────────────────────────────────
   Calm, gentle monthly-ish movement — NOT tick-by-tick trading data.
   Every series ends at the current price (240 ₴) and reads "below the usual
   range", so historical context supports a quiet "good moment" verdict.
   usualLow/usualHigh = the typical band ("звичайна ціна") that answers
   "Is this a typical price?". current sits below it → cheaper than usual.  */
const PH_SERIES = {
  '30': {
    label: '30 днів',
    points: [
      { x: '15 трав', p: 268 }, { x: '20 трав', p: 272 }, { x: '26 трав', p: 263 },
      { x: '1 чер', p: 258 }, { x: '7 чер', p: 252 }, { x: '13 чер', p: 240 },
    ],
    usualLow: 255, usualHigh: 274, low: 240, high: 272, current: 240, change: -10,
  },
  '90': {
    label: '90 днів',
    points: [
      { x: 'Бер', p: 320 }, { x: '', p: 305 }, { x: 'Кві', p: 312 }, { x: '', p: 290 },
      { x: 'Тра', p: 270 }, { x: '', p: 258 }, { x: 'Чер', p: 240 },
    ],
    usualLow: 285, usualHigh: 318, low: 240, high: 320, current: 240, change: -25,
  },
  '365': {
    label: 'Рік',
    points: [
      { x: 'Лип', p: 300 }, { x: '', p: 312 }, { x: 'Вер', p: 335 }, { x: '', p: 330 },
      { x: 'Лис', p: 318 }, { x: '', p: 305 }, { x: 'Січ', p: 295 }, { x: '', p: 288 },
      { x: 'Бер', p: 276 }, { x: '', p: 262 }, { x: 'Тра', p: 250 }, { x: 'Чер', p: 240 },
    ],
    usualLow: 288, usualHigh: 320, low: 240, high: 335, current: 240, change: -20,
  },
  'all': {
    label: 'Весь час',
    points: [
      { x: "'24", p: 290 }, { x: '', p: 312 }, { x: '', p: 335 }, { x: '', p: 360 },
      { x: '', p: 345 }, { x: '', p: 330 }, { x: '', p: 312 }, { x: "'25", p: 300 },
      { x: '', p: 285 }, { x: '', p: 270 }, { x: '', p: 258 }, { x: '', p: 250 },
      { x: '', p: 245 }, { x: "'26", p: 240 },
    ],
    usualLow: 300, usualHigh: 342, low: 240, high: 360, current: 240, change: -17,
  },
};
const PH_PERIOD_ORDER = ['30', '90', '365', 'all'];

/* Typical-price RANGE label — the band that answers "is this a typical price?".
   Format: "285–318 ₴" (one ₴, en-dash). */
function phRange(s) { return s.usualLow + '–' + s.usualHigh + ' ₴'; }

/* Price-history advisory line — OBJECTIVE observations only. Price history
   explains facts; it never speaks for Knyhovyk's judgment. No "Книговик
   вважає / думає / радить" — future AI features may interpret these facts
   later. Tone classifies the fact (good/calm/high) for emphasis colour only. */
function phAdvisoryFor(s) {
  const belowBand = s.current < s.usualLow;
  const aboveBand = s.current > s.usualHigh;
  const atLow = s.current <= s.low;
  const moved = s.change < 0 ? 'знизилася' : s.change > 0 ? 'зросла' : 'майже не змінилася';
  const parts = [];
  if (belowBand) {
    parts.push('Зараз ', { b: phUah(s.current) }, ' — ', { b: 'нижче за типовий діапазон' },
      ' цієї книги (' + phRange(s) + '). ');
  } else if (aboveBand) {
    parts.push('Зараз ', { b: phUah(s.current) }, ' — ', { b: 'вище за типовий діапазон' },
      ' цієї книги (' + phRange(s) + '). ');
  } else {
    parts.push('Зараз ', { b: phUah(s.current) }, ' — у межах типового діапазону цієї книги (' + phRange(s) + '). ');
  }
  parts.push('За ' + s.label.toLowerCase() + ' ціна ' + moved +
    (s.change !== 0 ? ' на ' + Math.abs(s.change) + '%' : '') + '.');
  if (atLow) parts.push(' Поточна ціна близька до історичного мінімуму.');
  return { tone: belowBand ? 'good' : aboveBand ? 'high' : 'calm', parts };
}

/* Backward-compat (exploration files pass a period key). */
function phAdvisory(key) { return phAdvisoryFor(PH_SERIES[key]); }

/* ── Verdict v2 — frozen set + icon + historical-context explanation ──────
   Colorblind-safe: ICON SHAPE + TITLE + POSITION distinguish each verdict,
   never colour alone. High price = informational blue (NOT red / danger).  */
const PH_VERDICTS = {
  now: {
    key: 'now', tone: 'green', label: 'Чудовий момент', icon: 'trending-down',
    title: 'Чудовий момент', en: 'Great time to buy',
    text: 'Ціна нижча за звичайну для цієї книги.',
    toneNote: 'Найсильніший зелений — лише цей вердикт',
  },
  wait: {
    key: 'wait', tone: 'neutral', label: 'Зачекайте', icon: 'minus',
    title: 'Зачекайте', en: 'Wait',
    text: 'Ціна стабільна — купувати не горить.',
    toneNote: 'Нейтральний — звичайний стан',
  },
  high: {
    key: 'high', tone: 'blue', label: 'Ціна висока', icon: 'trending-up',
    title: 'Ціна висока', en: 'Price is high',
    text: 'Ціна вища за звичний рівень. Можна зачекати.',
    toneNote: 'Інформативний синій — НЕ червоний, без тривоги',
  },
};

/* ── Demo wishlist items (self-contained) ────────────────────────────────── */
const PH_WL_ITEMS = [
  { id: 'vidmak', title: 'Відьмак. Останнє бажання', author: 'Анджей Сапковський',
    price: 240, old: 320, store: 'Yakaboo', verdict: 'now', tracking: true },
  { id: 'zvychky', title: 'Атомні звички', author: 'Джеймс Клір',
    price: 245, old: 245, store: 'Yakaboo', verdict: 'wait', tracking: true },
  { id: 'sapiens', title: 'Сапієнс. Людина розумна', author: 'Ювал Ной Харарі',
    price: 335, old: 310, store: 'Rozetka', verdict: 'high', tracking: true },
];

/* Discount section — populated rows (all 'now', with savings) */
const PH_DISCOUNT_ITEMS = [
  { id: 'vidmak', title: 'Відьмак. Останнє бажання', author: 'Анджей Сапковський',
    price: 240, old: 320, store: 'Yakaboo', verdict: 'now', tracking: true },
  { id: 'mech', title: 'Меч призначення', author: 'Анджей Сапковський',
    price: 229, old: 255, store: 'Rozetka', verdict: 'now', tracking: true },
  { id: 'krov', title: 'Кров ельфів', author: 'Анджей Сапковський',
    price: 235, old: 250, store: 'Книгарня «Є»', verdict: 'now', tracking: false },
];

const phSaved = (i) => (i.old != null && i.price != null && i.old > i.price ? i.old - i.price : 0);
const phDelta = (i) => (i.old != null && i.price != null ? i.price - i.old : 0);

window.PHData = {
  DS: PH_DS, uah: phUah, Icon: PHIcon, ICONS: PH_ICONS,
  BOOK: PH_BOOK, SERIES: PH_SERIES, PERIOD_ORDER: PH_PERIOD_ORDER, advisory: phAdvisory, advisoryFor: phAdvisoryFor, range: phRange,
  VERDICTS: PH_VERDICTS, WL_ITEMS: PH_WL_ITEMS, DISCOUNT_ITEMS: PH_DISCOUNT_ITEMS,
  saved: phSaved, delta: phDelta,
};
