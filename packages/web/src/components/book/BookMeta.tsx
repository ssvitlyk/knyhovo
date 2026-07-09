/**
 * BookMeta — "Про видання" metadata grid.
 * Frozen Book Details v1.1: all six fields are always rendered; values the
 * API doesn't provide yet show the muted «Уточнюємо…» placeholder instead of
 * the row being omitted. Only ISBN is carried by BookDetailsDto today.
 */
export function BookMeta({ isbn }: { readonly isbn: string | null }): React.JSX.Element {
  const rows: ReadonlyArray<readonly [string, string | null]> = [
    ['Видавництво', null],
    ['ISBN', isbn],
    ['Мова', null],
    ['Формат', null],
    ['Серія', null],
    ['Рік видання', null],
  ];
  return (
    <dl className="bd-meta">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          {value ? <dd>{value}</dd> : <dd className="bd-meta--missing">Уточнюємо…</dd>}
        </div>
      ))}
    </dl>
  );
}
