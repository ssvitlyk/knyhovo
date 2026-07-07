import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '../env';

describe('apiBaseUrl', () => {
  const original = process.env.API_BASE_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = original;
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
});
