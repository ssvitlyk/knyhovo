import { describe, expect, it } from 'vitest';
import {
  ALIAS_CONFIDENCE,
  GENRE_PROVIDER_PRIORITY,
  buildEngineContext,
  mapBookGenre,
  type EngineContext,
  type ListingSignal,
  type MappingRuleInput,
} from '../mapping-engine.js';
import { CANONICAL_GENRES } from '../taxonomy.js';

// ──────────────────────────────────────────────────────────────
// Fixture context: a small deterministic taxonomy + rule set that
// exercises every engine behaviour (PRD §4.3) without depending on
// the curated production seed.
// ──────────────────────────────────────────────────────────────

const GENRES = [
  { id: 'g-fentezi', slug: 'fentezi' },
  { id: 'g-fantastyka', slug: 'fantastyka' },
  { id: 'g-khud', slug: 'khudozhnia-proza' },
  { id: 'g-dytiachi', slug: 'dytiachi' },
  { id: 'g-naukpop', slug: 'naukovo-populiarni' },
  { id: 'g-klasyka', slug: 'klasyka' },
] as const;

const TAXONOMY = [
  { slug: 'fentezi', aliases: ['fantasy'] },
  { slug: 'fantastyka', aliases: [] },
  { slug: 'khudozhnia-proza', aliases: [] },
  { slug: 'dytiachi', aliases: [] },
  { slug: 'naukovo-populiarni', aliases: ['Науково-популярна література'] },
  { slug: 'klasyka', aliases: [] },
] as const;

const RULES: readonly MappingRuleInput[] = [
  { provider: 'book-club', sourceCategory: 'фентезі', genreId: 'g-fentezi', confidence: 95 },
  { provider: 'book-club', sourceCategory: 'фантастика', genreId: 'g-fantastyka', confidence: 95 },
  { provider: 'book-club', sourceCategory: 'художня література', genreId: 'g-khud', confidence: 50 },
  { provider: 'book-club', sourceCategory: 'акції', genreId: null, confidence: 100 },
  { provider: 'bookchef', sourceCategory: 'фентезі', genreId: 'g-fentezi', confidence: 95 },
  { provider: 'bookchef', sourceCategory: 'художня література', genreId: 'g-khud', confidence: 50 },
  { provider: 'bookchef', sourceCategory: 'дитяча література', genreId: 'g-dytiachi', confidence: 90 },
  { provider: 'laboratory', sourceCategory: 'фантастика', genreId: 'g-fantastyka', confidence: 80 },
  { provider: 'laboratory', sourceCategory: 'каталог книжок', genreId: null, confidence: 100 },
  { provider: 'knigoland', sourceCategory: 'книги', genreId: null, confidence: 100 },
  { provider: 'knigoland', sourceCategory: 'фантастика', genreId: 'g-fantastyka', confidence: 80 },
  { provider: 'knigoland', sourceCategory: 'класична проза', genreId: 'g-klasyka', confidence: 90 },
];

function makeCtx(rules: readonly MappingRuleInput[] = RULES): EngineContext {
  return buildEngineContext({ mappingRules: rules, genres: GENRES, taxonomy: TAXONOMY });
}

function signal(
  provider: ListingSignal['provider'],
  rawCategories: readonly string[],
  url = `https://example.test/${provider}`,
): ListingSignal {
  return { provider, rawCategories, url };
}

describe('GENRE_PROVIDER_PRIORITY', () => {
  it('is the PRD §4.3 order', () => {
    expect(GENRE_PROVIDER_PRIORITY).toEqual([
      'book-club',
      'bookchef',
      'laboratory',
      'knigoland',
      'vivat',
      'yakaboo',
      'book-ye',
    ]);
  });
});

