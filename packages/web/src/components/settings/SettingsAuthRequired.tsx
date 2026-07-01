import { AuthBlock } from '@/components/auth/AuthBlock';
import type { AuthBlockContext } from '@/components/auth/AuthBlock';

export interface SettingsAuthRequiredProps {
  readonly context?: AuthBlockContext;
  readonly returnTo?: string;
}

/**
 * SettingsAuthRequired — shown when a settings page returns 401.
 * Renders the frozen auth-required block inside the settings content area.
 * Defaults to the notifications context so the existing call-site
 * `<SettingsAuthRequired />` is unchanged.
 */
export function SettingsAuthRequired({
  context = 'settings',
  returnTo = '/settings/notifications',
}: SettingsAuthRequiredProps): React.JSX.Element {
  return (
    <div className="np-content">
      <AuthBlock context={context} returnTo={returnTo} />
    </div>
  );
}
