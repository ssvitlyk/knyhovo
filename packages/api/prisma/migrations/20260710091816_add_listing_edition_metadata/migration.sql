-- AlterTable
ALTER TABLE "provider_listings" ADD COLUMN     "format" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "publication_year" INTEGER,
ADD COLUMN     "publisher" TEXT,
ADD COLUMN     "series" TEXT;
