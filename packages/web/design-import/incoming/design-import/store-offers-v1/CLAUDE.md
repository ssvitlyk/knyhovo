# Knyhovo · W6 — Store Offers Intelligence (design only)

> **Status: design deliverable — a thin intelligence layer over the frozen
> OffersPanel.** Authored 2026-06-16. Does **not** redesign Book Details v1.1,
> Price History v1.2.1, Wishlist v1.0, or the W4 Alerts work. Page layout, grid,
> spacing, type scale, radii, shadows, themes and breakpoints of the frozen
> patterns are preserved. Composes `window.KnyhovoDesignSystem_9fa616` exports +
> DS v1.0 tokens only — no new colours, type, radii or shadows. **Design +
> rationale only — no implementation code.**

## Goal
Help users understand which store offer is **best, not only cheapest**. The layer
adds five things to the existing «Ціни у книгарнях» / OffersPanel: a best-offer
explanation, store-reliability indicators, delivery/availability hints, price
freshness, and per-row empty/stale/unavailable states.

## Files
- **`Offers Intelligence — Desktop.html`** — the intelligence OffersPanel inside the
  real frozen Book Details Variant C page (light + dark) + all 10 panel states as a
  gallery.
- **`Offers Intelligence — Mobile.html`** — the same layer inside the frozen
  `<768px` Book Details layout (no horizontal scroll, tappable rows, 44px targets)
  + 10 states at 375px.
- **`Offer States Matrix.html`** — signals reference, 10 live states with spec,
  component guidance, copy rules, accessibility notes, Claude Code notes.
- **Support:** `so-offers.css` (the intelligence layer — extends, never repaints,
  `bd-chassis.css`), `so-shared.jsx` (icons + data + components), `so-states.jsx`
  (the 10-state data spec), `so-desktop.jsx` / `so-mobile.jsx` / `so-matrix.jsx`
  (canvases), `so-matrix.css` (doc-page layout), `bd-chassis.css` (frozen Book
  Details subset, copied verbatim — do not edit).

## What the layer adds (and only this)
1. **`.so-reasons`** — a 1–3 item «why this offer» list inside the frozen
   `.bdc-best`, between the store line and the CTA.
2. **`.so-best-note`** — an honest caveat when the best choice is **not** the
   cheapest listing (names the cheapest price + store + reason).
3. **`.so-row`** — the frozen single-line `.bdc-row` extended to two lines: top line
   keeps the frozen anatomy (store · price · CTA); a quiet `.so-row__meta` status
   line is added underneath. CTA spans both lines.
4. **Panel bodies** — empty / loading / error states that replace only the panel
   **body** (eyebrow + frame stay).

## Best-offer logic (frozen)
- Among offers that are **in stock + fresh price + working link**, the cheapest is
  the best offer → green **«Найкраща ціна»** badge.
- If the cheapest listing fails any of those (stale · out of stock · unverified ·
  unknown delivery · store/link down) → badge becomes green **«Найкращий вибір»**
  and a `.so-best-note` names the cheapest price/store and why it wasn't chosen.
- The cheapest listing, when it ≠ best offer, gets a neutral **«Найдешевша»** badge
  on its row — never hunted for.

## Signals → treatment (frozen vocabulary)
- **Availability** — coloured dot + label in the status line: `В наявності` (green) ·
  `Закінчується` (accent) · `Немає в наявності` (faint) · `Наявність уточнюється`
  (hollow dot). Never colour-only — always paired with text.
- **Reliability** — subtle `shield-check` mark in `--icon-muted` beside the store
  name (`title="Перевірена книгарня"`). Never accent, never competes with title or
  price. No ratings/reviews (out of scope).
- **Delivery** — status-line fact with a `truck` icon: `Доставка: 1–3 дні` /
  `Безкоштовно від 600 ₴`; unknown → `Доставка уточнюється у книгарні` (honest).
- **Price freshness** — global footnote `Ціни оновлено сьогодні о 08:00`; a stale
  row is marked `Ціна могла змінитися` (clock, muted). Changed-since-last-check →
  `Ціна впала з 289 ₴` (green for a drop) / `Ціна зросла з …` (muted — never red).
- **Store unavailable** — row dimmed (opacity .62), CTA disabled, fact
  `Книгарня тимчасово недоступна`; the price stays visible as proof of the check.
- **Affiliate link unavailable** — CTA disabled, fact `Посилання недоступне`; price
  stays visible.
- **Duplicate provider listing** — collapsed into one row with a quiet caption
  `Схожі пропозиції обʼєднано · N` + ghost «показати».

## The 10 states (see `so-states.jsx` for data)
1. Normal · 2. Cheapest = best · 3. Best overall ≠ cheapest · 4. Cheapest but stale ·
5. Cheapest but out of stock · 6. Multiple same-price (tie-break by delivery +
reliability) · 7. Provider unavailable (store-down + link-down + unknown stock) ·
8. No offers (calm empty body) · 9. Loading skeleton · 10. Error (local, recoverable).

## Badge hierarchy (frozen — max ONE strong badge per row)
Best block: `Найкраща ціна` / `Найкращий вибір` (green). Row priority:
`Найдешевша` (neutral) → `Така сама ціна` (neutral) → `−N%` (solid). Freshness /
delivery / reliability are status-line facts, **never badges**.

## Colour discipline (inherited)
Green only for positive value: availability, cheapest, price drop, best choice.
Price rises stay muted; **never red**. Accent (copper/amber) drives CTAs and the
price; store names are always `--text-muted`-neutral.

## Copy rules
- Calm · helpful · non-promotional. No «Найкраще!», exclamation marks, FOMO,
  countdowns.
- Role split: **Knyhovo finds / checks prices** (tool); **Книговик advises /
  suggests** (helper). A recommendation never reads as coming from a store.
- «Найкращий вибір» always carries a reason; if not cheapest, name the cheapest
  price + store honestly.
- Unknowns are stated plainly («Доставка уточнюється…», «Наявність уточнюється»),
  never invented. Freshness uses the exact time («Оновлено сьогодні о 08:00»).
- Price format `240 ₴` (space before ₴); store after «у» / middle dot.

## Accessibility
- Availability + best-choice conveyed by **text**, not colour alone.
- Disabled CTAs (out / store-down / link-down) carry `disabled` + an in-row textual
  reason — not dimming alone.
- Status line is plain text with `·` separators rendered via a pseudo-element
  (hidden from AT) so it reads as one phrase.
- ≥44px touch targets on mobile; inherited 3px DS focus ring.
- Loading skeleton is `aria-hidden`; `prefers-reduced-motion` disables pulse +
  stagger and shows static content.

## Responsive
- **Desktop ≥1024px** — offers panel 460px; two-line rows, CTA right spanning both
  lines.
- **Mobile <768px** — row collapses to two columns (info · price) + status line, CTA
  right under the price; store names wrap, never truncate; no horizontal scroll.

## Do not modify
Best-block composition (badge · price row · store line · full-width CTA), price
hierarchy (serif accent price · muted strike old · muted store), panel
surface/radius/shadow, button + badge styles, the badge hierarchy and one-badge
rule, the colour discipline, the best-offer logic, status-line-not-badge rule for
freshness/delivery/reliability, system-body-only rule for empty/loading/error, and
all protected v1.0/v1.1 brand assets. New work may extend functionality but must not
redesign these foundations.

## Out of scope
Checkout, payments, store reviews/ratings, and any redesign of page layout, Wishlist,
Price History, or Alerts.
