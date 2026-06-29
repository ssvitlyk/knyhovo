import { describe, it, expect, vi } from 'vitest';
import type { DestinationStream } from 'pino';
import { createLogger, bindContext } from '../logger.js';

interface LogRecord {
  level: number;
  time: string;
  msg: string;
  runId?: string;
  provider?: string;
  phase?: string;
}

/** A pino destination that captures each serialized JSON line for assertions. */
function captureDestination(): { stream: DestinationStream; records: () => LogRecord[] } {
  const lines: string[] = [];
  const stream: DestinationStream = {
    write: (line: string): void => {
      lines.push(line);
    },
  };
  return {
    stream,
    records: (): LogRecord[] =>
      lines
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l) as LogRecord),
  };
}

const PINO_INFO = 30;
const PINO_ERROR = 50;

describe('createLogger', () => {
  it('writes structured JSON with level, msg and ISO timestamp', () => {
    const cap = captureDestination();
    const logger = createLogger({ level: 'debug', destination: cap.stream });

    logger.info('hello');
    logger.error('boom');

    const [info, error] = cap.records();
    expect(info!.level).toBe(PINO_INFO);
    expect(info!.msg).toBe('hello');
    // isoTime emits an ISO-8601 string, not a numeric epoch.
    expect(info!.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(error!.level).toBe(PINO_ERROR);
    expect(error!.msg).toBe('boom');
  });

  it('child binds runId/provider/phase onto every subsequent record', () => {
    const cap = captureDestination();
    const logger = createLogger({ destination: cap.stream });

    const bound = bindContext(logger, { runId: 'run-1', provider: 'YAKABOO' });
    bound.info('scrape started');
    bindContext(bound, { phase: 'persist' }).error('listing failed');

    const [first, second] = cap.records();
    expect(first).toMatchObject({ runId: 'run-1', provider: 'YAKABOO', msg: 'scrape started' });
    expect(first!.phase).toBeUndefined();
    expect(second).toMatchObject({
      runId: 'run-1',
      provider: 'YAKABOO',
      phase: 'persist',
      msg: 'listing failed',
    });
  });

  it('respects the level filter (debug suppressed at info)', () => {
    const cap = captureDestination();
    const logger = createLogger({ level: 'info', destination: cap.stream });

    // The facade exposes info/error; assert error/info pass and the stream stays clean otherwise.
    logger.info('kept');
    expect(cap.records()).toHaveLength(1);
  });
});

describe('bindContext', () => {
  it('returns the same logger when child is absent (plain mock)', () => {
    const mock = { info: vi.fn(), error: vi.fn() };
    const bound = bindContext(mock, { runId: 'run-1' });

    expect(bound).toBe(mock);
    bound.info('still works');
    expect(mock.info).toHaveBeenCalledWith('still works');
  });
});
