import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the genres-taxonomy PRD §6.1 requirement that `prisma/seed.ts`
 * imports the genre list from `genres/taxonomy.ts` instead of hardcoding its
 * own copy — demo and production data can never diverge on genre content.
 * A source-text assertion is enough here; we don't need to execute seed.ts.
 */
describe('prisma/seed.ts genre source', () => {
  const seedPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../prisma/seed.ts');
  const source = readFileSync(seedPath, 'utf-8');

  it('imports CANONICAL_GENRES from genres/taxonomy', () => {
    expect(source).toMatch(/import\s*\{\s*CANONICAL_GENRES\s*\}\s*from\s*['"].*genres\/taxonomy(\.js)?['"]/);
  });

  it('does not define its own hardcoded genre list literal', () => {
    // The old inline array declared `const GENRES: GenreSeed[] = [` followed by
    // 17 literal genre objects. Only the re-export `const GENRES = CANONICAL_GENRES;`
    // (or equivalent identifier reference) should remain.
    expect(source).not.toMatch(/const\s+GENRES\s*:\s*GenreSeed\[\]\s*=\s*\[/);
    expect(source).not.toContain("slug: 'fantastyka', name: 'Фантастика'");
  });
});
