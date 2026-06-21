import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { extractBookYeProductDescription } from '../book-ye.parser.js';
import { sanitizeDescription } from '../../../lib/sanitize-description.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

describe('extractBookYeProductDescription', () => {
  it('extracts the Magento description value HTML from a product page', () => {
    const raw = extractBookYeProductDescription(loadFixture('product-page.html'));
    expect(raw).not.toBeNull();
    expect(raw).toContain('Коцюбинського');
  });

  it('sanitizes the extracted description to plain text (no markup, no style)', () => {
    const raw = extractBookYeProductDescription(loadFixture('product-page.html'));
    const clean = sanitizeDescription(raw);
    expect(clean).not.toBeNull();
    expect(clean).toContain('Повість Михайла Коцюбинського про життя гуцулів.');
    expect(clean).toContain('імпресіоністична');
    expect(clean).not.toContain('<');
    expect(clean).not.toContain('display:none');
  });

  it('returns null when the product page has no description block', () => {
    expect(extractBookYeProductDescription(loadFixture('product-no-description.html'))).toBeNull();
  });

  it('returns null for empty HTML', () => {
    expect(extractBookYeProductDescription('')).toBeNull();
  });
});
