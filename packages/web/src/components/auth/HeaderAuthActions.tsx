import { LoginButton } from './LoginButton';
import { AccountMenu } from './AccountMenu';

export interface HeaderUser {
  readonly email: string;
}

export interface HeaderAuthActionsProps {
  /** The authenticated user, or null when there is no valid session. */
  readonly user: HeaderUser | null;
}

/**
 * HeaderAuthActions — chooses the header's auth control from session state:
 * guest → «Увійти» (opens the login modal); authenticated → AccountMenu.
 * Pure presentational branch (no hooks/IO) so it is trivially testable; the
 * session is resolved by the server-rendered SiteHeader.
 */
export function HeaderAuthActions({ user }: HeaderAuthActionsProps): React.JSX.Element {
  return user != null ? <AccountMenu email={user.email} /> : <LoginButton />;
}
