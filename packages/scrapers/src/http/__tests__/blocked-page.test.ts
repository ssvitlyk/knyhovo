import { describe, it, expect } from 'vitest';
import {
  isCloudflareChallenge,
  isForbiddenPage,
  isEmptyCatalogPage,
  classifyBlockedPage,
  isForbiddenError,
} from '../blocked-page.js';

const CLOUDFLARE_HTML = `<!DOCTYPE html><html><head><title>Just a moment...</title></head>
<body><div id="cf-challenge-running"></div>
<script src="/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1"></script>
<iframe src="https://challenges.cloudflare.com/turnstile/v0/abc"></iframe>
<p>Checking your browser before accessing the site.</p>
</body></html>`;

const FORBIDDEN_HTML = `<html><head><title>403 Forbidden</title></head>
<body><h1>Access Denied</h1><p>You don't have permission to access this resource.</p></body></html>`;

const REAL_CATALOG_HTML = `<html><body><ul><li class="product-item"><a class="product-item-link">Книга</a></li></ul></body></html>`;

describe('isCloudflareChallenge', () => {
  it('detects a Cloudflare challenge interstitial', () => {
    expect(isCloudflareChallenge(CLOUDFLARE_HTML)).toBe(true);
  });
  it('returns false for real catalog HTML', () => {
    expect(isCloudflareChallenge(REAL_CATALOG_HTML)).toBe(false);
  });
  it('returns false for empty input', () => {
    expect(isCloudflareChallenge('')).toBe(false);
  });
});

describe('isForbiddenPage', () => {
  it('detects a 403 / access-denied page', () => {
    expect(isForbiddenPage(FORBIDDEN_HTML)).toBe(true);
  });
  it('returns false for real catalog HTML', () => {
    expect(isForbiddenPage(REAL_CATALOG_HTML)).toBe(false);
  });
  it('returns false for empty input', () => {
    expect(isForbiddenPage('')).toBe(false);
  });
});

describe('isEmptyCatalogPage', () => {
  it('treats a whitespace-only response as empty', () => {
    expect(isEmptyCatalogPage('   \n  ')).toBe(true);
  });
  it('treats a body with no visible content as empty', () => {
    expect(isEmptyCatalogPage('<html><body><!-- nothing --></body></html>')).toBe(true);
  });
  it('returns false when the page has visible text', () => {
    expect(isEmptyCatalogPage(REAL_CATALOG_HTML)).toBe(false);
  });
});

describe('classifyBlockedPage', () => {
  it('classifies a Cloudflare challenge first', () => {
    expect(classifyBlockedPage(CLOUDFLARE_HTML)).toBe('cloudflare-challenge');
  });
  it('classifies a forbidden page', () => {
    expect(classifyBlockedPage(FORBIDDEN_HTML)).toBe('forbidden');
  });
  it('classifies a blank page as empty-catalog', () => {
    expect(classifyBlockedPage('<html><body></body></html>')).toBe('empty-catalog');
  });
  it('classifies real content as unknown (not blocked)', () => {
    expect(classifyBlockedPage(REAL_CATALOG_HTML)).toBe('unknown');
  });
});

describe('isForbiddenError', () => {
  it('detects an HTTP 403 error message', () => {
    expect(isForbiddenError(new Error('HTTP 403 Forbidden'))).toBe(true);
  });
  it('detects a "forbidden" message without a code', () => {
    expect(isForbiddenError(new Error('Request Forbidden'))).toBe(true);
  });
  it('returns false for an unrelated network error', () => {
    expect(isForbiddenError(new Error('ECONNREFUSED'))).toBe(false);
  });
  it('returns false for other HTTP codes', () => {
    expect(isForbiddenError(new Error('HTTP 500 Internal Server Error'))).toBe(false);
  });
});
