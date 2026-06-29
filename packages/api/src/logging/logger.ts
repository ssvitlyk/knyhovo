import pino from 'pino';
import type { Logger, LogContext } from '../pipeline/types.js';

/**
 * Structured logging for the ingestion pipeline.
 *
 * `createLogger` returns a pino-backed implementation of the existing `Logger`
 * facade (`info`/`error` take a plain string), so every current call site keeps
 * working unchanged. The added `child(ctx)` binds JSON context fields
 * (`runId`/`provider`/`phase`) onto every subsequent record, which is how
 * production logs get correlated per run/provider/phase.
 *
 * The interface stays string-in; the JSON shaping happens inside pino.
 */

export interface CreateLoggerOptions {
  /** Log level; defaults to `LOG_LEVEL` env, then `'info'`. */
  readonly level?: string;
  /** Injectable destination for deterministic capture in tests. */
  readonly destination?: pino.DestinationStream;
}

/** Wrap a pino instance behind the minimal `Logger` facade. */
function wrap(instance: pino.Logger): Logger {
  return {
    info: (msg: string): void => instance.info(msg),
    error: (msg: string): void => instance.error(msg),
    child: (bindings: LogContext): Logger => wrap(instance.child({ ...bindings })),
  };
}

export function createLogger(opts: CreateLoggerOptions = {}): Logger {
  const level = opts.level ?? process.env['LOG_LEVEL'] ?? 'info';
  const options: pino.LoggerOptions = {
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  const instance =
    opts.destination !== undefined ? pino(options, opts.destination) : pino(options);
  return wrap(instance);
}

/**
 * Return a logger bound to `ctx`, or the same logger when `child` is absent
 * (e.g. a plain `{ info, error }` test mock). Use this instead of calling
 * `logger.child` directly so the optional method never has to be guarded inline.
 */
export function bindContext(logger: Logger, ctx: LogContext): Logger {
  return logger.child ? logger.child(ctx) : logger;
}
