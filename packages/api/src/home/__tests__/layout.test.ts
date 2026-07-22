import { describe, it, expect } from 'vitest';
import {
  HOME_LAYOUT,
  HomeLayoutError,
  validateHomeLayout,
  candidateLimitFor,
  homeDiversityPolicy,
  layoutFingerprint,
} from '../layout.js';
import type { HomeLayout } from '../layout.js';

/** A structurally valid layout, cloned + mutated per test. */
function baseLayout(): HomeLayout {
  return {
    take: 12,
    providerShareLimit: 1 / 3,
    sections: [
      { key: 'knyhovyk', slug: 'knyhovyk-radyt', take: 12, candidateMultiplier: 3, diversify: false },
      { key: 'novynky', slug: 'novynky', take: 12, candidateMultiplier: 5, diversify: true },
      { key: 'popular', slug: 'populyarne-zaraz', take: 12, candidateMultiplier: 10, diversify: true },
    ],
    displayOrder: ['popular', 'novynky', 'knyhovyk'],
  };
}

describe('validateHomeLayout', () => {
  it('accepts the shipped HOME_LAYOUT (module load did not throw)', () => {
    expect(() => validateHomeLayout(HOME_LAYOUT)).not.toThrow();
  });

  it('throws on a duplicate section key', () => {
    const layout = baseLayout();
    const sections = [...layout.sections];
    sections[1] = { ...sections[1]!, key: 'popular' }; // dup 'popular'
    expect(() => validateHomeLayout({ ...layout, sections })).toThrow(HomeLayoutError);
  });

  it('throws on a non-positive / non-integer take', () => {
    const layout = baseLayout();
    const sections = [...layout.sections];
    sections[0] = { ...sections[0]!, take: 0 };
    expect(() => validateHomeLayout({ ...layout, sections })).toThrow(HomeLayoutError);
  });

  it('throws on an invalid candidateMultiplier', () => {
    const layout = baseLayout();
    const sections = [...layout.sections];
    sections[0] = { ...sections[0]!, candidateMultiplier: 0 };
    expect(() => validateHomeLayout({ ...layout, sections })).toThrow(HomeLayoutError);
  });

  it('throws when displayOrder references an unknown key', () => {
    const layout = baseLayout();
    expect(() =>
      validateHomeLayout({ ...layout, displayOrder: ['popular', 'novynky', 'nope' as never] }),
    ).toThrow(HomeLayoutError);
  });

  it('throws when a section key is missing from displayOrder', () => {
    const layout = baseLayout();
    expect(() => validateHomeLayout({ ...layout, displayOrder: ['popular', 'novynky'] })).toThrow(HomeLayoutError);
  });

  it('throws when displayOrder lists a key more than once', () => {
    const layout = baseLayout();
    expect(() =>
      validateHomeLayout({ ...layout, displayOrder: ['popular', 'popular', 'novynky', 'knyhovyk'] as never }),
    ).toThrow(HomeLayoutError);
  });
});

describe('candidateLimitFor', () => {
  it('is take × candidateMultiplier (36/60/120)', () => {
    const bySlug = new Map(HOME_LAYOUT.sections.map((s) => [s.slug, s]));
    expect(candidateLimitFor(bySlug.get('knyhovyk-radyt')!)).toBe(36);
    expect(candidateLimitFor(bySlug.get('novynky')!)).toBe(60);
    expect(candidateLimitFor(bySlug.get('populyarne-zaraz')!)).toBe(120);
  });
});

describe('homeDiversityPolicy', () => {
  it('bucketCapFor(12) = floor(12 × 1/3) = 4', () => {
    expect(homeDiversityPolicy(1 / 3).bucketCapFor(12)).toBe(4);
  });

  it('clamps to >= 1 for small take', () => {
    expect(homeDiversityPolicy(1 / 3).bucketCapFor(1)).toBe(1);
  });
});

describe('layoutFingerprint', () => {
  it('changes when a composition-affecting field changes', () => {
    const base = layoutFingerprint(baseLayout());
    const layout = baseLayout();
    const sections = [...layout.sections];
    sections[2] = { ...sections[2]!, candidateMultiplier: 8 };
    expect(layoutFingerprint({ ...layout, sections })).not.toBe(base);
  });

  it('is stable for the same layout', () => {
    expect(layoutFingerprint(baseLayout())).toBe(layoutFingerprint(baseLayout()));
  });
});
