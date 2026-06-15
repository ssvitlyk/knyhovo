import { describe, it, expect } from 'vitest';
import { deriveAlertStatus } from '../service.js';
import type { MoneyDto } from '../../dto.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function money(amount: number): MoneyDto {
  return { amount, currency: 'UAH' };
}

const ACTIVE_PERSISTED = { status: 'ACTIVE' as const, targetPriceAmount: 20000 };
const PAUSED_PERSISTED = { status: 'PAUSED' as const, targetPriceAmount: 20000 };
const TRIGGERED_PERSISTED = { status: 'TRIGGERED' as const, targetPriceAmount: 20000 };
const UNAVAILABLE_PERSISTED = { status: 'UNAVAILABLE' as const, targetPriceAmount: 20000 };

// ---------------------------------------------------------------------------
// deriveAlertStatus — exhaustive truth table
// ---------------------------------------------------------------------------

describe('deriveAlertStatus', () => {
  // ── Precedence 1: PAUSED wins over everything ─────────────────────────────

  it('PAUSED × offers > 0 × lowestPrice below target → paused (PAUSED beats triggered)', () => {
    expect(deriveAlertStatus(PAUSED_PERSISTED, money(10000), 1)).toBe('paused');
  });

  it('PAUSED × offers = 0 × lowestPrice null → paused (PAUSED beats unavailable)', () => {
    expect(deriveAlertStatus(PAUSED_PERSISTED, null, 0)).toBe('paused');
  });

  it('PAUSED × offers > 0 × lowestPrice above target → paused', () => {
    expect(deriveAlertStatus(PAUSED_PERSISTED, money(30000), 2)).toBe('paused');
  });

  it('PAUSED × offers = 0 × lowestPrice = null → paused', () => {
    expect(deriveAlertStatus(PAUSED_PERSISTED, null, 0)).toBe('paused');
  });

  // ── Precedence 2: offersCount = 0 → unavailable (when not PAUSED) ─────────

  it('ACTIVE × offers = 0 × lowestPrice null → unavailable', () => {
    expect(deriveAlertStatus(ACTIVE_PERSISTED, null, 0)).toBe('unavailable');
  });

  it('TRIGGERED × offers = 0 × lowestPrice null → unavailable', () => {
    expect(deriveAlertStatus(TRIGGERED_PERSISTED, null, 0)).toBe('unavailable');
  });

  it('UNAVAILABLE × offers = 0 × lowestPrice null → unavailable', () => {
    expect(deriveAlertStatus(UNAVAILABLE_PERSISTED, null, 0)).toBe('unavailable');
  });

  // ── Precedence 3: lowestPrice ≤ target → triggered ───────────────────────

  it('ACTIVE × offers > 0 × lowestPrice strictly below target → triggered', () => {
    expect(deriveAlertStatus(ACTIVE_PERSISTED, money(15000), 1)).toBe('triggered');
  });

  it('ACTIVE × offers > 0 × lowestPrice exactly equals target (boundary) → triggered', () => {
    // Boundary case: lowestPrice.amount === targetPriceAmount
    expect(deriveAlertStatus(ACTIVE_PERSISTED, money(20000), 1)).toBe('triggered');
  });

  it('TRIGGERED × offers > 0 × lowestPrice below target → triggered', () => {
    expect(deriveAlertStatus(TRIGGERED_PERSISTED, money(10000), 3)).toBe('triggered');
  });

  it('UNAVAILABLE × offers > 0 × lowestPrice below target → triggered', () => {
    expect(deriveAlertStatus(UNAVAILABLE_PERSISTED, money(19999), 1)).toBe('triggered');
  });

  // ── Precedence 4: else → active ───────────────────────────────────────────

  it('ACTIVE × offers > 0 × lowestPrice above target → active', () => {
    expect(deriveAlertStatus(ACTIVE_PERSISTED, money(25000), 2)).toBe('active');
  });

  it('ACTIVE × offers > 0 × lowestPrice null → active', () => {
    // offers > 0 but lowestPrice is null (should not happen in practice, but defensive)
    expect(deriveAlertStatus(ACTIVE_PERSISTED, null, 1)).toBe('active');
  });

  it('TRIGGERED × offers > 0 × lowestPrice above target → active', () => {
    expect(deriveAlertStatus(TRIGGERED_PERSISTED, money(99999), 5)).toBe('active');
  });

  it('UNAVAILABLE × offers > 0 × lowestPrice above target → active', () => {
    expect(deriveAlertStatus(UNAVAILABLE_PERSISTED, money(50000), 2)).toBe('active');
  });

  // ── Edge: lowestPrice.amount = target + 1 (just above) → active ──────────

  it('ACTIVE × offers > 0 × lowestPrice one kopika above target → active', () => {
    expect(deriveAlertStatus(ACTIVE_PERSISTED, money(20001), 1)).toBe('active');
  });

  // ── Edge: lowestPrice.amount = target - 1 (just below) → triggered ───────

  it('ACTIVE × offers > 0 × lowestPrice one kopika below target → triggered', () => {
    expect(deriveAlertStatus(ACTIVE_PERSISTED, money(19999), 1)).toBe('triggered');
  });
});
