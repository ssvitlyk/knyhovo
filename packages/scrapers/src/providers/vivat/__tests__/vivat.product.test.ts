import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { extractVivatProductDescription } from '../vivat.parser.js';
import { sanitizeDescription } from '../../../lib/sanitize-description.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

describe('extractVivatProductDescription', () => {
  it('extracts bookDescription from the product __NEXT_DATA__ payload', () => {
    const raw = extractVivatProductDescription(loadFixture('product-page.html'));
    expect(raw).not.toBeNull();
    expect(raw).toContain('Жадана');
  });

  it('strips the boilerplate heading from bookDescription', () => {
    const raw = extractVivatProductDescription(loadFixture('product-page.html'));
    expect(raw).not.toBeNull();
    expect(raw).not.toContain('Анотація книги');
    expect(raw).not.toContain('<h2>');
  });

  it('sanitizes the extracted description to plain text (no markup)', () => {
    const raw = extractVivatProductDescription(loadFixture('product-page.html'));
    const clean = sanitizeDescription(raw);
    expect(clean).not.toBeNull();
    expect(clean).toContain('Роман Сергія Жадана про війну на сході України.');
    expect(clean).not.toContain('<');
  });

  it('falls back to shortDescription when bookDescription is missing/empty', () => {
    const raw = extractVivatProductDescription(loadFixture('product-short-description-fallback.html'));
    expect(raw).toBe('Коротка анотація книги.');
  });

  it('falls back to shortDescription when bookDescription is only a heading', () => {
    const raw = extractVivatProductDescription(loadFixture('product-heading-only-description.html'));
    expect(raw).toBe('Резервний короткий опис.');
  });

  it('returns null when both bookDescription and shortDescription are missing/empty', () => {
    expect(extractVivatProductDescription(loadFixture('product-no-description.html'))).toBeNull();
  });

  it('returns null when __NEXT_DATA__ is missing or unparseable', () => {
    expect(extractVivatProductDescription('<html><body>no next data</body></html>')).toBeNull();
    expect(extractVivatProductDescription('')).toBeNull();
  });
});