describe('buildEngineContext', () => {
  it('normalizes rule keys defensively', () => {
    const ctx = buildEngineContext({
      mappingRules: [
        { provider: 'bookchef', sourceCategory: '  Фентезі (7) ', genreId: 'g-fentezi', confidence: 95 },
      ],
      genres: GENRES,
      taxonomy: TAXONOMY,
    });
    const result = mapBookGenre([signal('bookchef', ['Фентезі'])], ctx);
    expect(result.genreId).toBe('g-fentezi');
  });

  it('throws on duplicate normalized rule keys for one provider', () => {
    expect(() =>
      buildEngineContext({
        mappingRules: [
          { provider: 'bookchef', sourceCategory: 'фентезі', genreId: 'g-fentezi', confidence: 95 },
          { provider: 'bookchef', sourceCategory: 'Фентезі ', genreId: 'g-khud', confidence: 50 },
        ],
        genres: GENRES,
        taxonomy: TAXONOMY,
      }),
    ).toThrow(/duplicate mapping rule/);
  });

  it('allows the same key on different providers', () => {
    expect(() =>
      buildEngineContext({
        mappingRules: [
          { provider: 'bookchef', sourceCategory: 'фентезі', genreId: 'g-fentezi', confidence: 95 },
          { provider: 'knigoland', sourceCategory: 'фентезі', genreId: 'g-fentezi', confidence: 90 },
        ],
        genres: GENRES,
        taxonomy: TAXONOMY,
      }),
    ).not.toThrow();
  });

  it('throws when a rule points at an unknown genre id', () => {
    expect(() =>
      buildEngineContext({
        mappingRules: [
          { provider: 'bookchef', sourceCategory: 'фентезі', genreId: 'g-missing', confidence: 95 },
        ],
        genres: GENRES,
        taxonomy: TAXONOMY,
      }),
    ).toThrow(/unknown genre id/);
  });

  it('throws when two genres claim the same alias', () => {
    expect(() =>
      buildEngineContext({
        mappingRules: [],
        genres: GENRES,
        taxonomy: [
          { slug: 'fentezi', aliases: ['spilnyi alias'] },
          { slug: 'fantastyka', aliases: ['Spilnyi Alias'] },
        ],
      }),
    ).toThrow(/alias "spilnyi alias" is claimed by both/);
  });

  it('skips aliases of taxonomy entries without a DB genre row', () => {
    const ctx = buildEngineContext({
      mappingRules: [],
      genres: [{ id: 'g-fentezi', slug: 'fentezi' }],
      taxonomy: [
        { slug: 'fentezi', aliases: ['fantasy'] },
        { slug: 'not-synced-yet', aliases: ['фантом'] },
      ],
    });
    expect(ctx.aliasToGenreId.get('fantasy')).toBe('g-fentezi');
    expect(ctx.aliasToGenreId.has('фантом')).toBe(false);
  });

  it('defaults taxonomy to CANONICAL_GENRES', () => {
    const ctx = buildEngineContext({
      mappingRules: [],
      genres: [{ id: 'g-fentezi', slug: 'fentezi' }],
    });
    const fentezi = CANONICAL_GENRES.find((g) => g.slug === 'fentezi')!;
    expect(ctx.aliasToGenreId.get(fentezi.aliases[0]!)).toBe('g-fentezi');
  });
});

