/**
 * Canonical-matching provider validation (diagnostics only — no DB, no writes).
 *
 * Runs controlled, capped scrapes for Laboratory, Knigoland and BookClub, then
 * replays the listings through the SAME `matchOrCreate` logic the production
 * pipeline uses (`packages/api/src/pipeline/run-scrape.ts`), maintaining an
 * in-memory canonical store that grows exactly like `persistListing` would:
 *
 *   - listings with `price === null` never reach `matchOrCreate` (the pipeline
 *     routes them to `markUnavailable`; a brand-new no-price listing is skipped);
 *   - a `created` result appends a synthetic CanonicalBook built from the
 *     listing's own `title` / `author ?? ''` / `isbn ?? null`;
 *   - a `matched` result reuses the existing canonical id.
 *
 * It then computes listing-level metrics and matching diagnostics (ISBN vs fuzzy
 * matches, duplicates, cross-provider ISBN consistency) and writes a JSON report.
 *
 * Usage:  tsx validate-canonical-matching.ts <cap> <outFile>
 *
 * This file imports ONLY from `@knyhovo/scrapers` and `@knyhovo/shared`; it does
 * not touch Prisma. It changes no production logic.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import {
  LaboratoryScraper,
  KnigolandScraper,
  BookClubScraper,
  matchOrCreate,
  normalizeIsbn,
  normalizeTitle,
  normalizeAuthor,
  titleSimilarity,
  authorSimilarity,
} from '@knyhovo/scrapers';
import type {
  ScraperProvider,
  ScraperResult,
  CanonicalBook,
  CanonicalBookId,
  ProviderName,
} from '@knyhovo/shared';

const EBOOK_HINT = /(електронн[аи]\s+книг|е-книг|e-?book|\.epub|\.pdf|\(pdf\)|audio|аудіокниг)/i;

interface ListingMetrics {
  provider: ProviderName;
  scraped: number;
  withIsbn: number;
  withoutIsbn: number;
  withPrice: number;
  nullPrice: number;
  inStock: number;
  outOfStock: number;
  unknownStock: number;
  scrapeErrors: number;
  ebookSuspects: string[]; // titles that look non-paper
  // matching outcomes for THIS provider's listings
  skippedNoPrice: number;
  matchedByIsbn: number;
  matchedByFuzzy: number;
  matchedByExactKey: number;
  createdCanonical: number;
  conflicts: number;
  conflictsByReason: Record<string, number>;
}

interface CanonRec {
  book: CanonicalBook;
  members: { provider: ProviderName; title: string; author: string | null; isbn: string | null; url: string }[];
}

function emptyMetrics(provider: ProviderName): ListingMetrics {
  return {
    provider,
    scraped: 0,
    withIsbn: 0,
    withoutIsbn: 0,
    withPrice: 0,
    nullPrice: 0,
    inStock: 0,
    outOfStock: 0,
    unknownStock: 0,
    scrapeErrors: 0,
    ebookSuspects: [],
    skippedNoPrice: 0,
    matchedByIsbn: 0,
    matchedByFuzzy: 0,
    matchedByExactKey: 0,
    createdCanonical: 0,
    conflicts: 0,
    conflictsByReason: {},
  };
}

async function main(): Promise<void> {
  const cap = Number(process.argv[2] ?? 100);
  const outFile = process.argv[3] ?? `validation-${cap}.json`;
  const delayMs = Number(process.env['VALIDATE_DELAY_MS'] ?? 400);

  console.log(`[validate] cap=${cap} delayMs=${delayMs} out=${outFile}`);

  // Provider order is fixed and recorded: the FIRST provider to see a given book
  // "creates" the canonical; later providers should MATCH it. Order is
  // matching-irrelevant for the ISBN path (commutative on equal normalized ISBN).
  const providers: { name: ProviderName; scraper: ScraperProvider }[] = [
    { name: 'book-club', scraper: new BookClubScraper() },
    { name: 'laboratory', scraper: new LaboratoryScraper() },
    { name: 'knigoland', scraper: new KnigolandScraper() },
  ];

  // Raw scrape cache: scraping is slow (~80s/provider). When a raw cache exists
  // and ANALYZE_ONLY=1, reuse it so the matching analysis can be iterated cheaply.
  const rawFile = `${outFile}.raw.json`;
  const analyzeOnly = process.env['ANALYZE_ONLY'] === '1' && existsSync(rawFile);

  let results: { provider: ProviderName; result: ScraperResult }[];
  if (analyzeOnly) {
    console.log(`[validate] ANALYZE_ONLY: reusing raw cache ${rawFile}`);
    results = JSON.parse(readFileSync(rawFile, 'utf8')) as typeof results;
  } else {
    results = [];
    for (const p of providers) {
      const t0 = Date.now();
      console.log(`[validate] scraping ${p.name} (cap ${cap})...`);
      const result = await p.scraper.scrape({ maxPages: cap, delayMs });
      console.log(
        `[validate]   ${p.name}: ${result.listings.length} listings, ${result.errors.length} errors, ${Date.now() - t0}ms`,
      );
      results.push({ provider: p.name, result });
    }
    writeFileSync(rawFile, JSON.stringify(results, null, 2));
  }

  // ── Listing-level metrics ────────────────────────────────────────────────
  const metricsByProvider = new Map<ProviderName, ListingMetrics>();
  for (const { provider, result } of results) {
    const m = emptyMetrics(provider);
    m.scraped = result.listings.length;
    m.scrapeErrors = result.errors.length;
    for (const l of result.listings) {
      if (l.isbn !== null) m.withIsbn++;
      else m.withoutIsbn++;
      if (l.price !== null) m.withPrice++;
      else m.nullPrice++;
      if (l.availability === 'in-stock') m.inStock++;
      else if (l.availability === 'out-of-stock') m.outOfStock++;
      else m.unknownStock++;
      if (EBOOK_HINT.test(l.title) || EBOOK_HINT.test(l.url)) m.ebookSuspects.push(l.title);
    }
    metricsByProvider.set(provider, m);
  }

  // ── Matching simulation (faithful to run-scrape.ts) ──────────────────────
  const candidates: CanonicalBook[] = [];
  const canonById = new Map<string, CanonRec>();
  let idSeq = 0;

  // Per-listing trace for examples in the report.
  interface Trace {
    provider: ProviderName;
    title: string;
    author: string | null;
    isbn: string | null;
    url: string;
    outcome: 'matched-isbn' | 'matched-fuzzy' | 'matched-exact-key' | 'created' | 'conflict';
    canonicalId?: string;
    conflictReason?: string;
    matchedAgainst?: { title: string; author: string; isbn: string | null; titleSim?: number; authorSim?: number };
  }
  const traces: Trace[] = [];

  for (const { provider, result } of results) {
    const m = metricsByProvider.get(provider)!;
    for (const listing of result.listings) {
      if (listing.price === null) {
        // Mirrors pipeline: never enters matchOrCreate; new no-price listing skipped.
        m.skippedNoPrice++;
        continue;
      }

      const normIsbn = normalizeIsbn(listing.isbn);
      const normTitle = normalizeTitle(listing.title);
      const normAuthor = normalizeAuthor(listing.author ?? '');

      // Snapshot candidate that shares this ISBN BEFORE matching (to classify
      // ISBN-path vs fuzzy/exact-key path without altering production logic).
      let isbnSharer: CanonicalBook | null = null;
      if (normIsbn !== null) {
        for (const c of candidates) {
          if (normalizeIsbn(c.isbn) === normIsbn) {
            isbnSharer = c;
            break;
          }
        }
      }

      const result2 = matchOrCreate(listing, candidates);

      if (result2.type === 'conflict') {
        m.conflicts++;
        m.conflictsByReason[result2.reason] = (m.conflictsByReason[result2.reason] ?? 0) + 1;
        traces.push({
          provider,
          title: listing.title,
          author: listing.author,
          isbn: listing.isbn,
          url: listing.url,
          outcome: 'conflict',
          conflictReason: result2.reason,
        });
        continue;
      }

      if (result2.type === 'matched') {
        const matched = canonById.get(result2.canonicalBookId as string);
        const matchedBook = matched?.book;
        let outcome: Trace['outcome'];
        if (isbnSharer !== null && (matchedBook?.id === isbnSharer.id)) {
          outcome = 'matched-isbn';
          m.matchedByIsbn++;
        } else if (
          matchedBook &&
          normalizeTitle(matchedBook.title) === normTitle &&
          normalizeAuthor(matchedBook.author) === normAuthor
        ) {
          outcome = 'matched-exact-key';
          m.matchedByExactKey++;
        } else {
          outcome = 'matched-fuzzy';
          m.matchedByFuzzy++;
        }
        const tSim = matchedBook ? titleSimilarity(normTitle, normalizeTitle(matchedBook.title)) : undefined;
        const aSim = matchedBook ? authorSimilarity(normAuthor, normalizeAuthor(matchedBook.author)) : undefined;
        traces.push({
          provider,
          title: listing.title,
          author: listing.author,
          isbn: listing.isbn,
          url: listing.url,
          outcome,
          canonicalId: result2.canonicalBookId as string,
          matchedAgainst: matchedBook
            ? { title: matchedBook.title, author: matchedBook.author, isbn: matchedBook.isbn, titleSim: tSim, authorSim: aSim }
            : undefined,
        });
        matched?.members.push({
          provider,
          title: listing.title,
          author: listing.author,
          isbn: listing.isbn,
          url: listing.url,
        });
        continue;
      }

      // created
      const id = `canon-${++idSeq}` as unknown as CanonicalBookId;
      const book: CanonicalBook = {
        id,
        title: listing.title,
        author: listing.author ?? '',
        isbn: listing.isbn ?? null,
        createdAt: new Date().toISOString(),
      };
      candidates.push(book);
      canonById.set(id as string, {
        book,
        members: [{ provider, title: listing.title, author: listing.author, isbn: listing.isbn, url: listing.url }],
      });
      m.createdCanonical++;
      traces.push({
        provider,
        title: listing.title,
        author: listing.author,
        isbn: listing.isbn,
        url: listing.url,
        outcome: 'created',
        canonicalId: id as string,
      });
    }
  }

  // ── Cross-provider ISBN consistency ──────────────────────────────────────
  // For each normalized ISBN seen in ≥2 providers (price!=null path only),
  // confirm every occurrence maps to a single canonical id.
  const isbnToCanon = new Map<string, Map<ProviderName, Set<string>>>();
  for (const rec of canonById.values()) {
    for (const mem of rec.members) {
      const ni = normalizeIsbn(mem.isbn);
      if (ni === null) continue;
      if (!isbnToCanon.has(ni)) isbnToCanon.set(ni, new Map());
      const byProv = isbnToCanon.get(ni)!;
      if (!byProv.has(mem.provider)) byProv.set(mem.provider, new Set());
      byProv.get(mem.provider)!.add(rec.book.id as string);
    }
  }
  const crossProviderIsbns: {
    isbn: string;
    providers: ProviderName[];
    canonicalIds: string[];
    consistent: boolean;
  }[] = [];
  for (const [isbn, byProv] of isbnToCanon) {
    if (byProv.size < 2) continue;
    const canonIds = new Set<string>();
    for (const set of byProv.values()) for (const id of set) canonIds.add(id);
    crossProviderIsbns.push({
      isbn,
      providers: [...byProv.keys()],
      canonicalIds: [...canonIds],
      consistent: canonIds.size === 1,
    });
  }

  // ── Duplicate detection ──────────────────────────────────────────────────
  // (a) ISBN duplicates: same normalized ISBN spread across ≥2 distinct canonicals.
  const isbnDup = new Map<string, string[]>();
  for (const rec of canonById.values()) {
    const ni = normalizeIsbn(rec.book.isbn);
    if (ni === null) continue;
    if (!isbnDup.has(ni)) isbnDup.set(ni, []);
    isbnDup.get(ni)!.push(rec.book.id as string);
  }
  const isbnDuplicates = [...isbnDup.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([isbn, ids]) => ({ isbn, canonicalIds: ids }));

  // (b) Fuzzy duplicate candidates: distinct canonicals, no shared ISBN, but
  //     high title+author similarity — books matching SHOULD have merged.
  const recs = [...canonById.values()];
  const fuzzyDuplicates: {
    a: { title: string; author: string; isbn: string | null };
    b: { title: string; author: string; isbn: string | null };
    titleSim: number;
    authorSim: number;
  }[] = [];
  for (let i = 0; i < recs.length; i++) {
    for (let j = i + 1; j < recs.length; j++) {
      const A = recs[i]!.book;
      const B = recs[j]!.book;
      const ai = normalizeIsbn(A.isbn);
      const bi = normalizeIsbn(B.isbn);
      if (ai !== null && bi !== null && ai === bi) continue; // would be isbn dup
      const tSim = titleSimilarity(normalizeTitle(A.title), normalizeTitle(B.title));
      if (tSim < 0.9) continue;
      const aSim = authorSimilarity(normalizeAuthor(A.author), normalizeAuthor(B.author));
      if (tSim >= 0.92 || (tSim >= 0.9 && aSim >= 0.8)) {
        fuzzyDuplicates.push({
          a: { title: A.title, author: A.author, isbn: A.isbn },
          b: { title: B.title, author: B.author, isbn: B.isbn },
          titleSim: Number(tSim.toFixed(3)),
          authorSim: Number(aSim.toFixed(3)),
        });
      }
    }
  }

  // Correct cross-provider matches (a canonical with members from ≥2 providers).
  const multiProviderCanons = recs
    .filter((r) => new Set(r.members.map((mem) => mem.provider)).size >= 2)
    .map((r) => ({
      canonicalTitle: r.book.title,
      canonicalAuthor: r.book.author,
      isbn: r.book.isbn,
      members: r.members.map((mem) => ({
        provider: mem.provider,
        title: mem.title,
        author: mem.author,
        isbn: mem.isbn,
      })),
    }));

  // ── Matcher-INDEPENDENT ground truth (raw listings) ──────────────────────
  // Group every price!=null listing by normalized ISBN, ignoring matchOrCreate
  // entirely. This is the truth the matcher SHOULD reproduce: how many distinct
  // ISBNs exist, and which are sold by ≥2 providers. Lets us separate "is the
  // data matchable?" from "does the current matcher match it?".
  const rawByIsbn = new Map<
    string,
    { provider: ProviderName; title: string; author: string | null }[]
  >();
  for (const { provider, result } of results) {
    for (const l of result.listings) {
      if (l.price === null) continue;
      const ni = normalizeIsbn(l.isbn);
      if (ni === null) continue;
      if (!rawByIsbn.has(ni)) rawByIsbn.set(ni, []);
      rawByIsbn.get(ni)!.push({ provider, title: l.title, author: l.author });
    }
  }
  const rawCrossProviderSameIsbn = [...rawByIsbn.entries()]
    .filter(([, arr]) => new Set(arr.map((x) => x.provider)).size >= 2)
    .map(([isbn, arr]) => {
      // For each cross-provider pair, how close are title/author? (would the
      // fuzzy fallback have agreed if ISBN matching had not fired?)
      const titles = arr.map((x) => normalizeTitle(x.title));
      const authors = arr.map((x) => normalizeAuthor(x.author ?? ''));
      const titleSim = titles.length >= 2 ? titleSimilarity(titles[0]!, titles[1]!) : 1;
      const authorSim = authors.length >= 2 ? authorSimilarity(authors[0]!, authors[1]!) : 1;
      return {
        isbn,
        providers: [...new Set(arr.map((x) => x.provider))],
        entries: arr,
        titleSim: Number(titleSim.toFixed(3)),
        authorSim: Number(authorSim.toFixed(3)),
      };
    });

  // ── Corrected-matcher estimate (diagnostic only; no production change) ────
  // Replays listings with the SAME logic EXCEPT the ISBN-conflict short-circuit
  // is scoped to title-similar candidates only (i.e. only flag ISBN_CONFLICT
  // when the book otherwise looks like the same title). Quantifies the bug's
  // impact: how many canonicals SHOULD exist, and matched/created counts.
  const correctedCanon: { id: number; title: string; author: string; isbn: string | null }[] = [];
  let correctedMatchedIsbn = 0;
  let correctedMatchedFuzzy = 0;
  let correctedCreated = 0;
  let correctedConflicts = 0;
  let cseq = 0;
  for (const { result } of results) {
    for (const l of result.listings) {
      if (l.price === null) continue;
      const ni = normalizeIsbn(l.isbn);
      const nt = normalizeTitle(l.title);
      const na = normalizeAuthor(l.author ?? '');
      // 1. ISBN exact
      const byIsbn = ni !== null ? correctedCanon.find((c) => normalizeIsbn(c.isbn) === ni) : undefined;
      if (byIsbn) {
        correctedMatchedIsbn++;
        continue;
      }
      // 2. fuzzy (only among candidates NOT ISBN-conflicting on a similar title)
      let best: { id: number } | null = null;
      let bestScore = 0;
      let titleSimilarConflict = false;
      for (const c of correctedCanon) {
        const ct = normalizeTitle(c.title);
        const tSim = titleSimilarity(nt, ct);
        if (tSim < 0.85) continue;
        const ci = normalizeIsbn(c.isbn);
        // scoped conflict: looks like same title but different ISBN → real conflict
        if (ni !== null && ci !== null && ni !== ci && tSim >= 0.92) {
          titleSimilarConflict = true;
          continue;
        }
        const ca = normalizeAuthor(c.author);
        const aSim = na && ca ? authorSimilarity(na, ca) : tSim >= 0.92 ? 0.8 : 0;
        if (aSim < 0.8 && na && ca) continue;
        const score = tSim * 0.65 + aSim * 0.35;
        if (score >= 0.85 && score > bestScore) {
          bestScore = score;
          best = { id: c.id };
        }
      }
      if (best) {
        correctedMatchedFuzzy++;
        continue;
      }
      if (titleSimilarConflict) {
        correctedConflicts++;
        continue;
      }
      correctedCanon.push({ id: ++cseq, title: l.title, author: l.author ?? '', isbn: l.isbn ?? null });
      correctedCreated++;
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    cap,
    delayMs,
    providerOrder: providers.map((p) => p.name),
    totals: {
      totalCanonicals: canonById.size,
      multiProviderCanonicals: multiProviderCanons.length,
      crossProviderSharedIsbns: crossProviderIsbns.length,
      crossProviderConsistent: crossProviderIsbns.filter((c) => c.consistent).length,
      crossProviderInconsistent: crossProviderIsbns.filter((c) => !c.consistent).length,
      isbnDuplicateCanonicals: isbnDuplicates.length,
      fuzzyDuplicateCandidates: fuzzyDuplicates.length,
    },
    groundTruth: {
      distinctIsbns: rawByIsbn.size,
      crossProviderSameIsbn: rawCrossProviderSameIsbn.length,
    },
    correctedMatcherEstimate: {
      note: 'Diagnostic re-implementation (NOT production). Scopes ISBN_CONFLICT to title-similar candidates only.',
      canonicalsCreated: correctedCreated,
      matchedByIsbn: correctedMatchedIsbn,
      matchedByFuzzy: correctedMatchedFuzzy,
      conflicts: correctedConflicts,
    },
    metricsByProvider: [...metricsByProvider.values()].map((m) => ({
      ...m,
      ebookSuspects: m.ebookSuspects.slice(0, 20),
      ebookSuspectCount: m.ebookSuspects.length,
    })),
    crossProviderIsbns,
    rawCrossProviderSameIsbn,
    isbnDuplicates,
    fuzzyDuplicates: fuzzyDuplicates.slice(0, 50),
    multiProviderCanons,
    scrapeErrorsByProvider: results.map((r) => ({
      provider: r.provider,
      errors: r.result.errors.slice(0, 10),
      total: r.result.errors.length,
    })),
    // Keep matched-fuzzy + conflict traces for manual inspection of edge cases.
    fuzzyMatchTraces: traces.filter((t) => t.outcome === 'matched-fuzzy'),
    conflictTraces: traces.filter((t) => t.outcome === 'conflict'),
  };

  writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`\n[validate] wrote ${outFile}`);
  console.log('[validate] totals:', JSON.stringify(report.totals, null, 2));
  console.log('[validate] groundTruth:', JSON.stringify(report.groundTruth, null, 2));
  console.log('[validate] correctedMatcherEstimate:', JSON.stringify(report.correctedMatcherEstimate, null, 2));
  for (const m of report.metricsByProvider) {
    console.log(
      `[validate] ${m.provider}: scraped=${m.scraped} isbn=${m.withIsbn}/${m.scraped} nullPrice=${m.nullPrice} ` +
        `created=${m.createdCanonical} matchedIsbn=${m.matchedByIsbn} matchedFuzzy=${m.matchedByFuzzy} ` +
        `matchedKey=${m.matchedByExactKey} conflicts=${m.conflicts} skippedNoPrice=${m.skippedNoPrice} ebookSuspects=${m.ebookSuspectCount}`,
    );
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
