# Fix benchmark: VOLUME_MISMATCH / BUNDLE_MISMATCH over-firing in `matchOrCreate`

Companion to [canonical-matching-isbn-fix.md](./canonical-matching-isbn-fix.md).
Branch: `bugfix/canonical-volume-bundle-gating`.

## The bug

`matchOrCreate` raised `VOLUME_MISMATCH` and `BUNDLE_MISMATCH` for **any** candidate
whose volume number or bundle flag differed — checked **before** title similarity was
ever considered. Two completely unrelated books were dropped as a conflict purely
because their volume markers differed: e.g. "Мемуари Ванітаса. Том 6" conflicted with
"Зроблено в Безодні. Том 7" (normalized title similarity ≈ **0.11**) because `6 ≠ 7`,
and a box set conflicted with the first single book it happened to be compared against.

This is the **exact same structural flaw** the ISBN fix already corrected for
`ISBN_CONFLICT` (see the companion note): a hard conflict raised ahead of the title
gate, so a genuinely new book is discarded instead of created.

## Why a separate bugfix after ISBN

The ISBN fix (#53) deliberately scoped itself to `ISBN_CONFLICT` only and flagged the
volume/bundle siblings as out of scope, because resolving them needed confirmation that
a differing series volume should *create* a new canonical (not raise a conflict) and
would change the expectations of the existing volume/bundle tests. That product call is
now made: **volume/bundle mismatches are only meaningful for near-identical titles.**

## The fix

The title-similarity gate now runs **first** inside the fuzzy loop. Every hard conflict
— `VOLUME_MISMATCH`, `BUNDLE_MISMATCH`, `ISBN_CONFLICT` — is evaluated **only** for a
candidate that already cleared the gate (`tSim ≥ TITLE_THRESHOLD = 0.85`):

- Title-dissimilar candidates are ignored entirely (neither match nor conflict) → a
  unique book falls through to `created`.
- `normalizeTitle` strips volume markers, so same-series volumes ("…Книга 1" vs
  "…Книга 2") land on the gate with `tSim ≈ 1.0` and still raise `VOLUME_MISMATCH`.
- A bundle marker on an otherwise identical title ("…(комплект)" vs the single edition,
  `tSim = 0.90`) still raises `BUNDLE_MISMATCH`.
- An **exact ISBN match (Step 1) remains authoritative** and short-circuits before any
  volume/bundle reasoning.

No thresholds, conflict-priority ordering, scraper output, or `RawProviderListing`
shape changed. The diff is the matcher loop ordering plus tests.

## Benchmark (real scrapes: book-club → laboratory → knigoland, replayed through the real `matchOrCreate`)

| cap | canonicals (ISBN-fix → vol/bundle-fix) | VOLUME_MISMATCH | BUNDLE_MISMATCH | ISBN_CONFLICT | ground-truth distinct ISBNs |
|----:|:--------------------------------------:|:---------------:|:---------------:|:-------------:|:---------------------------:|
| 100 | **224 → 273**                          | **26 → 1**      | **27 → 1**      | 1 → 1         | 272                         |

- Canonicals now match the ground-truth distinct-ISBN count (273 vs 272) and the
  diagnostic re-implementation's estimate (273 created / 1 conflict).
- The ~48-canonical gap that remained after the ISBN fix is **fully closed**.
- The 3 remaining conflicts are all legitimate near-identical-title cases, not false
  positives:
  - `ISBN_CONFLICT` — "Професор з пелюшок 2-3 роки …" (same title, different ISBN);
  - `BUNDLE_MISMATCH` — "Комплект книжок Філіппа Бессона. …" (box set vs the single);
  - `VOLUME_MISMATCH` — "Біль і гнів. Книга 2. …" (volume vs an existing similar title).
- No regression: `ISBN_CONFLICT` count unchanged (1), cross-provider ISBNs 100%
  consistent (4/4), zero ISBN-duplicate canonicals, zero fuzzy-duplicate candidates —
  no false merges introduced.

(The cap-300 prior state from the ISBN note — 693 canonicals, VOLUME 61, BUNDLE 51, gap
~109 — is the same flaw at scale; the cap-300 after-run was not completed here because
the laboratory scrape is slow/unreliable within local time limits. The cap-100 run is
complete and decisive.)

Reproduce (DB-free; first run scrapes live, subsequent runs can reuse the raw cache):

```bash
nvm use 22
pnpm --filter @knyhovo/shared build && pnpm --filter @knyhovo/scrapers build
cd packages/api
npx tsx src/scripts/validate-canonical-matching.ts 100 <scratch>/validation-100.json
# re-analyse cheaply against the cached raw scrapes:
ANALYZE_ONLY=1 npx tsx src/scripts/validate-canonical-matching.ts 100 <scratch>/validation-100.json
```

## Cases now covered by tests (`match-canonical.test.ts`)

- Different books with differing volume markers → **separate canonicals**, not
  `VOLUME_MISMATCH` (incl. the real "Мемуари Ванітаса" / "Зроблено в Безодні" example).
- Different-subtitle series volumes ("Відьмак. Том 1. …" vs "Том 2. …") → separate
  canonicals (title similarity below the gate).
- Near-identical title with a differing volume ("…Книга 1" vs "…Книга 2") →
  `VOLUME_MISMATCH`.
- Box set vs a different single book ("…: комплект 3 книги", "…: набір 3 книги") →
  **separate canonicals**, not `BUNDLE_MISMATCH`.
- Bundle marker on a near-identical title ("…(комплект)") → `BUNDLE_MISMATCH`.
- Exact ISBN match with differing volume/bundle text → `matched` (MATCH_BY_ISBN wins).
- Regression: three different books with distinct ISBNs and volume/bundle words →
  3 canonicals.

## Out of scope (deliberately)

- Whether a series volume should be a *member* of one canonical vs its own canonical
  remains the current behaviour (its own canonical); no schema/domain change.
- No new matcher, no similarity-algorithm change, no threshold tuning.
- Providers, scraper output, and `RawProviderListing` untouched.
</content>
</invoke>
