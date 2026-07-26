import type { AlertMode } from '@knyhovo/shared';
import { formatUah } from '../../alerts/templates.js';
import type { AlertPolicy } from './policy.js';
import type { GoodPriceResult } from './good-price.js';

/**
 * Policy resolver — the ONLY place a mode is turned into behaviour
 * (notifications-model-v2 §9.1).
 *
 * It runs exactly once per alert, at create or update time, and its output is a
 * finished policy. Nothing downstream — engine, dedup, dispatcher, templates,
 * read models — is allowed to branch on the mode again, which is what makes
 * modes a UX concern instead of an architectural one.
 *
 * Pure: no Prisma, no clock, no config. The caller gathers the context.
 */

/** Everything a resolver needs, gathered by the caller. */
export interface ResolverContext {
  /** Canonical price right now (kopiyky), or null when nothing is in stock. */
  readonly canonicalPrice: number | null;
  /** Currency of the book's offers. */
  readonly currency: 'UAH';
  /** The good-price source's answer for this book. */
  readonly goodPrice: GoodPriceResult;
  /** The threshold the user typed — only meaningful for `my-price`. */
  readonly requestedThreshold: number | null;
}

/** The policy fields a resolver produces; lifecycle is always ACTIVE on write. */
export type ResolvedPolicy = Omit<AlertPolicy, 'lifecycle'>;

export type ResolveFailure =
  /** The book has no strictly in-stock offer, so no threshold can be honest. */
  | 'NO_CANONICAL_PRICE'
  /** «Вигідна ціна» has no calibrated threshold for this book yet. */
  | 'INSUFFICIENT_HISTORY'
  /** `my-price` without a threshold. */
  | 'THRESHOLD_REQUIRED'
  /** A threshold was supplied for a mode the server owns. */
  | 'THRESHOLD_NOT_ALLOWED'
  /** A `my-price` threshold at or above the current price would fire immediately. */
  | 'THRESHOLD_NOT_BELOW_CURRENT';

export type ResolveResult =
  | { readonly ok: true; readonly policy: ResolvedPolicy }
  | { readonly ok: false; readonly reason: ResolveFailure };

/**
 * Resolve `mode` + context into a policy.
 *
 * | mode         | threshold          | baseline | rearm       | significance |
 * |--------------|--------------------|----------|-------------|--------------|
 * | `any-drop`   | canonical price    | same     | follow-down | applied      |
 * | `good-price` | calibrated formula | —        | static      | not applied  |
 * | `my-price`   | user's number      | —        | static      | not applied  |
 *
 * `any-drop` stores the current price as the threshold on purpose: on its own that
 * makes `price <= threshold` true immediately, and it is the significance check
 * over `baseline` that decides an email is due. That is why the client-side
 * "one kopiyka below" hack is gone — the rule lives in the engine now, expressed
 * as configuration rather than arithmetic smuggled into a stored number.
 */
export function resolveAlertPolicy(mode: AlertMode, ctx: ResolverContext): ResolveResult {
  switch (mode) {
    case 'any-drop': {
      if (ctx.requestedThreshold != null) return { ok: false, reason: 'THRESHOLD_NOT_ALLOWED' };
      if (ctx.canonicalPrice == null) return { ok: false, reason: 'NO_CANONICAL_PRICE' };
      return {
        ok: true,
        policy: {
          threshold: ctx.canonicalPrice,
          baseline: ctx.canonicalPrice,
          rearmPolicy: 'follow-down',
          thresholdBasis: 'current-price',
          thresholdProof: 'Щойно ціна впаде',
        },
      };
    }

    case 'good-price': {
      if (ctx.requestedThreshold != null) return { ok: false, reason: 'THRESHOLD_NOT_ALLOWED' };
      if (!ctx.goodPrice.available) return { ok: false, reason: 'INSUFFICIENT_HISTORY' };
      return {
        ok: true,
        policy: {
          threshold: ctx.goodPrice.suggestion.amount,
          baseline: null,
          rearmPolicy: 'static',
          thresholdBasis: ctx.goodPrice.suggestion.basis,
          thresholdProof: ctx.goodPrice.suggestion.proof,
        },
      };
    }

    case 'my-price': {
      const threshold = ctx.requestedThreshold;
      if (threshold == null) return { ok: false, reason: 'THRESHOLD_REQUIRED' };
      if (ctx.canonicalPrice != null && threshold >= ctx.canonicalPrice) {
        // A threshold at or above today's price is not a target: it would be
        // reached the moment it is saved (PRD §4.3).
        return { ok: false, reason: 'THRESHOLD_NOT_BELOW_CURRENT' };
      }
      return {
        ok: true,
        policy: {
          threshold,
          baseline: null,
          rearmPolicy: 'static',
          thresholdBasis: 'user-supplied',
          thresholdProof: `Поріг — нижче ${formatUah(threshold)}`,
        },
      };
    }
  }
}
