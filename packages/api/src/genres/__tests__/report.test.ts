import { describe, expect, it } from 'vitest';
import {
  AMBIGUITY_SCORE_THRESHOLD,
  AmbiguousReportAccumulator,
  UnmappedReportAccumulator,
  isAmbiguous,
} from '../report.js';
import type { GenreCandidate, GenreMappingResult, UnmappedCategory } from '../mapping-engine.js';

function unmappedEntry(overrides: Partial<UnmappedCategory> = {}): UnmappedCategory {
  return {
    provider: 'knigoland',
    rawCategory: 'Подарунки',
    normalizedKey: 'подарунки',
    exampleUrl: 'https://example.test/a',
    ...overrides,
  };
}

function candidate(slug: string, score: number, explanation = `origin of ${slug}`): GenreCandidate {
  return { genreId: `g-${slug}`, slug, score, providers: ['bookchef'], explanation };
}

function resultWith(candidates: readonly GenreCandidate[]): GenreMappingResult {
  const winner = candidates[0] ?? null;
  return {
    genreId: winner?.genreId ?? null,
    confidence: winner?.score ?? null,
    explanation: winner?.explanation ?? null,
    candidates,
    unmapped: [],
  };
}

describe('UnmappedReportAccumulator', () => {
  it('aggregates listing counts per (provider, normalizedKey)', () => {
    const acc = new UnmappedReportAccumulator();
    acc.add([unmappedEntry()]);
    acc.add([unmappedEntry({ exampleUrl: 'https://example.test/b' })]);
    acc.add([unmappedEntry({ provider: 'bookchef' })]);

    const rows = acc.rows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      provider: 'knigoland',
      rawCategory: 'Подарунки',
      normalizedKey: 'подарунки',
      listingCount: 2,
      exampleUrl: 'https://example.test/a',
    });
    expect(rows[1]!.provider).toBe('bookchef');
    expect(rows[1]!.listingCount).toBe(1);
  });

  it('sorts by count desc, then provider, then key', () => {
    const acc = new UnmappedReportAccumulator();
    acc.add([unmappedEntry({ provider: 'knigoland', normalizedKey: 'б', rawCategory: 'б' })]);
    acc.add([unmappedEntry({ provider: 'knigoland', normalizedKey: 'а', rawCategory: 'а' })]);
    acc.add([unmappedEntry({ provider: 'bookchef', normalizedKey: 'в', rawCategory: 'в' })]);
    acc.add([unmappedEntry({ provider: 'bookchef', normalizedKey: 'в', rawCategory: 'в' })]);

    expect(acc.rows().map((r) => [r.provider, r.normalizedKey, r.listingCount])).toEqual([
      ['bookchef', 'в', 2],
      ['knigoland', 'а', 1],
      ['knigoland', 'б', 1],
    ]);
  });

  it('keeps the first raw text and backfills a missing exampleUrl', () => {
    const acc = new UnmappedReportAccumulator();
    acc.add([unmappedEntry({ rawCategory: 'ПОДАРУНКИ ', exampleUrl: null })]);
    acc.add([unmappedEntry({ rawCategory: 'Подарунки' })]);

    const [row] = acc.rows();
    expect(row!.rawCategory).toBe('ПОДАРУНКИ ');
    expect(row!.exampleUrl).toBe('https://example.test/a');
  });

  it('formats an aligned stdout table with a header', () => {
    const acc = new UnmappedReportAccumulator();
    acc.add([unmappedEntry()]);
    const text = acc.format();
    const lines = text.split('\n');

    expect(lines[0]).toMatch(/provider\s+\| rawCategory\s+\| normalizedKey/);
    expect(lines[2]).toContain('knigoland');
    expect(lines[2]).toContain('подарунки');
    expect(lines[2]).toContain('https://example.test/a');
  });

  it('formats an explicit empty state', () => {
    expect(new UnmappedReportAccumulator().format()).toBe('unmapped categories: none');
  });
});

describe('isAmbiguous', () => {
  it('is false with fewer than two candidates', () => {
    expect(isAmbiguous(resultWith([]))).toBe(false);
    expect(isAmbiguous(resultWith([candidate('fentezi', 95)]))).toBe(false);
  });

  it(`is true when the top-two distance is ≤ ${AMBIGUITY_SCORE_THRESHOLD}`, () => {
    expect(isAmbiguous(resultWith([candidate('fentezi', 91), candidate('fantastyka', 90)]))).toBe(
      true,
    );
    expect(isAmbiguous(resultWith([candidate('fentezi', 95), candidate('fantastyka', 90)]))).toBe(
      true,
    );
  });

  it('is true on an exact tie (tie-break fired)', () => {
    expect(isAmbiguous(resultWith([candidate('fentezi', 90), candidate('fantastyka', 90)]))).toBe(
      true,
    );
  });

  it('is false when the winner is clear', () => {
    expect(isAmbiguous(resultWith([candidate('fentezi', 96), candidate('fantastyka', 90)]))).toBe(
      false,
    );
  });

  it('honours a custom threshold', () => {
    const result = resultWith([candidate('fentezi', 96), candidate('fantastyka', 90)]);
    expect(isAmbiguous(result, 10)).toBe(true);
    expect(isAmbiguous(result, 0)).toBe(false);
  });
});

describe('AmbiguousReportAccumulator', () => {
  const dune = { title: 'Дюна', isbn: '9786177682102' };
  const ambiguousResult = resultWith([
    candidate('fentezi', 91, 'BookChef breadcrumb "Художня література → Фентезі"'),
    candidate('fantastyka', 90, 'KSD category "Фантастика"'),
  ]);

  it('records only ambiguous books', () => {
    const acc = new AmbiguousReportAccumulator();
    expect(acc.add(dune, ambiguousResult)).toBe(true);
    expect(
      acc.add(
        { title: 'Clear', isbn: null },
        resultWith([candidate('fentezi', 100), candidate('fantastyka', 50)]),
      ),
    ).toBe(false);

    expect(acc.entries()).toHaveLength(1);
    expect(acc.entries()[0]!.book).toEqual(dune);
  });

  it('formats entries in the PRD §8.4 shape', () => {
    const acc = new AmbiguousReportAccumulator();
    acc.add(dune, ambiguousResult);
    const text = acc.format();

    expect(text).toContain('«Дюна» (isbn 9786177682102)');
    expect(text).toMatch(/fentezi\s+91\s+BookChef breadcrumb "Художня література → Фентезі"/);
    expect(text).toMatch(/fantastyka\s+90\s+KSD category "Фантастика"/);
  });

  it('labels books without an isbn', () => {
    const acc = new AmbiguousReportAccumulator();
    acc.add({ title: 'Безномерна', isbn: null }, ambiguousResult);
    expect(acc.format()).toContain('«Безномерна» (no isbn)');
  });

  it('formats an explicit empty state', () => {
    expect(new AmbiguousReportAccumulator().format()).toBe('ambiguous books: none');
  });
});
