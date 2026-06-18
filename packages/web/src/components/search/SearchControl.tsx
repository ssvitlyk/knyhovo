import { Typeahead } from './Typeahead';

/**
 * Search field host. Wraps the W7a {@link Typeahead} combobox (recent searches,
 * debounced suggestions, ISBN detection, keyboard navigation) in the frozen
 * `.results__search` slot. The frozen SearchBar visual is preserved by Typeahead
 * re-using the `.kn-field` markup; navigation stays URL-driven.
 */
export function SearchControl({ initialQuery }: { readonly initialQuery: string }): React.JSX.Element {
  return (
    <div className="results__search">
      <Typeahead initialQuery={initialQuery} />
    </div>
  );
}
