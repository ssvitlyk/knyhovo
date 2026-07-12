-- CreateEnum
CREATE TYPE "genre_source" AS ENUM ('seed', 'provider-mapping', 'manual');

-- AlterTable
ALTER TABLE "canonical_books" ADD COLUMN     "genre_confidence" INTEGER,
ADD COLUMN     "genre_source" "genre_source",
ADD COLUMN     "genre_updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "provider_listings" ADD COLUMN     "raw_categories" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "genre_mappings" (
    "id" TEXT NOT NULL,
    "provider" "provider" NOT NULL,
    "source_category" TEXT NOT NULL,
    "genre_id" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 100,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "genre_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "genre_mappings_genre_id_idx" ON "genre_mappings"("genre_id");

-- CreateIndex
CREATE UNIQUE INDEX "genre_mappings_provider_source_category_key" ON "genre_mappings"("provider", "source_category");

-- AddForeignKey
ALTER TABLE "genre_mappings" ADD CONSTRAINT "genre_mappings_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
