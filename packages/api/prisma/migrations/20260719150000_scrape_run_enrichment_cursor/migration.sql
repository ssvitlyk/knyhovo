-- AlterTable (megakniga-resumable-enrichment PRD §4.2, PR3)
-- Checkpoint columns for DESCRIPTION_ENRICHMENT runs. Additive only:
-- "cursor" — last processed provider_listings.id; NOT NULL ⇔ resumable.
-- "items_processed" — live processed counter (updated after every batch).
ALTER TABLE "scrape_runs"
  ADD COLUMN "cursor" TEXT,
  ADD COLUMN "items_processed" INTEGER NOT NULL DEFAULT 0;
