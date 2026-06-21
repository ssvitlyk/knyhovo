import { describe, it, expect } from 'vitest';
import { sanitizeDescription, DESCRIPTION_MAX_CHARS } from '../sanitize-description.js';

describe('sanitizeDescription', () => {
  it('strips HTML tags and returns plain text', () => {
    const result = sanitizeDescription('<p>Чудова <strong>книга</strong> про все.</p>');
    expect(result).toBe('Чудова книга про все.');
  });

  it('strips script content entirely (XSS boundary)', () => {
    const result = sanitizeDescription('<p>Опис</p><script>alert("xss")</script>');
    expect(result).toBe('Опис');
    expect(result).not.toContain('alert');
    expect(result).not.toContain('<');
  });

  it('collapses whitespace and newlines to single spaces', () => {
    const result = sanitizeDescription('<div>Рядок один\n\n   Рядок два\t\tкінець</div>');
    expect(result).toBe('Рядок один Рядок два кінець');
  });

  it('handles plain text input without markup', () => {
    expect(sanitizeDescription('Просто текст')).toBe('Просто текст');
  });

  it('returns null for null input', () => {
    expect(sanitizeDescription(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(sanitizeDescription(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(sanitizeDescription('')).toBeNull();
  });

  it('returns null for whitespace-only / tag-only input', () => {
    expect(sanitizeDescription('   ')).toBeNull();
    expect(sanitizeDescription('<div>  </div><br/>')).toBeNull();
  });

  it('truncates over-long text on a word boundary with an ellipsis', () => {
    const word = 'слово ';
    const long = word.repeat(2000); // ~12000 chars, well over the cap
    const result = sanitizeDescription(long);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    expect(result!.endsWith('…')).toBe(true);
    // Word boundary: the char before the ellipsis is part of a whole word, not a mid-word cut.
    expect(result!.slice(-2, -1)).not.toBe(' ');
  });

  it('does not append an ellipsis when within the limit', () => {
    const result = sanitizeDescription('Короткий опис.');
    expect(result).toBe('Короткий опис.');
    expect(result!.endsWith('…')).toBe(false);
  });

  it('is deterministic — same input yields same output', () => {
    const html = '<p>Той самий <em>опис</em></p>';
    expect(sanitizeDescription(html)).toBe(sanitizeDescription(html));
  });
});
