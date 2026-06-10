# Knyhovo — project notes for Claude sessions

## Frozen pattern: Knyhovo Search Results v1.0

> **"This pattern is approved and frozen. Future iterations may extend Search Results functionality, but must not redesign the established visual foundations."**
> Approved 2026-06-10. Stable Knyhovo pattern intended for direct reuse in Claude Code implementations.

- **Files:** `Search Results Page.html` (live pattern, light/dark via `data-theme`), `search-results.jsx` (composition logic), `Search Results — Pattern Spec.html` (anatomy, all frozen specs, machine-readable JSON note).
- **Compose only from** `window.KnyhovoDesignSystem_9fa616` exports: `SearchBar`, `BookCard`, `Button`, `Badge`, `Chip`, `ThemeToggle`. No new visual language, colors, type, radii, or shadows.

### Footer
- Footer is **always present** in all three states: results, loading, empty. Layout and content identical across states and themes.

### SearchBar states
- **Idle:** icon + placeholder only.
- **Typing:** entered query + `× Очистити запит` button below (`--text-muted`, hover → `--accent`). Clear resets query + committed + page.
- **Loading:** `<SearchBarSkeleton />` reuses `.kn-field` capsule — exact dims, 16px radius, border preserved.
- **Results / Empty:** query preserved in field exactly as typed.

### BookCard metadata hierarchy (frozen)
- Primary: current price (large serif, `--accent`).
- Secondary: old price if available (muted strikethrough, smaller).
- Tertiary: store name — **always `--text-muted`, never accented, never competes with title or price**.
- Badge priority: Найкраща ціна (green) → -N% (solid) → Новинка (accent). Max one per card.

### Pagination
- Algorithm: always show first + last + current + ±1 adjacent. Fill single hidden pages instead of ellipsis. Ellipsis only when gap > 1 page.
- Buttons: prev/next → `secondary sm`; pages → `ghost sm`; current → `primary sm` + `aria-current="page"`.
- `<768px`: row wraps, all buttons min 44×44px touch targets.
- Sort change or new search resets to page 1.

### View modes
- **Grid View only** — List View excluded from MVP v1.0. No layout toggle.

### Loading states
- Warm `--surface-accent` blocks only — never cold greys.
- SearchBar skeleton: reuses `.kn-field` capsule exactly.
- BookCard skeleton: mirrors full anatomy (cover 84×122, badge zone, title, author, price+store row); `min-height: 156px` prevents layout shift.
- Animation: staggered fade-in 280ms ease-out, 50ms cascade per card. **No infinite animations.** Static under `prefers-reduced-motion`.

### Empty state
- Approved mascot illustrations: magnifier (light) / lantern (dark). Height 230px desktop / 180px ≤900px.
- Messaging hierarchy: headline → supporting text → popular-query Chips.
- **Illustration-driven by intent — do NOT simplify or minimize. Knyhovyk acts as a guide.**

### Responsive
- ≥768px: 2-col grid, horizontal BookCards, full pagination.
- <768px: single column, BookCards switch to vertical via page-level CSS (BookCard component untouched), full-width SearchBar, wrapping sort chips, 44px touch targets.

### Do not modify
Hero typography, SearchBar appearance, header/nav, BookCard visual design, sorting-control appearance, empty-state composition/mascot usage, color palette, typography, spacing rules, shadows/borders — and all v1.0 protected brand assets (logo, mascot).
