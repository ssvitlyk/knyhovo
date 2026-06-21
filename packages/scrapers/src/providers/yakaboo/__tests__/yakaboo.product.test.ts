import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { extractYakabooProductDescription } from '../yakaboo.parser.js';
import { sanitizeDescription } from '../../../lib/sanitize-description.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

describe('extractYakabooProductDescription', () => {
  it('extracts the description container HTML from a product page', () => {
    const raw = extractYakabooProductDescription(loadFixture('product-page.html'));
    expect(raw).not.toBeNull();
    expect(raw).toContain('Кобзар');
  });

  it('sanitizes the extracted description to plain text (no markup, no script)', () => {
    const raw = extractYakabooProductDescription(loadFixture('product-page.html'));
    const clean = sanitizeDescription(raw);
    expect(clean).not.toBeNull();
    expect(clean).toContain('«Кобзар» — збірка поетичних творів Тараса Шевченка.');
    expect(clean).toContain('безсмертні');
    expect(clean).not.toContain('<');
    expect(clean).not.toContain('tracking pixel');
  });

  it('returns null when the product page has no description container', () => {
    expect(extractYakabooProductDescription(loadFixture('product-no-description.html'))).toBeNull();
  });

  it('returns null for empty HTML', () => {
    expect(extractYakabooProductDescription('')).toBeNull();
  });
});
