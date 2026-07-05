import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { AuthDeps } from '../auth/service.js';
import { resolveSessionUser } from '../auth/service.js';
import { SESSION_COOKIE } from '../auth/cookie.js';
import { parseBooksQuery, parseSlugParams } from './schema.js';
import { getHub, getCollectionDetail, getCollectionBooks, getAllCollections } from './service.js';

/**
 * Register all `GET /api/collections*` routes. None of these require
 * authentication — collections/добірки are a public browsing surface.
 *
 * `authDeps` is optional (mirrors `buildApp`): when provided, the hub and
 * `:slug/books` handlers resolve the current session (if any) to decorate
 * `isWishlisted` on the returned books. Guests — and callers that omit
 * `authDeps` entirely — always get `isWishlisted: false`, never a 401.
 */
export function registerCollectionsRoute(app: FastifyInstance, prisma: PrismaClient, authDeps?: AuthDeps): void {
  app.get('/api/collections/hub', async (request, reply) => {
    const user = authDeps ? await resolveSessionUser(authDeps, request.cookies?.[SESSION_COOKIE] ?? null) : null;
    await reply.send(await getHub(prisma, user?.id ?? null));
  });

  app.get('/api/collections', async (_request, reply) => {
    await reply.send(await getAllCollections(prisma));
  });

  app.get('/api/collections/:slug/books', async (request, reply) => {
    const { slug } = parseSlugParams(request.params);
    const params = parseBooksQuery(request.query);
    const user = authDeps ? await resolveSessionUser(authDeps, request.cookies?.[SESSION_COOKIE] ?? null) : null;
    await reply.send(await getCollectionBooks(prisma, slug, params, user?.id ?? null));
  });

  app.get('/api/collections/:slug', async (request, reply) => {
    const { slug } = parseSlugParams(request.params);
    const { response, redirect } = await getCollectionDetail(prisma, slug);
    if (redirect) {
      await reply.code(301).header('Location', redirect).send();
      return;
    }
    await reply.send(response);
  });
}
