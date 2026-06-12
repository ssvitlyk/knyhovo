/**
 * Auth configuration. Call `loadAuthConfig()` once at startup; the returned
 * object is then injected wherever it is needed — never imported globally.
 * Throws immediately if `AUTH_SECRET` is missing so the process fails fast.
 */
export interface AuthConfig {
  readonly secret: string;
  readonly cookieSecure: boolean;
  readonly codeTtlMs: number;
  readonly sessionTtlMs: number;
  readonly rateWindowMs: number;
  readonly maxCodesPerWindow: number;
  readonly maxVerifyAttempts: number;
}

export function loadAuthConfig(): AuthConfig {
  const secret = process.env['AUTH_SECRET'];
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is required but not set.');
  }
  return {
    secret,
    cookieSecure: process.env['NODE_ENV'] === 'production',
    codeTtlMs: 10 * 60_000,
    sessionTtlMs: 30 * 24 * 60 * 60_000,
    rateWindowMs: 15 * 60_000,
    maxCodesPerWindow: 5,
    maxVerifyAttempts: 5,
  };
}
