-- CreateIndex
CREATE INDEX "canonical_books_created_at_idx" ON "canonical_books"("created_at");

-- CreateIndex
CREATE INDEX "wishlist_items_canonical_book_id_idx" ON "wishlist_items"("canonical_book_id");