describe('mapBookGenre — single-provider candidates (§4.3 step 1)', () => {
  it('maps a single breadcrumb leaf through a provider rule', () => {
    const result = mapBookGenre(
      [signal('bookchef', ['Художня Література', 'Фентезі'])],
      makeCtx(),
    );
    expect(result.genreId).toBe('g-fentezi');
    expect(result.confidence).toBe(95);
    expect(result.explanation).toBe('BookChef breadcrumb "Художня Література → Фентезі"');
  });

  it('takes only the deepest mapped element of a breadcrumb path — leaf beats root', () => {
    const result = mapBookGenre(
      [signal('bookchef', ['Художня Література', 'Фентезі'])],
      makeCtx(),
    );
    // The root «Художня література» (g-khud, 50) must NOT appear as a candidate.
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.slug).toBe('fentezi');
  });

  it('leaf beats root even when the leaf has LOWER confidence', () => {
    const ctx = makeCtx([
      { provider: 'bookchef', sourceCategory: 'дитяча література', genreId: 'g-dytiachi', confidence: 90 },
      { provider: 'bookchef', sourceCategory: 'дитячі пригоди', genreId: 'g-dytiachi', confidence: 60 },
    ]);
    const result = mapBookGenre(
      [signal('bookchef', ['Дитяча Література', 'Дитячі пригоди'])],
      ctx,
    );
    expect(result.genreId).toBe('g-dytiachi');
    expect(result.confidence).toBe(60);
  });

  it('an unmapped leaf falls back to the deepest mapped ancestor', () => {
    const result = mapBookGenre(
      [signal('knigoland', ['Книги', 'Фантастика', 'Космоопера'])],
      makeCtx(),
    );
    expect(result.genreId).toBe('g-fantastyka');
    expect(result.unmapped).toEqual([
      {
        provider: 'knigoland',
        rawCategory: 'Космоопера',
        normalizedKey: 'космоопера',
        exampleUrl: 'https://example.test/knigoland',
      },
    ]);
  });

  it('ignore rules drop the element silently: not a candidate, not unmapped', () => {
    const result = mapBookGenre(
      [signal('knigoland', ['Книги', 'Класична проза'])],
      makeCtx(),
    );
    expect(result.genreId).toBe('g-klasyka');
    expect(result.unmapped).toEqual([]);
  });

  it('an ignored leaf yields the next deepest mapped element', () => {
    const ctx = makeCtx([
      { provider: 'bookchef', sourceCategory: 'фентезі', genreId: 'g-fentezi', confidence: 95 },
      { provider: 'bookchef', sourceCategory: 'новинки', genreId: null, confidence: 100 },
    ]);
    const result = mapBookGenre(
      [signal('bookchef', ['Фентезі', 'Новинки'])],
      ctx,
    );
    expect(result.genreId).toBe('g-fentezi');
  });

  it('a whole path of ignored/unmapped elements produces no candidates', () => {
    const result = mapBookGenre([signal('knigoland', ['Книги', 'Подарунки'])], makeCtx());
    expect(result.genreId).toBeNull();
    expect(result.confidence).toBeNull();
    expect(result.explanation).toBeNull();
    expect(result.candidates).toEqual([]);
    expect(result.unmapped.map((u) => u.normalizedKey)).toEqual(['подарунки']);
  });

  it('normalizes raw elements before lookup (counter, case, whitespace)', () => {
    const result = mapBookGenre(
      [signal('bookchef', ['ХУДОЖНЯ   ЛІТЕРАТУРА', 'Фентезі (123)'])],
      makeCtx(),
    );
    expect(result.genreId).toBe('g-fentezi');
  });
});

describe('mapBookGenre — KSD unordered set semantics', () => {
  it('every mapped KSD category is an independent candidate; specificity wins by score', () => {
    // Leaf-ish category listed FIRST — path semantics would wrongly pick the root.
    const result = mapBookGenre(
      [signal('book-club', ['Фентезі', 'Художня література'])],
      makeCtx(),
    );
    expect(result.genreId).toBe('g-fentezi');
    expect(result.confidence).toBe(95);
    expect(result.explanation).toBe('KSD category "Фентезі"');
    expect(result.candidates.map((c) => c.slug)).toEqual(['fentezi', 'khudozhnia-proza']);
  });

  it('ignore rules drop KSD junk categories', () => {
    const result = mapBookGenre(
      [signal('book-club', ['Акції', 'Фантастика'])],
      makeCtx(),
    );
    expect(result.genreId).toBe('g-fantastyka');
    expect(result.unmapped).toEqual([]);
  });
});

