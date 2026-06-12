import type { FastifyInstance } from 'fastify';
import type { AuthDeps } from './service.js';
import { requestCode, verifyCode, resolveSessionUser, logout } from './service.js';
import { parseRequestCodeBody, parseVerifyCodeBody } from './schema.js';
import { toAuthUserDto } from './mapper.js';
import { setSessionCookie, clearSessionCookie, SESSION_COOKIE } from './cookie.js';
import { UnauthorizedError } from '../errors.js';

/**
 * Register the four auth routes onto `app`.
 *
 * Auth deps are injected (not built here) so tests can pass in deterministic
 * fakes without touching process.env or the real clock.
 *
 * Routes:
 *  POST /api/auth/request-code  — send OTP to email
 *  POST /api/auth/verify-code   — verify OTP, issue session cookie
 *  GET  /api/auth/me            — return current user (requires valid cookie)
 *  POST /api/auth/logout        — clear session
 */
export function registerAuthRoute(app: FastifyInstance, deps: AuthDeps): void {
  app.post('/api/auth/request-code', async (request, reply) => {
    const { email } = parseRequestCodeBody(request.body);
    await requestCode(deps, email);
    await reply.code(200).send({ ok: true });
  });

  app.post('/api/auth/verify-code', async (request, reply) => {
    const { email, code } = parseVerifyCodeBody(request.body);
    const { token, user } = await verifyCode(deps, email, code);
    setSessionCookie(reply, token, deps.config);
    await reply.code(200).send({ user: toAuthUserDto(user) });
  });

  app.get('/api/auth/me', async (request, reply) => {
    const token = request.cookies?.[SESSION_COOKIE] ?? null;
    const user = await resolveSessionUser(deps, token);
    if (!user) throw new UnauthorizedError();
    await reply.code(200).send({ user: toAuthUserDto(user) });
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies?.[SESSION_COOKIE] ?? null;
    await logout(deps, token);
    clearSessionCookie(reply);
    await reply.code(200).send({ ok: true });
  });
}
