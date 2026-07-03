# W9a — Author Shelf «Інші книги автора» · v1.0 · FROZEN 2026-06-20

> **"This pattern is approved and frozen for implementation. Future iterations may extend Author Shelf
> functionality, but must not redesign the established visual foundations."**
> The only new UI component for W9a. Extends Book Details v1.1 (Variant C). Designs NO new pages,
> does NOT modify Search Results, does NOT modify the Book Details hero.

- **Files:** `Author Shelf — Pattern Spec.html` (frozen spec — anatomy, degradation, a11y, responsive, machine-readable JSON), `Author Shelf — Live Pattern.html` (all states, both themes, desktop + mobile), `author-shelf.jsx` (`window.AuthorShelfKit` — `selectAuthorShelf · AuthorShelf · AuthorShelfTablet · AuthorShelfMobile · ASCard`), `author-shelf.css`.
- **Compose only from** `window.KnyhovoDesignSystem_9fa616` (`BookCard`, `Badge`) + `window.AuthorShelfKit`. Page integration renders **`AuthorShelfSection`** (runs the selector three times — cap4 desktop, cap3 tablet, cap8 mobile — and renders all three `.as-desktop` + `.as-tablet` + `.as-mobile` wrappers; CSS shows one per breakpoint). No new visual language, colors, type, radii, shadows. `BookCard` component untouched — only page-level overrides.
- **Dedup key = canonical `id`** (exclude `currentId` + `seriesIds`), never title. **Availability map:** `in`/`low` (in-stock) · `out` (price «—», sorted last); all-out still shows, omit only on total<2. **Column model:** each breakpoint is its own selector instance, so inline `--as-cols` = min(cards, rowCap) → `repeat(var(--as-cols), minmax(0,272px))`; `auto-fit`/`auto-fill` forbidden; **column count == card count in every range**; every track `minmax(0,272px)` so card width is identical for 2/3/4 cards.

## Data reality
Source is the `canonical_books.author` TEXT field (string match, no entity, no dedup). Built to degrade gracefully on incomplete matches, noisy author strings and small result sets. Author entity / dedup / bio / author-intelligence = **W9b, out of scope**.

## Frozen rules
- **Placement:** last content section — after the Series shelf, before the footer. Always below Price History and metadata. Never a separate page.
- **Min N = 2:** 0 or 1 matched book → section **omitted entirely** (`selectAuthorShelf → show:false`, component returns `null`). No placeholder, no empty state, no mascot. Mascot Книговик never appears on this shelf.
- **Card = frozen `BookCard`** (`.kn-book`, vertical). Shown: cover · title · price · oldPrice? · store · one discount badge. Hidden: **author** (redundant with the heading + hides noisy author-string variants — `.as-shelf .kn-book__author{display:none}`, author shelf only), availability label, rating. Metadata hierarchy: price (accent serif) › old price (muted strike) › store (muted, never accent).
- **Cover:** 104×150 desktop / 96×138 mobile (warm placeholder while `coverUrl=null`).
- **Layout:** grid 4-up (≥1024, `.as-desktop`) · grid 3-up (768–1023, `.as-tablet` — its own cap-3 instance) · horizontal rail with scroll-snap (<768, `.as-mobile`). **Column count = visible card count** (inline `--as-cols`; `data-count` is a QA hook, not the column driver) — when books < cap there are NO empty/reserved tracks and NO filler cards; the shelf box stays full content width with empty trailing space, cards left-aligned. Card width clamped **136–272px** (`--as-card-max`) so 2–3 cards never stretch. No overlap / fan / absolute positioning.
- **Examples are normative:** the Live Pattern + rendered specimens win over prose if they ever conflict; both render from the same `author-shelf.jsx` + `author-shelf.css` as production.
- **Cap:** 4 desktop / 8 mobile; over cap → «Усі книги автора (N) →» (desktop) / trailing rail card (mobile) → author page (Search Results filtered). No second row, no pagination on the book page.
- **Ordering:** exclude current book + Series-shelf books (dedupe); in-stock first; then price ascending.
- **Interaction:** whole card is a link → leaf Book Details; `.kn-book:hover` lift+shadow; one-shot stagger entrance (reduced-motion static, never infinite); native swipe scroll-snap.
- **A11y:** `a.as-link` with aria-label, inner `BookCard` `tabIndex=-1`; `--focus-ring` on `:focus-visible`; ≥44px touch; hidden author absent from a11y tree.

## Do not modify
Placement order, min-N=2 omit threshold, BookCard reuse (no new card), author-line suppression, shown/hidden card fields + metadata hierarchy, cap + see-all behavior, selection/ordering, grid↔rail breakpoint, one-shot (non-infinite) entrance, DS v1.0 tokens, protected brand assets. Do not touch Search Results or the Book Details hero.
