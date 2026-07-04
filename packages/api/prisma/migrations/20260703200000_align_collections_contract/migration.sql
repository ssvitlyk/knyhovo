-- Align Collections with the approved «Добірки» contract (catalog v3):
--   * collection_type enum shrinks to dynamic | editorial | taxonomic
--   * genres/moods fold into collections (a genre is a TAXONOMIC collection,
--     a mood is an EDITORIAL collection identified by a constant slug list)
--   * collections.title → name; description becomes NOT NULL;
--     eyebrow/status_label dropped (not part of the contract)
--   * canonical_books.genre_id now references collections(id)
--
-- Data cleanup first: the previous demo seed used the old enum values and the
-- genres/moods tables. Collections are demo data and are fully re-seeded after
-- this migration, so wiping them here is safe and keeps the enum swap valid.
DELETE FROM "collection_items";
DELETE FROM "collections";
UPDATE "canonical_books" SET "genre_id" = NULL;

-- AlterEnum
BEGIN;
CREATE TYPE "collection_type_new" AS ENUM ('dynamic', 'editorial', 'taxonomic');
ALTER TABLE "collections" ALTER COLUMN "type" TYPE "collection_type_new" USING ("type"::text::"collection_type_new");
ALTER TYPE "collection_type" RENAME TO "collection_type_old";
ALTER TYPE "collection_type_new" RENAME TO "collection_type";
DROP TYPE "public"."collection_type_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "canonical_books" DROP CONSTRAINT "canonical_books_genre_id_fkey";

-- AlterTable
ALTER TABLE "collections" DROP COLUMN "eyebrow",
DROP COLUMN "status_label",
DROP COLUMN "title",
ADD COLUMN     "name" TEXT NOT NULL,
ALTER COLUMN "description" SET NOT NULL;

-- DropTable
DROP TABLE "genres";

-- DropTable
DROP TABLE "moods";

-- AddForeignKey
ALTER TABLE "canonical_books" ADD CONSTRAINT "canonical_books_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