describe('mapBookGenre — alias fallback (§4.3 step 1)', () => {
  it('falls back to the taxonomy alias dictionary at ALIAS_CONFIDENCE', () => {
    const result = mapBookGenre(
      [signal('laboratory', ['Науково-популярна література'])],
      makeCtx(),
    );
    expect(result.genreId).toBe('g-naukpop');
    expect(result.confidence).toBe(ALIAS_CONFIDENCE);
    expect(result.explanation).toBe('Alias "Науково-популярна література"');
  });

  it('an explicit provider rule beats the alias — including an ignore rule', () => {
    const ctx = makeCtx([
      { provider: 'laboratory', sourceCategory: 'fantasy', genreId: null, confidence: 100 },
    ]);
    const result = mapBookGenre([signal('laboratory', ['Fantasy'])], ctx);
    expect(result.genreId).toBeNull();
    expect(result.unmapped).toEqual([]);
  });

  it('an alias hit counts as "mapped" for the deepest-element rule', () => {
    const result = mapBookGenre(
      [signal('knigoland', ['Книги', 'Фантастика', 'Науково-популярна література'])],
      makeCtx(),
    );
    // Alias leaf (70) is deeper than the rule-mapped «Фантастика» (80) — leaf wins.
    expect(result.genreId).toBe('g-naukpop');
    expect(result.confidence).toBe(ALIAS_CONFIDENCE);
  });
});

describe('mapBookGenre — cross-provider scoring (§4.3 step 2)', () => {
  it('agreement of two providers beats a single higher-confidence provider', () => {
    const result = mapBookGenre(
      [
        signal('book-club', ['Фентезі']), // 95, alone
        signal('laboratory', ['Фантастика']), // 80
        signal('knigoland', ['Книги', 'Фантастика']), // 80, agrees
      ],
      makeCtx(),
    );
    // fantastyka: 80 + 25 = 100 (cap); fentezi: 95.
    expect(result.genreId).toBe('g-fantastyka');
    expect(result.confidence).toBe(100);
    expect(result.explanation).toBe('Agreement: Laboratory + Knigoland');
  });

  it('caps the score at 100', () => {
    const result = mapBookGenre(
      [signal('laboratory', ['Фантастика']), signal('knigoland', ['Фантастика'])],
      makeCtx(),
    );
    expect(result.confidence).toBe(100);
  });

  it('two listings of the SAME provider earn no agreement bonus', () => {
    const result = mapBookGenre(
      [
        signal('knigoland', ['Фантастика'], 'https://example.test/a'),
        signal('knigoland', ['Фантастика'], 'https://example.test/b'),
      ],
      makeCtx(),
    );
    expect(result.confidence).toBe(80);
    expect(result.candidates[0]!.providers).toEqual(['knigoland']);
  });

  it('an alias candidate participates in cross-provider agreement', () => {
    const result = mapBookGenre(
      [
        signal('knigoland', ['Фантастика']), // rule, 80
        signal('laboratory', ['Науково-популярна література']), // alias → naukpop 70
        signal('bookchef', ['Науково-популярна література']), // alias → naukpop 70
      ],
      makeCtx(),
    );
    // naukpop: 70 + 25 = 95 vs fantastyka 80.
    expect(result.genreId).toBe('g-naukpop');
    expect(result.confidence).toBe(95);
    expect(result.explanation).toBe('Agreement: BookChef + Laboratory');
  });
});

