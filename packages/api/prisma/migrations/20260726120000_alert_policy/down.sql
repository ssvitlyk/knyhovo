-- Manual rollback for 20260726120000_alert_policy.
--
-- Prisma Migrate has no automatic down-migration; this file is the documented,
-- tested reverse so a bad deploy can be undone without restoring a dump.
-- It restores the pre-v2 shape exactly: `intent` was never dropped, so alerts
-- keep working on the old code path after this runs.

-- 4. Restore the dead wishlist_items columns (nullable, no data to recover) ──
ALTER TABLE "wishlist_items" ADD COLUMN "target_price_amount" INTEGER;
ALTER TABLE "wishlist_items" ADD COLUMN "target_price_currency" "currency";

-- 3. Widen the status enum back ──────────────────────────────────────────────
ALTER TYPE "alert_status" RENAME TO "alert_status_v2";
CREATE TYPE "alert_status" AS ENUM ('active', 'paused', 'triggered', 'unavailable');
ALTER TABLE "alerts"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "alert_status" USING ("status"::text::"alert_status"),
  ALTER COLUMN "status" SET DEFAULT 'active';
DROP TYPE "alert_status_v2";

-- 2. Drop the policy fields ──────────────────────────────────────────────────
ALTER TABLE "alerts" DROP COLUMN "threshold_proof";
ALTER TABLE "alerts" DROP COLUMN "threshold_basis";
ALTER TABLE "alerts" DROP COLUMN "rearm_policy";
ALTER TABLE "alerts" DROP COLUMN "baseline_amount";

-- 1. Drop the mode column and its enums ──────────────────────────────────────
ALTER TABLE "alerts" DROP COLUMN "mode";
DROP TYPE "alert_rearm_policy";
DROP TYPE "alert_mode";
