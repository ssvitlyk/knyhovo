# Knyhovo · W7 — Search Intelligence (design only)

> **Status: design deliverable — an intelligence layer AROUND search.**
> Authored 2026-06-17. Does **not** redesign the frozen Search Results v1.0
> page or the global SearchBar, nor Book Details v1.1, Price History v1.2.1,
> Wishlist v1.0, Alerts (W4) or Store Offers (W6). Page layout, grid, type
> scale, radii, shadows, themes and breakpoints of the frozen patterns are
> preserved. Composes `window.KnyhovoDesignSystem_9fa616` exports + DS v1.0
> tokens only — no new colours, type, radii or shadows. **Design + rationale
> only — the JSX here is the design reference, not the shipping implementation.**

## Goal
Raise search success when the query is imperfect: typos, partial titles, ISBN,
author-only, series names, publishers, books not in the DB, or books listed
under a different title variation. The layer adds **recovery, guidance and
discovery** around search — no AI chat, no recommendations feed.

## Files
- **`Search Intelligence - Desktop.html`** — every intelligence state inside the
  real frozen Search Results page (light + dark), as a design-canvas gallery.
- **`Search Intelligence - Mobile.html`** — the same layer in the frozen `<768px`
  layout: compact header, single column, full-screen typeahead sheet, 44px targets.
- **`Search Suggestions - Live Prototype.html`** — a real interactive typeahead:
  type → live suggestions (books/authors/series/recent/ISBN), `↑ ↓ ↵ Esc`,
  click-to-pick, routing preview. Theme + recent searches persist.
- **`Search Intelligence - Principles & States.html`** — principles, 16-state
  inventory (tiered), user flows, copy/tone, accessibility.
- **`Feasibility — W7 Tiers.html`** — every capability tiered W7a/W7b/W7c with
  backend requirement + Claude Code notes + shipping order.
- **Support:** `si.css` (chassis copied verbatim from frozen Search Results +
  the additive intelligence layer), `si-shared.jsx` (icons, mock data, chrome,
  `SIPage`), `si-blocks.jsx` (recovery / ISBN / series / author / editions /
  empty / error components), `si-typeahead.jsx` (the shared typeahead component +
  corpus + ISBN detect), `si-desktop.jsx` / `si-mobile.jsx` / `si-typeahead-live.jsx`
  (canvases + prototype), `si-doc.css` (doc-page layout).

## The seven explorations → where they live
1. **No-Results Recovery** — `SIRecoverHigh` (auto-correct + «шукати оригінал») /
   `SIRecoverLow` (did-you-mean chips + author/series jump + closest matches).
   Scenarios: «гари потер» (high), «ведьмак» (low/cross-language), «марсіянин енді веєр» (parse).
2. **ISBN Intelligence** — `SIIsbnHint` (detect) → exact match · `SIWork` edition
   chooser · empty (`SIEmpty`) on no match.
3. **Series Navigation** — `SISeriesRail`: reading-order volumes, availability,
   best price, «у вішлисті», reading-order ↔ release-date toggle.
4. **Author Exploration** — `SIAuthorLanding`: header + Популярні / Найвідстежуваніші /
   Найдешевші tabs over a BookCard grid.
5. **Search Empty State** — `SIEmpty`: mascot + 3 actions (стежити · попросити додати ·
   вказати ISBN).
6. **Ambiguous Queries** — `SIWork`: one canonical work + grouped editions, price
   shown per format by cheapest seller. («Маленький принц», Дюна, Кобзар.)
7. **Search Suggestions** — `SITAList` (shared) in a desktop popover and a mobile
   full-screen sheet; live version in the prototype.

## Intelligence principles (frozen for W7)
1. Recover, don't dead-end. 2. Knyhovo finds, Книговик advises (tool vs adviser).
3. Confidence-tiered (high = auto-apply + undo; low = suggest only). 4. Group by
work, not by listing. 5. Calm, not noisy (no FOMO / no input hijack). 6. Honest
about gaps. 7. Reuse, never reinvent (SearchBar · BookCard · Chip · Badge · Button).

## What the layer adds (and only this)
- `.si-correct` — corrected-query notice (auto-apply) with a «шукати оригінал» revert.
- `.si-dym` — did-you-mean candidate chips (low confidence).
- `.si-jump` — author/series jump card.
- `.si-author` + `.si-tabs` — author landing.
- `.si-series` / `.si-vol` — reading-order volume rail.
- `.si-work` / `.si-eds` / `.si-ed` — canonical work + edition chooser (ambiguous + ISBN).
- `.si-empty` + `.si-actions` / `.si-act` — not-found state with track/request/ISBN.
- `.si-syserr` / `.si-partial` — recoverable error + partial-index notice.
- `.si-ta*` — typeahead dropdown (desktop popover / mobile sheet).

## Prioritization (see Feasibility doc for the full matrix)
- **W7a — MVP-safe (frontend).** Typeahead, ISBN-detect, exact-match jumps, empty +
  «стежити», search error, partial index, dictionary auto-correct.
- **W7b — needs backend.** Fuzzy did-you-mean, work→editions grouping, ISBN multi-edition,
  author aggregations, «попросити додати».
- **W7c — future.** Query NLP (title+author parse), series reading-order metadata,
  cross-language mapping, semantic similarity.

## Copy rules (inherited)
Calm · helpful · non-promotional. No exclamation marks / FOMO / countdowns. Role
split: **Knyhovo finds / checks prices** (tool); **Книговик advises / watches /
notifies** (helper) — a suggestion never reads as coming from a store. Corrections
are always reversible. Unknowns stated plainly («Поки що не маємо…»). Price `245 ₴`
(space before ₴); store name after «·», always `--text-muted`.

## Accessibility
Typeahead: `role="combobox"` field + `role="listbox"` menu, `↑ ↓ ↵ Esc`, active row
not colour-only. ≥44px targets; mobile = full-screen sheet. Series availability is
text + dot, never colour alone. Inherited 3px DS focus ring; no disabled control
without a textual reason; `aria-live="polite"` on the results summary.

## Responsive
- **Desktop ≥768px** — frozen Search Results chassis: 2-col results, typeahead as a
  popover under the field.
- **Mobile <768px** — single column, compact header, full-width search, typeahead as a
  full-screen sheet, 44px targets, editions/volumes stack.

## Do not modify
The frozen Search Results page (header / results layout / SearchBar visual / BookCard
internals / sorting / pagination / empty-state composition / skeletons), DS component
internals, the colour discipline (green only for positive value; never red), the
price hierarchy, the role split, the confidence-tiered recovery rule, the
group-by-work rule, and all protected v1.0 brand assets (logo, mascot). New work may
extend functionality but must not redesign these foundations.

## Out of scope
AI chat, recommendations feed, checkout/payments, store reviews/ratings, and any
redesign of Search Results, Book Details, Wishlist, Price History, Alerts or Offers.
