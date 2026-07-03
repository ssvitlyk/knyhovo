# Knyhovo · Price Alerts extension (W4) — design rationale & state matrix

> **Status: design exploration — the missing 20% of an already-shipped system.**
> This package adds the alert-related states that become available once the W4
> Alert API exists. It does **not** redesign Wishlist v1.0 or Book Details v1.2.1.
> Every layout, grid, spacing rule, type scale, radius, shadow, theme and
> breakpoint of the frozen patterns is preserved. New work composes
> `window.KnyhovoDesignSystem_9fa616` exports + DS v1.0 tokens only — no new
> colours, type, radii or shadows.
>
> Authored 2026-06-15 for the W4 backend Alert work. **Design + rationale only —
> no implementation code.**

---

## W4 — FINAL FREEZE (2026-06-15)

> **"W4 Price Alerts is feature-complete. This is the final design freeze. The two
> finalization deliverables below remove all remaining mobile + lifecycle UX
> ambiguity, so Claude Code can implement Alerts without making UX decisions.
> Ready for implementation handoff. No redesign of Wishlist v1.0, Book Details
> v1.2.1, Price History v1.2.1 or the desktop alert specs."**

### Finalization deliverables (new — the missing 20%)
- **`Mobile Alert Configuration.html`** — the COMPLETE mobile flow shown in real
  Book Details context (frozen `bdm-*` chassis): saved → tap bell → bottom sheet
  (3 intents) → quiet confirmation → updated Book Details. All 7 states (saved→
  enable · configure · created · edit/manage · paused · removed · error) as 375px
  frames, light + dark, plus extra sheet specimens (Вигідна ціна · no-history
  degrade · custom price · resume · remove confirm · triggered) and Claude Code
  handoff notes.
- **`Alert Transition Matrix.html`** — deterministic lifecycle spec: the seven
  states; every transition as a row of {trigger · visual · animation ·
  confirmation · persistence}; quiet confirmation specimens; and the animation +
  persistence rules. Light + dark via the DS `ThemeToggle`.

### Mobile config flow — frozen rules
- **Bottom sheet, never a modal/new nav.** Entry = bell / «Сповістити про
  зниження ціни» in the Book Details `.bd-wish`. One sheet (`.al-sheet`), grab
  handle + page scrim, docked bottom; rises 260ms, scrim fades 220ms.
- **≤ 2 interaction layers.** Book Details (1) → sheet (2). Edit, pause and remove
  all live inside the edit sheet — no third layer.
- **One hand on 375px.** All actions in the lower ~430px; full-width buttons,
  ≥44px touch (`.al-sheet .kn-btn`, `.al-opt min-height:56px`).
- **Context preserved.** Sheet covers only the lower screen; cover, title and best
  price stay visible, and the sheet sub-head restates «зараз 240 ₴ у Yakaboo».
- **Intent, not a number.** 3 intents (`any · below · good`) → `target_price`;
  «Вказати свою ціну» is the quiet secondary path; «Вигідна ціна» disables when
  Price History has no `typicalRange`.
- **Quiet confirmation.** Floating `AL.Toast` above the safe area; auto-dismiss
  ~4s; swipe to close. Never celebratory, never red.
- **Local error.** `AL.Note kind="err"` at the top of the sheet + «Ще раз»; form
  stays editable; book stays wishlisted; Book Details never blocked.
- **Book Details state after the action:** created → `BDToggle state="alert"`;
  paused → `"paused"`; removed → `"saved"`; triggered → `"trig"`.

### Transition matrix — frozen rules
- **Ten transitions, fully specified:** unsaved→saved · saved→active ·
  active→triggered · triggered→active · active→paused · paused→active ·
  active→unavailable · unavailable→active · active→removed · removed→saved.
- **Deterministic.** Each transition fixes trigger, visual treatment, animation,
  confirmation and persistence — nothing left to implementation.
- **Green = triggered only** (the one «good news»); **red is never used**; errors
  are muted + locally recoverable.
- **Confirmations** (created · updated · paused · resumed · removed): subtle, no
  celebration, auto-dismiss, manual dismiss / undo where appropriate. Removal is
  neutral (not green) with a 5s undo.
- **Animation:** token-driven (`--dur-fast` ~140ms / `--dur-base` ~220ms +
  `--ease-out`); bell swap 140ms · chip crossfade 160ms · row colour/promote
  200–280ms · sheet 260ms · scrim 220ms · toast hold ~4s. Triggered highlight is
  a single pass — **no infinite loops**; `prefers-reduced-motion` → instant end
  state. No layout shift (alert lives in reserved slots).
