# Knyhovo · Price History extension (W3) — design rationale & freeze notes

> **Status: extension of the frozen system — the missing 20%.**
> This package adds the price-intelligence states that become available once the
> Price History API exists. It does **not** redesign Wishlist v1.0 or Book Details
> v1.1. Every layout, spacing rule, type scale, radius, shadow and responsive
> breakpoint of the frozen patterns is preserved. New work composes
> `window.KnyhovoDesignSystem_9fa616` exports and frozen DS v1.0 tokens only —
> no new colours, type, radii or shadows are introduced.

Authored 2026-06-13 for the W3 backend Price History work.

---

## W3 revision — 2026-06-14 (refinement pass, no redesign)

> Polishing the final 10% of an already-frozen feature so it better matches
> Knyhovo's philosophy and the frozen Wishlist system. All layouts, spacing
> scales, type, tokens, themes and interaction patterns are preserved.

1. **Statistics row** — «Найвища за період» (historical maximum) is replaced by
   **«Звичайна ціна»** (the typical-price *range*, e.g. `285–318 ₴`, neutral
   `--text-body`). Final row: Зараз · Найнижча за період · Звичайна ціна · Зміна
   за період. Users decide against the *typical* price, not the maximum.
2. **Typical-price visualization** — the chart band now reads as a **range** with
   an inline label «звичайна ціна · 285–318 ₴». Subtle `--surface-accent` fill,
   soft `--border` hairline edges (no strong dashed reference lines), low
   contrast, visible in both themes, never dominates. Says *"this is where the
   book usually lives"*, not *"the one correct price"*.
3. **Tone of voice** — the advisory line is now **objective fact only**. Removed
   «Книговик вважає це … вдалим моментом». New copy: «Зараз 240 ₴ — нижче за
   звичайний діапазон цієї книги (285–318 ₴). За 90 днів ціна знизилася на 25%.
   Поточна ціна близька до історичного мінімуму.» Price history explains facts;
   future AI features may interpret them. No «Книговик думає / радить / вважає».
4. **Empty-state copy** — «…Книговик підкаже, коли ціна нижча за звичайну.» →
   «…Книговик підкаже, коли настане вдалий момент купувати.» (matches the frozen
   Wishlist language).
5. **Loading skeleton** — now **mirrors the final structure**: section title ·
   two-line explanatory text · period chips · chart area *with a typical-range
   band hint* · 4-stat row. No large generic rectangles; warm surfaces only
   (`--surface-sunk` chart frame + `--surface-accent` band). Minimises layout shift.
6. **Book Details spacing** — gap between the offers panel and the price-history
   block increased to **64px desktop** (`.ph-section { margin-top: var(--space-16) }`;
   mobile `.ph-section--mob` = 40px). Related but independent; no crowding.
7. **Mobile** — period chips now **wrap** instead of horizontal-scroll; stats use a
   2×2 grid; chart stays readable at 320px (SVG scales); explanatory text never
   truncates. No horizontal scrolling. Validated at 320 + 390px artboards.
8. **Deliverable split** — empty and loading states now live in their own files
   (`Price History - Empty States.html`, `Price History - Loading States.html`);
   Desktop/Mobile keep the Book Details integration + populated chart.

---

## W5 — Final Freeze Polish · 2026-06-14 (FINAL — supersedes conflicting W3 bullets above)

> **Status: feature-complete, final design freeze.** Consistency & polish only — no
> redesign. Layouts, spacing system, type scales, chart behaviour and component
> hierarchy are unchanged. Lives in `ph-chart.css`, `ph-section.jsx`, `ph-chart.jsx`.
> The live W5 block is `window.PHSection.PriceHistorySection` (API-driven); the
> standalone `window.PHChart.*` states are kept in sync.

**Polish applied:**
1. **Chips ↔ title (desktop filled/loading)** — `.ph-head` is `align-items:center;
   flex-wrap:nowrap`; period chips (`flex:0 0 auto`) stay on the «Динаміка ціни»
   title's row, optically centred with the serif. They never wrap below it.
2. **Loading skeleton mirrors the final chart** — real title + real chips, then
   two-line explanatory text → chart area **sized to the real chart footprint**
   (`.ph-sk-chart` 244px desktop / 168px mobile → no loading→filled shift) with a
   typical-range band hint + a sparse axis-label row → 4 statistics placeholders
   sized to the real labels/values. Warm surfaces only.
3. **Error = compact card** — `.ph-empty--error { max-width: 520px }`; desktop error
   no longer spans full width. Mobile unaffected.
4. **Empty-state badge proximity** — «Збираємо дані» sits directly beside the
   «Ще збираємо історію» heading (`.ph-empty__title { flex:0 1 auto }`, titlerow gap
   `--space-2`).
5. **Mobile chip minimum widths (floors)** — 30 днів 72px · 90 днів 72px · Рік 56px ·
   Весь час 80px (`.ph-periods--mob .ph-period:nth-child(n)`). One row, no scroll,
   44px touch height preserved.

**Resiliency rules — locked (override the W3 bullets where they conflict):**
- **Highest price is HIDDEN** — `highest` is an internal API field only (no dot/label/
  stat). Stat set = Зараз · Найнижча · **Типова ціна** · Зміна (was «Найвища»).
