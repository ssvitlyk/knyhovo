export interface NotificationToggleProps {
  readonly on: boolean;
  readonly disabled?: boolean;
  readonly id: string;
  readonly label: string;
  readonly onChange?: () => void;
}

/**
 * NotificationToggle — the `.np-toggle` switch. Uses a hidden checkbox
 * with role="switch" for accessibility. The label wraps the input for a
 * larger click target; CSS expands the touch area to 44px on mobile.
 */
export function NotificationToggle({
  on,
  disabled = false,
  id,
  label,
  onChange,
}: NotificationToggleProps): React.JSX.Element {
  const cls = [
    'np-toggle',
    on ? 'np-toggle--on' : '',
    disabled ? 'np-toggle--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label className={cls} htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        role="switch"
        aria-checked={on}
        aria-label={label}
        checked={on}
        disabled={disabled}
        onChange={disabled ? () => {} : (onChange ?? (() => {}))}
        className="np-toggle__input"
      />
      <span className="np-toggle__track" aria-hidden="true" />
    </label>
  );
}
