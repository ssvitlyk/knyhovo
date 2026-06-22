-- CreateEnum
-- Three new enum types for scrape run tracking (W10.1).
-- The `provider` enum already exists — not recreated here.
CREATE TYPE "scrape_run_kind" AS ENUM ('full-catalog', 'wishlist-refresh', 'manual', 'description-enrichment');

-- CreateEnum
CREATE TYPE "scrape_run_status" AS ENUM ('running', 'success', 'partial', 'failed');

-- CreateEnum
CREATE TYPE "scrape_run_trigger" AS ENUM ('cron', 'manual', 'system');

-- CreateTable
CREATE TABLE "scrape_runs" (
    "id"                   TEXT NOT NULL,
    "provider"             "provider" NOT NULL,
    "kind"                 "scrape_run_kind" NOT NULL,
    "status"               "scrape_run_status" NOT NULL DEFAULT 'running',
    "triggered_by"         "scrape_run_trigger" NOT NULL,
    "started_at"           TIMESTAMP(3) NOT NULL,
    "finished_at"          TIMESTAMP(3),
    "duration_ms"          INTEGER,
    "items_found"          INTEGER NOT NULL DEFAULT 0,
    "items_updated"        INTEGER NOT NULL DEFAULT 0,
    "price_changes"        INTEGER NOT NULL DEFAULT 0,
    "availability_changes" INTEGER NOT NULL DEFAULT 0,
    "errors_count"         INTEGER NOT NULL DEFAULT 0,
    "error_summary"        TEXT,
    "metadata"             JSONB,

    CONSTRAINT "scrape_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scrape_runs_provider_kind_started_at_idx" ON "scrape_runs"("provider", "kind", "started_at");
