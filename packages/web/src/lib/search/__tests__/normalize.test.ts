import { describe, expect, it } from 'vitest';
import { normalizeQuery } from '../normalize';

describe('normalizeQuery', () => {
  it('lowercases ASCII input', () => {
    expect(normalizeQuery('Hello World')).toBe('hello world');
  });

  it('lowercases Cyrillic input using Ukrainian locale', () => {
    expect(normalizeQuery('Гаррі Поттер')).toBe('гаррі поттер');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeQuery('  hello  ')).toBe('hello');
  });

  it('collapses internal runs of whitespace to a single space', () => {
    expect(normalizeQuery('hello   world\t!')).toBe('hello   world\t!'.replace(/\s+/g, ' ').trim().toLocaleLowerCase('uk'));
    expect(normalizeQuery('гаррі   поттер')).toBe('гаррі поттер');
  });

  it('converts right single quotation mark to straight apostrophe', () => {
    expect(normalizeQuery("м’який")).toBe("м'який");
  });

  it('converts left single quotation mark to straight apostrophe', () => {
    expect(normalizeQuery("м‘який")).toBe("м'який");
  });

  it('converts backtick to straight apostrophe', () => {
    expect(normalizeQuery('м`який')).toBe("м'який");
  });

  it('converts acute accent to straight apostrophe', () => {
    expect(normalizeQuery('м´який')).toBe("м'який");
  });

  it('converts right single quote (U+2019) to straight apostrophe', () => {
    expect(normalizeQuery("м’який")).toBe("м'який");
  });

  it('applies NFC normalization', () => {
    // Composed form and decomposed form should normalize to the same result.
    const composed = 'é'; // é as a single codepoint
    const decomposed = 'é'; // e + combining acute
    expect(normalizeQuery(composed)).toBe(normalizeQuery(decomposed));
  });

  it('handles empty string', () => {
    expect(normalizeQuery('')).toBe('');
  });

  it('coerces non-string input via String()', () => {
    // @ts-expect-error — testing runtime coercion
    expect(normalizeQuery(42)).toBe('42');
  });

  it('handles a combined case: mixed whitespace and apostrophe variants', () => {
    expect(normalizeQuery("  Гаррі   М’який  ")).toBe("гаррі м'який");
  });
});
