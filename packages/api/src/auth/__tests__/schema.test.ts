import { describe, it, expect } from 'vitest';
import { parseRequestCodeBody, parseVerifyCodeBody } from '../schema.js';
import { ValidationError } from '../../errors.js';

describe('parseRequestCodeBody', () => {
  it('accepts a valid email', () => {
    const result = parseRequestCodeBody({ email: 'user@example.com' });
    expect(result.email).toBe('user@example.com');
  });

  it('normalises email to lowercase and trims whitespace', () => {
    const result = parseRequestCodeBody({ email: '  User@EXAMPLE.COM  ' });
    expect(result.email).toBe('user@example.com');
  });

  it('throws ValidationError for missing email', () => {
    expect(() => parseRequestCodeBody({})).toThrow(ValidationError);
  });

  it('throws ValidationError for invalid email format', () => {
    expect(() => parseRequestCodeBody({ email: 'not-valid' })).toThrow(ValidationError);
  });

  it('throws ValidationError for empty email', () => {
    expect(() => parseRequestCodeBody({ email: '' })).toThrow(ValidationError);
  });
});

describe('parseVerifyCodeBody', () => {
  it('accepts valid email + 6-digit code', () => {
    const result = parseVerifyCodeBody({ email: 'u@e.com', code: '042789' });
    expect(result.email).toBe('u@e.com');
    expect(result.code).toBe('042789');
  });

  it('throws ValidationError for non-6-digit code (too short)', () => {
    expect(() => parseVerifyCodeBody({ email: 'u@e.com', code: '123' })).toThrow(ValidationError);
  });

  it('throws ValidationError for non-6-digit code (too long)', () => {
    expect(() => parseVerifyCodeBody({ email: 'u@e.com', code: '1234567' })).toThrow(ValidationError);
  });

  it('throws ValidationError for non-numeric code', () => {
    expect(() => parseVerifyCodeBody({ email: 'u@e.com', code: 'abcdef' })).toThrow(ValidationError);
  });

  it('throws ValidationError for missing code', () => {
    expect(() => parseVerifyCodeBody({ email: 'u@e.com' })).toThrow(ValidationError);
  });

  it('throws ValidationError for invalid email', () => {
    expect(() => parseVerifyCodeBody({ email: 'bad', code: '123456' })).toThrow(ValidationError);
  });
});
