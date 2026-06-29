import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { fetchScrapeRunMetricRows } from './scrape-runs.repository.js';
import { ScrapeRunsMetricsSource } from './scrape-runs-source.js';
import { PrometheusExporter, PROMETHEUS_CONTENT_TYPE } from './prometheus-exporter.js';

/**
 * Register the `GET /metrics` route. Unconditional — no auth required.
 *
 * Each request fetches a fresh snapshot of scrape_runs from the DB, folds it
 * into an in-memory metrics registry via {@link ScrapeRunsMetricsSource}, then
 * serialises the result to the Prometheus text exposition format.
 */
export function registerMetricsRoute(app: FastifyInstance, prisma: PrismaClient): void {
  app.get('/metrics', async (_request, reply) => {
    const rows = await fetchScrapeRunMetricRows(prisma);
    const source = new ScrapeRunsMetricsSource(rows);
    const body = new PrometheusExporter().export(source.snapshot());
    await reply.header('Content-Type', PROMETHEUS_CONTENT_TYPE).send(body);
  });
}
