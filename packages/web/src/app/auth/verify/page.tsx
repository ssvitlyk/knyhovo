import { VerifyClient } from '@/components/auth/VerifyClient';

/**
 * Magic Link verify page. The emailed link lands here (`/auth/verify?token=…`).
 * The token is read server-side and handed to the client component, which
 * performs the verification POST, sets the session, and redirects.
 */
export default async function VerifyPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ token?: string }>;
}): Promise<React.JSX.Element> {
  const { token } = await searchParams;
  return (
    <main className="ml-main">
      <VerifyClient token={token ?? null} />
    </main>
  );
}