describe('mapBookGenre — tie-breaks (§4.3 step 3)', () => {
  it('equal score → lower GENRE_PROVIDER_PRIORITY index wins', () => {
    const ctx = makeCtx([
      { provider: 'bookchef', sourceCategory: 'фентезі', genreId: 'g-fentezi', confidence: 90 },
      { provider: 'knigoland', sourceCategory: 'класична проза', genreId: 'g-klasyka', confidence: 90 },
    ]);
    const result = mapBookGenre(
      [signal('knigoland', ['Класична проза']), signal('bookchef', ['Фентезі'])],
      ctx,
    );
    expect(result.genreId).toBe('g-fentezi'); // bookchef (1) < knigoland (3)
  });

  it('equal score and provider → deeper breadcrumb wins', () => {
    const ctx = makeCtx([
      { provider: 'book-club', sourceCategory: 'казки', genreId: 'g-dytiachi', confidence: 90 },
      { provider: 'book-club', sourceCategory: 'класика', genreId: 'g-klasyka', confidence: 90 },
    ]);
    const result = mapBookGenre([signal('book-club', ['Казки', 'Класика'])], ctx);
    expect(result.genreId).toBe('g-klasyka'); // element index 1 > 0
  });

  it('full tie → alphabetical slug wins', () => {
    const ctx = makeCtx([
      { provider: 'book-club', sourceCategory: 'казки', genreId: 'g-dytiachi', confidence: 90 },
      { provider: 'book-club', sourceCategory: 'класика', genreId: 'g-klasyka', confidence: 90 },
    ]);
    const result = mapBookGenre(
      [
        signal('book-club', ['Казки'], 'https://example.test/a'),
        signal('book-club', ['Класика'], 'https://example.test/b'),
      ],
      ctx,
    );
    expect(result.genreId).toBe('g-dytiachi'); // 'dytiachi' < 'klasyka'
  });

  it('is deterministic regardless of listing order', () => {
    const listings = [
      signal('book-club', ['Фентезі']),
      signal('laboratory', ['Фантастика']),
      signal('knigoland', ['Книги', 'Фантастика']),
    ];
    const forward = mapBookGenre(listings, makeCtx());
    const backward = mapBookGenre([...listings].reverse(), makeCtx());
    expect(backward.genreId).toBe(forward.genreId);
    expect(backward.confidence).toBe(forward.confidence);
    expect(backward.candidates).toEqual(forward.candidates);
  });
});

describe('mapBookGenre — edge cases and reporting', () => {
  it('no listings → null result, nothing unmapped', () => {
    const result = mapBookGenre([], makeCtx());
    expect(result).toEqual({
      genreId: null,
      confidence: null,
      explanation: null,
      candidates: [],
      unmapped: [],
    });
  });

  it('listings with empty rawCategories → null result', () => {
    const result = mapBookGenre([signal('bookchef', [])], makeCtx());
    expect(result.genreId).toBeNull();
    expect(result.unmapped).toEqual([]);
  });

  it('whitespace-only category elements are skipped entirely', () => {
    const result = mapBookGenre([signal('bookchef', ['  ', 'Фентезі'])], makeCtx());
    expect(result.genreId).toBe('g-fentezi');
    expect(result.unmapped).toEqual([]);
  });

  it('a provider with no rules at all still resolves via aliases and reports misses', () => {
    const result = mapBookGenre(
      [signal('vivat', ['Fantasy', 'Щось невідоме'], 'https://vivat.test/x')],
      makeCtx(),
    );
    // Deepest element is unmapped; 'Fantasy' resolves via alias and wins.
    expect(result.genreId).toBe('g-fentezi');
    expect(result.unmapped).toEqual([
      {
        provider: 'vivat',
        rawCategory: 'Щось невідоме',
        normalizedKey: 'щось невідоме',
        exampleUrl: 'https://vivat.test/x',
      },
    ]);
  });

  it('dedupes unmapped keys within one listing but keeps per-listing occurrences', () => {
    const result = mapBookGenre(
      [
        signal('knigoland', ['Подарунки', 'подарунки '], 'https://example.test/a'),
        signal('knigoland', ['Подарунки'], 'https://example.test/b'),
      ],
      makeCtx(),
    );
    expect(result.unmapped).toHaveLength(2);
    expect(result.unmapped.map((u) => u.exampleUrl)).toEqual([
      'https://example.test/a',
      'https://example.test/b',
    ]);
  });

  it('exposes the full ranked candidate list (§8.4, §15)', () => {
    const result = mapBookGenre(
      [
        signal('book-club', ['Фентезі', 'Художня література']),
        signal('laboratory', ['Фантастика']),
      ],
      makeCtx(),
    );
    expect(result.candidates.map((c) => ({ slug: c.slug, score: c.score }))).toEqual([
      { slug: 'fentezi', score: 95 },
      { slug: 'fantastyka', score: 80 },
      { slug: 'khudozhnia-proza', score: 50 },
    ]);
    expect(result.candidates[1]!.explanation).toBe('Laboratory breadcrumb "Фантастика"');
  });
});
