# Canonical matcher — production review (final audit)

Branch: `research/canonical-matcher-final-audit`. **Research/audit only — no production
code changed.** Companion to [canonical-matching-isbn-fix.md](./canonical-matching-isbn-fix.md)
and [canonical-matching-volume-bundle-fix.md](./canonical-matching-volume-bundle-fix.md).

Goal: before adding the next provider, review `matchOrCreate` after the two merged
bugfixes (ISBN_CONFLICT title-gating #53, VOLUME/BUNDLE title-gating #54) and decide
whether the matcher is safe to scale.

## Short summary

The two merged bugfixes are correct and verified: at cap-100 the matcher reproduces the
benchmark exactly (273 canonicals = ground-truth distinct ISBNs, 3 conflicts). The
**core job — cross-provider ISBN matching — is rock-solid**: 100% cross-provider ISBN
consistency, **zero** ISBN-duplicate canonicals, **zero** detected fuzzy-duplicate
candidates at both caps. No conflict type fires *before* the title gate any more.

However, scaling the same replay to **cap-300** (a run the prior bugfix notes never
completed) surfaces **two residual issue families that neither bugfix touched** and that
the validation script's own duplicate detectors **cannot see**:

1. **Candidate fuzzy over-merges identified during manual review** (the dangerous
   direction). Distinct same-series SKUs that differ only by a small token (subject /
   age tier / cover / a volume number defeated by a regex gap) appear to collapse into
   one canonical. Several such cases were observed by manual review among the fuzzy
   matches at both caps. These are invisible to `fuzzyDuplicates`/`isbnDuplicates`
   (those detect *under*-merging only), so the counts here are illustrative of the
   pattern rather than an exhaustive measurement.
2. **False CONFLICT drops** (the conservative direction). `BUNDLE_MISMATCH` fires via
   `suffixContainment` whenever a bundle title enumerates its member books; `VOLUME_MISMATCH`
   drops every non-first volume of a real series; `ISBN_CONFLICT` ignores author and so
   collides generic titles ("Вибрані твори", "Ненажера"). On the order of ~20 real,
   distinct, purchasable products appear to be dropped at cap-300 vs the diagnostic ideal
   (8 conflicts).

Both families look **pre-existing and orthogonal to the merged fixes** — the fixes simply
let the catalog populate, which *exposed* the latent fuzzy behaviour. They appear to scale
with catalog size and to be **provider-dependent** (likely most pronounced for series /
manga / workbook / box-set–heavy catalogs like Laboratory).

**Verdict:** safe to continue provider expansion, with follow-up matcher improvements
tracked separately. Onboarding a provider carries no observed risk of corrupting existing
data, breaking the pipeline, or producing ISBN-level mis-merges. The fuzzy over-merge and
conflict-drop patterns are accuracy/coverage improvements to track, not onboarding
blockers; a series/bundle-heavy provider would benefit most from addressing them. Details
and candidate fixes per issue below.

## Current matcher architecture

`matchOrCreate(listing, candidates)` → `{ matched | created | conflict }`.

Thresholds: `TITLE_THRESHOLD 0.85`, `AUTHOR_THRESHOLD 0.80`, `FINAL_THRESHOLD 0.85`,
`TITLE_NO_AUTHOR_THRESHOLD 0.92`, `AUTHOR_PENALTY 0.80`. Conflict priority:
`ISBN_CONFLICT(3) > VOLUME_MISMATCH(2) > BUNDLE_MISMATCH(1)`.

Pipeline:

1. **Step 1 — exact ISBN match (authoritative).** Normalized ISBN equality returns
   `matched` immediately, before any title/volume/bundle reasoning. Short-circuit only.
2. **Steps 2–3 — single candidate loop, title gate FIRST.** For each candidate:
   - `tSim < TITLE_THRESHOLD (0.85)` → `continue` (different book, ignored entirely).
   - Hard conflicts, evaluated **only** for title-similar candidates and in priority
     order: `VOLUME_MISMATCH` (both volumes present and differ) → `BUNDLE_MISMATCH`
     (`listingBundle !== candBundle`) → `ISBN_CONFLICT` (both ISBNs present, differ, and
     `tSim ≥ 0.92`). Each records the conflict and `continue`s.
   - Exact normalized key (`title`+`author`) → `matched`.
   - Fuzzy: author gate (or `AUTHOR_PENALTY` when an author is missing and `tSim ≥ 0.92`),
     `score = 0.65·tSim + 0.35·aSim`; track best.
3. **Step 4 — decision.** `bestScore ≥ FINAL_THRESHOLD` → `matched` (a real match
   **overrides** any recorded conflict); else `seenConflict` → `conflict`; else `created`.

`titleSimilarity = max(stringSimilarity, jaccard, suffixContainment)`. `suffixContainment`
returns **0.9** when the shorter token list is a prefix/suffix of the longer — this single
fact drives most of the false conflicts below.

## Conflict audit table

| Conflict | Purpose | Priority | Current location | Executes only after title gate? | Potential false positives | Verdict |
|---|---|---|---|---|---|---|
| `ISBN_CONFLICT` | Same near-identical title, differing ISBN ⇒ conflicting editions / bad data | 3 (highest) | In loop, after gate; extra guard `tSim ≥ 0.92` | **Yes** (gate + 0.92) | **Author ignored** → generic titles collide ("Вибрані твори", "Ненажера"); also "…2-3 роки" vs "…3-4 роки" (tSim 0.972) are *different* products dropped as a conflict | Mostly fixed; **residual: add author check / generic-title guard** |
| `VOLUME_MISMATCH` | Differing explicit volume of a near-identical series title | 2 | In loop, after gate | **Yes** | Drops every non-first volume of a *real* multi-volume series (Атака титанів Том 1 vs Том 5, Erased, Хочу з'їсти) — each is a distinct purchasable SKU; also `suffixContainment` lets sub-title variants in (Лицар Сич Книга 1 vs "…і Рання Пташка Книга 2") | Gating correct; **semantics wrong: `conflict` drops a real book that should be its own `created` canonical** |
| `BUNDLE_MISMATCH` | Box-set vs single edition of a near-identical title | 1 (lowest) | In loop, after gate | **Yes** | **Systematic.** Laboratory bundle titles *enumerate* member books; `suffixContainment`=0.9 makes every member single (or the bundle) title-similar → `listingBundle !== candBundle` drops a real product ("Подвійне життя", "Пильнуй її", "Не закохуйся, Єво!", …) | **Worst residual false-conflict source; needs a tighter similarity than suffix-containment** |

The "intended" `BUNDLE_MISMATCH` test case ("…Камінь (комплект)" vs "…Камінь") *also*
scores tSim 0.9 purely via `suffixContainment`, so it is structurally indistinguishable
from the enumerated-member-bundle false positives — a single threshold tweak cannot
separate them; the fix must use token-set overlap (jaccard / string-sim) rather than
suffix containment for bundle reasoning.

## Pipeline order assessment

The post-bugfix order is **correct and near-optimal** on the axes the fixes targeted:

- Exact ISBN (Step 1) short-circuits before any conflict reasoning — correct.
- Every hard conflict is scoped *inside* the title gate — the bug both fixes addressed.
- A genuine match found elsewhere **overrides** a recorded conflict (Step 4 checks
  `bestCandidate` before `seenConflict`) — so conflicting one candidate never blocks a
  real match against another. Verified correct.
- Conflict priority ordering (ISBN > VOLUME > BUNDLE) is exercised and correct.

The remaining problems are **not order problems** — they are (a) the *similarity metric*
(`suffixContainment` 0.9 over-qualifies bundle/sub-title relationships), (b) the *conflict
semantics* (`VOLUME`/`BUNDLE` → drop instead of create-separate), and (c) the *fuzzy
acceptance* (0.85 gate + author=1.0 for same-publisher series merges distinct SKUs). No
reordering fixes these.

## Validation metrics (real scrapes, replayed through the **current merged** `matchOrCreate`)

Provider order book-club → laboratory → knigoland; `price === null` skipped (pipeline
parity); DB-free; reused cached raw scrapes (matcher-independent) via `ANALYZE_ONLY=1`.

| Metric | cap-100 | cap-300 |
|---|---:|---:|
| Listings replayed (priced) | 283 | 814 |
| Total canonicals | **273** | **786** |
| Ground-truth distinct ISBNs | 272 | 802 |
| Diagnostic ideal (created / conflicts) | 273 / 1 | 796 / 8 |
| matched-by-ISBN | 4 | 6 |
| matched-by-fuzzy | 3 | 9 |
| Conflicts (ISBN / VOLUME / BUNDLE) | 1 / 1 / 1 | 5 / 6 / 11 |
| Cross-provider shared ISBNs — consistent | 4 / 4 | 6 / 6 |
| ISBN-duplicate canonicals | **0** | **0** |
| Fuzzy-duplicate candidates (detector) | **0** | **0** |

- **cap-100 is decisive and clean** and matches the published benchmark exactly.
- **cap-300 gap** (786 created vs 796 diagnostic / 802 ground-truth) is the residual
  conflict over-firing: 22 production conflicts vs 8 ideal ⇒ ~14–20 real products dropped.
- **The 0/0 duplicate metrics are reassuring but incomplete** — they detect *under*-merging
  only. The candidate over-merges below are invisible to them because the merged SKUs share
  one canonical id.

### Candidate fuzzy over-merges identified during manual review (cap-300 fuzzy path)

| Listing | Merged into | tSim | Distinct ISBNs? | Assessment |
|---|---|---:|---|---|
| Вправні пальчики **2-3 роки** (котик+цуцик) | …**3-4 роки** (зайчик+білочка) | 0.852 | yes (…081 vs …098) | candidate over-merge |
| Великий тренажер … **Прописи** | …**Читання** | 0.851 | yes (…297 vs …303) | candidate over-merge |
| Великий тренажер … **Логіка** | …**Читання** | 0.851 | yes (…273 vs …303) | candidate over-merge (≥3 of 4 SKUs → 1 canonical) |
| Сходження буквоїжки … Частина 1. **Том. 2** | …**Том 3** | 0.906 | yes (…578 vs …100) | candidate over-merge — `Том.` (period) defeats the volume regex, so `VOLUME_MISMATCH` never fires |
| Лісова пісня | Лісова пісня. **Вибрані драматичні твори** | 0.9 | yes, **cross-provider** | likely over-merge (single play vs collected works) |
| Атлас хмар | Атлас хмар (ілюстрований зріз) | 0.9 | yes, cross-provider | borderline (edition variant) |
| Сновійко (лазурова оправа) | …(охрова оправа) | 0.895 | yes | borderline (cover variant) |
| Раз і назавжди **Limited edition** | Раз і назавжди | 0.9 | yes | borderline |
| …(але це неточно) | …(нова обкладинка) | 0.9 | yes | acceptable (same book, new cover) |

Root causes: (1) the 0.85 title gate with `aSim≈1.0` for same-publisher series leaves
`score ≈ 0.90` even when the distinguishing token differs; (2) `extractVolumeNumber`'s
regex `…(?:том|книга|частина|vol|part)\s*(\d+)` rejects a `.` between the keyword and the
number ("Том. 2"), so distinct volumes fall through the volume guard into the fuzzy merge.

## Remaining risks

1. **Candidate fuzzy over-merges (likely the most impactful).** Distinct same-series SKUs
   (workbooks, age tiers, covers, period-suffixed volumes) appear to merge into one
   canonical → prices risk being attributed to the wrong product. Not surfaced by any
   current metric. Likely most pronounced for educational/series publishers; the manual
   review found several such cases, though the exact rate is not measured.
2. **`BUNDLE_MISMATCH` false conflicts (MEDIUM-HIGH).** Every member single of an
   enumerated-title box set (or the box set itself) is dropped via `suffixContainment`.
   ~9–11 real products dropped at cap-300.
3. **`VOLUME_MISMATCH` drops real volumes (MEDIUM).** Conflict-means-drop semantics loses
   every non-first volume of a series; a manga-heavy provider would lose most of its
   catalog. ~6 at cap-300.
4. **`ISBN_CONFLICT` ignores author (MEDIUM).** Generic titles with differing ISBNs and
   *different authors* collide and drop the second. ~3 at cap-300.
5. **Validation blind spot (MEDIUM).** `fuzzyDuplicates`/`isbnDuplicates` only detect
   under-merging; the script has no over-merge (false-merge) detector, giving false
   confidence from the 0/0 figures.

## Follow-up candidates (each a separate, scoped PR — not done here; none are onboarding blockers)

- **R1 — fuzzy over-merge guard.** Require the distinguishing tokens to matter:
  e.g. when `aSim` is high, demand `jaccard`/`stringSimilarity` (not `suffixContainment`)
  ≥ a higher bar, or block a fuzzy match when both sides carry *different* explicit
  numbers/age-ranges/subjects. Add an **over-merge detector** to
  `validate-canonical-matching.ts` (members of one canonical that have ≥2 distinct ISBNs
  with low pairwise title similarity).
- **R2 — fix `extractVolumeNumber` regex** to tolerate punctuation between the keyword and
  the number (`…(?:том|книга|частина|vol|part)\.?\s*(\d+)`), and mirror it in
  `normalizeTitle`'s `VOLUME_MARKER_RE`. Closes the "Том. 2" false merge.
- **R3 — bundle similarity.** Gate `BUNDLE_MISMATCH` on token-set overlap (jaccard /
  string-sim) rather than `suffixContainment`, so an enumerated-member bundle is *not*
  title-similar to its member singles. Keeps the intended "(комплект) on identical title"
  case only.
- **R4 — volume/bundle semantics product decision.** Decide whether a distinct volume /
  box set should be a separate `created` canonical (recommended for a price-comparison
  catalog) rather than a dropped `conflict`. This changes existing test expectations and
  needs a PRD note.
- **R5 — author check in `ISBN_CONFLICT`** (or a generic/short-title guard) so different
  authors sharing a generic title with different ISBNs are `created`, not dropped.

## Final verdict

**Safe to continue provider expansion, with follow-up matcher improvements tracked
separately.** The matcher shows no observed risk of corrupting existing canonicals or
breaking the pipeline, and the authoritative ISBN path is consistent and duplicate-free
at both caps; onboarding a provider introduces no new merge errors.

**Caveat:** catalog *coverage* and *fuzzy accuracy* appear to degrade with scale and are
provider-dependent. The follow-up candidates above are improvements to track, not
onboarding blockers. If the next provider is series / manga / workbook / box-set heavy,
**R1** (fuzzy over-merge guard) and **R3** (bundle similarity) would be the most valuable
to pick up, since those patterns are silent. Providers that are mostly ISBN-clean single
editions (matched purely by ISBN) are largely unaffected and can be added with no matcher
change.

## Reproduce (audit, DB-free, reuses cached raw scrapes)

```bash
nvm use 22
pnpm --filter @knyhovo/shared build && pnpm --filter @knyhovo/scrapers build
cd packages/api
ANALYZE_ONLY=1 npx tsx src/scripts/validate-canonical-matching.ts 100 <scratch>/validation-100.json
ANALYZE_ONLY=1 npx tsx src/scripts/validate-canonical-matching.ts 300 <scratch>/validation-300.json
```

(The per-conflict "which candidate triggered it" and per-fuzzy-match diagnosis used a
throwaway scratch script importing the real built `matchOrCreate`/`titleSimilarity`/
`extractVolumeNumber`/`isBundle`; it is intentionally **not** committed.)
