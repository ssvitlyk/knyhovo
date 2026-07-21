import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { compose, FeedComposerError } from '../index.js';
import type { DiversityPolicy, FeedCandidate, SectionSpec } from '../index.js';

/** Build a candidate; `providerId` defaults to a unique-per-id bucket (diversity is a no-op unless set). */
function c(id: string, providerId = `prov-${id}`): FeedCandidate {
  return { id, providerId };
}

/** Home-shaped policy: floor(take × 1/3), min 1 — the concrete policy lives in the caller, never in the composer. */
const homePolicy: DiversityPolicy = { bucketCapFor: (take) => Math.max(1, Math.floor(take / 3)) };
/** A cap that never constrains — lets diversify sections behave like plain dedup. */
const loosePolicy: DiversityPolicy = { bucketCapFor: (take) => take };

function pickedIds(result: ReturnType<typeof compose>, key: string): string[] {
  const section = result.sections.find((s) => s.key === key);
  return section ? section.picked.map((p) => p.id) : [];
}

describe('compose — dedup + allocation order', () => {
  it('strict cross-section dedup across an arbitrary number of sections', () => {
    const shared = [c('a'), c('b'), c('c'), c('d')];
    const specs: SectionSpec[] = [
      { key: 's1', take: 2, candidates: shared, diversify: false },
      { key: 's2', take: 2, candidates: shared, diversify: false },
      { key: 's3', take: 2, candidates: shared, diversify: false },
    ];
    const r = compose(specs, { diversityPolicy: loosePolicy });
    expect(pickedIds(r, 's1')).toEqual(['a', 'b']);
    expect(pickedIds(r, 's2')).toEqual(['c', 'd']);
    expect(pickedIds(r, 's3')).toEqual([]);
    // No id repeats anywhere.
    const all = r.sections.flatMap((s) => s.picked.map((p) => p.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it('allocation order: the first spec reserves first', () => {
    const pool = [c('x'), c('y'), c('z')];
    const r = compose(
      [
        { key: 'first', take: 1, candidates: pool, diversify: false },
        { key: 'second', take: 2, candidates: pool, diversify: false },
      ],
      { diversityPolicy: loosePolicy },
    );
    expect(pickedIds(r, 'first')).toEqual(['x']);
    expect(pickedIds(r, 'second')).toEqual(['y', 'z']);
  });

  it('supports arbitrary opaque keys', () => {
    const r = compose(
      [{ key: 'любий-ключ-42', take: 1, candidates: [c('a')], diversify: false }],
      { diversityPolicy: loosePolicy },
    );
    expect(pickedIds(r, 'любий-ключ-42')).toEqual(['a']);
  });

  it('a single book goes to the highest-priority section', () => {
    const only = [c('solo')];
    const r = compose(
      [
        { key: 'hi', take: 5, candidates: only, diversify: false },
        { key: 'lo', take: 5, candidates: only, diversify: false },
      ],
      { diversityPolicy: loosePolicy },
    );
    expect(pickedIds(r, 'hi')).toEqual(['solo']);
    expect(pickedIds(r, 'lo')).toEqual([]);
  });

  it('full overlap: later sections get whatever the earlier ones left', () => {
    const pool = [c('a'), c('b')];
    const r = compose(
      [
        { key: 's1', take: 2, candidates: pool, diversify: false },
        { key: 's2', take: 2, candidates: pool, diversify: false },
      ],
      { diversityPolicy: loosePolicy },
    );
    expect(pickedIds(r, 's1')).toEqual(['a', 'b']);
    expect(pickedIds(r, 's2')).toEqual([]);
  });
});

describe('compose — diversity', () => {
  it('diversify=false ignores providerId (curated order preserved)', () => {
    const pool = [c('a', 'P'), c('b', 'P'), c('c', 'P'), c('d', 'P')];
    const r = compose([{ key: 's', take: 3, candidates: pool, diversify: false }], { diversityPolicy: homePolicy });
    expect(pickedIds(r, 's')).toEqual(['a', 'b', 'c']);
    expect(r.sections[0]?.diagnostics.cap).toBeNull();
  });

  it('take=12 with the Home policy yields cap=4', () => {
    // 5 candidates from provider P, plenty of alternatives after.
    const pool: FeedCandidate[] = [
      ...Array.from({ length: 5 }, (_, i) => c(`p${i}`, 'P')),
      ...Array.from({ length: 20 }, (_, i) => c(`q${i}`, `Q${i}`)),
    ];
    const r = compose([{ key: 's', take: 12, candidates: pool, diversify: true }], { diversityPolicy: homePolicy });
    const section = r.sections[0]!;
    expect(section.diagnostics.cap).toBe(4);
    // With alternatives available, provider P is held to the cap of 4.
    expect(section.diagnostics.providerDistribution['P']).toBe(4);
    expect(section.picked).toHaveLength(12);
  });

  it('no bucket exceeds the cap when there are enough alternatives', () => {
    const pool: FeedCandidate[] = [];
    for (const prov of ['A', 'B', 'C', 'D', 'E', 'F']) {
      for (let i = 0; i < 6; i += 1) pool.push(c(`${prov}${i}`, prov));
    }
    const r = compose([{ key: 's', take: 12, candidates: pool, diversify: true }], { diversityPolicy: homePolicy });
    const dist = r.sections[0]!.diagnostics.providerDistribution;
    for (const count of Object.values(dist)) expect(count).toBeLessThanOrEqual(4);
    expect(r.sections[0]!.picked).toHaveLength(12);
  });

  it('skewed pool: relaxation fills the shelf past the cap when no alternatives remain', () => {
    // 10 from P, only 2 from others → cap 4 can not fill 12 without relaxing.
    const pool: FeedCandidate[] = [
      ...Array.from({ length: 10 }, (_, i) => c(`p${i}`, 'P')),
      c('q0', 'Q'),
      c('q1', 'Q'),
    ];
    const r = compose([{ key: 's', take: 12, candidates: pool, diversify: true }], { diversityPolicy: homePolicy });
    const section = r.sections[0]!;
    expect(section.picked).toHaveLength(12); // relaxation filled it
    expect(section.diagnostics.relaxationUsed).toBe(true);
    expect(section.diagnostics.providerDistribution['P']).toBeGreaterThan(4);
  });

  it('single provider for the whole pool: relaxation still fills up to take', () => {
    const pool = Array.from({ length: 20 }, (_, i) => c(`p${i}`, 'ONLY'));
    const r = compose([{ key: 's', take: 12, candidates: pool, diversify: true }], { diversityPolicy: homePolicy });
    expect(r.sections[0]!.picked).toHaveLength(12);
    expect(r.sections[0]!.diagnostics.relaxationUsed).toBe(true);
  });

  it('UNKNOWN is just another opaque bucket (subject to the same cap)', () => {
    const pool: FeedCandidate[] = [
      ...Array.from({ length: 6 }, (_, i) => c(`u${i}`, 'UNKNOWN')),
      ...Array.from({ length: 6 }, (_, i) => c(`k${i}`, `K${i}`)),
    ];
    const r = compose([{ key: 's', take: 8, candidates: pool, diversify: true }], { diversityPolicy: homePolicy });
    const dist = r.sections[0]!.diagnostics.providerDistribution;
    // cap = floor(8/3) = 2 → UNKNOWN capped at 2 while alternatives exist.
    expect(dist['UNKNOWN']).toBe(2);
  });
});

describe('compose — pool sizes & relevance order', () => {
  it('empty pool → empty section, underfilled', () => {
    const r = compose([{ key: 's', take: 5, candidates: [], diversify: true }], { diversityPolicy: homePolicy });
    expect(r.sections[0]!.picked).toEqual([]);
    expect(r.sections[0]!.diagnostics.underfilled).toBe(true);
  });

  it('pool smaller than take: returns the whole pool, underfilled', () => {
    const pool = [c('a'), c('b')];
    const r = compose([{ key: 's', take: 5, candidates: pool, diversify: true }], { diversityPolicy: homePolicy });
    expect(pickedIds(r, 's')).toEqual(['a', 'b']);
    expect(r.sections[0]!.diagnostics.underfilled).toBe(true);
  });

  it('preserves relevance order in the primary (under-cap) tier', () => {
    const pool = [c('a', 'A'), c('b', 'B'), c('c', 'C')];
    const r = compose([{ key: 's', take: 3, candidates: pool, diversify: true }], { diversityPolicy: loosePolicy });
    expect(pickedIds(r, 's')).toEqual(['a', 'b', 'c']);
  });

  it('preserves relevance order within the relaxation (overflow) tier', () => {
    // provider P over cap: p0..p2 admitted up to cap 1 → p1,p2 deferred; relaxation restores their order.
    const pool = [c('p0', 'P'), c('p1', 'P'), c('p2', 'P')];
    const r = compose([{ key: 's', take: 3, candidates: pool, diversify: true }], {
      diversityPolicy: { bucketCapFor: () => 1 },
    });
    // p0 admitted in pass 1; p1, p2 admitted via relaxation in their original order.
    expect(pickedIds(r, 's')).toEqual(['p0', 'p1', 'p2']);
  });
});

describe('compose — determinism', () => {
  it('same input → same output', () => {
    const specs: SectionSpec[] = [
      { key: 'a', take: 4, candidates: [c('1', 'P'), c('2', 'P'), c('3', 'Q'), c('4', 'R')], diversify: true },
      { key: 'b', take: 4, candidates: [c('3', 'Q'), c('5', 'P'), c('6', 'S')], diversify: true },
    ];
    const r1 = compose(specs, { diversityPolicy: homePolicy });
    const r2 = compose(specs, { diversityPolicy: homePolicy });
    expect(JSON.stringify(r1)).toEqual(JSON.stringify(r2));
  });
});

describe('compose — validation', () => {
  it('throws on duplicate section keys', () => {
    expect(() =>
      compose(
        [
          { key: 'dup', take: 1, candidates: [], diversify: false },
          { key: 'dup', take: 1, candidates: [], diversify: false },
        ],
        { diversityPolicy: homePolicy },
      ),
    ).toThrow(FeedComposerError);
  });

  it('throws on a non-positive / non-integer take', () => {
    expect(() => compose([{ key: 's', take: 0, candidates: [], diversify: false }], { diversityPolicy: homePolicy })).toThrow(
      FeedComposerError,
    );
    expect(() => compose([{ key: 's', take: 2.5, candidates: [], diversify: false }], { diversityPolicy: homePolicy })).toThrow(
      FeedComposerError,
    );
  });

  it('throws when the policy returns a cap < 1 or a non-integer (diversify sections only)', () => {
    expect(() =>
      compose([{ key: 's', take: 12, candidates: [c('a')], diversify: true }], { diversityPolicy: { bucketCapFor: () => 0 } }),
    ).toThrow(FeedComposerError);
    expect(() =>
      compose([{ key: 's', take: 12, candidates: [c('a')], diversify: true }], { diversityPolicy: { bucketCapFor: () => 1.5 } }),
    ).toThrow(FeedComposerError);
  });

  it('does not consult the policy for curated (diversify=false) sections', () => {
    // A throwing policy must be irrelevant when no section diversifies.
    const throwingPolicy: DiversityPolicy = {
      bucketCapFor: () => {
        throw new Error('should not be called');
      },
    };
    expect(() =>
      compose([{ key: 's', take: 2, candidates: [c('a'), c('b')], diversify: false }], { diversityPolicy: throwingPolicy }),
    ).not.toThrow();
  });
});

describe('compose — reusable primitive (second synthetic builder)', () => {
  it('composes unrelated sections/keys with no Home specifics', () => {
    // A totally different "builder" shape: two arbitrary sections, arbitrary policy.
    const r = compose(
      [
        { key: 'landing-hero', take: 2, candidates: [c('x', 'v1'), c('y', 'v1'), c('z', 'v2')], diversify: true },
        { key: 'landing-more', take: 3, candidates: [c('x', 'v1'), c('w', 'v3'), c('y', 'v1')], diversify: false },
      ],
      { diversityPolicy: { bucketCapFor: (take) => Math.max(1, take - 1) } },
    );
    // cap = max(1, 2-1) = 1 → hero takes x (v1), then diversifies to z (v2), holding y back.
    expect(pickedIds(r, 'landing-hero')).toEqual(['x', 'z']);
    expect(pickedIds(r, 'landing-more')).toEqual(['w', 'y']); // x,z already used
  });

  it('module isolation guards against a bucketCapFor(1) rounding to 0', () => {
    // Sanity: home-shaped policy clamps to >= 1 so take=1 diversify sections stay valid.
    const r = compose([{ key: 's', take: 1, candidates: [c('a', 'P')], diversify: true }], {
      diversityPolicy: { bucketCapFor: (take) => Math.max(1, Math.floor(take / 3)) },
    });
    expect(pickedIds(r, 's')).toEqual(['a']);
  });
});

describe('compose — module isolation', () => {
  it('composer/types/errors import nothing from Home, framework, or infra', () => {
    const forbidden = [
      /from ['"].*\/home\//,
      /from ['"]fastify['"]/,
      /from ['"]@prisma\/client['"]/,
      /from ['"].*\/collections\//,
      /from ['"].*\/cache/,
      /from ['"].*wishlist/,
      /from ['"]node:http['"]/,
    ];
    for (const file of ['composer.ts', 'types.ts', 'errors.ts', 'index.ts']) {
      const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      for (const pattern of forbidden) {
        expect(pattern.test(src), `${file} must not match ${pattern}`).toBe(false);
      }
    }
  });
});
