# Megakniga fixtures

Real HTML captured during recon (2026-07-19), trimmed to keep the parsed regions
intact (headers/sidebars/related-products/scripts dropped). Two fixtures were
edited for edge-case coverage that no captured page happened to exhibit; both
are noted below.

- `catalog-page.html` — root `/catalog/knigi` listing, 6 cards, in-stock, mix of
  discounted (`.price-old`) and non-discounted prices.
- `catalog-page-2.html` — a subcategory listing (distinct URLs from
  `catalog-page.html`), used for the multi-page combine test.
- `catalog-empty.html` — **hand-crafted**: an empty `product-items-cont` wrapper
  with zero cards, for the "genuinely empty page" parser/scraper test. The live
  site does not actually serve this shape past the last page (recon §7 — it
  repeats the last page instead), but it is still a valid, useful edge case.
- `catalog-invalid-price.html` — **derived** from `catalog-page.html`'s first
  card: `data-price` and the `.price` text both replaced with `"—"` to test the
  invalid-price → `price: null` / `out-of-stock` path.
- `catalog-out-of-stock.html` — **derived** from `catalog-page.html`'s second
  card: the availability container's class/text replaced with `awaiting` /
  "Товар очікується" (recon-documented text marker, not present verbatim in any
  captured listing page).
- `catalog-unknown-availability.html` — **derived**, same base card: the
  availability container replaced with neither an `in_stock` class nor a known
  text marker, to test the `'unknown'` fallback.
- `product-in-stock.html` — real product page for "Енеїда" (Вергілій), InStock,
  ISBN 9786178493974, Виробник Фоліо, Обкладинка М'яка.
- `product-out-of-stock.html` — real product page for "Дитячий кобзар", OutOfStock,
  ISBN 9789662909944, Виробник ВСЛ, Обкладинка Тверда.
- `product-non-book.html` — **derived** from `product-in-stock.html`: the
  `<p>Паперова книга</p>` marker replaced with `<p>Іграшка</p>`, to test the
  non-book skip in `extractMegaknigaProductDetails`.
- `product-isbn-text-fallback.html` — **derived** from `product-out-of-stock.html`:
  the `itemprop="mpn"`/`itemprop="identifier"` meta tags removed, keeping the
  visible "Код товару / ISBN:" text, to test the ISBN fallback cascade.
