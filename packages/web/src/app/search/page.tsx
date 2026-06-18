import { searchBooks } from '@/lib/api/search';
import { knBookWord } from '@/lib/format';
import { lookupCorrection, type Correction } from '@/lib/search/corrections';
import { findAuthorExactMatch } from '@/lib/search/authorMatch';
import { readPartialIndexMeta } from '@/lib/search/partialIndex';
import { SearchControl } from '@/components/search/SearchControl';
import { SortControls } from '@/components/search/SortControls';
import { ResultsGrid } from '@/components/search/ResultsGrid';
import { Pagination } from '@/components/search/Pagination';
import { EmptyState } from '@/components/search/EmptyState';
import { CorrectionNotice } from '@/components/search/CorrectionNotice';
import { AuthorJump } from '@/components/search/AuthorJump';
import { PartialIndexNotice } from '@/components/search/PartialIndexNotice';

interface SearchPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function parsePage(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export default async function SearchPage({ searchParams }: SearchPageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const query = firstParam(params['q']).trim();
  const page = parsePage(firstParam(params['page']));

  // W7a auto-correction: a curated static typo → corrected query. The `exact=1`
  // flag (set by the reversible "натомість шукати оригінал" link) disables it.
  const exact = firstParam(params['exact']) === '1';
  const correction = exact ? null : lookupCorrection(query);
  const effectiveQuery = correction ? correction.corrected : query;

  return (
    <main className="results">
      <p className="results__eyebrow">ПОШУК · 5 КНИГАРЕНЬ · НАЙНИЖЧІ ЦІНИ</p>
      <h1 className="results__title">
        {effectiveQuery ? (
          <>
            Результати для <em>«{effectiveQuery}»</em>
          </>
        ) : (
          'Пошук книг'
        )}
      </h1>

      <SearchControl initialQuery={query} />

      {query ? (
        await Results({ query: effectiveQuery, page, correction })
      ) : (
        <EmptyState title="Почніть пошук книг" text="Введіть назву книги, автора або ISBN у поле вище." />
      )}
    </main>
  );
}

/** Fetches and renders the toolbar + results/empty state for a non-empty query. */
async function Results({
  query,
  page,
  correction,
}: {
  query: string;
  page: number;
  correction: Correction | null;
}): Promise<React.JSX.Element> {
  const data = await searchBooks({ q: query, page });
  const isEmpty = data.totalItems === 0;

  // Optional progressive enhancement: only renders when the API exposes
  // responded-stores metadata (it does not today → null → nothing rendered).
  const partial = readPartialIndexMeta(data);

  // W7a Author Jump: exact author match derived purely from existing results.
  const authorMatch = isEmpty ? null : findAuthorExactMatch(query, data.items);

  return (
    <>
      {correction ? <CorrectionNotice original={correction.original} corrected={correction.corrected} /> : null}

      <div className="results__toolbar">
        <p className="results__summary" aria-live="polite">
          {isEmpty ? 'Нічого не знайдено' : `Знайдено ${data.totalItems} ${knBookWord(data.totalItems)}`}
        </p>
        <SortControls />
      </div>

      {partial ? <PartialIndexNotice responded={partial.responded} total={partial.total} /> : null}

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {authorMatch ? <AuthorJump author={authorMatch} /> : null}
          <ResultsGrid items={data.items} />
          <Pagination query={query} page={data.page} totalPages={data.totalPages} />
        </>
      )}
    </>
  );
}
