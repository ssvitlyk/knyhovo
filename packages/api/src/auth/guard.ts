import type { FastifyRequest } from 'fastify';
import type { AuthDeps } from './service.js';
import { resolveSessionUser } from './service.js';
import { SESSION_COOKIE } from './cookie.js';
import { UnauthorizedError } from '../errors.js';

/** The authenticated user as resolved from a session cookie. */
export type SessionUser = NonNullable<Awaited<ReturnType<typeof resolveSessionUser>>>;

/**
 * Resolve the signed-in user from the request's session cookie, or `null` for
 * guests. When `deps` is `undefined` (auth not wired) no lookup happens.
 */
export async function optionalUser(
  deps: AuthDeps | undefined,
  request: FastifyRequest,
): Promise<SessionUser | null> {
  if (!deps) return null;
  return resolveSessionUser(deps, request.cookies?.[SESSION_COOKIE] ?? null);
}

/**
 * Resolve the signed-in user or throw {@link UnauthorizedError} (401
 * AUTH_REQUIRED). Routes call this before any validation so guests always get
 * 401 regardless of input.
 */
export async function requireUser(deps: AuthDeps, request: FastifyRequest): Promise<SessionUser> {
  const user = await optionalUser(deps, request);
  if (!user) throw new UnauthorizedError();
  return user;
}
