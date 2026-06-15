import type { Availability } from '@knyhovo/shared';
import type { BookPriceHistoryDto, PriceHistoryPeriod } from './api/types';

/* ── Period mapping (single source) ─────────────────────────────────────── */

/** Internal period keys used in UI state. */
export type PeriodKey = '30' | '90' | '365' | 'all';

/** Ordered list of period keys for rendering chips. */
export const PERIOD_ORDER: readonly PeriodKey[] = ['30', '90', '365', 'all'];

/** Default period shown on mount. */
export const DEFAULT_PERIOD_KEY: PeriodKey = '90';

/** Maps internal period key → API period string. */
export const PERIOD_MAP: Readonly<Record<PeriodKey, PriceHistoryPeriod>> = {
  '30': '30d',
  '90': '90d',
  '365': '1y',
  all: 'all',
};

/** Maps API period string → internal period key. */
export const PERIOD_REVERSE: Readonly<Record<PriceHistoryPeriod, PeriodKey>> = {
  '30d': '30',
  '90d': '90',
  '1y': '365',
  all: 'all',
};

/** Human-readable labels for period keys. */
export const PERIOD_LABEL: Readonly<Record<PeriodKey, string>> = {
  '30': '30 днів',
  '90': '90 днів',
  '365': 'Рік',
  all: 'Весь час',
};

/* ── Formatters ──────────────────────────────────────────────────────────── */

/** U+2212 MINUS SIGN (typographic, not hyphen). */
export const MINUS = '−';

/** копійки (integer) → hryvnia integer (rounded). 24000 → 240, 31850 → 319 */
export function kopToUah(kop: number): number {
  return Math.round((kop || 0) / 100);
}

/** копійки → "240 ₴" (space before ₴ U+20B4, per brand rule). */
export function formatUah(kop: number): string {
  return kopToUah(kop) + ' ₴';
}

/** Typical range → "285–318 ₴" (en-dash U+2013, one ₴). */
export function formatRange(minKop: number, maxKop: number): string {
  return kopToUah(minKop) + '–' + kopToUah(maxKop) + ' ₴';
}

/** change.percent → "−25%" / "+10%" / "0%". Uses U+2212 for negative. */
export function formatPercent(p: number): string {
  if (!p) return '0%';
  return (p < 0 ? MINUS : '+') + Math.abs(p) + '%';
}

/** change.amount (копійки) → "−80 ₴" / "+30 ₴" / "0 ₴". */
export function formatChangeAmount(kop: number): string {
  if (!kop) return '0 ₴';
  return (kop < 0 ? MINUS : '+') + formatUah(Math.abs(kop));
}

/* ── Axis labels ─────────────────────────────────────────────────────────── */

const UA_MONTH = [
  'Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер',
  'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру',
];

/**
 * Derives a sparse axis label from a recordedAt ISO string.
 * For 30d: day + month at start/mid/end; for all: year on change; otherwise
 * month abbreviation on month change.
 */
export function axisLabel(
  apiPeriod: PriceHistoryPeriod,
  iso: string,
  i: number,
  arr: readonly { readonly recordedAt: string }[],
): string {
  const d = new Date(iso);
  const total = arr.length;

  if (apiPeriod === '30d') {
    if (i === 0 || i === total - 1 || i === Math.floor(total / 2)) {
      return d.getUTCDate() + ' ' + UA_MONTH[d.getUTCMonth()].toLowerCase();
    }
    return '';
  }

  if (apiPeriod === 'all') {
    const prevY =
      i > 0 ? new Date(arr[i - 1].recordedAt).getUTCFullYear() : null;
    if (i === 0 || d.getUTCFullYear() !== prevY) {
      return "'" + String(d.getUTCFullYear()).slice(2);
    }
    return '';
  }

  // 90d / 1y → month abbreviation on month change
  const prevM =
    i > 0 ? new Date(arr[i - 1].recordedAt).getUTCMonth() : null;
  if (i === 0 || d.getUTCMonth() !== prevM) {
    return UA_MONTH[d.getUTCMonth()];
  }
  return '';
}

/* ── Advisory ────────────────────────────────────────────────────────────── */

/** Tone of the advisory line: good = below typical, high = above, calm = within. */
export type AdvisoryTone = 'good' | 'calm' | 'high';

/** A text part: plain string or bold object. */
export type AdvisoryPart = string | { readonly b: string };

export interface Advisory {
  readonly tone: AdvisoryTone;
  readonly parts: readonly AdvisoryPart[];
}

