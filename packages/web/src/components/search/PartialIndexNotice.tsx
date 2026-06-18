export interface PartialIndexNoticeProps {
  readonly responded: number;
  readonly total: number;
}

/**
 * W7a partial-coverage notice — a calm informational line rendered above
 * results when the page has store-coverage metadata (i.e. not all stores
 * responded in time). This is optional progressive enhancement: the page
 * mounts this component only when the metadata is present; it never blocks
 * or delays the results themselves.
 */
export function PartialIndexNotice({ responded, total }: PartialIndexNoticeProps): React.JSX.Element {
  return (
    <div className="si-partial" role="status">
      Показано ціни з {responded} з {total} книгарень. Решта тимчасово недоступні.
    </div>
  );
}
