// Note: \b does not match Cyrillic word boundaries in JS regex without the u+v flags.
// These patterns deliberately omit \b and rely on the keyword specificity.
const VOLUME_NUMBER_RE =
  /(?:книга|том|частина|vol\.?|part)\s*(\d+)/i;

const BUNDLE_RE =
  /(?:набір|комплект|серія\s+книг|bundle|set\s+of|збірник\s+книг)/i;

export function extractVolumeNumber(rawTitle: string): number | null {
  const match = VOLUME_NUMBER_RE.exec(rawTitle);
  if (!match) return null;
  return parseInt(match[1]!, 10);
}

export function isBundle(rawTitle: string): boolean {
  return BUNDLE_RE.test(rawTitle);
}