- **Persistence:** source of truth = `wishlist_items.target_price` (копійки,
  nullable) + a `paused` flag (W4 adds). State is derived (see the table at the
  bottom of this doc). Optimistic update + rollback on error; e-mail dedupe fires
  once per drop below target and resets on triggered→active.

### Additive component changes (no redesign — defaults unchanged)
- `AL.Config` (al-core.jsx) gains optional `manage` (adds the «Призупинити
  сповіщення» affordance), `paused` (resume/remove surface) and
  `onPause/onResume/onRemove/onSave/onCancel` handlers.
- `ALC.BDToggle` (al-compose.jsx) gains `paused` and `trig` states.
- `ALData` (al-data.jsx) gains the `arrow-right` icon.
- New styles: `.al-manage`, `.al-paused-note` (alerts.css); `alm-flow.css`
  (375px device frame + flow chrome); `altr-matrix.css` (transition doc + legend
  + state map). New compositions: `alm-flow.jsx`, `altr-doc.jsx`.

---

Inherited from the Wishlist & Price-History freezes:

- **Knyhovo шукає / перевіряє ціни** (the tool). **Книговик радить / стежить /
  повідомляє** (the calm adviser). An alert is *"Книговик watches the price for
  me and writes when the moment comes"* — never *"Buy now before it's gone!"*.
- **No e-commerce urgency.** No countdowns, no «−25%!», no celebration patterns,
  no FOMO. Confirmations are quiet; **green is reserved for genuine good news**
  (the alert *triggered*), never for neutral/technical states; **red is never
  used** — failures are muted and recoverable.
- **Minimise cognitive load.** The user states *intent* («tell me when it's a
  good price»); Книговик translates it into a number. No one is asked to reason
  about thresholds unless they want to.

## How alerts map to the data model

The W4 backend introduces nothing more than a threshold: `wishlist_items`
already carries `target_price_amount` (nullable копійки). The price pipeline
emails the user once when `new_price ≤ target_price` (Resend). So **an "alert"
is simply a configured `target_price` on a wishlist item** — there is no second
entity to design. The whole UX is: *set, show, edit, and remove that one value,
calmly.*

The three configuration **intents** are just presets over that field:

| Intent | Copy | `target_price` written |
|---|---|---|
| Будь-яке зниження | «Книговик напише, щойно ціна впаде.» | current price (any drop below today) |
| Нижче за поточну | «Повідомимо, коли стане дешевше за сьогодні.» | `current` (e.g. 240 ₴) |
| Вигідна ціна | «Коли ціна впаде до вигідного діапазону книги.» | `typicalRange.min` from Price History (e.g. 285 ₴) |

A quiet **«Вказати свою ціну»** disclosure lets power users type an exact value
(still just `target_price`). The intent layer is presentation; the stored value
is always one integer.

---

## Explicit alert state matrix

| State | When | Visual treatment | `target_price` |
|---|---|---|---|
| **saved** | In wishlist, no alert configured | Bell glyph (outline) · no chip · «Сповістити про ціну» link | `NULL` |
| **watch** (active) | Alert on, price not yet at target | `bell-dot` accent · chip «Стежимо за ціною» · target line «нижче 240 ₴» | threshold |
| **triggered** | `price ≤ target` (email sent) | Green moment-row (frozen `hy-row--moment`) · `bell-ring` · chip «Ціль досягнута» · savings | `target ≥ new price` |
| **paused** | User temporarily muted the alert | `bell-off` muted · chip «Призупинено» · «Поновіть…» | stored, paused |
| **unavailable** | Book out-of-stock / no data to watch | `bell-off` faint (disabled) · chip «Сповіщення недоступні» | stored, inactive |

**Colourblind-safe by construction:** four distinct bell glyphs
(`bell` · `bell-dot` · `bell-ring` · `bell-off`) + an always-present text chip.
Colour is the *third* cue, never the only one. `paused` and `unavailable` share
the `bell-off` glyph but are disambiguated by tone, the disabled affordance, and
their distinct chips.

---

## 1 · Wishlist «Бажанки» — alert in the row / card

**The alert reuses slots the frozen pattern already reserves — no new column,
no height change (`min-height: 104px` desktop; the accordion card on mobile).**

- **Status column** (`.hy-row-status`, the badge+reason slot that holds the
  verdict): now also carries the **alert status chip** + the target line. A row
  shows the alert state here; verdict and alert never fight for the slot because
  the triggered state *is* the good-moment verdict.
