/**
 * Why a wishlist book qualifies for the «Зараз вигідно купити» section.
 * Frozen 3-value contract (Buying Reason Engine spec §3): every signal must be
 * proven by Knyhovo's own price tracking — never a store-side "was" price.
 * BEST_OFFER/BIG_DISCOUNT/BACK_IN_STOCK/GOOD_DEAL were deliberately removed;
 * do not reintroduce without an explicit product decision.
 */
export type BuyingReason = 'TARGET_REACHED' | 'LOWEST_90_DAYS' | 'PRICE_DROPPED';

/**
 * The only alert state that is PERSISTED (notifications-model-v2 §9.1).
 * Everything else about an alert is either a fact (a notification marker) or a
 * property of the live listing data.
 */
export type AlertLifecycle = 'active' | 'paused';

/**
 * The effective alert state shown to the user (notifications-model-v2 §9.3).
 *
 * - `paused`      — the user muted it (persisted).
 * - `unavailable` — the book has no strictly-IN_STOCK offer, so no promise can be kept.
 * - `reached`     — we have already emailed about the current threshold. This is a
 *                   FACT read from the notification marker, never a price
 *                   comparison, so the UI cannot claim an email that was never sent.
 * - `armed`       — watching.
 */
export type AlertState = 'armed' | 'reached' | 'unavailable' | 'paused';

/**
 * How the user asked the threshold to be chosen (notifications-model-v2 §3).
 *
 * A mode is a resolver selector and a display label — nothing downstream of the
 * resolver may branch on it.
 */
export type AlertMode = 'any-drop' | 'good-price' | 'my-price';
