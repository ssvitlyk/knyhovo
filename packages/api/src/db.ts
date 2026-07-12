import { PrismaClient } from '@prisma/client';

// Any GUC starting with "jit" set via `-c` in the libpq `options` param counts
// as an explicit operator choice (e.g. `jit=off`, `jit_above_cost=1e9`) and
// suppresses the automatic append below.
const JIT_OPTION_PATTERN = /-c\s*jit[a-z_]*\s*=/;

/**
 * Disables Postgres JIT compilation for API sessions by appending the libpq
 * `-c jit=off` startup option to a connection URL. JIT compile time exceeds
 * its savings for the collections feed queries this API runs (see
 * docs/prd/collections-sql-performance.md §10.5), so JIT is turned off
 * per-session for API connections only; migrations/CLI keep the raw URL.
 *
 * Pure and side-effect free; never throws — an unparseable URL is returned
 * unchanged so Prisma can surface its own connection error.
 */
export function withJitOff(databaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return databaseUrl;
  }

  const existingOptions = url.searchParams.get('options');
  if (existingOptions !== null) {
    if (JIT_OPTION_PATTERN.test(existingOptions)) {
      return databaseUrl;
    }
    url.searchParams.set('options', `${existingOptions} -c jit=off`);
  } else {
    url.searchParams.set('options', '-c jit=off');
  }

  return url.toString();
}

// Global singleton to avoid exhausting database connections in development
// when the module is re-evaluated (e.g. during hot-reload or test runs).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const databaseUrl = process.env['DATABASE_URL'];

export const prisma =
  globalForPrisma.prisma ??
  (databaseUrl
    ? new PrismaClient({ datasources: { db: { url: withJitOff(databaseUrl) } } })
    : new PrismaClient());

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
