/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Compile-time checks for branded ID types.
 * This file must typecheck cleanly — any @ts-expect-error that does NOT produce
 * an error would itself cause a type error, keeping the checks honest.
 */
import type { CanonicalBookId } from '../ids.js';

// A branded type is assignable from a matching cast
const _canonicalId = 'def' as CanonicalBookId;

// Plain string is not directly assignable to a branded type without a cast
// @ts-expect-error plain string is not assignable to CanonicalBookId
const _wrongId4: CanonicalBookId = 'plain-string';

// Declare module to prevent TS "unused" errors on _wrongIdN in strict projects
export {};
