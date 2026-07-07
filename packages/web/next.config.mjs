/**
 * Next.js config.
 *
 * The Search page fetches `GET /api/search` from the Fastify API package. Server
 * Components fetch the absolute `API_BASE_URL` directly (server→server, no CORS).
 * The rewrite below proxies any browser-side `/api/*` call to the same backend,
 * so client code can use relative URLs without a CORS setup on the API.
 */
import { join } from 'node:path';

// Trim + treat an empty string as unset — Vercel can create an env var with an
// empty value without it being `undefined`, which `??` alone would not catch.
const API_BASE_URL = process.env.API_BASE_URL?.trim() || 'http://localhost:3000';

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
