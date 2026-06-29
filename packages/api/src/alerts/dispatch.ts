/**
 * Email dispatch phase (W4b). Reads due deliveries from the outbox, applies
 * preference / unsubscribe / rate-limit gates, renders the template, sends via
 * the injected mailer, and only THEN advances the alert dedup marker — so a
 * failed send never loses the notification. Transient failures are retried with
 * backoff; non-retryable failures are skipped.
 */

import type { PrismaClient } from '@prisma/client';
import type { AlertMailer } from './mailer.js';
import { renderPriceDropEmail, renderBackInStockEmail } from './templates.js';
import {
  findDueDeliveries,
  loadDeliveryContext,
  markDeliverySent,
  markDeliveryFailed,
  markDeliverySkipped,
  deferDelivery,
  countUserDeliveriesSince,
  setUserUnsubscribeToken,
} from '../refresh/notification-delivery.repository.js';
import {
  updateAlertNotificationMarker,
  updateAlertStockMarker,
} from '../wishlist/alert/repository.js';

export interface DispatchConfig {
  /** Total send attempts before giving up (1 initial + retries). Default 4. */
  readonly maxAttempts: number;
  /** Backoff delays (ms) per retry, indexed by prior attempt count. Default [1m, 5m, 30m]. */
  readonly backoffMs: readonly number[];
  /** Per-user rolling-24h email cap. Default 20. */
  readonly maxEmailsPerDay: number;
  /** Delay (ms) before retrying a delivery deferred by the rate limit. Default 1h. */
  readonly rateLimitDeferMs: number;
  /** Base URL for links (e.g. https://knyhovo.com). */
  readonly baseUrl: string;
  /** Max deliveries processed per run. Default 200. */
  readonly limit: number;
}

export const DEFAULT_DISPATCH_CONFIG: Omit<DispatchConfig, 'baseUrl'> = {
  maxAttempts: 4,
  backoffMs: [60_000, 300_000, 1_800_000],
  maxEmailsPerDay: 20,
  rateLimitDeferMs: 3_600_000,
  limit: 200,
};

export interface DispatchDeps {
  readonly mailer: AlertMailer;
  readonly config: DispatchConfig;
  readonly now: () => Date;
  /** Token generator for lazy unsubscribe-token init. */
  readonly generateToken: () => string;
  readonly logger?: { info: (m: string) => void; error: (m: string) => void };
}

export interface DispatchSummary {
  readonly sent: number;
  readonly failed: number;
  readonly skipped: number;
  readonly deferred: number;
}

