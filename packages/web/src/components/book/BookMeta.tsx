export interface BookMetaProps {
  readonly isbn: string | null;
  readonly publisher: string | null;
  readonly language: string | null;
  readonly format: string | null;
  readonly series: string | null;
  readonly publicationYear: number | null;
}

/**
 * BookMeta — "Про видання" metadata grid.
 * Frozen Book Details v1.1: all six fields are always rendered; values the
 * API doesn't provide show the muted «Уточнюємо…» placeholder instead of
 * the row being omitted. Values come from BookDetailsDto's provider-priority
 * selection (book-metadata PRD) and degrade to the placeholder per field.
 */
export function BookMeta({
  isbn,
  publisher,
  language,
  format,
  series,
  publicationYear,
}: BookMetaProps): React.JSX.Element {
  const rows: ReadonlyArray<readonly [string, string | null]> = [
    ['Видавництво', publisher],
    ['ISBN', isbn],
    ['Мова', language],
    ['Формат', format],
    ['Серія', series],
    ['Рік видання', publicationYear !== null ? String(publicationYear) : null],
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
