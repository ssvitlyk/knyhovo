import { describe, it, expect } from 'vitest';
import {
  DEFAULT_BATCH_SIZE,
  GENRE_BACKFILL_USAGE,
  parseGenreBackfillArgs,
} from '../genre-backfill-args.js';

describe('parseGenreBackfillArgs', () => {
  it('returns all defaults for an empty argv', () => {
    expect(parseGenreBackfillArgs([])).toEqual({
      dryRun: false,
      batchSize: DEFAULT_BATCH_SIZE,
      cursor: null,
      onlyUnassigned: false,
      clearStale: false,
      report: null,
    });
  });

  it('parses --dry-run', () => {
    expect(parseGenreBackfillArgs(['--dry-run']).dryRun).toBe(true);
  });

  it('parses --only-unassigned', () => {
    expect(parseGenreBackfillArgs(['--only-unassigned']).onlyUnassigned).toBe(true);
  });

  it('parses --clear-stale', () => {
    expect(parseGenreBackfillArgs(['--clear-stale']).clearStale).toBe(true);
  });

  it('parses --batch-size=N', () => {
    expect(parseGenreBackfillArgs(['--batch-size=250']).batchSize).toBe(250);
  });

  it('rejects a non-positive or non-integer batch size', () => {
    for (const bad of ['0', '-5', '2.5', 'abc', '']) {
      expect(() => parseGenreBackfillArgs([`--batch-size=${bad}`])).toThrow(
        /--batch-size must be a positive integer/,
      );
    }
  });

  it('parses --cursor=<bookId>', () => {
    expect(parseGenreBackfillArgs(['--cursor=book-42']).cursor).toBe('book-42');
  });

  it('rejects an empty cursor value', () => {
    expect(() => parseGenreBackfillArgs(['--cursor='])).toThrow(/non-empty canonicalBook id/);
  });

  it('parses bare --report as stdout target', () => {
    expect(parseGenreBackfillArgs(['--report']).report).toEqual({ path: null });
  });

  it('parses --report=path as a file target', () => {
    expect(parseGenreBackfillArgs(['--report=/tmp/genres.txt']).report).toEqual({
      path: '/tmp/genres.txt',
    });
  });

  it('rejects --report= with an empty path', () => {
    expect(() => parseGenreBackfillArgs(['--report='])).toThrow(/non-empty path/);
  });

  it('rejects an unknown argument and includes usage', () => {
    expect(() => parseGenreBackfillArgs(['--dryrun'])).toThrow(/unknown argument "--dryrun"/);
    try {
      parseGenreBackfillArgs(['--nope']);
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).toContain(GENRE_BACKFILL_USAGE);
    }
  });

  it('parses the full PRD flag combination', () => {
    expect(
      parseGenreBackfillArgs([
        '--dry-run',
        '--batch-size=100',
        '--cursor=abc',
        '--only-unassigned',
        '--clear-stale',
        '--report=out.txt',
      ]),
    ).toEqual({
      dryRun: true,
      batchSize: 100,
      cursor: 'abc',
      onlyUnassigned: true,
      clearStale: true,
      report: { path: 'out.txt' },
    });
  });

  it('applies last-one-wins for repeated value flags', () => {
    const args = parseGenreBackfillArgs(['--batch-size=10', '--batch-size=20', '--report', '--report=x']);
    expect(args.batchSize).toBe(20);
    expect(args.report).toEqual({ path: 'x' });
  });
});
