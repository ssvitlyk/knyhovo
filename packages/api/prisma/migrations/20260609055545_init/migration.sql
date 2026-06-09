-- CreateEnum
CREATE TYPE "provider" AS ENUM ('yakaboo', 'book-club');

-- CreateEnum
CREATE TYPE "currency" AS ENUM ('UAH');

-- CreateTable
CREATE TABLE "canonical_books" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "isbn" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_listings" (
    "id" TEXT NOT NULL,
    "canonical_book_id" TEXT NOT NULL,
    "provider" "provider" NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "isbn" TEXT,
    "price_amount" INTEGER NOT NULL,
    "price_currency" "currency" NOT NULL,
    "url" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "provider_listing_id" TEXT NOT NULL,
    "price_amount" INTEGER NOT NULL,
    "price_currency" "currency" NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "canonical_book_id" TEXT NOT NULL,
    "target_price_amount" INTEGER,
    "target_price_currency" "currency",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "canonical_books_isbn_idx" ON "canonical_books"("isbn");

-- CreateIndex
CREATE INDEX "provider_listings_provider_canonical_book_id_idx" ON "provider_listings"("provider", "canonical_book_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_listings_provider_url_key" ON "provider_listings"("provider", "url");

-- CreateIndex
CREATE INDEX "price_history_provider_listing_id_recorded_at_idx" ON "price_history"("provider_listing_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_user_id_canonical_book_id_key" ON "wishlist_items"("user_id", "canonical_book_id");

-- AddForeignKey
ALTER TABLE "provider_listings" ADD CONSTRAINT "provider_listings_canonical_book_id_fkey" FOREIGN KEY ("canonical_book_id") REFERENCES "canonical_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_provider_listing_id_fkey" FOREIGN KEY ("provider_listing_id") REFERENCES "provider_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_canonical_book_id_fkey" FOREIGN KEY ("canonical_book_id") REFERENCES "canonical_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
