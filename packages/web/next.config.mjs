/**
 * Next.js config.
 *
 * The Search page fetches `GET /api/search` from the Fastify API package. Server
 * Components fetch the absolute `API_BASE_URL` directly (server→server, no CORS).
 * The rewrite below proxies any browser-side `/api/*` call to the same backend,
 * so client code can use relative URLs without a CORS setup on the API.
 */
import { join } from 'node:path';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the Turbopack root to the monorepo root so workspace dependencies resolve
  // and a stray lockfile elsewhere can't make Next infer the wrong root.
  turbopack: { root: join(import.meta.dirname, '..', '..') },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_BASE_URL}/api/:path*` }];
  },
};

export default nextConfig;
