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
  it('extracts the description from the product __NEXT_DATA__ payload', () => {
    const raw = extractVivatProductDescription(loadFixture('product-page.html'));
    expect(raw).not.toBeNull();
    expect(raw).toContain('Жадана');
  });

  it('sanitizes the extracted description to plain text (no markup)', () => {
    const raw = extractVivatProductDescription(loadFixture('product-page.html'));
    const clean = sanitizeDescription(raw);
    expect(clean).not.toBeNull();
    expect(clean).toContain('Роман Сергія Жадана про війну на сході України.');
    expect(clean).not.toContain('<');
  });

  it('returns null when the product payload has no description field', () => {
    expect(extractVivatProductDescription(loadFixture('product-no-description.html'))).toBeNull();
  });

  it('returns null when __NEXT_DATA__ is missing or unparseable', () => {
    expect(extractVivatProductDescription('<html><body>no next data</body></html>')).toBeNull();
    expect(extractVivatProductDescription('')).toBeNull();
  });
});
