-- Cleanup before CreateIndex (megakniga-resumable-enrichment PRD §4.6, PR4).
-- Before PR4 nothing bounded concurrent enrichment runs: a kill -9 / OOM /
-- Railway restart (no heartbeat, no reaper for this kind until now) leaves a
-- RUNNING description-enrichment row forever, and a re-run inserts another —
-- so the DB can already hold two+ RUNNING rows for the same provider. The
-- CREATE UNIQUE INDEX below would then fail with a unique violation, breaking
-- `prisma migrate deploy` (and thus API boot). Close those stranded rows to
-- FAILED first — cursor / metadata (incl. resumedFromRunId) are left intact,
-- so every closed row stays resumable via the normal FAILED+cursor path.
UPDATE "scrape_runs"
SET
  "status" = 'failed',
  "finished_at" = NOW(),
  "error_summary" = 'Closed by scrape_runs_one_active_enrichment migration'
WHERE
  "status" = 'running'
  AND "kind" = 'description-enrichment';

-- CreateIndex (megakniga-resumable-enrichment PRD §4.6, PR4)
-- DB-level lock: at most ONE RUNNING enrichment run per provider. A second
-- `startScrapeRun` INSERT hits this index and fails with a unique violation
-- (Prisma P2002), which the CLI reports as "enrichment already running".
-- Scoped strictly to kind='description-enrichment' (the mapped PostgreSQL
-- value of ScrapeRunKind.DESCRIPTION_ENRICHMENT; statuses map to lowercase),
-- so FULL_CATALOG / WISHLIST_REFRESH / MANUAL rows are never affected.
CREATE UNIQUE INDEX "scrape_runs_one_active_enrichment"
ON "scrape_runs" ("provider", "kind")
WHERE "status" = 'running'
  AND "kind" = 'description-enrichment';
