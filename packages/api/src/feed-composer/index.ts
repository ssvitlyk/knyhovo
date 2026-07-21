/**
 * Generic Feed Composer (Layer 2) — public entry point.
 *
 * A reusable, domain-independent composition primitive: ranked candidate pools
 * → strict cross-section dedup + soft, policy-driven provider diversification
 * with relaxation → final sections. Consumed by domain builders (Home Builder
 * today; email/push/landing/recommendations later) — the composer never
 * changes to serve a new consumer.
 */
export { compose } from './composer.js';
export { FeedComposerError } from './errors.js';
export type {
  FeedCandidate,
  SectionSpec,
  DiversityPolicy,
  ComposeOptions,
  ComposedSection,
  ComposeResult,
  SectionDiagnostics,
} from './types.js';
