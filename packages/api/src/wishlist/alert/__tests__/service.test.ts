import { describe, it, expect } from 'vitest';
import { deriveAlertState, toLifecycle } from '../service.js';

// ---------------------------------------------------------------------------
// toLifecycle — the persisted column narrows to exactly two values
// ---------------------------------------------------------------------------

describe('toLifecycle', () => {
  it('PAUSED → paused', () => {
    expect(toLifecycle('PAUSED')).toBe('paused');
  });

  it('ACTIVE → active', () => {
    expect(toLifecycle('ACTIVE')).toBe('active');
  });

  it('reads the never-written reserved enum values defensively as active', () => {
    // No code path ever persisted these; they read as `active` until the enum is
    // narrowed by migration.
    expect(toLifecycle('TRIGGERED')).toBe('active');
    expect(toLifecycle('UNAVAILABLE')).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// deriveAlertState — exhaustive truth table over FACTS (no price comparison)
// ---------------------------------------------------------------------------

const NOTIFIED = new Date('2026-07-20T08:00:00.000Z');

describe('deriveAlertState', () => {
  // ── Precedence 1: paused wins over everything ─────────────────────────────

  it('paused × price present × marker set → paused', () => {
    expect(deriveAlertState({ lifecycle: 'paused', lastNotifiedAt: NOTIFIED }, 10000)).toBe(
      'paused',
    );
  });

  it('paused × no canonical price → paused (beats unavailable)', () => {
    expect(deriveAlertState({ lifecycle: 'paused', lastNotifiedAt: null }, null)).toBe('paused');
  });

  // ── Precedence 2: no canonical price → unavailable ────────────────────────

  it('active × no canonical price × no marker → unavailable', () => {
    expect(deriveAlertState({ lifecycle: 'active', lastNotifiedAt: null }, null)).toBe(
      'unavailable',
    );
  });

  it('active × no canonical price × marker set → unavailable (beats reached)', () => {
    expect(deriveAlertState({ lifecycle: 'active', lastNotifiedAt: NOTIFIED }, null)).toBe(
      'unavailable',
    );
  });

  // ── Precedence 3: marker set → reached ───────────────────────────────────

  it('active × price present × marker set → reached', () => {
    expect(deriveAlertState({ lifecycle: 'active', lastNotifiedAt: NOTIFIED }, 30000)).toBe(
      'reached',
    );
  });

  it('reached does not depend on the price relative to anything', () => {
    // The point of the model: `reached` means "we emailed", so even a price far
    // above any plausible threshold still reads as reached while the marker stands.
    expect(deriveAlertState({ lifecycle: 'active', lastNotifiedAt: NOTIFIED }, 999_999)).toBe(
      'reached',
    );
  });

  // ── Precedence 4: default ────────────────────────────────────────────────

  it('active × price present × no marker → armed', () => {
    expect(deriveAlertState({ lifecycle: 'active', lastNotifiedAt: null }, 30000)).toBe('armed');
  });

  it('a cheap price alone never produces reached without a marker', () => {
    // Regression guard for the defect this model removes: the old implementation
    // compared lowestPrice <= target and could claim «Ціль досягнута» for an
    // alert the mailer had never fired on.
    expect(deriveAlertState({ lifecycle: 'active', lastNotifiedAt: null }, 1)).toBe('armed');
  });
});
