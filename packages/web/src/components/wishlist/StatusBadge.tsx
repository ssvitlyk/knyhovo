import { DynIcon } from '@/components/collections/icons';

export interface StatusBadgeProps {
  /** Stamp label, or `null` to render nothing (the `none` status). */
  readonly label: string | null;
  readonly variant: 'desktop' | 'mobile';
}

/**
 * «Порада Книговика» status stamp — port of the inline stamp markup in
 * `WL21Featured` (`wl22-app.jsx`). Always the `check` icon regardless of
 * status (only the label text changes); server-rendered uk-date via
 * `toLocaleDateString('uk-UA')`. Renders `null` for the `none` status —
 * callers add the `--nostamp` modifier class in that case.
 */
export function StatusBadge({ label, variant }: StatusBadgeProps): React.JSX.Element | null {
  if (label == null) return null;

  const mobile = variant === 'mobile';
  const date = new Date().toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div
      className={mobile ? 'wl21-featm__stamp' : 'wl21-feat__stamp'}
      role="img"
      aria-label={`${label}, ${date}`}
    >
      <em>
        <DynIcon name="check" size={mobile ? 11 : 13} />
        {label}
      </em>
      <small>{date}</small>
    </div>
  );
}
