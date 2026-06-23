-- AlterTable
-- Additive nullable columns: alert notification dedup markers (W10.4).
-- Backward-compatible — existing rows get NULL, no data backfill required.
-- `last_notified_at` records when a notification last fired; `last_notified_price_amount`
-- records the lowest price (копійки) at that moment. Together they suppress duplicate
-- notifications and re-arm when the price condition no longer holds.
ALTER TABLE "alerts" ADD COLUMN     "last_notified_at" TIMESTAMP(3),
ADD COLUMN     "last_notified_price_amount" INTEGER;
