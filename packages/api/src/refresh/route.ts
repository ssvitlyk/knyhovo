import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { getRefreshHealth, DEFAULT_HEALTH_CONFIG } from './refresh-health.js';
import { getLastmodPrecisionMin } from '../scripts/scrape-env.js';

export function registerRefreshHealthRoute(app: FastifyInstance, prisma: PrismaClient): void {
  app.get('/api/refresh/health', async (_request, reply) => {
    const result = await getRefreshHealth(prisma, {
      config: {
        ...DEFAULT_HEALTH_CONFIG,
        lastmodPrecisionMin: getLastmodPrecisionMin(process.env),
      },
    });
    await reply.send(result);
  });
}
