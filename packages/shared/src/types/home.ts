/**
 * Home Feed Composer — shared shelf-key vocabulary.
 *
 * The single source of truth for the opaque section keys the composed Home feed
 * uses. Both the API (`HOME_LAYOUT`, response DTO, response-mapper) and the web
 * (API client, badge rule, presentation config) type against this union so a
 * key rename is a compile error on both sides instead of a silent, stringly
 * typed break.
 *
 * Presentation copy (title/eyebrow/CTA) intentionally does NOT live here — it
 * stays in the web. This module only fixes the key vocabulary.
 */
export type HomeShelfKey = 'popular' | 'novynky' | 'knyhovyk';

/** All Home shelf keys, for exhaustiveness checks / iteration. */
export const HOME_SHELF_KEYS: readonly HomeShelfKey[] = ['popular', 'novynky', 'knyhovyk'];