export async function dispatchPendingDeliveries(
  prisma: PrismaClient,
  deps: DispatchDeps,
): Promise<DispatchSummary> {
  const { mailer, config, now, generateToken } = deps;
  const log = deps.logger;

  const due = await findDueDeliveries(prisma, now(), config.maxAttempts, config.limit);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let deferred = 0;

  for (const delivery of due) {
    try {
      const ctx = await loadDeliveryContext(prisma, delivery.id);
      if (!ctx) {
        await markDeliverySkipped(prisma, delivery.id, { lastError: 'context missing' });
        skipped++;
        continue;
      }

      // --- Preference / unsubscribe gates ---------------------------------
      if (ctx.user.unsubscribedAt != null) {
        await markDeliverySkipped(prisma, delivery.id, { lastError: 'user unsubscribed' });
        skipped++;
        continue;
      }
      if (ctx.type === 'PRICE_DROP' && !ctx.user.priceDropEnabled) {
        await markDeliverySkipped(prisma, delivery.id, { lastError: 'price-drop disabled' });
        skipped++;
        continue;
      }
      if (ctx.type === 'BACK_IN_STOCK' && !ctx.user.backInStockEnabled) {
        await markDeliverySkipped(prisma, delivery.id, { lastError: 'back-in-stock disabled' });
        skipped++;
        continue;
      }

      // The book must still be in stock to advertise a price/link.
      if (!ctx.bestListing) {
        await markDeliverySkipped(prisma, delivery.id, { lastError: 'no in-stock listing' });
        skipped++;
        continue;
      }

      // --- Rate limit (rolling 24h) ---------------------------------------
      const windowStart = new Date(now().getTime() - 24 * 60 * 60_000);
      const sentInWindow = await countUserDeliveriesSince(prisma, ctx.user.id, windowStart);
      if (sentInWindow >= config.maxEmailsPerDay) {
        await deferDelivery(prisma, delivery.id, new Date(now().getTime() + config.rateLimitDeferMs));
        deferred++;
        continue;
      }

      // --- Unsubscribe token (lazy) ---------------------------------------
      let token = ctx.user.unsubscribeToken;
      if (!token) {
        token = generateToken();
        await setUserUnsubscribeToken(prisma, ctx.user.id, token);
      }
      const unsubscribeUrl = `${config.baseUrl}/api/notifications/unsubscribe?token=${token}`;

      // --- Render ----------------------------------------------------------
      const templateData = {
        bookTitle: ctx.book.title,
        bookAuthor: ctx.book.author,
        priceAmount: ctx.bestListing.priceAmount,
        targetPriceAmount: ctx.targetPriceAmount,
        provider: ctx.bestListing.provider,
        url: ctx.bestListing.url,
        unsubscribeUrl,
      };
      const rendered =
        ctx.type === 'PRICE_DROP'
          ? renderPriceDropEmail(templateData)
          : renderBackInStockEmail(templateData);

      // --- Send ------------------------------------------------------------
      const result = await mailer.sendAlertEmail({
        to: ctx.user.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        unsubscribeUrl,
      });

      if (result.ok) {
        await markDeliverySent(prisma, delivery.id, {
          providerMessageId: result.messageId,
          sentAt: now(),
        });
        // Advance the alert dedup marker ONLY after a successful send.
        if (ctx.type === 'PRICE_DROP' && ctx.triggerPriceAmount != null) {
          await updateAlertNotificationMarker(prisma, ctx.alertId, {
            lastNotifiedAt: now(),
            lastNotifiedPriceAmount: ctx.triggerPriceAmount,
          });
        } else if (ctx.type === 'BACK_IN_STOCK') {
          await updateAlertStockMarker(prisma, ctx.alertId, {
            lastStockNotifiedAt: now(),
            lastNotifiedAvailability: 'IN_STOCK',
          });
        }
        sent++;
        continue;
      }

      // --- Failure: retry with backoff or give up -------------------------
      const nextAttempts = delivery.attempts + 1;
      if (result.retryable && nextAttempts < config.maxAttempts) {
        const idx = Math.min(delivery.attempts, config.backoffMs.length - 1);
        const delay = config.backoffMs[idx] ?? config.backoffMs[config.backoffMs.length - 1] ?? 60_000;
        await markDeliveryFailed(prisma, delivery.id, {
          lastError: result.error,
          attempts: nextAttempts,
          nextAttemptAt: new Date(now().getTime() + delay),
        });
        failed++;
      } else {
        await markDeliverySkipped(prisma, delivery.id, {
          lastError: result.retryable ? `exhausted retries: ${result.error}` : result.error,
        });
        skipped++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log?.error(`dispatch delivery ${delivery.id} crashed: ${msg}`);
      // Best-effort: mark failed so it can retry; do not let one delivery break the batch.
      try {
        await markDeliveryFailed(prisma, delivery.id, {
          lastError: msg,
          attempts: delivery.attempts + 1,
          nextAttemptAt: new Date(now().getTime() + 60_000),
        });
        failed++;
      } catch {
        // ignore secondary failure
      }
    }
  }

  log?.info(`Alert dispatch: sent=${sent} failed=${failed} skipped=${skipped} deferred=${deferred}`);
  return { sent, failed, skipped, deferred };
}
