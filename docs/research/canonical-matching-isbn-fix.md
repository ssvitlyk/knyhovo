# Fix benchmark: ISBN_CONFLICT over-firing in `matchOrCreate`

Companion to [canonical-matching-provider-validation.md](./canonical-matching-provider-validation.md).
Branch: `bugfix/canonical-isbn-conflict`.

## The bug

`matchOrCreate` raised `ISBN_CONFLICT` for **any** candidate carrying a different
ISBN, in a dedicated pass **before** title similarity was ever considered. Every
genuinely new book with a unique ISBN therefore conflicted with the first existing
canonical and was dropped instead of created — the catalog could not grow past one
book.

## The fix

- **Step 1** keeps only the authoritative behaviour: an *exact* ISBN match returns
  `matched` (a shared ISBN is the strongest same-edition signal).
- `ISBN_CONFLICT` is now raised **inside the fuzzy loop**, scoped to candidates whose
  title is near-identical (`tSim ≥ TITLE_NO_AUTHOR_THRESHOLD = 0.92`) yet whose ISBN
  differs — i.e. genuine conflicting editions / bad data, not a new book.
- A unique ISBN with no near-identical-title candidate now falls through to `created`.

This matches, to the listing, the ground-truth-validated diagnostic re-implementation
in `validate-canonical-matching.ts` (its scoped-conflict path also gates on `tSim ≥ 0.92`).

## Benchmark (real scrapes: book-club → laboratory → knigoland, replayed through the real `matchOrCreate`)

| cap | canonicals (before → after) | ISBN_CONFLICT after | ground-truth distinct ISBNs | diagnostic estimate |
|----:|:---------------------------:|:-------------------:|:---------------------------:|:-------------------:|
| 100 | **1 → 224**                 | **1**               | 272                         | 273 created / 1 conflict |
| 300 | **4 → 693**                 | **5**               | 802                         | 796 created / 8 conflict |

- `ISBN_CONFLICT` count after the fix equals the validated diagnostic (cap-100: 1).
- No ISBN-duplicate canonicals, no fuzzy-duplicate candidates, cross-provider ISBNs
  100% consistent — the fix introduces no false merges.

Reproduce (DB-free, reuses cached raw scrapes):

```bash
nvm use 22
pnpm --filter @knyhovo/shared build && pnpm --filter @knyhovo/scrapers build
cd packages/api
ANALYZE_ONLY=1 npx tsx src/scripts/validate-canonical-matching.ts 100 <scratch>/validation-100.json
ANALYZE_ONLY=1 npx tsx src/scripts/validate-canonical-matching.ts 300 <scratch>/validation-300.json
```

## Open sibling bug (out of scope here — recommend follow-up PR)

`VOLUME_MISMATCH` and `BUNDLE_MISMATCH` share the **identical** structural flaw: both
fire against any candidate with a differing volume/bundle marker **without** checking
title similarity. Because `normalizeTitle` strips volume markers, "Мемуари Ванітаса.
Том 6" conflicts with the unrelated "Зроблено в Безодні. Том 7" purely because 6 ≠ 7,
and the new book is dropped.

This accounts for the **entire** remaining catalog gap after the ISBN fix:

| cap | VOLUME_MISMATCH | BUNDLE_MISMATCH | gap to ground truth |
|----:|:---------------:|:---------------:|:-------------------:|
| 100 | 26              | 27              | ~48 (272 − 224)     |
| 300 | 61              | 51              | ~109                |

A proper fix requires a product decision (should a series volume be a separate
`created` canonical rather than a dropped conflict?) and would change the expectations
of the existing volume/bundle tests, so it is deliberately left to a scoped follow-up.
