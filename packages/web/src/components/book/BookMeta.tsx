/**
 * BookMeta — "Про видання" metadata grid.
 * Renders a definition list with book metadata; fields that aren't available
 * yet show a muted placeholder instead of an empty cell.
 */
export function BookMeta({ isbn }: { readonly isbn: string | null }): React.JSX.Element {
  return (
    <dl className="bd-meta">
      <div>
        <dt>ISBN</dt>
        {isbn ? <dd>{isbn}</dd> : <dd className="bd-meta--missing">Уточнюємо…</dd>}
      </div>
    </dl>
  );
}
