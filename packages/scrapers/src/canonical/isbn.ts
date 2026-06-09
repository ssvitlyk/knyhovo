function stripIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase();
}

function isbn10Checksum(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += (10 - i) * parseInt(digits[i]!, 10);
  }
  const check = digits[9]!;
  const checkVal = check === 'X' ? 10 : parseInt(check, 10);
  sum += checkVal;
  return sum % 11 === 0;
}

function isbn13Checksum(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]!, 10) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(digits[12]!, 10);
}

export function toIsbn13(isbn10: string): string | null {
  const digits = stripIsbn(isbn10);
  if (digits.length !== 10) return null;
  if (!isbn10Checksum(digits)) return null;

  const base = '978' + digits.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i]!, 10) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check.toString();
}

export function normalizeIsbn(isbn: string | null | undefined): string | null {
  if (isbn == null) return null;
  const digits = stripIsbn(isbn);
  if (digits.length === 10) return toIsbn13(digits);
  if (digits.length === 13) return isbn13Checksum(digits) ? digits : null;
  return null;
}
