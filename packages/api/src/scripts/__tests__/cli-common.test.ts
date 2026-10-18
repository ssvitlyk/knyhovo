import { describe, it, expect } from 'vitest';
import { ScrapeRunTrigger } from '@prisma/client';
import { getHeartbeatIntervalMs, getStaleReapConfig, parseTriggeredBy } from '../cli-common.js';

describe('parseTriggeredBy', () => {
  it('maps CRON and SYSTEM case-insensitively', () => {
    expect(parseTriggeredBy('cron')).toBe(ScrapeRunTrigger.CRON);
    expect(parseTriggeredBy('SYSTEM')).toBe(ScrapeRunTrigger.SYSTEM);
  });

  it('defaults to MANUAL for absent or unknown values', () => {
    expect(parseTriggeredBy(undefined)).toBe(ScrapeRunTrigger.MANUAL);
    expect(parseTriggeredBy('MANUAL')).toBe(ScrapeRunTrigger.MANUAL);
    expect(parseTriggeredBy('whatever')).toBe(ScrapeRunTrigger.MANUAL);
  });
});

describe('getHeartbeatIntervalMs / getStaleReapConfig', () => {
  it('uses defaults (60s, 15min, 24h) on an empty env', () => {
    expect(getHeartbeatIntervalMs({})).toBe(60_000);
    expect(getStaleReapConfig({})).toEqual({
      heartbeatTimeoutMs: 15 * 60_000,
      legacyStartedAtTimeoutMs: 24 * 3_600_000,
    });
  });

  it('honours env overrides', () => {
    const env = {
      SCRAPE_HEARTBEAT_INTERVAL_SECONDS: '5',
      SCRAPE_HEARTBEAT_TIMEOUT_MINUTES: '2',
      SCRAPE_STALE_STARTEDAT_TIMEOUT_HOURS: '3',
    };
    expect(getHeartbeatIntervalMs(env)).toBe(5000);
    expect(getStaleReapConfig(env)).toEqual({
      heartbeatTimeoutMs: 120_000,
      legacyStartedAtTimeoutMs: 3 * 3_600_000,
    });
  });
});