- **Actions column** (`.v1-row-actions`): the existing bell `.wl-iconbtn`
  becomes the alert control, extended with `--trig` / `--paused` / `--unavail`
  tones (all token-derived).
- **Triggered → green moment-row.** A fired alert is a good-price moment, so it
  reuses the frozen `hy-row--moment` treatment and **auto-promotes into the
  «Книги зі знижками» green section** — consistent with the frozen rule that
  discounted books rise to the top.
- **Mobile:** the alert state is the collapsed-card status chip; details
  (intent, target, last check) and management (bell, «Змінити сповіщення», remove)
  appear on expand. 44px touch targets throughout.

## 2 · Book Details — extended wishlist toggle

**Placement unchanged: directly below the best-price CTA in the OffersPanel
(`.bdc-panel .bd-wish`). The two-pane Variant C grid is untouched.**

| Toggle state | Composition |
|---|---|
| unsaved | secondary `bookmark` «До вішлиста» |
| saved | secondary `bookmark-check` «У вішлисті» + quiet «Сповістити про зниження ціни» link |
| saved + alert | + accent Badge «Стежимо за ціною» + target line + «Змінити» (extends the frozen v1.1 badge) |
| loading | warm skeleton pills (frozen «warm surfaces only» rule) |
| error | toggle stays usable + local `AlertNote` with «Ще раз» — never blocks book exploration |

Light + dark inherit automatically from the theme tokens (copper ↔ amber).

## 3 · Configuration — lightweight, not a modal

- **Desktop:** an anchored **popover** (`.al-config`, ~332px, card radius +
  hairline + `--shadow-lg`) that opens in place under the control.
- **Mobile:** a **bottom sheet** (`.al-sheet`, rounded-top surface + grab handle
  + page scrim) — lightweight, not a full-screen modal. 44px targets, full-width
  buttons.
- **Body:** title → three intent radios (glyph-free, radio + label + desc +
  resolved price) → quiet «Вказати свою ціну» disclosure → a clock footer line
  («Knyhovo перевіряє ціни щодня о 08:00 — Книговик одразу напише на пошту») →
  actions. Create = `[Скасувати] [Увімкнути сповіщення]`; edit =
  `[Прибрати] [Зберегти]`.
- **No-history degrade:** when Price History has no `typicalRange`, the «Вигідна
  ціна» intent is disabled with «Збираємо історію цін…» — a direct tie-in to the
  frozen Price-History empty state. The other two intents stay available.

## 4 · Management · success · error · empty

- **Lifecycle** (active / paused / removed / unavailable) is the same row/card +
  bell + chip vocabulary, specified desktop & mobile in *Alert States – …*.
  «Removed» reverts the row to `saved` + a quiet confirmation.
- **Success** (created / updated / removed): subtle inline `AlertNote` — a calm
  green check for positive events, neutral for removal. **No toast storm, no
  celebration.**
- **Error** (create / update / remove failed · backend unavailable): muted
  `AlertNote--err` with a **local** recovery action («Спробувати ще раз»).
  Never red, never a global page, never blocks the book or OffersPanel.
- **Empty:** *no active alerts* → calm banner inviting the user to pick a book;
  *alerts unavailable (no data)* → «будуть доступні незабаром» banner. No mascot
  (he stays restricted to empty / first-book per the frozen rule).

## Responsive

- **≥768px:** wishlist rows, popover config, two-pane Book Details, full matrix
  (4 columns incl. `target_price`).
- **<768px:** accordion cards, bottom-sheet config, full-width controls, 44px
  targets, compact 3-column matrix (target folded into the cell), **no
  horizontal scroll**.

---

## Component-level implementation guidance (handoff)

New compositions (no new DS components — everything is `window.KnyhovoDesignSystem_9fa616`):

