/**
 * Composer-local error type. Kept inside `feed-composer` so the module stays
 * free of any dependency on the API's shared `errors.ts` (which is tied to the
 * HTTP boundary). Mirrors the repo's custom-Error-subclass-with-`code` style.
 */
export class FeedComposerError extends Error {
  readonly code = 'FEED_COMPOSER_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'FeedComposerError';
  }
}
