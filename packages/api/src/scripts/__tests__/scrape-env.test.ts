import { describe, it, expect } from 'vitest';
import { parseScraperOptionsFromEnv } from '../scrape-env.js';

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
