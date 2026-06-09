import type { UserId } from './ids.js';

/**
 * A registered user who authenticated via Email Magic Link.
 * OAuth and password auth are explicitly out of scope for MVP.
 */
export interface User {
  readonly id: UserId;
  readonly email: string;
  /** ISO 8601 timestamp of account creation. */
  readonly createdAt: string;
}
