import type { CanonicalBookId } from '@knyhovo/shared';

export type MatchResult =
  | {
      readonly type: 'matched';
      readonly canonicalBookId: CanonicalBookId;
    }
  | {
      readonly type: 'created';
    }
  | {
      readonly type: 'conflict';
      readonly reason: ConflictReason;
    };

export type ConflictReason =
  | 'ISBN_CONFLICT'
  | 'VOLUME_MISMATCH'
  | 'BUNDLE_MISMATCH';
