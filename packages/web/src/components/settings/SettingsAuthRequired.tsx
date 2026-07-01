import { AuthBlock } from '@/components/auth/AuthBlock';

/**
 * SettingsAuthRequired — shown when `GET /api/notifications/preferences` returns
 * 401. Renders the frozen auth-required block inside the settings content area,
 * with a CTA that routes to `/login?returnTo=/settings/notifications`.
 */
export function SettingsAuthRequired(): React.JSX.Element {
  return (
    <div className="np-content">
      <AuthBlock context="settings" returnTo="/settings/notifications" />
    </div>
  );
}
