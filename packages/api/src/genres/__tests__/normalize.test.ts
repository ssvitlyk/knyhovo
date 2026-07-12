import { describe, expect, it } from 'vitest';
import { normalizeCategoryKey, leafFirst } from '../normalize.js';

describe('normalizeCategoryKey', () => {
  it('lowercases and trims', () => {
    expect(normalizeCategoryKey('  Фентезі  ')).toBe('фентезі');
    expect(normalizeCategoryKey('Business Books')).toBe('business books');
  });

  it('collapses internal whitespace (spaces, tabs, newlines)', () => {
    expect(normalizeCategoryKey('Художня   Література')).toBe('художня література');
    expect(normalizeCategoryKey('Художня\t\nЛітература')).toBe('художня література');
  });

  it('applies Unicode NFC so composed and decomposed forms match', () => {
    const composed = 'Йога'; // 'Й' = U+0419 (composed)
    const decomposed = composed.normalize('NFD'); // 'И' + U+0306 combining breve
    expect(decomposed).not.toBe(composed);
    expect(normalizeCategoryKey(decomposed)).toBe(normalizeCategoryKey(composed));
    expect(normalizeCategoryKey(decomposed)).toBe('йога');
  });

  it('strips a trailing item counter', () => {
    expect(normalizeCategoryKey('Фентезі (123)')).toBe('фентезі');
    expect(normalizeCategoryKey('Фентезі(7)')).toBe('фентезі');
  });

  it('does not strip a parenthesized non-counter suffix', () => {
    expect(normalizeCategoryKey('Книги (укр)')).toBe('книги (укр)');
  });

  it('strips only the trailing counter, not one in the middle', () => {
    expect(normalizeCategoryKey('Топ (10) книг')).toBe('топ (10) книг');
  });

  it('strips framing slashes', () => {
    expect(normalizeCategoryKey('/фентезі/')).toBe('фентезі');
    expect(normalizeCategoryKey('//фентезі')).toBe('фентезі');
    expect(normalizeCategoryKey('/ Фентезі /')).toBe('фентезі');
  });

  it('handles the full pipeline combined (counter stripped before slashes, §5.3 order)', () => {
    expect(normalizeCategoryKey('  /Художня   Література/ (42)  ')).toBe('художня література');
  });

  it('is idempotent', () => {
    for (const raw of ['  Фентезі (123)  ', '/Художня  Література/', 'BUSINESS']) {
      const once = normalizeCategoryKey(raw);
      expect(normalizeCategoryKey(once)).toBe(once);
    }
  });

  it('returns empty string for whitespace-only and slash-only input', () => {
    expect(normalizeCategoryKey('   ')).toBe('');
    expect(normalizeCategoryKey('//')).toBe('');
  });
});

describe('leafFirst', () => {
  it('iterates a root→leaf path leaf-first', () => {
    expect(leafFirst(['Книги', 'Художня література', 'Фентезі'])).toEqual([
      'Фентезі',
      'Художня література',
      'Книги',
    ]);
  });

  it('does not mutate the input', () => {
    const path = ['a', 'b', 'c'];
    leafFirst(path);
    expect(path).toEqual(['a', 'b', 'c']);
  });

  it('handles empty and single-element paths', () => {
    expect(leafFirst([])).toEqual([]);
    expect(leafFirst(['x'])).toEqual(['x']);
  });
});
