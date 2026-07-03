import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { AuthDeps } from '../auth/service.js';
import { resolveSessionUser } from '../auth/service.js';
import { SESSION_COOKIE } from '../auth/cookie.js';
import { parseBooksQuery, parseSlugParams } from './schema.js';
import {
  getHome,
  getFeaturedSection,
  getWishlistPopularSection,
  getPopularSection,
  getNewArrivalsSection,
  getBiggestDiscountsSection,
  getUnderratedSection,
  getGenresSection,
  getMoodsSection,
  getEditorialSection,
  getCollectionDetail,
  getCollectionBooksPage,
  getGenreBooksPage,
  getMoodBooksPage,
  getSimilarCollections,
} from './service.js';

/**
 * Register all `GET /api/collections/*` routes.
 *
 * Every handler resolves the current session user (or null for guests) up
 * front via `resolveSessionUser` — this NEVER throws for guests, it simply
 * returns null so `isWishlisted` degrades to `false` for anonymous requests.
 */
export function registerCollectionsRoute(
  app: FastifyInstance,
  prisma: PrismaClient,
  authDeps: AuthDeps,
): void {
  async function currentUserId(request: { cookies?: Record<string, string | undefined> }): Promise<string | null> {
    const user = await resolveSessionUser(authDeps, request.cookies?.[SESSION_COOKIE] ?? null);
    return user?.id ?? null;
  }

  // ── Home / Hub ─────────────────────────────────────────────────────────
  app.get('/api/collections/home', async (request, reply) => {
    const userId = await currentUserId(request);
    await reply.send(await getHome(prisma, userId));
  });
  app.get('/api/collections/hub', async (request, reply) => {
    const userId = await currentUserId(request);
    await reply.send(await getHome(prisma, userId));
  });

  // ── Section feeds ──────────────────────────────────────────────────────
  app.get('/api/collections/featured', async (request, reply) => {
    const userId = await currentUserId(request);
    await reply.send(await getFeaturedSection(prisma, userId));
  });
  app.get('/api/collections/wishlist-popular', async (request, reply) => {
    const userId = await currentUserId(request);
    await reply.send(await getWishlistPopularSection(prisma, userId));
  });
  app.get('/api/collections/popular', async (request, reply) => {
    const userId = await currentUserId(request);
    await reply.send(await getPopularSection(prisma, userId));
  });
  app.get('/api/collections/new-arrivals', async (request, reply) => {
    const userId = await currentUserId(request);
    await reply.send(await getNewArrivalsSection(prisma, userId));
  });
  app.get('/api/collections/biggest-discounts', async (request, reply) => {
    const userId = await currentUserId(request);
    await reply.send(await getBiggestDiscountsSection(prisma, userId));
  });
  app.get('/api/collections/underrated', async (request, reply) => {
    const userId = await currentUserId(request);
    await reply.send(await getUnderratedSection(prisma, userId));
  });
  app.get('/api/collections/genres', async (_request, reply) => {
    await reply.send(await getGenresSection(prisma));
  });
  app.get('/api/collections/moods', async (_request, reply) => {
    await reply.send(await getMoodsSection(prisma));
  });
  app.get('/api/collections/editorial', async (request, reply) => {
    const userId = await currentUserId(request);
    await reply.send(await getEditorialSection(prisma, userId));
  });

  // ── Genre / mood book listings ─────────────────────────────────────────
  app.get('/api/collections/genres/:slug/books', async (request, reply) => {
    const { slug } = parseSlugParams(request.params);
    const params = parseBooksQuery(request.query);
    const userId = await currentUserId(request);
    await reply.send(await getGenreBooksPage(prisma, slug, params, userId));
  });
  app.get('/api/collections/moods/:slug/books', async (request, reply) => {
    const { slug } = parseSlugParams(request.params);
    const params = parseBooksQuery(request.query);
    const userId = await currentUserId(request);
    await reply.send(await getMoodBooksPage(prisma, slug, params, userId));
  });

  // ── Generic collection detail / books / similar ─────────────────────────
  app.get('/api/collections/:slug/books', async (request, reply) => {
    const { slug } = parseSlugParams(request.params);
    const params = parseBooksQuery(request.query);
    const userId = await currentUserId(request);
    await reply.send(await getCollectionBooksPage(prisma, slug, params, userId));
  });
  app.get('/api/collections/:slug/similar', async (request, reply) => {
    const { slug } = parseSlugParams(request.params);
    const userId = await currentUserId(request);
    await reply.send(await getSimilarCollections(prisma, slug, userId));
  });
  app.get('/api/collections/:slug', async (request, reply) => {
    const { slug } = parseSlugParams(request.params);
    await reply.send(await getCollectionDetail(prisma, slug));
  });
}
