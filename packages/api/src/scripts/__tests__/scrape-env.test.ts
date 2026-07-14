import { describe, it, expect } from 'vitest';
import {
  parseScraperOptionsFromEnv,
  getScrapeStateRetentionDays,
  getLastmodPrecisionMin,
  getHeartbeatIntervalSeconds,
  getHeartbeatTimeoutMinutes,
  getLegacyStaleTimeoutHours,
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
