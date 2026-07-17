# Knyhovo — project notes for Claude sessions

## Frozen pattern: Knyhovo «Бажанки» (Wishlist) v2.2

> **Approved + frozen 2026-07-16.** `Бажанки v2.2.html` → `wl22-app.jsx` +
> `wl22.css` is the one canonical «Бажанки» implementation (supersedes the
> v1.0 Hybrid Freeze — retired history). «Зараз вигідно купити» carries its
> own separately-frozen visual spec (2026-07-08) plus a buying-reason
> recommendation engine (`wl-buying-reasons.js`, same date) — both unchanged
> by the 2026-07-16 full-page freeze, which covers everything else on the
> page (Hero, «Порада Книговика», «Решта бажанок», section order, chrome).

- **Files:** `wl22-app.jsx` (reference markup/behavior for every section —
  Hero, «Порада Книговика», «Зараз вигідно купити», «Решта бажанок»; port the
  contract/markup/behavior only, never the prototype plumbing — no Tweaks
  panel, no mock catalogs, no `window.KnHeader`/`window.KnyhovoDesignSystem_9fa616`
  globals in production), `wl22.css` (frozen visual recipe — colors, radii,
  shadows, type, spacing; the production `wishlist.css` ports it scoped/deduped
  against `collections.css`/`search-results.css`, see that file's header
  comment), `wl-buying-reasons.js` (the `BuyingReason` enum contract +
  reference `evaluateCatalog` — production reimplements this server-side in
  `packages/api/src/wishlist/buying-opportunities/engine.ts`, same enum/
  priority/sort semantics), `Claude Code - Buying Reason Engine.md` (§10 API
  contract this was handed off against).

### The three governing freeze entries (condensed — full text in `incoming/CLAUDE.md`)
1. **"FROZEN — «Бажанки» v2.2 — full page freeze" (2026-07-16):** canonical
   page order Header → Hero → «Порада Книговика» → «Зараз вигідно купити» →
   «Решта бажанок» → Footer. Hero Variant A is the shipping default (B/C
   stay archived). «Порада Книговика» has its OWN 5-status-plus-none
   vocabulary (goal/best/drop/deal/low90/none), independent of the buying-
   reason engine — never merge the two. «Решта бажанок» card `.bkc`: whole
   card is the link (no separate «Деталі» button), Cover Frame System
   (contain-fit, never crop), fixed-row `.bkc__body` grid, frozen density
   defaults (16.5px / Стандарт / 150%).
2. **"«Зараз вигідно купити» UI/UX v1.0" (2026-07-08):** desktop 2×2 paged
   carousel (`PER=4`, 91%-step peek geometry, progress bar + serif counter);
   mobile 1-at-a-time pointer-drag rail (5px axis-lock, 0.35 rubber-band,
   velocity flick, click-squelch, ←/→ keys); shared adaptive
   «Купити за N ₴» → «N ₴» CTA (measured via hidden span + ResizeObserver);
   empty state `.wl21-saleempty`; exactly one green badge per card, old price
   only when real (`prevPrice > price`).
3. **"Feature: «Зараз вигідно купити» — buying-reason recommendation engine"
   (2026-07-08):** only 3 buying reasons exist (`TARGET_REACHED` →
   `LOWEST_90_DAYS` → `PRICE_DROPPED`), each proving a REAL historical price
   drop tracked by Knyhovo itself — never a store's "old price". No fallback
   reason. The UI never decides the badge, only maps the enum to icon+label.
   Ineligible books fold into «Решта бажанок» automatically, never dropped.

### Do not modify
Section order, Hero variant-A-is-default rule, «Порада Книговика»'s
independent 5-status vocabulary and its non-wiring to the buying-reason
engine, the shared adaptive-CTA component, «Зараз вигідно купити»'s carousel
mechanics/card anatomy/badge rule/empty state (either breakpoint), the
3-reason `BuyingReason` enum + priority + sort order, «Решта бажанок»'s
whole-card-link rule and Cover Frame geometry, chrome/footer. Extend with
real data/backend wiring only (as this implementation already does via
`GET /api/wishlist/buying-opportunities`) — never redesign, never fork a new
copy of these files. `incoming/` stays read-only; these are point-in-time
copies for reference only.
