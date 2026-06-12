import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { AuthDeps } from '../auth/service.js';
import { resolveSessionUser } from '../auth/service.js';
import { SESSION_COOKIE } from '../auth/cookie.js';
import { UnauthorizedError } from '../errors.js';
import { parseAddWishlistBody, parseWishlistParams } from './schema.js';
import { listWishlist, addToWishlist, removeFromWishlist, isBookInWishlist } from './service.js';

/**
 * Register the four wishlist routes onto `app`.
 *
 * Auth deps are injected (not built here) so tests can pass in deterministic
 * fakes without touching process.env or the real clock.
 *
 * All routes authenticate first, before any validation, so unauthenticated
 * requests always receive 401 AUTH_REQUIRED regardless of input.
 *
 * Routes:
 *  GET    /api/wishlist                  — list current user's wishlist
 *  POST   /api/wishlist                  — add a book to wishlist
 *  GET    /api/wishlist/status/:bookId   — check if a book is in wishlist
 *  DELETE /api/wishlist/:bookId          — remove a book from wishlist
 */
export function registerWishlistRoute(
  app: FastifyInstance,
  prisma: PrismaClient,
  authDeps: AuthDeps,
): void {
  app.get('/api/wishlist', async (request, reply) => {
    const user = await resolveSessionUser(authDeps, request.cookies?.[SESSION_COOKIE] ?? null);
    if (!user) throw new UnauthorizedError();

    await reply.send(await listWishlist(prisma, user.id));
  });

  app.post('/api/wishlist', async (request, reply) => {
    const user = await resolveSessionUser(authDeps, request.cookies?.[SESSION_COOKIE] ?? null);
    if (!user) throw new UnauthorizedError();

    const { bookId } = parseAddWishlistBody(request.body);
    await addToWishlist(prisma, user.id, bookId);
    await reply.send({ ok: true });
  });

  app.get('/api/wishlist/status/:bookId', async (request, reply) => {
    const user = await resolveSessionUser(authDeps, request.cookies?.[SESSION_COOKIE] ?? null);
    if (!user) throw new UnauthorizedError();

    const { bookId } = parseWishlistParams(request.params);
    await reply.send({ inWishlist: await isBookInWishlist(prisma, user.id, bookId) });
  });

  app.delete('/api/wishlist/:bookId', async (request, reply) => {
    const user = await resolveSessionUser(authDeps, request.cookies?.[SESSION_COOKIE] ?? null);
    if (!user) throw new UnauthorizedError();

    const { bookId } = parseWishlistParams(request.params);
    await removeFromWishlist(prisma, user.id, bookId);
    await reply.send({ ok: true });
  });
}
