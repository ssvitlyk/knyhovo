import { cookies } from 'next/headers';
import { getNotificationPreferences } from '@/lib/api/notifications';
import { NotificationsPanel } from '@/components/settings/NotificationsPanel';
import { SettingsAuthRequired } from '@/components/settings/SettingsAuthRequired';

/**
 * Notification preferences page — server component. Reads the session cookie,
 * fetches preferences from the API, and renders the interactive panel or an
 * auth-required notice on 401.
 */
export default async function NotificationsPage(): Promise<React.JSX.Element> {
  const cookie = (await cookies()).toString();
  const result = await getNotificationPreferences({ cookie });

  if ('unauthorized' in result) {
    return <SettingsAuthRequired />;
  }

  return <NotificationsPanel initial={result} />;
}
