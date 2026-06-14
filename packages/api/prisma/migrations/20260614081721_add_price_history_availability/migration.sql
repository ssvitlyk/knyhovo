-- AlterTable
ALTER TABLE "price_history" ADD COLUMN     "availability" "availability" NOT NULL DEFAULT 'unknown';

-- CreateIndex
CREATE INDEX "price_history_provider_listing_id_price_amount_idx" ON "price_history"("provider_listing_id", "price_amount");
