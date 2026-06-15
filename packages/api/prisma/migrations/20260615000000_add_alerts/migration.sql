-- CreateEnum
CREATE TYPE "alert_status" AS ENUM ('active', 'paused', 'triggered', 'unavailable');

-- CreateEnum
CREATE TYPE "alert_intent" AS ENUM ('any-drop', 'below-current', 'favourable-price', 'custom-price');

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "wishlist_item_id" TEXT NOT NULL,
    "status" "alert_status" NOT NULL DEFAULT 'active',
    "intent" "alert_intent" NOT NULL,
    "target_price_amount" INTEGER NOT NULL,
    "target_price_currency" "currency" NOT NULL,
    "paused_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alerts_wishlist_item_id_key" ON "alerts"("wishlist_item_id");

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_wishlist_item_id_fkey" FOREIGN KEY ("wishlist_item_id") REFERENCES "wishlist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: migrate existing wishlist_items thresholds into alerts.
-- The deprecated wishlist_items.target_price_* columns are intentionally KEPT
-- (not dropped) — column removal is a separate cleanup PR after W4 stabilizes.
-- The original intent is unknown for legacy rows, so it defaults to 'custom-price'.
INSERT INTO "alerts" ("id", "wishlist_item_id", "status", "intent", "target_price_amount", "target_price_currency", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    "id",
    'active'::"alert_status",
    'custom-price'::"alert_intent",
    "target_price_amount",
    "target_price_currency",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "wishlist_items"
WHERE "target_price_amount" IS NOT NULL
  AND "target_price_currency" IS NOT NULL;
