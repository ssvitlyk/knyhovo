import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { AuthDeps } from '../../auth/service.js';
import { resolveSessionUser } from '../../auth/service.js';
import { SESSION_COOKIE } from '../../auth/cookie.js';
import { UnauthorizedError } from '../../errors.js';
import { parseAlertParams, parseSetAlertBody, parsePauseAlertBody } from './schema.js';
import { setAlert, setAlertPaused, removeAlert } from './service.js';

/**
 * Register the three wishlist alert routes onto `app`.
 *
 * All routes authenticate first — unauthenticated requests always receive
 * 401 AUTH_REQUIRED regardless of body or path validity.
 *
 * Routes:
 *  PUT    /api/wishlist/:bookId/alert  — create or replace the alert for a wishlist item
 *  PATCH  /api/wishlist/:bookId/alert  — pause or unpause the alert
 *  DELETE /api/wishlist/:bookId/alert  — remove the alert
 */
export function registerWishlistAlertRoute(
  app: FastifyInstance,
  prisma: PrismaClient,
  authDeps: AuthDeps,
): void {
  app.put('/api/wishlist/:bookId/alert', async (request, reply) => {
    const user = await resolveSessionUser(authDeps, request.cookies?.[SESSION_COOKIE] ?? null);
    if (!user) throw new UnauthorizedError();

    const { bookId } = parseAlertParams(request.params);
    const body = parseSetAlertBody(request.body);
    await setAlert(prisma, user.id, bookId, body);
    await reply.send({ ok: true });
  });

  app.patch('/api/wishlist/:bookId/alert', async (request, reply) => {
    const user = await resolveSessionUser(authDeps, request.cookies?.[SESSION_COOKIE] ?? null);
    if (!user) throw new UnauthorizedError();

    const { bookId } = parseAlertParams(request.params);
    const { paused } = parsePauseAlertBody(request.body);
    await setAlertPaused(prisma, user.id, bookId, paused, () => new Date());
    await reply.send({ ok: true });
  });

  app.delete('/api/wishlist/:bookId/alert', async (request, reply) => {
    const user = await resolveSessionUser(authDeps, request.cookies?.[SESSION_COOKIE] ?? null);
    if (!user) throw new UnauthorizedError();

    const { bookId } = parseAlertParams(request.params);
    await removeAlert(prisma, user.id, bookId);
    await reply.send({ ok: true });
  });
}
