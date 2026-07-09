# Knyhovo — project notes for Claude sessions

## Frozen pattern: Knyhovo Cover Frame System v1.0

> **Approved + frozen 2026-07-09.** Rendering-system rule, not a redesign:
> every REAL book cover renders inside a fixed "Cover Frame" via the shared
> `<CoverFrame>` component. Book covers come from many bookstores with
> inconsistent dimensions/ratios/padding/resolutions — the UI normalizes them;
> no source (Yakaboo/Є/Vivat/BookChef/BookClub/Laboratory) may look visually
> different from another. Approved layouts stay visually unchanged except that
> cover sizing and alignment become consistent.

- **Files:** `cover-frame.css` (`.knc-frame` / `.knc-img` fit contract),
  `cover-frame.jsx` (`window.KnCoverFrame.CoverFrame` — reference
  markup/behavior for the prototype; port the contract and fallback behavior,
  never the prototype plumbing).
- Implement production cover rendering from these files only.

### Ownership split (the core rule)
- **Frame owns:** fixed size, aspect-ratio, border-radius, `overflow: hidden`,
  box-shadow, background, and centering of its content (flex, both axes). The
  per-surface frame class keeps its exact frozen spec — this system never
  changes a frame dimension.
- **Image owns:** `object-fit: contain`, `width/height: auto`,
  `max-width/max-height: 100%`, alt text. Never `object-fit: cover`, never
  stretched, never cropped, no artificial padding/margins on the image — any
  visual whitespace comes naturally from `contain` (frame background shows
  through the letterbox). Hover-scale transforms on the img stay part of the
  frozen card specs.

### Variants (frozen frame specs per surface)
- `collection-card` → `.bkc__coverclip` + `img.bkc__cover` (radius 12px,
  aspect 2/3, surface-accent bg, shadow-sm; card width 202→190→156→142px).
- `wishlist-hero` → `.wl21-feat__coverclip` («Порада Книговика», 2/3, shadow-md).
- `sale-card` → `.wl21-sale__coverclip` («Зараз вигідно купити», 96px cover).
- `mobile-book` → `.wl21-featm__book` (mobile "book-styled" cover; spine
  `::before` + gloss `::after` decoration lives on the FRAME, untouched).
- `wishlist-card` → `.wsc-cover` (Wishlist v1.0 card, 116px, min-height 168px;
  typographic placeholder via `placeholderClassName="wsc-cover--ph"`).
- **DS `BookCard` (`.kn-book__cover`, 84×122 + page overrides)** — frozen DS
  internals where the img IS the frame; the contract is applied there as a
  CSS-only fit-mode change (`object-fit: contain`), frame box unchanged.
  Search Results, Book Details related shelves and Homepage rails inherit it.

### Mandatory usage / exclusions
Mandatory for every real book cover: Homepage carousels, Search Results,
Wishlist (both generations), «Зараз вигідно купити», Book Details shelves (and
its main cover once it gets a real image), Collections `.bkc` cards.
**Excluded — decorative art direction (keep `object-fit: cover`):**
`.fresh-card__stack img` (overlapping mini-cover stack), `.gems-fan__cover`
(fanned trio), mascot illustrations, hero artwork. `contain` would break them
into letterboxed rectangles — leave untouched.

### Missing / broken image behavior
No `src` or a load error → the frame renders unchanged (same class, same
dimensions) with `knc-frame--empty` + optional `placeholder` node; otherwise
the frame background shows. Frame dimensions never change. Lazy loading and
alt semantics pass through unchanged.

### Do not modify
The ownership split, the contain/never-crop/never-stretch rules, per-variant
frame specs, the decorative exclusions, the fallback behavior. Pages configure
ONLY exposed props (variant / className / placeholder…) — no local overrides
of the rendering logic, no hand-rolled frame+img pairs, no duplicated frame
markup per page. New surfaces = add a `KNC_VARIANTS` entry — never a local
copy of the rendering logic.
