import { Chip } from '@/components/ds/Chip';

/**
 * Frozen sort toolbar. The S8a contract exposes no sort parameter — results are
 * always cheapest-first — so only the backed "Найдешевші спочатку" option is
 * shown (selected, static). The "Найпопулярніші" / "Новинки" chips return once
 * the API gains a sort parameter (an allowed v1.1 extension).
 */
export function SortControls(): React.JSX.Element {
  return (
    <div className="results__sort" role="group" aria-label="Сортування">
      <span className="results__sort-label">Сортування:</span>
      <Chip selected disabled aria-current="true">
        Найдешевші спочатку
      </Chip>
    </div>
  );
}
