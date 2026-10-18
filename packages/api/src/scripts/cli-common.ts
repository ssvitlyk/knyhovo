import { ScrapeRunTrigger } from '@prisma/client';
import type { StaleReapConfig } from '../refresh/concurrency-guard.js';
import {
  getHeartbeatIntervalSeconds,
  getHeartbeatTimeoutMinutes,
  getLegacyStaleTimeoutHours,
} from './scrape-env.js';

/**
 * Parse the SCRAPE_TRIGGERED_BY environment variable into a ScrapeRunTrigger
 * enum value. Defaults to MANUAL when the value is absent or unrecognised.
 */
export function parseTriggeredBy(val: string | undefined): ScrapeRunTrigger {
  switch (val?.toUpperCase()) {
    case 'CRON':
      return ScrapeRunTrigger.CRON;
    case 'SYSTEM':
      return ScrapeRunTrigger.SYSTEM;
    default:
      return ScrapeRunTrigger.MANUAL;
  }
}

/** Heartbeat interval (ms) from `SCRAPE_HEARTBEAT_INTERVAL_SECONDS` (default 60s). */
export function getHeartbeatIntervalMs(env: NodeJS.ProcessEnv): number {
  return getHeartbeatIntervalSeconds(env) * 1000;
}

/** Env-driven stale-reap thresholds shared by every scrape-style CLI entrypoint. */
export function getStaleReapConfig(env: NodeJS.ProcessEnv): StaleReapConfig {
  return {
    heartbeatTimeoutMs: getHeartbeatTimeoutMinutes(env) * 60_000,
    legacyStartedAtTimeoutMs: getLegacyStaleTimeoutHours(env) * 3_600_000,
  };
}
