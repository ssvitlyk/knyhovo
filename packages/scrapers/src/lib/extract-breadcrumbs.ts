import * as cheerio from 'cheerio';

/**
 * Shared JSON-LD `BreadcrumbList` extraction for raw provider-category signals
 * (genres-taxonomy PRD G2) — used by BookChef and Knigoland. Laboratory uses a
 * different HTML-microdata breadcrumb format and implements its own extraction
 * directly in its parser; this helper is not meant to cover that shape.
 *
 * Pure — no IO, never throws. Malformed JSON-LD blocks are skipped silently.
 */

function matchesType(type: unknown, wanted: string): boolean {
  if (type === wanted) return true;
  if (Array.isArray(type)) return type.includes(wanted);
  return false;
}

/**
 * Find the first object with the given `@type` within a parsed JSON-LD value.
 * Handles single objects, arrays of objects and `@graph` containers.
 */
function findByType(parsed: unknown, wanted: string): Record<string, unknown> | null {
  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      const found = findByType(entry, wanted);
      if (found) return found;
    }
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (matchesType(obj['@type'], wanted)) return obj;
  if (Array.isArray(obj['@graph'])) return findByType(obj['@graph'], wanted);
  return null;
}

function readPosition(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value.trim()))) {
    return Number(value.trim());
  }
  return null;
}

/**
 * Read a breadcrumb `ListItem`'s display name. `item` is usually a plain URL
 * string, but some providers nest `{ item: { name } }` instead of a top-level
 * `name` field — checked first, falling back to the top-level `name`.
 */
function readCrumbName(el: { item?: unknown; name?: unknown }): string | null {
  const item = el.item;
  if (typeof item === 'object' && item !== null) {
    const n = (item as { name?: unknown }).name;
    if (typeof n === 'string' && n.trim() !== '') return n.trim();
  }
  if (typeof el.name === 'string' && el.name.trim() !== '') return el.name.trim();
  return null;
}

/**
 * Reduce a list of candidate category names to a valid `rawCategories` array:
 * trim + collapse internal whitespace, drop non-strings and empties, and
 * dedupe by exact string preserving first-occurrence order. Shared by the
 * JSON-LD breadcrumb extraction below and by the book-club (KSD) parser for
 * its own provider-native category-name list.
 */
export function finalizeRawCategories(names: readonly (string | null | undefined)[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (typeof name !== 'string') continue;
    const normalized = name.replace(/\s+/g, ' ').trim();
    if (normalized === '') continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

/**
 * Extract raw provider-category names (root→leaf) from a JSON-LD
 * `BreadcrumbList` block on a product page. Pure — no IO, never throws.
 *
 * The first crumb (home/store-name) is always dropped unconditionally, and
 * when `title` is passed and it matches the last remaining crumb
 * case-insensitively, that trailing self-referential crumb is dropped too.
 * Returns `[]` when no `BreadcrumbList` is found or none of its entries carry
 * a usable name.
 */
export function extractBreadcrumbs(html: string, title?: string | null): string[] {
  const $ = cheerio.load(html);
  const blocks = $('script[type="application/ld+json"]').toArray();

  let breadcrumbList: Record<string, unknown> | null = null;
  for (const block of blocks) {
    const raw = $(block).contents().text().trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    breadcrumbList = findByType(parsed, 'BreadcrumbList');
    if (breadcrumbList) break;
  }

  if (breadcrumbList === null) return [];

  const itemListElement = breadcrumbList['itemListElement'];
  if (!Array.isArray(itemListElement)) return [];

  const entries: { name: string; position: number | null }[] = [];
  for (const entry of itemListElement) {
    if (typeof entry !== 'object' || entry === null) continue;
    const el = entry as { item?: unknown; name?: unknown; position?: unknown };
    const name = readCrumbName(el);
    if (name === null) continue;
    entries.push({ name, position: readPosition(el.position) });
  }

  const allHavePosition = entries.length > 0 && entries.every((e) => e.position !== null);
  const ordered = allHavePosition
    ? [...entries].sort((a, b) => (a.position as number) - (b.position as number))
    : entries;

  let names = ordered.map((e) => e.name);
  names = names.slice(1);

  if (title != null && names.length > 0) {
    const last = names[names.length - 1]!;
    if (last.trim().toLowerCase() === title.trim().toLowerCase()) {
      names = names.slice(0, -1);
    }
  }

  return finalizeRawCategories(names);
}
