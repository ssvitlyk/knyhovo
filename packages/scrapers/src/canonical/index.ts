export { matchOrCreate } from './match-canonical.js';
export { normalizeText, normalizeTitle, normalizeAuthor } from './normalize.js';
export { normalizeIsbn, toIsbn13 } from './isbn.js';
export { levenshteinDistance, stringSimilarity, titleSimilarity, authorSimilarity } from './similarity.js';
export { extractVolumeNumber, isBundle } from './conflicts.js';
export type { MatchResult, ConflictReason } from './types.js';
