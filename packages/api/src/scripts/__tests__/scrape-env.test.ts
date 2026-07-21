import { describe, it, expect } from 'vitest';
import {
  parseScraperOptionsFromEnv,
  getScrapeStateRetentionDays,
  getLastmodPrecisionMin,
  getHeartbeatIntervalSeconds,
  getHeartbeatTimeoutMinutes,
  getLegacyStaleTimeoutHours,
  getEnrichBatchSize,
  getEnrichDelayMs,
  getEnrichCircuitBreakerThreshold,
  getEnrichMaxNoProgressRestarts,
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

  it('returns undefined when SCRAPE_DEBUG_FETCH_STAGES is absent', () => {
    expect(parseScraperOptionsFromEnv({})).toBeUndefined();
  });

  it("enables debugFetchStages when SCRAPE_DEBUG_FETCH_STAGES is 'true'", () => {
    expect(parseScraperOptionsFromEnv({ SCRAPE_DEBUG_FETCH_STAGES: 'true' })).toEqual({
      debugFetchStages: true,
    });
  });

  it("enables debugFetchStages when SCRAPE_DEBUG_FETCH_STAGES is '1'", () => {
    expect(parseScraperOptionsFromEnv({ SCRAPE_DEBUG_FETCH_STAGES: '1' })).toEqual({
      debugFetchStages: true,
    });
  });

  it('returns undefined when SCRAPE_DEBUG_FETCH_STAGES is an unrecognised value', () => {
    expect(parseScraperOptionsFromEnv({ SCRAPE_DEBUG_FETCH_STAGES: 'yes' })).toBeUndefined();
  });

  it('composes debugFetchStages with enrichDescriptions and descriptionDelayMs', () => {
    expect(
      parseScraperOptionsFromEnv({
        SCRAPE_ENRICH_DESCRIPTIONS: 'true',
        SCRAPE_DESCRIPTION_DELAY_MS: '2500',
        SCRAPE_DEBUG_FETCH_STAGES: '1',
      }),
    ).toEqual({ enrichDescriptions: true, descriptionDelayMs: 2500, debugFetchStages: true });
  });

  it('composes debugFetchStages alone when enrichment is off', () => {
    expect(
      parseScraperOptionsFromEnv({
        SCRAPE_DEBUG_FETCH_STAGES: 'true',
        SCRAPE_DESCRIPTION_DELAY_MS: '2500',
      }),
    ).toEqual({ debugFetchStages: true });
  });

  it('sets sitemapTimeoutMs alone when a valid positive integer is set', () => {
    expect(parseScraperOptionsFromEnv({ SCRAPE_SITEMAP_TIMEOUT_MS: '60000' })).toEqual({
      sitemapTimeoutMs: 60000,
    });
  });

  it('ignores invalid SCRAPE_SITEMAP_TIMEOUT_MS values', () => {
    expect(parseScraperOptionsFromEnv({ SCRAPE_SITEMAP_TIMEOUT_MS: '0' })).toBeUndefined();
    expect(parseScraperOptionsFromEnv({ SCRAPE_SITEMAP_TIMEOUT_MS: '-5' })).toBeUndefined();
    expect(parseScraperOptionsFromEnv({ SCRAPE_SITEMAP_TIMEOUT_MS: 'abc' })).toBeUndefined();
    expect(parseScraperOptionsFromEnv({ SCRAPE_SITEMAP_TIMEOUT_MS: '1.5' })).toBeUndefined();
  });

  it('sets maxConsecutiveFetchFailures alone when a valid positive integer is set', () => {
    expect(parseScraperOptionsFromEnv({ SCRAPE_MAX_CONSECUTIVE_FETCH_FAILURES: '20' })).toEqual({
      maxConsecutiveFetchFailures: 20,
    });
  });

  it('ignores invalid SCRAPE_MAX_CONSECUTIVE_FETCH_FAILURES values', () => {
    expect(parseScraperOptionsFromEnv({ SCRAPE_MAX_CONSECUTIVE_FETCH_FAILURES: '0' })).toBeUndefined();
    expect(parseScraperOptionsFromEnv({ SCRAPE_MAX_CONSECUTIVE_FETCH_FAILURES: '-5' })).toBeUndefined();
    expect(parseScraperOptionsFromEnv({ SCRAPE_MAX_CONSECUTIVE_FETCH_FAILURES: 'abc' })).toBeUndefined();
    expect(parseScraperOptionsFromEnv({ SCRAPE_MAX_CONSECUTIVE_FETCH_FAILURES: '1.5' })).toBeUndefined();
  });

  it('combines sitemapTimeoutMs and maxConsecutiveFetchFailures with SCRAPE_DEBUG_FETCH_STAGES', () => {
    expect(
      parseScraperOptionsFromEnv({
        SCRAPE_SITEMAP_TIMEOUT_MS: '45000',
        SCRAPE_MAX_CONSECUTIVE_FETCH_FAILURES: '15',
        SCRAPE_DEBUG_FETCH_STAGES: '1',
      }),
    ).toEqual({
      debugFetchStages: true,
      sitemapTimeoutMs: 45000,
      maxConsecutiveFetchFailures: 15,
    });
  });

  it('sets maxPages alone when SCRAPE_MAX_PAGES is a valid positive integer', () => {
    expect(parseScraperOptionsFromEnv({ SCRAPE_MAX_PAGES: '100' })).toEqual({ maxPages: 100 });
  });

  it('ignores invalid SCRAPE_MAX_PAGES values (default = uncapped)', () => {
    expect(parseScraperOptionsFromEnv({ SCRAPE_MAX_PAGES: '0' })).toBeUndefined();
    expect(parseScraperOptionsFromEnv({ SCRAPE_MAX_PAGES: '-5' })).toBeUndefined();
    expect(parseScraperOptionsFromEnv({ SCRAPE_MAX_PAGES: 'abc' })).toBeUndefined();
    expect(parseScraperOptionsFromEnv({ SCRAPE_MAX_PAGES: '1.5' })).toBeUndefined();
    expect(parseScraperOptionsFromEnv({})).toBeUndefined();
  });

  it('combines maxPages with the enrichment options', () => {
    expect(
      parseScraperOptionsFromEnv({
        SCRAPE_ENRICH_DESCRIPTIONS: 'true',
        SCRAPE_MAX_PAGES: '250',
      }),
    ).toEqual({ enrichDescriptions: true, maxPages: 250 });
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

describe('getHeartbeatIntervalSeconds', () => {
  it('returns the default (60) when absent', () => {
    expect(getHeartbeatIntervalSeconds({})).toBe(60);
  });

  it('returns the custom value when a positive integer string is set', () => {
    expect(getHeartbeatIntervalSeconds({ SCRAPE_HEARTBEAT_INTERVAL_SECONDS: '30' })).toBe(30);
  });

  it('falls back to the default on invalid values', () => {
    expect(getHeartbeatIntervalSeconds({ SCRAPE_HEARTBEAT_INTERVAL_SECONDS: '0' })).toBe(60);
    expect(getHeartbeatIntervalSeconds({ SCRAPE_HEARTBEAT_INTERVAL_SECONDS: '-5' })).toBe(60);
    expect(getHeartbeatIntervalSeconds({ SCRAPE_HEARTBEAT_INTERVAL_SECONDS: 'not-a-number' })).toBe(60);
    expect(getHeartbeatIntervalSeconds({ SCRAPE_HEARTBEAT_INTERVAL_SECONDS: '3.5' })).toBe(60);
  });
});

describe('getHeartbeatTimeoutMinutes', () => {
  it('returns the default (15) when absent', () => {
    expect(getHeartbeatTimeoutMinutes({})).toBe(15);
  });

  it('returns the custom value when a positive integer string is set', () => {
    expect(getHeartbeatTimeoutMinutes({ SCRAPE_HEARTBEAT_TIMEOUT_MINUTES: '5' })).toBe(5);
  });

  it('falls back to the default on invalid values', () => {
    expect(getHeartbeatTimeoutMinutes({ SCRAPE_HEARTBEAT_TIMEOUT_MINUTES: '0' })).toBe(15);
    expect(getHeartbeatTimeoutMinutes({ SCRAPE_HEARTBEAT_TIMEOUT_MINUTES: '-5' })).toBe(15);
    expect(getHeartbeatTimeoutMinutes({ SCRAPE_HEARTBEAT_TIMEOUT_MINUTES: 'not-a-number' })).toBe(15);
  });
});

describe('getLegacyStaleTimeoutHours', () => {
  it('returns the default (24) when absent', () => {
    expect(getLegacyStaleTimeoutHours({})).toBe(24);
  });

  it('returns the custom value when a positive integer string is set', () => {
    expect(getLegacyStaleTimeoutHours({ SCRAPE_STALE_STARTEDAT_TIMEOUT_HOURS: '48' })).toBe(48);
  });

  it('falls back to the default on invalid values', () => {
    expect(getLegacyStaleTimeoutHours({ SCRAPE_STALE_STARTEDAT_TIMEOUT_HOURS: '0' })).toBe(24);
    expect(getLegacyStaleTimeoutHours({ SCRAPE_STALE_STARTEDAT_TIMEOUT_HOURS: '-5' })).toBe(24);
    expect(getLegacyStaleTimeoutHours({ SCRAPE_STALE_STARTEDAT_TIMEOUT_HOURS: 'not-a-number' })).toBe(24);
  });
});

describe('getEnrichBatchSize', () => {
  it('returns the default (50) when absent', () => {
    expect(getEnrichBatchSize({})).toBe(50);
  });

  it('returns the custom value when a positive integer string is set', () => {
    expect(getEnrichBatchSize({ SCRAPE_ENRICH_BATCH_SIZE: '200' })).toBe(200);
  });

  it('falls back to the default on invalid values', () => {
    expect(getEnrichBatchSize({ SCRAPE_ENRICH_BATCH_SIZE: '0' })).toBe(50);
    expect(getEnrichBatchSize({ SCRAPE_ENRICH_BATCH_SIZE: '-5' })).toBe(50);
    expect(getEnrichBatchSize({ SCRAPE_ENRICH_BATCH_SIZE: 'not-a-number' })).toBe(50);
    expect(getEnrichBatchSize({ SCRAPE_ENRICH_BATCH_SIZE: '2.5' })).toBe(50);
  });
});

describe('getEnrichDelayMs', () => {
  it('returns undefined when absent (provider default applies)', () => {
    expect(getEnrichDelayMs({})).toBeUndefined();
  });

  it('returns the custom value when a positive integer string is set', () => {
    expect(getEnrichDelayMs({ SCRAPE_ENRICH_DELAY_MS: '500' })).toBe(500);
  });

  it('returns undefined on invalid values', () => {
    expect(getEnrichDelayMs({ SCRAPE_ENRICH_DELAY_MS: '0' })).toBeUndefined();
    expect(getEnrichDelayMs({ SCRAPE_ENRICH_DELAY_MS: '-1' })).toBeUndefined();
    expect(getEnrichDelayMs({ SCRAPE_ENRICH_DELAY_MS: 'nope' })).toBeUndefined();
  });
});

describe('getEnrichCircuitBreakerThreshold', () => {
  it('defaults to 10 (breaker on by default) when absent', () => {
    expect(getEnrichCircuitBreakerThreshold({})).toBe(10);
  });

  it('returns the custom value when a positive integer string is set', () => {
    expect(getEnrichCircuitBreakerThreshold({ SCRAPE_ENRICH_CIRCUIT_BREAKER_THRESHOLD: '3' })).toBe(3);
  });

  it('falls back to the default on invalid values', () => {
    expect(getEnrichCircuitBreakerThreshold({ SCRAPE_ENRICH_CIRCUIT_BREAKER_THRESHOLD: '0' })).toBe(10);
    expect(getEnrichCircuitBreakerThreshold({ SCRAPE_ENRICH_CIRCUIT_BREAKER_THRESHOLD: '-2' })).toBe(10);
    expect(getEnrichCircuitBreakerThreshold({ SCRAPE_ENRICH_CIRCUIT_BREAKER_THRESHOLD: 'x' })).toBe(10);
    expect(getEnrichCircuitBreakerThreshold({ SCRAPE_ENRICH_CIRCUIT_BREAKER_THRESHOLD: '1.5' })).toBe(10);
  });
});

describe('getEnrichMaxNoProgressRestarts', () => {
  it('defaults to 3 when absent', () => {
    expect(getEnrichMaxNoProgressRestarts({})).toBe(3);
  });

  it('returns the custom value when a positive integer string is set', () => {
    expect(getEnrichMaxNoProgressRestarts({ SCRAPE_ENRICH_MAX_NO_PROGRESS_RESTARTS: '5' })).toBe(5);
  });

  it('falls back to the default on invalid values', () => {
    expect(getEnrichMaxNoProgressRestarts({ SCRAPE_ENRICH_MAX_NO_PROGRESS_RESTARTS: '0' })).toBe(3);
    expect(getEnrichMaxNoProgressRestarts({ SCRAPE_ENRICH_MAX_NO_PROGRESS_RESTARTS: '-1' })).toBe(3);
    expect(getEnrichMaxNoProgressRestarts({ SCRAPE_ENRICH_MAX_NO_PROGRESS_RESTARTS: 'nope' })).toBe(3);
    expect(getEnrichMaxNoProgressRestarts({ SCRAPE_ENRICH_MAX_NO_PROGRESS_RESTARTS: '2.2' })).toBe(3);
  });
});