| Export | What | Notes for Claude Code |
|---|---|---|
| `AL.Bell({state})` | alert control | `off·watch·trig·paused·unavail` → glyph + `.wl-iconbtn--*`; `disabled` when `unavail`. Wire `onClick` to open config / toggle. |
| `AL.Chip({state})` | status indicator | `watch·trig·paused·unavail`. Pure presentational; lives in the reserved status slot. |
| `AL.Target({intent,book,triggered,price})` | target line | Derives copy from `ALData.INTENT[...].noteFor(book)`. |
| `AL.Config({book,initialIntent,editing,noHistory,openCustom})` | config body | Stateful (intent + custom). On confirm → `PATCH /api/wishlist/:bookId { targetPrice }`; on remove → `PATCH … { targetPrice: null }`. Intents resolve to `priceFor(book)` (копійки ×100). |
| `AL.Sheet` | mobile sheet shell | Wrap `AL.Config`; reserve `env(safe-area-inset-bottom)`. |
| `AL.Note({kind,action})` | success/error | `ok·quiet·err`; pass a retry `Button` as `action` for errors. |
| `ALC.WRow / WMobCard` | wishlist row/card | Read `item.alert = { state, intent, target }` derived from `target_price` vs current price + availability. |
| `ALC.BDToggle({state})` | Book Details toggle | `unsaved·saved·alert·loading·error`. Mirrors `GET /api/wishlist/status/:bookId` + the item's `target_price`. |

**Deriving `state` from the API (no new endpoint needed):**
`target_price == null` → `saved`; book `out-of-stock` → `unavailable`;
`current ≤ target_price` → `triggered`; a stored `paused` flag → `paused`;
else → `watch`. (W4 may add a `paused` boolean to `wishlist_items`; until then,
paused is a client concept — note for the W4 domain model.)

**Money:** intents store integer копійки (`240 ₴ → 24000`), consistent with the
frozen Price-History / OffersPanel contract.

---

## Files in this package

| File | What |
|---|---|
| `Wishlist Alerts.html` | «Бажанки» rows + accordion cards across all alert states · desktop + mobile · light + dark + state gallery. |
| `Book Details Alerts.html` | Extended wishlist toggle in the frozen OffersPanel · in-context + control gallery · light + dark. |
| `Alert Configuration.html` | Intent-first popover + bottom sheet · create/edit/remove · custom price · no-history degrade · success/error results. |
| `Alert States – Desktop.html` | Explicit state matrix + desktop specimens (bell, chips, lifecycle, success/error, empty). |
| `Alert States – Mobile.html` | Same matrix + mobile specimens · 44px touch · no horizontal scroll. |
| `alerts.css` | **New** alert-only styles — bell tones, status chips, config popover/sheet, notes, gallery scaffold. Tokens only. |
| `ph-wl.css` · `ph-bd.css` · `ph-chart.css` | Frozen Wishlist / Book Details / chart subsets, copied **verbatim** so the extension sits in the real chassis. Do not edit. |
| `al-data.jsx` | Mock content + icons + intent definitions + format → `window.ALData`. |
| `al-core.jsx` | Bell, chip, target line, config, sheet, notes → `window.AL`. |
| `al-compose.jsx` | Wishlist row/card + Book Details toggle + shells → `window.ALC`. |
| `al-states.jsx` | State matrix + specimen galleries → `window.ALS`. |
| `Mobile Alert Configuration.html` | **W4 final** — complete mobile alert config flow in Book Details context; all 7 states + extra sheet specimens, 375px, light + dark, handoff notes. |
| `Alert Transition Matrix.html` | **W4 final** — deterministic lifecycle spec: 7 states, every transition (trigger · visual · animation · confirmation · persistence), confirmations, animation + persistence rules. Light + dark. |
| `alm-flow.jsx` · `alm-flow.css` | Mobile flow: 375px device frame, Book Details backdrop, docked sheet variants, flow canvas. Composes `window.AL/ALC/ALData`. |
| `altr-doc.jsx` · `altr-matrix.css` | Transition-matrix document: state legend, state map, transition table, confirmation specimens, animation/persistence cards. |
| `*-canvas.jsx` | Per-file design-canvas assembly. |

Paths to `_ds/`, `assets/` and `design-canvas.jsx` are relative (`../../`).

---

## Frozen / do-not-modify (proposed for this extension)

- Alert lives in slots the frozen patterns already reserve: the wishlist status
  column + actions bell; the Book Details toggle below the best-price CTA. **No
  new column, no row-height change, no layout paradigm.**
- The five-state set + the four-glyph, colourblind-safe construction; chip
  anatomy mirrors `.phv-badge`.
- Intent-first configuration; popover (desktop) / sheet (mobile); never a modal;
  custom price is secondary. The three intents map to `target_price`.
- Green = triggered/good news only; **never red**; errors muted + locally
  recoverable; success quiet & non-celebratory.
- No push/email/Telegram settings, no preference center, no digests, no AI, no
  social/gamification — out of scope by the brief.
- All v1.0 protected brand assets (logo, mascot) and mascot usage rules; the
  frozen Wishlist / Book Details / OffersPanel / Price-History foundations.
