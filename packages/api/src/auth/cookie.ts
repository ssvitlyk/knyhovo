import type { FastifyReply } from 'fastify';

/** Name of the session cookie. */
export const SESSION_COOKIE = 'kn_session';

interface CookieOptions {
  readonly cookieSecure: boolean;
  readonly sessionTtlMs: number;
}

/**
 * Write the session cookie onto `reply`.
 * httpOnly + sameSite lax prevents CSRF while still allowing cookie to be
 * sent on top-level navigations.
 */
export function setSessionCookie(reply: FastifyReply, token: string, opts: CookieOptions): void {
  void reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: opts.cookieSecure,
    path: '/',
    maxAge: Math.floor(opts.sessionTtlMs / 1000),
  });
}

/**
 * Clear the session cookie by setting maxAge=0.
 */
export function clearSessionCookie(reply: FastifyReply): void {
  void reply.clearCookie(SESSION_COOKIE, { path: '/' });
}
