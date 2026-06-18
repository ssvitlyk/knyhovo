/**
 * Web-layer proxy: enables browser-side typeahead by re-exposing `searchBooks`
 * (server-only, reads `API_BASE_URL`) as a same-origin Next.js route handler.
 * The browser hits `GET /api/search` on the Next.js origin; this handler
 * validates and bounds the params, then proxies to the backend. No Fastify
 * suggest endpoint is required. Backend errors are never leaked to the client —
 * only generic error codes are returned.
 */

import { searchBooks, SearchError } from '@/lib/api/search';

export const dynamic = 'force-dynamic';

/** Defensive upper bound on the query length accepted by the proxy. */
const MAX_QUERY_LENGTH = 120;
/** Safe maximum page size served by the typeahead proxy (suggestions are short). */
const MAX_PAGE_SIZE = 10;

/**
 * Parse an optional positive-integer query param.
 * - `undefined` → param absent (use the backend default)
 * - `null`      → param present but invalid (not a positive integer)
 * - `number`    → a valid positive integer
 */
function parseOptionalPositiveInt(raw: string | null): number | null | undefined {
  if (raw === null) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const q = (searchParams.get('q') ?? '').trim();
  if (!q) {
    return Response.json({ error: 'EMPTY_QUERY' }, { status: 400 });
  }
  if (q.length > MAX_QUERY_LENGTH) {
    return Response.json({ error: 'INVALID_PARAMS' }, { status: 400 });
  }

  const page = parseOptionalPositiveInt(searchParams.get('page'));
  const pageSize = parseOptionalPositiveInt(searchParams.get('pageSize'));
  if (page === null || pageSize === null) {
    return Response.json({ error: 'INVALID_PARAMS' }, { status: 400 });
  }

  // Clamp to a safe ceiling so a crafted request cannot widen the typeahead fan-out.
  const safePageSize = pageSize !== undefined ? Math.min(pageSize, MAX_PAGE_SIZE) : undefined;

  try {
    const data = await searchBooks({ q, page, pageSize: safePageSize });
    return Response.json(data);
  } catch (err) {
    if (err instanceof SearchError) {
      return Response.json({ error: 'SEARCH_FAILED' }, { status: err.status ?? 502 });
    }
    return Response.json({ error: 'SEARCH_FAILED' }, { status: 502 });
  }
}