/**
 * Builds the advisory line for the given view model.
 * Objective fact only — no «Книговик вважає». Tone is for emphasis colour only.
 */
export function buildAdvisory(vm: PriceHistoryViewModel): Advisory {
  // Strict `<` for the advisory tone (matches the frozen reference); the chart
  // and stats use `<=` for the "good moment" colour. Boundary current==usualLow
  // reads as "within range" in copy but still colours green — frozen behaviour.
  const belowBand = vm.current < vm.usualLow;
  const aboveBand = vm.current > vm.usualHigh;
  const atLow = vm.current <= vm.low;

  const uah = (n: number) => n + ' ₴';
  const range = vm.usualLow + '–' + vm.usualHigh + ' ₴';
  const periodLabel = vm.label.toLowerCase();
  const moved =
    vm.change < 0 ? 'знизилася' : vm.change > 0 ? 'зросла' : 'майже не змінилася';

  const parts: AdvisoryPart[] = [];

  if (belowBand) {
    parts.push(
      'Зараз ',
      { b: uah(vm.current) },
      ' — ',
      { b: 'нижче за типовий діапазон' },
      ' цієї книги (' + range + '). ',
    );
  } else if (aboveBand) {
    parts.push(
      'Зараз ',
      { b: uah(vm.current) },
      ' — ',
      { b: 'вище за типовий діапазон' },
      ' цієї книги (' + range + '). ',
    );
  } else {
    parts.push(
      'Зараз ',
      { b: uah(vm.current) },
      ' — у межах типового діапазону цієї книги (' + range + '). ',
    );
  }

  parts.push(
    'За ' +
      periodLabel +
      ' ціна ' +
      moved +
      (vm.change !== 0 ? ' на ' + Math.abs(vm.change) + '%' : '') +
      '.',
  );

  if (atLow) parts.push(' Поточна ціна близька до історичного мінімуму.');

  return {
    tone: belowBand ? 'good' : aboveBand ? 'high' : 'calm',
    parts,
  };
}

/* ── View model ──────────────────────────────────────────────────────────── */

export interface PriceHistoryPoint {
  /** Sparse axis label (may be empty string). */
  readonly x: string;
  /** Price in ₴ (integer, already converted from kopiyky). */
  readonly p: number;
  readonly availability: Availability;
  readonly recordedAt: string;
}

export interface PriceHistoryViewModel {
  /** Human-readable period label e.g. "90 днів". */
  readonly label: string;
  /** API period string e.g. "90d". */
  readonly period: PriceHistoryPeriod;
  readonly points: readonly PriceHistoryPoint[];
  /** Lower bound of typical price range (₴ integer). */
  readonly usualLow: number;
  /** Upper bound of typical price range (₴ integer). */
  readonly usualHigh: number;
  /** Historical lowest price (₴ integer). */
  readonly low: number;
  /** Current price (₴ integer). */
  readonly current: number;
  /** Change in percent (e.g. -25). */
  readonly change: number;
  /** Change in kopiyky (signed). */
  readonly changeAmountKop: number;
}

/**
 * Maps a {@link BookPriceHistoryDto} to a {@link PriceHistoryViewModel}.
 * Returns `null` when the response has no points, no current price, or no
 * typical range — the section should show the empty state in that case.
 * All monetary values are converted from kopiyky to integer ₴.
 * Out-of-stock points keep their recorded amount (never 0 ₴).
 */
export function toViewModel(dto: BookPriceHistoryDto): PriceHistoryViewModel | null {
  if (
    !dto.points ||
    dto.points.length === 0 ||
    dto.current == null ||
    !dto.typicalRange
  ) {
    return null;
  }

  const internalKey: PeriodKey = PERIOD_REVERSE[dto.period] ?? '90';
  const label = PERIOD_LABEL[internalKey];

  const points: PriceHistoryPoint[] = dto.points.map((pt, i, arr) => ({
    x: axisLabel(dto.period, pt.recordedAt, i, arr),
    p: kopToUah(pt.amount), // keeps historical amount even for out-of-stock
    availability: pt.availability,
    recordedAt: pt.recordedAt,
  }));

  return {
    label,
    period: dto.period,
    points,
    usualLow: kopToUah(dto.typicalRange.min),
    usualHigh: kopToUah(dto.typicalRange.max),
    low: dto.lowest != null ? kopToUah(dto.lowest.amount) : kopToUah(dto.current.amount),
    current: kopToUah(dto.current.amount),
    change: dto.change?.percent ?? 0,
    changeAmountKop: dto.change?.amount ?? 0,
  };
}
