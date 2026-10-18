import { getCookieHeader, getSessionUser } from '@/lib/api/server';
import { ProfilePanel } from '@/components/settings/ProfilePanel';
import { SettingsAuthRequired } from '@/components/settings/SettingsAuthRequired';

/**
 * Profile settings page — server component. Reads the session cookie,
 * fetches the current user from the API, and renders the profile panel or
 * an auth-required notice on 401.
 */
export default async function ProfilePage(): Promise<React.JSX.Element> {
  const cookie = await getCookieHeader();
  const user = await getSessionUser(cookie);
  if (!user) return <SettingsAuthRequired context="profile" returnTo="/settings/profile" />;
  return <ProfilePanel email={user.email} displayName={user.displayName ?? null} />;
}
