export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Uint32Array(b.length + 1);
  const curr = new Uint32Array(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] ?? 0) + 1,
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    prev.set(curr);
  }

  return prev[b.length] ?? 0;
}

export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

function jaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 && tokensB.length === 0) return 1;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

function suffixContainment(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const [shorter, longer] =
    tokensA.length <= tokensB.length
      ? [tokensA, tokensB]
      : [tokensB, tokensA];

  if (shorter.length < 2) return 0;

  const suffix = longer.slice(longer.length - shorter.length);
  if (suffix.every((t, i) => t === shorter[i])) return 0.9;

  const prefix = longer.slice(0, shorter.length);
  if (prefix.every((t, i) => t === shorter[i])) return 0.9;

  return 0;
}

export function titleSimilarity(normA: string, normB: string): number {
  if (normA === normB) return 1;
  const tokensA = normA.split(' ').filter(Boolean);
  const tokensB = normB.split(' ').filter(Boolean);
  return Math.max(
    stringSimilarity(normA, normB),
    jaccardSimilarity(tokensA, tokensB),
    suffixContainment(tokensA, tokensB),
  );
}

export function authorSimilarity(normA: string, normB: string): number {
  return stringSimilarity(normA, normB);
}
