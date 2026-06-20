-- AlterTable
-- Additive nullable column: per-listing cover image URL (W9a F1, covers enrichment foundation).
-- Backward-compatible — existing rows get NULL, no data backfill required.
ALTER TABLE "provider_listings" ADD COLUMN     "cover_url" TEXT;
