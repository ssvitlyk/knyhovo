// Knyhovo · Price History W5 — API LAYER (priceHistoryApi).
// Contract: GET /api/books/:id/price-history?period=30d|90d|1y|all  (default 90d)
//
// W5 response shape (EXACT — do not use price/t fields):
//   { bookId, period, currency, current, lowest, highest, typicalRange{min,max},
//     change{amount,percent}, points: [ { amount, currency, availability, recordedAt } ] }
//   • every money amount is integer копійки
//   • recordedAt is an ISO string
//   • availability ∈ in-stock | out-of-stock | unknown
//
// Exposes window.PHApi: fetchPriceHistory · toViewModel · buildMockRaw · maps.
'use strict';

/* ── Period mapping (single source) ───────────────────────────────────────── */
const PH_PERIOD_MAP = { '30': '30d', '90': '90d', '365': '1y', 'all': 'all' };       // internal → API
const PH_PERIOD_REVERSE = { '30d': '30', '90d': '90', '1y': '365', 'all': 'all' };   // API → internal
const PH_API_PERIODS = ['30d', '90d', '1y', 'all'];
const PH_PERIOD_DEFAULT = '90d';

const PH_UA_MONTH = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];

/* ── Mock backend (W5 shape) ──────────────────────────────────────────────────
   Built from the frozen demo series (₴ → копійки). Lets the UI run with no live
   backend. Swap to real fetch via { useMock: false }.                          */
function buildMockRaw(internalKey) {
  const S = window.PHData.SERIES[internalKey] || window.PHData.SERIES['90'];
  const n = S.points.length;
  const base = new Date('2026-06-13T08:00:00.000Z').getTime();
  const spanDays = { '30': 30, '90': 90, '365': 365, 'all': 900 }[internalKey] || 90;
  const points = S.points.map((pt, i) => {
    const dayMs = (spanDays / Math.max(1, n - 1)) * 86400000;
    return {
      amount: pt.p * 100,                                  // копійки
      currency: 'UAH',
      availability: 'in-stock',
      recordedAt: new Date(base - (n - 1 - i) * dayMs).toISOString(),
    };
  });
  // Seam exercise: one out-of-stock snapshot keeps its historical price (never 0).
  if (internalKey === '90' && points.length > 4) {
    points[3] = Object.assign({}, points[3], { availability: 'out-of-stock' });
  }
  return {
    bookId: 'demo',
    period: PH_PERIOD_MAP[internalKey],
    currency: 'UAH',
    current: S.current * 100,
    lowest: S.low * 100,
    highest: S.high * 100,                                 // internal only — UI never shows it
    typicalRange: { min: S.usualLow * 100, max: S.usualHigh * 100 },
    change: { amount: (S.current - S.points[0].p) * 100, percent: S.change },
    points,
  };
}

function emptyRaw(apiPeriod) {
  return {
    bookId: 'demo', period: apiPeriod, currency: 'UAH',
    current: null, lowest: null, highest: null,
    typicalRange: null, change: null, points: [],
  };
}

/* ── fetchPriceHistory ─────────────────────────────────────────────────────── */
function fetchPriceHistory(bookId, apiPeriod, opts) {
  const o = opts || {};
  const useMock = o.useMock !== false;
  const scenario = o.scenario || 'ok';
  const delay = o.delay == null ? 600 : o.delay;

  if (!useMock) {
    return fetch('/api/books/' + encodeURIComponent(bookId) + '/price-history?period=' + apiPeriod)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  const internalKey = PH_PERIOD_REVERSE[apiPeriod] || '90';
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (scenario === 'error') return reject(new Error('mock network error'));
      if (scenario === 'empty') return resolve(emptyRaw(apiPeriod));
      resolve(buildMockRaw(internalKey));
    }, delay);
  });
}

/* ── Sparse axis labels derived from recordedAt (no x/label in API) ─────────── */
function phAxisLabel(apiPeriod, iso, i, arr) {
  const d = new Date(iso), total = arr.length;
  if (apiPeriod === '30d') {
    if (i === 0 || i === total - 1 || i === Math.floor(total / 2))
      return d.getUTCDate() + ' ' + PH_UA_MONTH[d.getUTCMonth()].toLowerCase();
    return '';
  }
  if (apiPeriod === 'all') {
    const prevY = i > 0 ? new Date(arr[i - 1].recordedAt).getUTCFullYear() : null;
    if (i === 0 || d.getUTCFullYear() !== prevY) return "'" + String(d.getUTCFullYear()).slice(2);
    return '';
  }
  // 90d / 1y → month abbreviation on month change
  const prevM = i > 0 ? new Date(arr[i - 1].recordedAt).getUTCMonth() : null;
  if (i === 0 || d.getUTCMonth() !== prevM) return PH_UA_MONTH[d.getUTCMonth()];
  return '';
}

/* ── toViewModel ──────────────────────────────────────────────────────────────
   API response → the series object the frozen chart/stats/advisory consume.
   Returns null for an empty response (→ section renders the empty state).
   All ₴ integers; копійки never reach the view.                                */
function toViewModel(api) {
  if (!api || !api.points || api.points.length === 0 || api.current == null || !api.typicalRange) {
    return null;
  }
  const F = window.PHFormat;
  const internalKey = PH_PERIOD_REVERSE[api.period] || '90';
  const label = (window.PHData.SERIES[internalKey] || {}).label || '';
  const points = api.points.map((pt, i, arr) => ({
    x: phAxisLabel(api.period, pt.recordedAt, i, arr),
    p: F.kopToUah(pt.amount),                 // keep historical price even when out-of-stock
    availability: pt.availability,            // seam for future break/hatch treatment
    recordedAt: pt.recordedAt,
  }));
  return {
    label,
    period: api.period,
    points,
    usualLow: F.kopToUah(api.typicalRange.min),
    usualHigh: F.kopToUah(api.typicalRange.max),
    low: F.kopToUah(api.lowest),
    high: F.kopToUah(api.highest),            // internal only — not rendered
    current: F.kopToUah(api.current),
    change: api.change ? api.change.percent : 0,
    changeAmountKop: api.change ? api.change.amount : 0,
  };
}

window.PHApi = {
  fetchPriceHistory, toViewModel, buildMockRaw, emptyRaw, axisLabel: phAxisLabel,
  PERIOD_MAP: PH_PERIOD_MAP, PERIOD_REVERSE: PH_PERIOD_REVERSE,
  API_PERIODS: PH_API_PERIODS, PERIOD_DEFAULT: PH_PERIOD_DEFAULT,
};
