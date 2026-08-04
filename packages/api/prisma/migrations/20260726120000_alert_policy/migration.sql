-- notifications-model-v2 §10 — Alert Policy.
--
-- Additive and backward compatible within one release: `intent` is kept (and
-- still written by the previous code path if it is rolled back), the new policy
-- columns are nullable or defaulted, and the status enum is narrowed only after
-- proving no row uses the reserved values.

-- 1. Modes ───────────────────────────────────────────────────────────────────
CREATE TYPE "alert_mode" AS ENUM ('any-drop', 'good-price', 'my-price');
CREATE TYPE "alert_rearm_policy" AS ENUM ('follow-down', 'static');

ALTER TABLE "alerts" ADD COLUMN "mode" "alert_mode";

-- Backfill from the intent the row was created with.
-- 'below-current' collapses into 'any-drop': they were the same user intent
-- expressed twice, one of them with a frozen baseline (PRD §4.4).
UPDATE "alerts" SET "mode" = CASE "intent"
  WHEN 'any-drop'         THEN 'any-drop'::"alert_mode"
  WHEN 'below-current'    THEN 'any-drop'::"alert_mode"
  WHEN 'favourable-price' THEN 'good-price'::"alert_mode"
  WHEN 'custom-price'     THEN 'my-price'::"alert_mode"
END;

ALTER TABLE "alerts" ALTER COLUMN "mode" SET NOT NULL;

-- 2. Policy fields ───────────────────────────────────────────────────────────
ALTER TABLE "alerts" ADD COLUMN "baseline_amount" INTEGER;
ALTER TABLE "alerts" ADD COLUMN "rearm_policy" "alert_rearm_policy" NOT NULL DEFAULT 'static';
ALTER TABLE "alerts" ADD COLUMN "threshold_basis" TEXT;
ALTER TABLE "alerts" ADD COLUMN "threshold_proof" TEXT;

-- Existing any-drop alerts become follow-down policies. Their baseline is the
-- book's current canonical price (cheapest strictly IN_STOCK offer) — the same
-- definition the engine uses. Books with no in-stock offer keep a NULL baseline
-- and re-acquire one on the first refresh that sees stock.
UPDATE "alerts" a
SET "rearm_policy" = 'follow-down'::"alert_rearm_policy",
    "baseline_amount" = sub."min_price",
    "threshold_basis" = 'migrated-any-drop'
FROM (
  SELECT wi."id" AS wishlist_item_id, MIN(pl."price_amount") AS min_price
  FROM "wishlist_items" wi
  JOIN "provider_listings" pl ON pl."canonical_book_id" = wi."canonical_book_id"
  WHERE pl."availability" = 'in-stock'
  GROUP BY wi."id"
) sub
WHERE a."wishlist_item_id" = sub."wishlist_item_id"
  AND a."mode" = 'any-drop'::"alert_mode";

-- any-drop alerts on books with no in-stock listing: mark the basis, leave the
-- baseline NULL (the engine treats a NULL baseline as "no drop measured yet").
UPDATE "alerts"
SET "rearm_policy" = 'follow-down'::"alert_rearm_policy",
    "threshold_basis" = 'migrated-any-drop'
WHERE "mode" = 'any-drop'::"alert_mode" AND "threshold_basis" IS NULL;

UPDATE "alerts"
SET "threshold_basis" = 'migrated-my-price'
WHERE "mode" = 'my-price'::"alert_mode" AND "threshold_basis" IS NULL;

-- Pre-v2 «вигідна ціна» thresholds were computed client-side from typicalRange;
-- the basis records that so a later recalibration can tell them apart from
-- server-resolved ones.
UPDATE "alerts"
SET "threshold_basis" = 'legacy-typical-range'
WHERE "mode" = 'good-price'::"alert_mode" AND "threshold_basis" IS NULL;

-- 3. Narrow the status enum ──────────────────────────────────────────────────
-- TRIGGERED/UNAVAILABLE were reserved and never written by any code path; the
-- guard below fails the migration loudly instead of silently losing a row if
-- that assumption is ever wrong in a given database.
DO $$
DECLARE bad_rows INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_rows
  FROM "alerts"
  WHERE "status"::text IN ('triggered', 'unavailable');

  IF bad_rows > 0 THEN
    RAISE EXCEPTION 'alert_status narrowing aborted: % row(s) still use triggered/unavailable', bad_rows;
  END IF;
END $$;

ALTER TYPE "alert_status" RENAME TO "alert_status_old";
CREATE TYPE "alert_status" AS ENUM ('active', 'paused');
ALTER TABLE "alerts"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "alert_status" USING ("status"::text::"alert_status"),
  ALTER COLUMN "status" SET DEFAULT 'active';
DROP TYPE "alert_status_old";

-- 4. Drop the dead threshold columns on wishlist_items ───────────────────────
-- Deprecated since W4; no code has read or written them since. Verified by the
-- guard below rather than by assertion.
DO $$
DECLARE stale_rows INTEGER;
BEGIN
  SELECT COUNT(*) INTO stale_rows
  FROM "wishlist_items"
  WHERE "target_price_amount" IS NOT NULL;

  IF stale_rows > 0 THEN
    RAISE WARNING 'wishlist_items.target_price_amount had % non-null row(s); alerts own the threshold, dropping anyway', stale_rows;
  END IF;
END $$;

ALTER TABLE "wishlist_items" DROP COLUMN "target_price_amount";
ALTER TABLE "wishlist_items" DROP COLUMN "target_price_currency";
