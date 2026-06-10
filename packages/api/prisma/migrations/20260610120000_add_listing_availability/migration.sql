-- CreateEnum
CREATE TYPE "availability" AS ENUM ('in-stock', 'out-of-stock', 'unknown');

-- AlterTable
ALTER TABLE "provider_listings" ADD COLUMN     "availability" "availability" NOT NULL DEFAULT 'unknown';
