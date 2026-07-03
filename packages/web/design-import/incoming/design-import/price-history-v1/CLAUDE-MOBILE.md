# Knyhovo · Price History v1 — W3.1 mobile completion

> **Status: completes the missing 20% of Price History v1.**
> Adds the **Book Details mobile** variants (filled · empty · loading, light + dark)
> so the whole system — desktop + mobile, both themes, all states — can be frozen.
> This is **not** a redesign: it reuses Book Details v1.1 (Variant C), Wishlist v1.0
> and the already-approved Price History v1 Desktop. No new tokens, type, radii,
> shadows, colours or interaction models are introduced.

Authored 2026-06-14 for the W3.1 mobile completion.

---

## W3.2 — mobile «Динаміка ціни» alignment polish (2026-06-14)

> Final visual-polish pass before freeze. **No redesign, no IA change** — the graph,
> the 2×2 statistics, chip functionality, section placement and responsive behaviour
> are untouched. Only spacing rules, chip alignment and one term were refined.

**New review files** (single-theme, full mobile page, 390px column):
`Book Details – Mobile – Filled – Light.html` · `Book Details – Mobile – Filled – Dark.html`
(mounted via `phbdm-single.jsx`, reading the theme from `<html data-theme>`).

### What alignment issues were fixed
1. **Period chips** — chips now have an explicit **44px height** (frozen mobile
   touch-target rule, Book Details v1.2 — Price History FINAL FREEZE) and are vertically
   centred (`display:inline-flex; align-items:center`), so all four sit on a shared
   baseline with identical height regardless of active/inactive state (active = accent
   fill only — same box, so row rhythm never shifts). The group is **centred as a row**
   (`justify-content:center`) with equal `--space-2` gaps and a wrapping `row-gap`.
2. **Explanatory text** — the advisory paragraph is now full **card width**
   (`max-width:none` on mobile) so it aligns to the graph container, with normal
   line-height for calm readability (font size unchanged). Consistent top spacing from
   the chips and bottom spacing to the graph (see rhythm below).
3. **Vertical rhythm** — replaced the ad-hoc inline `margin` on the title with one
   token-driven scale applied top-to-bottom.
4. **Theme consistency** — every spacing rule is a `--space-*` token (theme-independent);
   light and dark were measured to use **identical** spacing (16 / 16 / 20px, 44px chips).
   Only colour tokens differ.

### Which spacing rules were standardized (`.ph-section--mob`)
| Gap | Token | Value |
|---|---|---|
| title → chips | `--space-4` | 16px |
| chips → explanatory text | `--space-4` | 16px |
| text → graph card | `--space-5` | 20px |
| chart → 2×2 stats (inside card, unchanged) | `--space-4` | 16px |

