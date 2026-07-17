import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { AuthDeps } from '../../auth/service.js';
import { resolveSessionUser } from '../../auth/service.js';
import { SESSION_COOKIE } from '../../auth/cookie.js';
import { UnauthorizedError } from '../../errors.js';
import { getBuyingOpportunities } from './service.js';

/**
 * Register `GET /api/wishlist/buying-opportunities`.
 *
 * Auth deps are injected (not built here) so tests can pass in deterministic
 * fakes without touching process.env or the real clock, mirroring
 * `registerWishlistRoute`.
 */
export function registerBuyingOpportunitiesRoute(
  app: FastifyInstance,
  prisma: PrismaClient,
  authDeps: AuthDeps,
): void {
  app.get('/api/wishlist/buying-opportunities', async (request, reply) => {
    const user = await resolveSessionUser(authDeps, request.cookies?.[SESSION_COOKIE] ?? null);
    if (!user) throw new UnauthorizedError();

    await reply.send(await getBuyingOpportunities(prisma, user.id, { now: () => new Date() }));
  });
}
