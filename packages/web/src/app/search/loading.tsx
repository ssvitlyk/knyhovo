import { SearchBarSkeleton, SkeletonGrid } from '@/components/search/Skeletons';
import { SortControls } from '@/components/search/SortControls';

/**
 * Route-level loading fallback (frozen loading state): SearchBar skeleton +
 * "Шукаємо найкращі ціни…" + a grid of warm skeleton cards with staggered fade-in.
 */
export default function SearchLoading(): React.JSX.Element {
  return (
    <main className="results">
      <p className="results__eyebrow">ПОШУК · 5 КНИГАРЕНЬ · НАЙНИЖЧІ ЦІНИ</p>
      <div className="results__search">
        <SearchBarSkeleton />
      </div>
      <div className="results__toolbar">
        <p className="results__summary" aria-live="polite">
          Шукаємо найкращі ціни…
        </p>
        <SortControls />
      </div>
      <SkeletonGrid />
    </main>
  );
}
