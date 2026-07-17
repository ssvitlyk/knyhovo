import type { BuyingReason } from '@knyhovo/shared';

/**
 * Icon + label mapping for the 3-value `BuyingReason` enum that drives
 * «Зараз вигідно купити» (port of `WL21_REASON_META` in `wl22-app.jsx`).
 * The UI never decides the badge — it only maps this enum to an icon+label
 * (frozen rule, `incoming/CLAUDE.md`). Shared by the desktop `SaleCard` and
 * the mobile `MobRail`/`WL22MobCard` — same map, presentation-only difference.
 */
export interface ReasonMeta {
  readonly icon: string;
  readonly label: string;
}

export const WL21_REASON_META: Readonly<Record<BuyingReason, ReasonMeta>> = {
  TARGET_REACHED: { icon: 'target', label: 'Досягнуто вашої цілі' },
  LOWEST_90_DAYS: { icon: 'trending-down', label: 'Найнижча за 90 днів' },
  PRICE_DROPPED: { icon: 'arrow-down', label: 'Подешевшала' },
};

/** Resolve the icon+label for a `BuyingReason`; falls back to PRICE_DROPPED per the reference port. */
export function reasonMeta(reason: BuyingReason): ReasonMeta {
  return WL21_REASON_META[reason] ?? WL21_REASON_META.PRICE_DROPPED;
}
