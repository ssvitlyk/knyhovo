/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Compile-time checks for Book, CanonicalBook, and ISBN types.
 */
import type { ISBN, Book, CanonicalBook } from '../book.js';
import type { CanonicalBookId } from '../ids.js';

// ISBN is nullable
const _withIsbn: ISBN = '9786177933105';
const _noIsbn: ISBN = null;

// Book accepts both isbn variants
const _bookWithIsbn: Book = { title: 'Кобзар', author: 'Шевченко', isbn: _withIsbn };
const _bookWithoutIsbn: Book = { title: 'Кобзар', author: 'Шевченко', isbn: null };

// CanonicalBook requires all fields
const _canonical: CanonicalBook = {
  id: 'id-1' as CanonicalBookId,
  title: 'Кобзар',
  author: 'Тарас Шевченко',
  isbn: null,
  createdAt: '2026-06-08T00:00:00.000Z',
};

// CanonicalBook fields are readonly — mutation must fail
// @ts-expect-error cannot assign to readonly property
_canonical.title = 'Other';

// ISBN cannot be undefined — only string or null
// @ts-expect-error undefined is not assignable to ISBN
const _badIsbn: ISBN = undefined;

export {};
