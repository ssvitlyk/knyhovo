import { searchBooks } from '@/lib/api/search';
import { knBookWord } from '@/lib/format';
import { SearchControl } from '@/components/search/SearchControl';
import { SortControls } from '@/components/search/SortControls';
import { ResultsGrid } from '@/components/search/ResultsGrid';
import { Pagination } from '@/components/search/Pagination';
import { EmptyState } from '@/components/search/EmptyState';

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

  return (
    <main className="results">
      <p className="results__eyebrow">ПОШУК · 5 КНИГАРЕНЬ · НАЙНИЖЧІ ЦІНИ</p>
      <h1 className="results__title">
        {query ? (
          <>
            Результати для <em>«{query}»</em>
          </>
        ) : (
          'Пошук книг'
        )}
      </h1>

      <SearchControl initialQuery={query} />

      {query ? await Results({ query, page }) : <EmptyState title="Почніть пошук книг" text="Введіть назву книги, автора або ISBN у поле вище." />}
    </main>
  );
}

/** Fetches and renders the toolbar + results/empty state for a non-empty query. */
async function Results({ query, page }: { query: string; page: number }): Promise<React.JSX.Element> {
  const data = await searchBooks({ q: query, page });
  const isEmpty = data.totalItems === 0;

  return (
    <>
      <div className="results__toolbar">
        <p className="results__summary" aria-live="polite">
          {isEmpty ? 'Нічого не знайдено' : `Знайдено ${data.totalItems} ${knBookWord(data.totalItems)}`}
        </p>
        <SortControls />
      </div>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          <ResultsGrid items={data.items} />
          <Pagination query={query} page={data.page} totalPages={data.totalPages} />
        </>
      )}
    </>
  );
}
