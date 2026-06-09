// й (U+0439) decomposes under NFD to и+combining-breve; protect it with a PUA placeholder
// before stripping combining marks, then restore afterward.
const YI_PLACEHOLDER = '';

const COMBINING_MARKS_RE = /\p{M}/gu;
// \b doesn't match Cyrillic boundaries — match keywords directly without word-boundary anchors
const VOLUME_MARKER_RE = /(?:книга|том|частина|vol\.?\s*|part)\s*\d+/gi;
const COSMETIC_EDITION_RE = /\(?(нова\s+)?суперобкладинка\)?/gi;
const DAMAGE_MARKER_RE = /\(?(з\s+пошкодженням|уцінка|брак|уценка)\)?/gi;
// Keep Cyrillic (а-я), Ukrainian extras (і ї є й), Latin (a-z), digits, spaces
const ALLOWED_CHARS_RE = /[^а-яіїєйa-z0-9\s]/g;
const COLLAPSE_WS_RE = /\s+/g;
const YI_PLACEHOLDER_RE = new RegExp(YI_PLACEHOLDER, 'gu');

export function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    // Ukrainian-specific substitutions before NFD (while letters are single codepoints)
    .replace(/ґ/gu, 'г')
    // Standalone "й" (conjunction ≡ "і"): preceded/followed by whitespace or start/end
    .replace(/(?<!\S)й(?!\S)/gu, 'і')
    // Protect remaining word-internal й from NFD decomposition
    .replace(/й/gu, YI_PLACEHOLDER)
    .normalize('NFD')
    .replace(COMBINING_MARKS_RE, '')
    // Restore й
    .replace(YI_PLACEHOLDER_RE, 'й')
    .replace(ALLOWED_CHARS_RE, '')
    .replace(COLLAPSE_WS_RE, ' ')
    .trim();
}

export function normalizeTitle(title: string): string {
  // Strip volume/edition markers on raw title (regex without \b works on Cyrillic)
  const stripped = title
    .replace(VOLUME_MARKER_RE, ' ')
    .replace(COSMETIC_EDITION_RE, ' ')
    .replace(DAMAGE_MARKER_RE, ' ');
  return normalizeText(stripped);
}

export function normalizeAuthor(author: string): string {
  const parts = author.split(/[,;&]/);
  const normalized = parts
    .map((part) => {
      const words = part.trim().split(/\s+/).filter(Boolean);
      return words.sort().join(' ');
    })
    .filter(Boolean)
    .sort()
    .join(',');
  return normalizeText(normalized);
}
