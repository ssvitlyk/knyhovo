import { describe, it, expect } from 'vitest';
import {
  parseScraperOptionsFromEnv,
  getScrapeStateRetentionDays,
  getLastmodPrecisionMin,
} from '../scrape-env.js';

describe('parseScraperOptionsFromEnv', () => {
  it('returns undefined when SCRAPE_ENRICH_DESCRIPTIONS is absent', () => {
    expect(parseScraperOptionsFromEnv({})).toBeUndefined();
  });

  it('returns undefined when SCRAPE_ENRICH_DESCRIPTIONS is an unrecognised value', () => {
    expect(parseScraperOptionsFromEnv({ SCRAPE_ENRICH_DESCRIPTIONS: 'yes' })).toBeUndefined();
  });

  it("enables enrichment when SCRAPE_ENRICH_DESCRIPTIONS is 'true'", () => {
    expect(parseScraperOptionsFromEnv({ SCRAPE_ENRICH_DESCRIPTIONS: 'true' })).toEqual({
      enrichDescriptions: true,
    });
  });

  it("enables enrichment when SCRAPE_ENRICH_DESCRIPTIONS is '1'", () => {
    expect(parseScraperOptionsFromEnv({ SCRAPE_ENRICH_DESCRIPTIONS: '1' })).toEqual({
      enrichDescriptions: true,
    });
  });

  it('adds descriptionDelayMs when set alongside the enrich flag', () => {
    expect(
      parseScraperOptionsFromEnv({
        SCRAPE_ENRICH_DESCRIPTIONS: 'true',
        SCRAPE_DESCRIPTION_DELAY_MS: '2500',
      }),
    ).toEqual({ enrichDescriptions: true, descriptionDelayMs: 2500 });
  });

  it('omits descriptionDelayMs when it is not a positive integer', () => {
    expect(
      parseScraperOptionsFromEnv({
        SCRAPE_ENRICH_DESCRIPTIONS: 'true',
        SCRAPE_DESCRIPTION_DELAY_MS: '0',
      }),
    ).toEqual({ enrichDescriptions: true });

    expect(
      parseScraperOptionsFromEnv({
        SCRAPE_ENRICH_DESCRIPTIONS: 'true',
        SCRAPE_DESCRIPTION_DELAY_MS: '-5',
      }),
    ).toEqual({ enrichDescriptions: true });

    expect(
      parseScraperOptionsFromEnv({
        SCRAPE_ENRICH_DESCRIPTIONS: 'true',
        SCRAPE_DESCRIPTION_DELAY_MS: 'not-a-number',
      }),
    ).toEqual({ enrichDescriptions: true });
  });

  it('returns undefined when only the delay is set and enrichment is off', () => {
    expect(parseScraperOptionsFromEnv({ SCRAPE_DESCRIPTION_DELAY_MS: '2500' })).toBeUndefined();
  });
});

describe('getScrapeStateRetentionDays', () => {
  it('returns the default (90) when absent', () => {
    expect(getScrapeStateRetentionDays({})).toBe(90);
  });

  it('returns the custom value when a positive integer string is set', () => {
    expect(getScrapeStateRetentionDays({ SCRAPE_STATE_RETENTION_DAYS: '30' })).toBe(30);
  });

  it('falls back to the default on invalid values', () => {
    expect(getScrapeStateRetentionDays({ SCRAPE_STATE_RETENTION_DAYS: '0' })).toBe(90);
    expect(getScrapeStateRetentionDays({ SCRAPE_STATE_RETENTION_DAYS: '-5' })).toBe(90);
    expect(getScrapeStateRetentionDays({ SCRAPE_STATE_RETENTION_DAYS: 'not-a-number' })).toBe(90);
    expect(getScrapeStateRetentionDays({ SCRAPE_STATE_RETENTION_DAYS: '3.5' })).toBe(90);
  });
});

describe('getLastmodPrecisionMin', () => {
  it('returns the default (0.05) when absent', () => {
    expect(getLastmodPrecisionMin({})).toBe(0.05);
  });

  it('returns the custom value when a valid float in [0,1] is set', () => {
    expect(getLastmodPrecisionMin({ SCRAPE_LASTMOD_PRECISION_MIN: '0.1' })).toBe(0.1);
    expect(getLastmodPrecisionMin({ SCRAPE_LASTMOD_PRECISION_MIN: '0' })).toBe(0);
    expect(getLastmodPrecisionMin({ SCRAPE_LASTMOD_PRECISION_MIN: '1' })).toBe(1);
  });

  it('falls back to the default on invalid values', () => {
    expect(getLastmodPrecisionMin({ SCRAPE_LASTMOD_PRECISION_MIN: 'not-a-number' })).toBe(0.05);
    expect(getLastmodPrecisionMin({ SCRAPE_LASTMOD_PRECISION_MIN: '-0.1' })).toBe(0.05);
    expect(getLastmodPrecisionMin({ SCRAPE_LASTMOD_PRECISION_MIN: '1.5' })).toBe(0.05);
  });
});
