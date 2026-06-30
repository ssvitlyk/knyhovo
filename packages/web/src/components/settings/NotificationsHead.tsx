/**
 * NotificationsHead — the shared `.np-head` block (title + optional subtitle)
 * reused by the loaded panel, the load-error boundary, and the auth-required
 * screen. Presentational only (no hooks) so it composes in both server and
 * client components. The unsubscribed head is bespoke (badge between title and
 * subtitle) and is rendered inline in NotificationsPanel.
 */

/** The frozen page title, shared across every notifications state. */
export const NOTIFICATIONS_TITLE = 'Налаштування сповіщень';
/** The frozen subtitle shown on the loaded + error states. */
export const NOTIFICATIONS_SUBTITLE = 'Керуйте email-сповіщеннями від Knyhovo.';

export function NotificationsHead({ subtitle }: { readonly subtitle?: string }): React.JSX.Element {
  return (
    <div className="np-head">
      <div className="np-head__text">
        <h1 className="np-title">{NOTIFICATIONS_TITLE}</h1>
        {subtitle != null && <p className="np-subtitle">{subtitle}</p>}
      </div>
    </div>
  );
}
