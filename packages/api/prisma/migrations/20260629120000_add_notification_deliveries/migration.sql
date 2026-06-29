-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('price-drop', 'back-in-stock');

-- CreateEnum
CREATE TYPE "delivery_status" AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- AlterTable
-- Additive nullable columns: back-in-stock dedup markers (W4b).
-- Backward-compatible — existing rows get NULL, no data backfill required.
-- `last_stock_notified_at` records when a back-in-stock notification last fired;
-- `last_notified_availability` records the availability observed at that moment,
-- so a fresh OUT_OF_STOCK → IN_STOCK transition can re-arm the notification.
ALTER TABLE "alerts" ADD COLUMN     "last_notified_availability" "availability",
ADD COLUMN     "last_stock_notified_at" TIMESTAMP(3);

-- AlterTable
-- W4b notification preferences. The boolean flags default to true so existing
-- users keep receiving alerts; `unsubscribe_token` and `unsubscribed_at` are
-- nullable (token generated lazily on first send). All additive — no backfill.
ALTER TABLE "users" ADD COLUMN     "back_in_stock_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "price_drop_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "unsubscribe_token" TEXT,
ADD COLUMN     "unsubscribed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "canonical_book_id" TEXT NOT NULL,
    "type" "notification_type" NOT NULL,
    "status" "delivery_status" NOT NULL DEFAULT 'pending',
    "trigger_price_amount" INTEGER,
    "dedup_key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "last_error" TEXT,
    "provider_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_dedup_key_key" ON "notification_deliveries"("dedup_key");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_next_attempt_at_idx" ON "notification_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_user_id_created_at_idx" ON "notification_deliveries"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_alert_id_idx" ON "notification_deliveries"("alert_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_unsubscribe_token_key" ON "users"("unsubscribe_token");

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
