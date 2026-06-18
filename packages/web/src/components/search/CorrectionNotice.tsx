import Link from 'next/link';

export interface CorrectionNoticeProps {
  readonly original: string;
  readonly corrected: string;
}

/**
 * W7a auto-correction notice — shown above results when the search engine
 * substituted a corrected query for the user's original input. Auto-correction
 * is always reversible: the action link re-runs the original query with
 * `exact=1`, which tells the search page to bypass auto-correction entirely.
 */
export function CorrectionNotice({ original, corrected }: CorrectionNoticeProps): React.JSX.Element {
  return (
    <div className="si-notice" role="status">
      Показано результати для «{corrected}».{' '}
      <Link
        className="si-notice__action"
        href={`/search?q=${encodeURIComponent(original)}&exact=1`}
      >
        Натомість шукати «{original}»
      </Link>
    </div>
  );
}
