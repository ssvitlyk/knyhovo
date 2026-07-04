import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { parseBooksQuery, parseSlugParams } from './schema.js';
import { getHub, getCollectionDetail, getCollectionBooks, getAllCollections } from './service.js';

/**
 * Register all `GET /api/collections*` routes. None of these require
 * authentication — collections/добірки are a public browsing surface.
 */
export function registerCollectionsRoute(app: FastifyInstance, prisma: PrismaClient): void {
  app.get('/api/collections/hub', async (_request, reply) => {
    await reply.send(await getHub(prisma));
  });

  app.get('/api/collections', async (_request, reply) => {
    await reply.send(await getAllCollections(prisma));
  });

  app.get('/api/collections/:slug/books', async (request, reply) => {
    const { slug } = parseSlugParams(request.params);
    const params = parseBooksQuery(request.query);
    await reply.send(await getCollectionBooks(prisma, slug, params));
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
