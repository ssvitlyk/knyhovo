import type { ProviderName } from '@knyhovo/shared';

/**
 * Curated genre-mapping seed (genres-taxonomy PRD §8.1, G3).
 *
 * Projected onto the `genre_mappings` table by `genres:sync` (upsert by
 * unique `(provider, sourceCategory)`; rows are never deleted by sync).
 * The DB table — not this file — is what the engine loads at runtime, so
 * ad-hoc curation directly in the DB survives sync runs of an older seed.
 *
 * Curation contract:
 *   - `sourceCategory` MUST already be normalized (`normalizeCategoryKey`) —
 *     validated by `__tests__/mappings-seed.test.ts` and again by sync;
 *   - `genreSlug: null` = explicit "ignore" rule: known junk (shop roots,
 *     promo sections) disappears from the unmapped report (§8.3);
 *   - confidence bands (PRD §5.1): leaf/specific 90–100, mid-level 55–80,
 *     broad roots («художня література») 40–60;
 *   - every entry cites its evidence in `notes`. Unconfirmed guesses are NOT
 *     seeded — unmapped pairs surface via the report cycle (§8.3): scrape →
 *     `--dry-run --report` → extend this seed → `genres:sync`.
 *
 * v1 scope note: this seed covers the signals confirmed by G2 parser fixtures
 * and the PRD. The staging distinct-category report (PRD §6.2) extends it
 * during rollout curation; that is data curation, not code structure.
 *
 * KSD (`book-club`) keys are category NAMES, not GraphQL slugs: the merged G2
 * parser stores `categories[].name` (slug only as fallback) in
 * `raw_categories` — see `book-club.parser.ts` `resolveCategories`.
 */
export interface GenreMappingSeed {
  readonly provider: ProviderName;
  /** Normalized lookup key (`normalizeCategoryKey`). */
  readonly sourceCategory: string;
  /** Target canonical genre slug (`taxonomy.ts`), or null for "ignore". */
  readonly genreSlug: string | null;
  /** 0–100 (see confidence bands above). */
  readonly confidence: number;
  /** Evidence / rationale — projected into `genre_mappings.notes`. */
  readonly notes: string;
}

export const GENRE_MAPPINGS_SEED: readonly GenreMappingSeed[] = [
  // ── Book Club / КСД (GraphQL categories; names per merged G2 parser) ──
  {
    provider: 'book-club',
    sourceCategory: 'фентезі',
    genreSlug: 'fentezi',
    confidence: 95,
    notes: 'KSD first-class category (PRD §4.3: одиничний сигнал КСД 90–100).',
  },
  {
    provider: 'book-club',
    sourceCategory: 'фантастика',
    genreSlug: 'fantastyka',
    confidence: 95,
    notes: 'KSD first-class category; PRD §8.4 example «KSD category "Фантастика"».',
  },
  {
    provider: 'book-club',
    sourceCategory: 'бізнес',
    genreSlug: 'biznes',
    confidence: 95,
    notes: 'KSD first-class category; PRD §4.6 example «KSD category "Бізнес"».',
  },
  {
    provider: 'book-club',
    sourceCategory: 'художня література',
    genreSlug: 'khudozhnia-proza',
    confidence: 50,
    notes: 'Broad root (PRD §6.2: мапиться лише з низькою confidence 40–60). G2 fixture.',
  },

  // ── BookChef (JSON-LD BreadcrumbList, root→leaf) ──
  {
    provider: 'bookchef',
    sourceCategory: 'фентезі',
    genreSlug: 'fentezi',
    confidence: 95,
    notes: 'G2 fixture: breadcrumb «Художня Література → Фентезі» (PRD §6.2).',
  },
  {
    provider: 'bookchef',
    sourceCategory: 'художня література',
    genreSlug: 'khudozhnia-proza',
    confidence: 50,
    notes: 'Broad root (PRD §6.2). G2 fixtures (all three product pages).',
  },
  {
    provider: 'bookchef',
    sourceCategory: 'романи',
    genreSlug: 'khudozhnia-proza',
    confidence: 55,
    notes: 'Mid-level fiction section; G2 fixture «Художня Література → Романи → Історичний роман».',
  },
  {
    provider: 'bookchef',
    sourceCategory: 'історичний роман',
    genreSlug: 'khudozhnia-proza',
    confidence: 75,
    notes:
      'Fiction subgenre → literary fiction, NOT istoriia (historical non-fiction). G2 fixture leaf.',
  },
  {
    provider: 'bookchef',
    sourceCategory: 'дитяча література',
    genreSlug: 'dytiachi',
    confidence: 90,
    notes: 'G2 fixture: breadcrumb root «Дитяча Література».',
  },
  {
    provider: 'bookchef',
    sourceCategory: 'дитячі пригоди',
    genreSlug: 'dytiachi',
    confidence: 90,
    notes: 'G2 fixture leaf «Дитячі пригоди»; flat taxonomy — maps to dytiachi (PRD §3.2).',
  },

  // ── Laboratory (JSON-LD Book.genre; microdata breadcrumb fallback) ──
  {
    provider: 'laboratory',
    sourceCategory: 'детектив',
    genreSlug: 'detektyvy',
    confidence: 90,
    notes: 'G2 fixture: Book.genre "детектив".',
  },
  {
    provider: 'laboratory',
    sourceCategory: 'художня література',
    genreSlug: 'khudozhnia-proza',
    confidence: 50,
    notes: 'Broad root (PRD §6.2: Laboratory root «Художня література» → низька confidence).',
  },
  {
    provider: 'laboratory',
    sourceCategory: 'каталог книжок',
    genreSlug: null,
    confidence: 100,
    notes: 'Ignore: shop-wide microdata breadcrumb root (G2 fixture), carries no genre signal.',
  },

  // ── Knigoland (JSON-LD BreadcrumbList only; root varies per section) ──
  {
    provider: 'knigoland',
    sourceCategory: 'книги',
    genreSlug: null,
    confidence: 100,
    notes: 'Ignore: universal breadcrumb root «Книги» (G2 fixtures), carries no genre signal.',
  },
  {
    provider: 'knigoland',
    sourceCategory: 'художня література',
    genreSlug: 'khudozhnia-proza',
    confidence: 50,
    notes: 'Broad root (PRD §6.2: Knigoland root «Художня література» → низька confidence).',
  },
  {
    provider: 'knigoland',
    sourceCategory: 'класична проза',
    genreSlug: 'klasyka',
    confidence: 90,
    notes: 'G2 fixture: breadcrumb leaf «Класична проза».',
  },
];
