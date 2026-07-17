import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '../env';

describe('apiBaseUrl', () => {
  const original = process.env.API_BASE_URL;
  const originalVercel = process.env.VERCEL;

  afterEach(() => {
    if (original === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = original;
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
    vi.restoreAllMocks();
  });

  it('returns the trimmed value when set', () => {
    process.env.API_BASE_URL = ' https://api-staging.example.com ';
    expect(apiBaseUrl()).toBe('https://api-staging.example.com');
  });

  it('falls back to localhost when unset', () => {
    delete process.env.API_BASE_URL;
    expect(apiBaseUrl()).toBe('http://localhost:3000');
  });

  it('falls back to localhost and logs when set to an empty string', () => {
    process.env.API_BASE_URL = '';
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(apiBaseUrl()).toBe('http://localhost:3000');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('falls back to localhost and logs when set to whitespace only', () => {
    process.env.API_BASE_URL = '   ';
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(apiBaseUrl()).toBe('http://localhost:3000');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('returns the trimmed value on Vercel when set', () => {
    process.env.VERCEL = '1';
    process.env.API_BASE_URL = 'https://api-staging-79f0.up.railway.app';
    expect(apiBaseUrl()).toBe('https://api-staging-79f0.up.railway.app');
  });

  it('throws on Vercel when unset', () => {
    process.env.VERCEL = '1';
    delete process.env.API_BASE_URL;
    expect(() => apiBaseUrl()).toThrow('API_BASE_URL is required for Vercel builds');
  });

  it('throws on Vercel when whitespace only', () => {
    process.env.VERCEL = '1';
    process.env.API_BASE_URL = '   ';
    expect(() => apiBaseUrl()).toThrow('API_BASE_URL is required for Vercel builds');
  });
});
