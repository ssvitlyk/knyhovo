import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { me } from '@/lib/api/auth';
import { isSafeReturnTo, safeReturnTo } from '@/lib/returnTo';
import { LoginForm } from '@/components/auth/LoginForm';

/**
 * Dedicated `/login` page — used for auth-required redirects, expired/invalid
 * magic links, direct URL access and bookmarks. Header/footer come from the
 * root layout. If the visitor already has a valid session, redirect them to the
 * (validated) returnTo instead of showing the form.
 */
export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ returnTo?: string }>;
}): Promise<React.JSX.Element> {
  const { returnTo } = await searchParams;
  const safe = isSafeReturnTo(returnTo) ? returnTo : null;

  // Best-effort: if already authenticated, skip the form. Any error (API down,
  // 500) is treated as "not logged in" so the login form still renders.
  // NOTE: redirect() throws NEXT_REDIRECT, so it must run outside the try/catch.
  const cookie = (await cookies()).toString();
  let user = null;
  try {
    user = await me(cookie);
  } catch {
    user = null;
  }
  if (user) redirect(safeReturnTo(safe, '/'));

  return (
    <main className="ml-main">
      <LoginForm returnTo={safe} autoFocus />
    </main>
  );
}