- **«Типова ціна»** terminology everywhere (band label, stat label, advisory, aria) —
  supersedes «звичайна ціна» used in the W3 sections below.
- Colour: high/up = **neutral/muted `--text-muted`** (blue retired); green only for
  positive user value; never red. (Supersedes the W3 "informational blue when up".)
- **Empty & error states show NO period chips** (no data to switch / switch won't fix
  a failure); **loading PRESERVES chips** (loading may follow a period change). Header =
  title only in empty/error.
- **Book Details resiliency:** the block never collapses (only its inner body swaps),
  the title is always present, and any Price-History failure leaves OffersPanel + the
  rest of Book Details fully usable. Error is local + recoverable, never a global page.

**Do not modify (W5 final):** the five polish items + the resiliency rules above. Future
work may extend functionality but must not redesign these foundations.

---

## Knyhovyk philosophy (mandatory — drives every decision here)

Price history exists to **support Knyhovyk's recommendations**, not to drive impulse
purchases. Knyhovyk is a calm adviser, not a discount hunter. Historical data answers
three quiet questions and nothing else:

- "Has this book become cheaper recently?"
- "Is this a typical price?"
- "Should I buy now or wait?"

It never says "Buy now before it's gone!", "Limited offer!", "Best deal ever!", or any
urgency-driven e-commerce pattern. The user should feel *"Knyhovyk quietly watches
prices for me and explains what's happening"* — never *"I must act before I miss it."*

**Role split (inherited from the Wishlist freeze):** Knyhovo = шукає / перевіряє ціни
(the tool). Книговик = радить / підказує (the adviser). Recommendations never read as
coming from a store.

---

## Files in this package

| File | What it is |
|---|---|
| `Price History – Desktop.html` | «Динаміка ціни» block inside Book Details v1.1 (Variant C), below the offers panel + standalone populated state, light + dark. |
| `Price History – Mobile.html` | Same data, compact chart, period selector as chips + populated state, light + dark. |
| `Price History – Empty States.html` | No-history state, desktop + mobile, both themes (W3 rev). |
| `Price History – Loading States.html` | Structure-mirroring skeleton, desktop + mobile, both themes (W3 rev). |
| `Wishlist Verdicts.html` | Verdict v2 anatomy (icon + title + text), in-row desktop + mobile, savings visualization, rules doc, light + dark. |
| `Discounts Section.html` | «Книги зі знижками» empty / populated / loading, desktop + mobile, light + dark. |
| `ph-chart.css` | **New** calm chart + verdict + savings styles (tokens only). |
| `ph-bd.css` / `ph-wl.css` | Frozen Book Details / Wishlist class subsets, copied **verbatim** so the extension sits in the real chassis. Do not edit. |
| `ph-data.jsx` | Mock price-history series + verdict definitions + icons. |
| `ph-chart.jsx` | Chart, period selector, advisory line, stat strip, empty/loading. → `window.PHChart` |
| `ph-verdicts.jsx` | Verdict badge/block, savings stack, wishlist row/card compositions, skeletons, shell. → `window.PHV` |
| `*-canvas.jsx` | Per-file design-canvas assembly (artboards). |

Paths to `_ds/`, `assets/` and `design-canvas.jsx` are relative (`../../`) to the
project root, where the frozen system lives.

---

## 1 · Book Details — price history block

**Placement (frozen):** directly **below the offers panel**, full content width, in the
same `bd-section` rhythm. The two-pane Variant C grid above it is untouched.

**The chart is calm, not financial.** No trading aesthetics, no candlesticks, no dense
gridlines, no red/green tick noise. Specifically:

- A single, gently-smoothed line (horizontal-tangent cubic) — organic, not jagged.
- A soft **"звичайна ціна" band** (`--surface-accent`) marks the *typical* price range.
  This is the device that answers *"Is this a typical price?"* at a glance: the current
  point sitting **below** the band is the quiet signal that now is a good moment.
- Two reference points only: the **peak** (muted, for context) and **now** (the answer).
  When the current price is below the usual band, the "now" dot + line turn moderate green.
- A one-line **advisory** in Knyhovyk's voice references historical context, e.g.
  *"Зараз 240 ₴ — нижче за звичайну ціну цієї книги (285 ₴–318 ₴). За 90 днів ціна впала
  на 25 %. Книговик вважає це спокійним, вдалим моментом."* — never urgency.

**Period selector:** DS chips (no new control) — `30 днів · 90 днів · Рік · Весь час`.
Mobile: same chips in a horizontal scroll rail (≥40 px targets). Switching the period is
interactive and updates the chart + stats live.

**Stats shown** (frozen requirement): Зараз · Найнижча за період · Найвища за період ·
Зміна за період. Lowest = moderate green, current = accent (or green when it *is* the
best moment), highest = neutral text, change = green when down (cheaper = good),
**informational blue when up — never red**.

**Mobile** = identical data, compact chart (`152` vs `244` SVG height), chips selector,
stats wrap to a calm 2-up grid. Same section, smaller scale — no new layout.

