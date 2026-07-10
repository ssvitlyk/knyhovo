import { describe, it, expect } from 'vitest';
import { sanitizeMetadataValue, parsePublicationYear, METADATA_MAX_CHARS } from '../sanitize-metadata.js';

describe('sanitizeMetadataValue', () => {
  it('returns a trimmed plain-text value unchanged', () => {
    expect(sanitizeMetadataValue('Vivat')).toBe('Vivat');
  });

  it('strips HTML tags', () => {
    expect(sanitizeMetadataValue('<b>Vivat</b>')).toBe('Vivat');
  });

  it('collapses internal whitespace', () => {
    expect(sanitizeMetadataValue('Vivat   \n  Publishing')).toBe('Vivat Publishing');
  });

  it('returns null for empty/whitespace-only input', () => {
    expect(sanitizeMetadataValue('   ')).toBeNull();
    expect(sanitizeMetadataValue('')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(sanitizeMetadataValue(null)).toBeNull();
    expect(sanitizeMetadataValue(undefined)).toBeNull();
    expect(sanitizeMetadataValue(2023)).toBeNull();
    expect(sanitizeMetadataValue(['Vivat'])).toBeNull();
  });

  it('truncates to the max length with no ellipsis', () => {
    const long = 'a'.repeat(METADATA_MAX_CHARS + 50);
    const result = sanitizeMetadataValue(long);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(METADATA_MAX_CHARS);
  });

  it('respects a custom maxLen', () => {
    expect(sanitizeMetadataValue('Українська', 5)).toBe('Украї');
  });
});

describe('parsePublicationYear', () => {
  it('accepts a 4-digit numeric string', () => {
    expect(parsePublicationYear('2023')).toBe(2023);
  });

  it('accepts a plain number', () => {
    expect(parsePublicationYear(2023)).toBe(2023);
  });

  it('rejects out-of-range years', () => {
    expect(parsePublicationYear('1300')).toBeNull();
    expect(parsePublicationYear('2200')).toBeNull();
    expect(parsePublicationYear(999)).toBeNull();
  });

  it('rejects malformed strings', () => {
    expect(parsePublicationYear('202x')).toBeNull();
    expect(parsePublicationYear('20233')).toBeNull();
    expect(parsePublicationYear('abcd')).toBeNull();
    expect(parsePublicationYear('')).toBeNull();
  });

  it('rejects non-integer numbers', () => {
    expect(parsePublicationYear(2023.5)).toBeNull();
  });

  it('rejects other types', () => {
    expect(parsePublicationYear(null)).toBeNull();
    expect(parsePublicationYear(undefined)).toBeNull();
    expect(parsePublicationYear(['2023'])).toBeNull();
  });
});
