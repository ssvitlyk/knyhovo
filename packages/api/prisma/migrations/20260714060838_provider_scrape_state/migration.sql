-- CreateTable
CREATE TABLE "provider_scrape_state" (
    "provider" "provider" NOT NULL,
    "url" TEXT NOT NULL,
    "source_lastmod" TIMESTAMP(3),
    "last_seen_in_sitemap_at" TIMESTAMP(3) NOT NULL,
    "last_fetched_at" TIMESTAMP(3),

    CONSTRAINT "provider_scrape_state_pkey" PRIMARY KEY ("provider","url")
);

-- CreateIndex
CREATE INDEX "provider_scrape_state_provider_last_seen_in_sitemap_at_idx" ON "provider_scrape_state"("provider", "last_seen_in_sitemap_at");