---

## 2 · Wishlist verdicts (v2)

Extends the **frozen verdict set** (`now / wait / high / data / out`) with an icon and a
historical-context explanation. The three required states:

| Verdict | Icon | Tone | Title | Explanation (historical context) |
|---|---|---|---|---|
| Great time to buy | `trending-down` ↘ | green (strongest) | Чудовий момент | «Ціна нижча за звичайну для цієї книги.» |
| Wait | `minus` — | neutral | Зачекайте | «Ціна стабільна — купувати не горить.» |
| Price is high | `trending-up` ↗ | blue (informational) | Ціна висока | «Ціна вища за звичний рівень. Можна зачекати.» |

**Colourblind-safe — by construction:**
- **Icon shape** distinguishes the verdict: ↘ down / — flat / ↗ up.
- **Title + text** are always present — meaning reads with zero colour.
- **Position** is fixed: the verdict sits in the existing status column, left of price.
- **No red.** A high price is *informational blue*, never a danger signal.

**Fits the frozen row, no height change.** The verdict lives in the row's existing
status column (`.hy-row-status`): badge on top, the explanation as the single honest
reason line beneath — exactly the slot the frozen row already reserves. The badge gains a
12–13 px inline icon on the same line; row `min-height: 104px` and the grid are unchanged.
Mobile: the badge is the collapsed-card status chip; the explanation appears under
"Порада Книговика" when expanded.

---

## 3 · Savings visualization

Wishlist rows support **old → current → saved**, e.g.

```
320 ₴        ← old price · muted, strikethrough, small
240 ₴        ← current  · serif, moderate green (the good moment)
Економія 80 ₴ ← saved   · serif, moderate green
```

- **Subtle, never promotional.** No "−25 %!", no "найкраща ціна назавжди", no urgency.
- Aligns with the frozen price hierarchy: current price serif, old price muted
  strikethrough, store always `--text-muted`.
- **Green hierarchy held:** strongest green is reserved for the «Чудовий момент» verdict;
  savings values use *moderate* green; ordinary/stable prices stay neutral. A risen price
  shows a muted/informational `+N ₴` delta — never a strikethrough (strike implies a drop).

---

## 4 · «Книги зі знижками» (discounts) section

Extends the frozen green discounts section with three states:

- **Populated** — **reuses the frozen wishlist row & card patterns** exactly (`WLRow` /
  `WLMobCard`). Discounted books are auto-promoted into the green section; each row carries
  the «Чудовий момент» verdict + savings. "Інші бажанки" follows in the normal section.
- **Empty** — explains the daily check in Knyhovyk's calm voice: *"Сьогодні знижок немає.
  Knyhovo щодня о 08:00 перевіряє ціни у 5 книгарнях — щойно якась із ваших бажанок
  подешевшає, Книговик підніме її сюди…"* No mascot (this is a sub-section of a populated
  page, not a whole-page empty state — mascot stays restricted to empty / first-book).
- **Loading** — warm `--surface-accent` skeleton rows in a neutral section frame; never
  cold grey. Mirrors the full row/card anatomy to avoid layout shift.

---

## 5 · Empty / loading states for price history

| Surface | "No data yet" | Loading |
|---|---|---|
| Book Details | `chart-line` icon + «Ще збираємо історію» + neutral «Збираємо дані» badge + a calm line about the daily 08:00 check. Honest, never apologetic, never faked into looking complete. | Warm skeleton: chart block + chip + stat placeholders in the `ph-card`. |
| Wishlist | Inherits the frozen `data` verdict («Збираємо дані») — the row degrades gracefully with no chart, identical height. | Frozen warm skeleton rows/cards. |

**Skeleton rule (inherited):** warm `--surface-accent` blocks only — never cold grey.
All motion is disabled under `prefers-reduced-motion`.

---

## Frozen / do-not-modify

- The frozen Book Details and Wishlist chassis (`ph-bd.css`, `ph-wl.css`) are copied
  verbatim — do not edit them here; change them upstream in the frozen patterns.
- Chart visual language: usual-range band, single smoothed line, two reference points,
  advisory-line voice, DS-chip period selector. No trading/stock-market aesthetics.
- Verdict set, icons, tones and colourblind-safety construction.
- Green hierarchy: strongest green = «Чудовий момент» only; moderate green = savings;
  neutral = ordinary prices; informational blue (never red) = high price.
- Price hierarchy: current serif accent · old muted strikethrough · store muted.
- All v1.0 protected brand assets (logo, mascot) and mascot usage rules.

## Handoff notes for Claude Code

- Replace the mock series in `ph-data.jsx` (`PH_SERIES`) with the Price History API
  response per period. Keep the shape: `{ points:[{x,p}], usualLow, usualHigh, low, high,
  current, change }`. `usualLow/usualHigh` define the "typical" band — derive from the
  API's typical/median range; the chart and the "good moment" logic key off
  `current ≤ usualLow`.
- Verdict copy lives in `ph-data.jsx` (`PH_VERDICTS`); the API supplies which verdict + the
  numbers, the UI supplies the calm sentence.
- `window.PHChart` and `window.PHV` are the composition entry points.
