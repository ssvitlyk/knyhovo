/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Compile-time checks for ProviderName, ProviderListing, ScraperProvider, ScraperResult.
 */
import type { ProviderName, ProviderListing, ScraperProvider, ScraperResult } from '../provider.js';
import type { CanonicalBookId, ProviderListingId } from '../ids.js';

// Valid provider names
const _yakaboo: ProviderName = 'yakaboo';
const _bookClub: ProviderName = 'book-club';

// Unknown provider must fail
// @ts-expect-error 'rozetka' is not a known ProviderName
const _rozetka: ProviderName = 'rozetka';
// @ts-expect-error plain string is not assignable to ProviderName
const _plain: ProviderName = 'some-provider';

// ProviderListing accepts valid ProviderName
const _listing: ProviderListing = {
  id: 'pl-1' as ProviderListingId,
  canonicalBookId: 'cb-1' as CanonicalBookId,
  provider: 'yakaboo',
  title: 'Кобзар',
  author: 'Тарас Шевченко',
  isbn: null,
  price: { amount: 34999, currency: 'UAH' },
  url: 'https://yakaboo.ua/kobzar.html',
  lastSeenAt: '2026-06-09T00:00:00.000Z',
};

// ProviderListing rejects unknown provider
const _badListing: ProviderListing = {
  id: 'pl-2' as ProviderListingId,
  canonicalBookId: 'cb-1' as CanonicalBookId,
  // @ts-expect-error 'rozetka' is not a known ProviderName
  provider: 'rozetka',
  title: 'Кобзар',
  author: 'Тарас Шевченко',
  isbn: null,
  price: { amount: 34999, currency: 'UAH' },
  url: 'https://rozetka.ua/kobzar.html',
  lastSeenAt: '2026-06-09T00:00:00.000Z',
};

// ScraperProvider shape
const _provider: ScraperProvider = {
  name: 'book-club',
  scrape: () => Promise.resolve({
    provider: 'book-club',
    listings: [],
    scrapedAt: '2026-06-09T00:00:00.000Z',
    errors: [],
  } satisfies ScraperResult),
};

export {};
