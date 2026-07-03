// Knyhovo · Price History W5 — FORMATTERS (priceHistoryFormatters).
// All API money amounts are integer копійки. UI shows hryvnias only.
//   24000 (копійки) → "240 ₴"
// Single source of money/percent formatting for the Price-History block.
'use strict';

const PHF_MINUS = '\u2212'; // U+2212 MINUS SIGN (typographic, not hyphen)

/** копійки (integer) → hryvnia integer (no копійки shown). 24000 → 240 */
function kopToUah(kop) { return Math.round((kop || 0) / 100); }

/** копійки → "240 ₴" (space before ₴, per brand rule). */
function formatUah(kop) { return kopToUah(kop) + ' \u20b4'; }

/** typical range → "285–318 ₴" (en-dash, one ₴). */
function formatRange(minKop, maxKop) {
  return kopToUah(minKop) + '\u2013' + kopToUah(maxKop) + ' \u20b4';
}

/** change.percent → "−25%" / "+10%" / "0%". Sign uses U+2212. */
function formatPercent(p) {
  if (!p) return '0%';
  return (p < 0 ? PHF_MINUS : '+') + Math.abs(p) + '%';
}

/** change.amount (копійки) → "−80 ₴" / "+30 ₴" / "0 ₴". */
function formatChangeAmount(kop) {
  if (!kop) return '0 \u20b4';
  return (kop < 0 ? PHF_MINUS : '+') + formatUah(Math.abs(kop));
}

window.PHFormat = {
  MINUS: PHF_MINUS,
  kopToUah, formatUah, formatRange, formatPercent, formatChangeAmount,
};
