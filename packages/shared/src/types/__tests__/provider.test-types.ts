/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Compile-time checks for ProviderName, Availability, ScraperOptions,
 * RawProviderListing, ProviderListing, ScraperProvider, ScraperResult.
 */
import type {
  ProviderName,
  Availability,
  ScraperOptions,
  RawProviderListing,
  ProviderListing,
  ScraperProvider,
  ScraperResult,
} from '../provider.js';
import type { CanonicalBookId, ProviderListingId } from '../ids.js';

// Valid provider names
const _yakaboo: ProviderName = 'yakaboo';
const _bookClub: ProviderName = 'book-club';

// Unknown provider must fail
// @ts-expect-error 'rozetka' is not a known ProviderName
const _rozetka: ProviderName = 'rozetka';
// @ts-expect-error plain string is not assignable to ProviderName
const _plain: ProviderName = 'some-provider';

// Availability accepts only the three defined values
const _inStock: Availability = 'in-stock';
const _outOfStock: Availability = 'out-of-stock';
const _unknown: Availability = 'unknown';
// @ts-expect-error 'preorder' is not a valid Availability value
const _preorder: Availability = 'preorder';

// ScraperOptions — all fields optional
const _optsEmpty: ScraperOptions = {};
const _optsFull: ScraperOptions = { maxPages: 10, timeoutMs: 5000, delayMs: 200 };

// RawProviderListing — scraper output before DB / canonical matching
const _rawListing: RawProviderListing = {
  provider: 'yakaboo',
  title: 'Кобзар',
  author: 'Тарас Шевченко',
  isbn: null,
  price: { amount: 34999, currency: 'UAH' },
  url: 'https://yakaboo.ua/kobzar.html',
  availability: 'in-stock',
};

// RawProviderListing with null author and null price (out of stock)
const _rawOos: RawProviderListing = {
  provider: 'yakaboo',
  title: 'Дюна',
  author: null,
  isbn: null,
  price: null,
  url: 'https://yakaboo.ua/djuna.html',
  availability: 'out-of-stock',
};

// RawProviderListing rejects unknown provider
const _badRaw: RawProviderListing = {
  // @ts-expect-error 'rozetka' is not a known ProviderName
  provider: 'rozetka',
  title: 'Test',
  author: null,
  isbn: null,
  price: null,
  url: 'https://rozetka.ua/test.html',
  availability: 'unknown',
};

// ProviderListing — persisted DB entity (has id, canonicalBookId, lastSeenAt, availability)
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
  availability: 'in-stock',
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
  availability: 'in-stock',
};

// ScraperProvider shape — scrape accepts optional ScraperOptions
const _provider: ScraperProvider = {
  name: 'book-club',
  scrape: (_options?: ScraperOptions) => Promise.resolve({
    provider: 'book-club',
    listings: [],
    scrapedAt: '2026-06-09T00:00:00.000Z',
    errors: [],
  } satisfies ScraperResult),
};

// ScraperResult with populated listings uses RawProviderListing (not ProviderListing)
const _result: ScraperResult = {
  provider: 'yakaboo',
  listings: [_rawListing, _rawOos],
  scrapedAt: '2026-06-09T00:00:00.000Z',
  errors: [],
};

export {};
