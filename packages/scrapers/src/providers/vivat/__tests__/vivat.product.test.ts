import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { extractVivatProductDetails } from '../vivat.parser.js';
import { sanitizeDescription } from '../../../lib/sanitize-description.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

describe('extractVivatProductDetails — description (ported from extractVivatProductDescription)', () => {
  it('extracts bookDescription from the product __NEXT_DATA__ payload', () => {
    const { description } = extractVivatProductDetails(loadFixture('product-page.html'));
    expect(description).not.toBeNull();
    expect(description).toContain('Жадана');
  });

  it('strips the boilerplate heading from bookDescription', () => {
    const { description } = extractVivatProductDetails(loadFixture('product-page.html'));
    expect(description).not.toBeNull();
    expect(description).not.toContain('Анотація книги');
    expect(description).not.toContain('<h2>');
  });

  it('sanitizes the extracted description to plain text (no markup)', () => {
    const { description } = extractVivatProductDetails(loadFixture('product-page.html'));
    const clean = sanitizeDescription(description);
    expect(clean).not.toBeNull();
    expect(clean).toContain('Роман Сергія Жадана про війну на сході України.');
    expect(clean).not.toContain('<');
  });

  it('falls back to shortDescription when bookDescription is missing/empty', () => {
    const { description } = extractVivatProductDetails(loadFixture('product-short-description-fallback.html'));
    expect(description).toBe('Коротка анотація книги.');
  });

  it('falls back to shortDescription when bookDescription is only a heading', () => {
    const { description } = extractVivatProductDetails(loadFixture('product-heading-only-description.html'));
    expect(description).toBe('Резервний короткий опис.');
  });

  it('returns null description when both bookDescription and shortDescription are missing/empty', () => {
    expect(extractVivatProductDetails(loadFixture('product-no-description.html')).description).toBeNull();
  });

  it('returns null description and metadata when __NEXT_DATA__ is missing or unparseable', () => {
    expect(extractVivatProductDetails('<html><body>no next data</body></html>')).toEqual({
      description: null,
      metadata: null,
    });
    expect(extractVivatProductDetails('')).toEqual({ description: null, metadata: null });
  });
});

describe('extractVivatProductDetails — metadata (book-metadata PRD)', () => {
  it('extracts all six mapped fields from allCharacteristics', () => {
    const { metadata } = extractVivatProductDetails(loadFixture('product-page.html'));
    expect(metadata).toEqual({
      publisher: 'Vivat',
      language: 'Українська',
      format: 'Тверда',
      series: 'Навіки Токіо',
      publicationYear: 2023,
      isbn: '9789669829283',
    });
  });

  it('ignores unmapped characteristic codes (author, pages_num, translator, id_erp, product_type)', () => {
    const { metadata } = extractVivatProductDetails(loadFixture('product-page.html'));
    expect(metadata).not.toBeNull();
    expect(Object.keys(metadata!)).toEqual([
      'publisher',
      'language',
      'format',
      'series',
      'publicationYear',
      'isbn',
    ]);
  });

  it('returns null metadata when allCharacteristics is absent', () => {
    const { metadata } = extractVivatProductDetails(loadFixture('product-no-metadata.html'));
    expect(metadata).toBeNull();
  });

  it('gracefully nulls out individual fields: empty value array, whitespace-only text, non-numeric year, invalid isbn', () => {
    const { metadata } = extractVivatProductDetails(loadFixture('product-metadata-edge-cases.html'));
    expect(metadata).toEqual({
      publisher: null,
      language: null,
      format: 'Тверда',
      series: null,
      publicationYear: null,
      isbn: null,
    });
  });

  it('never throws on missing/unparseable __NEXT_DATA__', () => {
    expect(() => extractVivatProductDetails('not json at all')).not.toThrow();
    expect(() => extractVivatProductDetails('')).not.toThrow();
  });
});
