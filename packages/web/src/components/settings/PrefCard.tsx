import { NotificationToggle } from './NotificationToggle';

export interface PrefCardProps {
  readonly id: string;
  readonly title: string;
  readonly desc: string;
  readonly on: boolean;
  /** Disables the toggle (in-flight save, or unsubscribed). */
  readonly disabled?: boolean;
  /** Dims the whole card (`.np-card--disabled`) — used in the unsubscribed state only. */
  readonly dimmed?: boolean;
  readonly onChange?: () => void;
}

/**
 * PrefCard — a single notification preference: the `.np-card` (title + desc)
 * with its toggle on the right. Shared by the subscribed and unsubscribed
 * states. Port of `PrefCard` from design-import/incoming/np-shared.jsx.
 */
export function PrefCard({
  id,
  title,
  desc,
  on,
  disabled = false,
  dimmed = false,
  onChange,
}: PrefCardProps): React.JSX.Element {
  return (
    <div className={dimmed ? 'np-card np-card--disabled' : 'np-card'}>
      <div className="np-card__info">
        <div className="np-card__title">{title}</div>
        <div className="np-card__desc">{desc}</div>
      </div>
      <NotificationToggle id={id} label={title} on={on} disabled={disabled} onChange={onChange} />
    </div>
  );
}
