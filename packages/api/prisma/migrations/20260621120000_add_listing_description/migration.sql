-- AlterTable
-- Additive nullable column: per-listing product-page description (W9a F2, description enrichment foundation).
-- Backward-compatible — existing rows get NULL, no data backfill required.
ALTER TABLE "provider_listings" ADD COLUMN     "description" TEXT;