### Copy update
«звичайний діапазон» → **«типовий діапазон»** in the advisory line. The copy lives in
the **shared** `phAdvisory` (one source for desktop + mobile), so both surfaces now read
«типовий діапазон» and stay identical — matching the approved W3.1 terminology. The
graph band label and the stat label keep their frozen «звичайна ціна» wording (out of
this pass's narrow scope — graph + stats structure must not change); they remain a
synonym of the same concept. Flag for a future pass if full term unification is wanted.

---

## Deliverables

| File | What it is |
|---|---|
| `Book Details – Mobile – Filled.html` | Full mobile Book Details page with the populated «Динаміка ціни» block (chart + typical band + stats). Light + dark, at 390 + 375px. |
| `Book Details – Mobile – Empty.html` | Same page, price-history block in the «Ще збираємо історію» no-data state. Light + dark. |
| `Book Details – Mobile – Loading.html` | Same page, price-history **section** as a structure-mirroring skeleton (rest of page renders normally). Light + dark. |
| `phbd-mobile.jsx` | Shared mobile Book Details page chassis, parameterised by price-history `state`. → `window.PHBDMobile.BookDetailsMobile({ theme, state })`. |
| `phbdm-*-canvas.jsx` | Per-deliverable design-canvas assembly (one section, both themes + a 375px artboard). |

All three pages reuse the existing `window.PHChart` mobile components
(`PriceHistoryMobile`, `PriceHistoryEmpty`, `PriceHistoryLoading`) and the frozen
mobile chassis classes in `ph-bd.css` — the desktop and mobile share one source of
truth, so the mobile reads as a direct continuation of the approved desktop.

---

## Placement (frozen for this extension)

```
hero (cover · title · author)
   ↓
«Де купити» — offers panel (decision-first)
   ↓
«Динаміка ціни» — price history          ← never moved
   ↓
remaining Book Details content (опис · про видання)
   ↓
footer
```

Price History sits **directly below the offers panel** — identical to the desktop
extension, where it sits full-width below the two-pane grid. The section is never
relocated between states; empty and loading occupy the same slot as filled.

---

## Layout decisions

### Chart sizing
- Mobile SVG viewBox is **340 × 152** (vs desktop 760 × 244): a compact adaptation
  that keeps the gently-smoothed line, the typical-price band, the peak reference and
  the «зараз» current marker fully readable. Rendered chart height lands at **~150–165px**
  inside the card (`.ph-card--mob` padding `--space-5`), within the 160–180px target.
- The SVG scales fluidly (`width:100%; height:auto`), so it never causes horizontal
  scrolling — at 375px the plotted width is ~245px and the right-side annotations
  («звичайна ціна · 285–318 ₴», «зараз 240 ₴») stay inside the padded plot area.

### Statistics arrangement
- Four stats in a **2 × 2 grid** (`.ph-stats--mob`): `Зараз` · `Найнижча за період`
  on row 1, `Звичайна ціна` · `Зміна за період` on row 2.
- Equal visual hierarchy: every value is serif `1.3125rem`, every label is the same
  uppercase xs eyebrow. Scannable, no tables. Column gap `--space-4`, row gap `--space-5`.
- Labels match the **approved desktop** wording exactly (`Звичайна ціна`, not a new
  «Типова ціна» synonym) so desktop ↔ mobile stay consistent.

### Period-chip behaviour
- DS-chip pattern, identical to the other mobile chips (`.ph-period`, 44px min touch
  height via `.ph-periods--mob .ph-period` — frozen v1.2 touch-target rule).
- The four chips (`30 днів · 90 днів · Рік · Весь час`) sit in **one row at ≥360px**
  and **wrap gracefully** (never horizontal-scroll) on narrower widths — `flex-wrap: wrap`,
  no scroll rail. Active state is the accent fill, matching desktop.

### Spacing adaptations
- Section top gap `.ph-section--mob` = `--space-10` (40px) — separates Price History
  from the offers panel above while keeping them related, consistent with the frozen
  mobile section rhythm (`.bdm .bd-section`).
- Card padding steps down to `--space-5`; advisory and stat spacing use the mobile
  scale. No values are invented — all are existing `--space-*` tokens.

---

## Mobile-specific rules

- **Breakpoint:** the mobile composition is the frozen Book Details v1.1 `<768px`
  layout (`.bdm` chassis). Above 768px the desktop two-pane Price History applies
  (see `Price History - Desktop.html`).
- **Minimum supported width: 375px.** The design is verified with **no horizontal
  scrolling at 375px and above** (375 + 390px artboards included in each file).
- **Behaviour on narrow devices:** period chips wrap instead of scrolling; stats stay a
  2-up grid; the chart scales down with its SVG; the advisory text reflows and is never
  truncated. At the tightest widths (≤340px) the chips simply take a second row — the
  section never overflows its column.
- **Touch targets:** chips and buttons keep a ≥44px target (`.bdm .kn-btn`,
  `.ph-periods--mob .ph-period`).
- **Loading scope:** only the price-history **section** is a skeleton; the rest of the
  page (hero, offers, description, metadata) renders normally, because price history is
  the part that loads after the page. The skeleton mirrors the final structure
  (title · two-line text · period chips · chart with typical-band hint · 2×2 stats) so
  the section reserves identical height and there is **no layout shift** when data arrives.
- **Motion:** warm `--surface-accent` / `--surface-sunk` skeleton blocks only — never
  cold grey. All pulse animation is disabled under `prefers-reduced-motion`.

---

## Empty-state copy — reconciliation note

The W3.1 brief sketched the supporting line as «…коли ціна стане нижчою за звичну.»
The **approved desktop** Price History (W3, 2026-06-14) and the frozen Wishlist v1.0
language both use «…коли настане вдалий момент купувати.». Because the empty state is a
**single shared component** (desktop + mobile render the same `PriceHistoryEmpty`) and
the mandate is "mobile = continuation of the approved desktop", the mobile keeps the
frozen desktop copy verbatim:

> **Ще збираємо історію** · Збираємо дані
> «Knyhovo перевіряє ціни у 5 книгарнях щодня о 08:00. Графік з'явиться, щойно
> назбираємо кілька тижнів спостережень — тоді Книговик підкаже, коли настане вдалий
> момент купувати.»

Honest, reassuring, never an error — consistent with Wishlist empty states.

---

## Philosophy preserved

> **Knyhovo знаходить та перевіряє ціни. Книговик допомагає зрозуміти, чи настав
> правильний момент купувати.**

The mobile Price History stays a calm, secondary supporting block — objective
observations only (no «Книговик думає / радить»), no trading aesthetics, no urgency,
no AI recommendations, target prices, notifications, weekly digests, sharing or
gamification. It exists to help readers make calmer, more confident purchasing
decisions — nothing more.

---

## Freeze requirement — met

With these three mobile variants in place, Price History v1 now covers **desktop +
mobile, both themes, filled + empty + loading**. The feature is ready to be officially
frozen alongside Book Details v1.1 and Wishlist v1.0.
