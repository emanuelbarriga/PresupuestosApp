import { describe, it, expect, vi } from 'vitest';
import { reconciliar } from '@/lib/parsers/reconciliador';
import type { MovimientoBancarioInput } from '@/lib/types';

function makeMov(overrides: Partial<MovimientoBancarioInput> & { ordinal: number }): MovimientoBancarioInput {
  return {
    fecha: '2026-01-01',
    descripcion: 'test',
    saldo: 0,
    moneda: 'COP',
    bancoOrigen: 'Bancolombia' as const,
    ...overrides,
  };
}

describe('reconciliar', () => {
  it('reconciles all rows when saldos match', () => {
    const movs: MovimientoBancarioInput[] = [
      makeMov({ ordinal: 1, debito: 100, saldo: 900 }),
      makeMov({ ordinal: 2, credito: 200, saldo: 1100 }),
      makeMov({ ordinal: 3, debito: 50, saldo: 1050 }),
    ];
    const result = reconciliar(movs, 1000);
    expect(result).toHaveLength(3);
    expect(result[0].requiereRevision).toBeFalsy();
    expect(result[1].requiereRevision).toBeFalsy();
    expect(result[2].requiereRevision).toBeFalsy();
  });

  it('marks row as requiereRevision when saldo does not match, and the next row recovers using ITS reported saldo (no cascade)', () => {
    const movs: MovimientoBancarioInput[] = [
      makeMov({ ordinal: 1, debito: 100, saldo: 900 }),   // 1000 - 100 = 900 ✓
      makeMov({ ordinal: 2, credito: 200, saldo: 1300 }), // 900 + 200 = 1100 ≠ 1300 ✗ (flagged)
      makeMov({ ordinal: 3, debito: 50, saldo: 1250 }),   // base = row2's REPORTED 1300 (not the wrong 1100): 1300 - 50 = 1250 ✓
    ];
    const result = reconciliar(movs, 1000);
    expect(result[1].requiereRevision).toBe(true);
    expect(result[0].requiereRevision).toBeFalsy();
    expect(result[2].requiereRevision).toBeFalsy();
  });

  it('marks first row as requiereRevision when it fails, and the second row recovers (no cascade)', () => {
    const movs: MovimientoBancarioInput[] = [
      makeMov({ ordinal: 1, debito: 100, saldo: 800 }),   // 1000 - 100 = 900 ≠ 800 ✗ (flagged)
      makeMov({ ordinal: 2, credito: 200, saldo: 1000 }), // base = row1's REPORTED 800: 800 + 200 = 1000 ✓
    ];
    const result = reconciliar(movs, 1000);
    expect(result[0].requiereRevision).toBe(true);
    expect(result[1].requiereRevision).toBeFalsy();
  });

  it('does NOT cascade a failure across multiple subsequent rows (regression: previous impl used the calculated saldo, not the reported one, causing every following row to fail)', () => {
    const movs: MovimientoBancarioInput[] = [
      makeMov({ ordinal: 1, debito: 100, saldo: 900 }),    // 1000 - 100 = 900 ✓
      makeMov({ ordinal: 2, credito: 500, saldo: 2000 }),  // 900 + 500 = 1400 ≠ 2000 ✗ (flagged — e.g. a row our parser skipped)
      makeMov({ ordinal: 3, debito: 300, saldo: 1700 }),   // base = row2's REPORTED 2000: 2000 - 300 = 1700 ✓ (recovers)
      makeMov({ ordinal: 4, credito: 100, saldo: 1800 }),  // base = row3's REPORTED 1700: 1700 + 100 = 1800 ✓ (stays recovered)
    ];
    const result = reconciliar(movs, 1000);
    expect(result[1].requiereRevision).toBe(true);
    expect(result[0].requiereRevision).toBeFalsy();
    expect(result[2].requiereRevision).toBeFalsy();
    expect(result[3].requiereRevision).toBeFalsy();
  });

  it('uses default tolerance of 0.01', () => {
    const movs: MovimientoBancarioInput[] = [
      makeMov({ ordinal: 1, debito: 100, saldo: 900.005 }),
    ];
    // 1000 - 100 = 900, difference is 0.005 which is within 0.01
    const result = reconciliar(movs, 1000);
    expect(result[0].requiereRevision).toBeFalsy();
  });

  it('uses custom tolerance when provided', () => {
    const movs: MovimientoBancarioInput[] = [
      makeMov({ ordinal: 1, debito: 100, saldo: 899.99 }),
    ];
    // 1000 - 100 = 900, difference is 0.01 which is within 0.02
    const result = reconciliar(movs, 1000, 0.02);
    expect(result[0].requiereRevision).toBeFalsy();
  });

  it('fails when tolerance is exceeded', () => {
    const movs: MovimientoBancarioInput[] = [
      makeMov({ ordinal: 1, debito: 100, saldo: 899.98 }),
    ];
    // 1000 - 100 = 900, difference is 0.02 which exceeds 0.01 default
    const result = reconciliar(movs, 1000);
    expect(result[0].requiereRevision).toBe(true);
  });

  it('handles rows with both debito and credito', () => {
    // This is a theoretical case: a row with both columns populated
    const movs: MovimientoBancarioInput[] = [
      makeMov({ ordinal: 1, debito: 100, credito: 30, saldo: 930 }),
    ];
    // 1000 - 100 + 30 = 930 ✓
    const result = reconciliar(movs, 1000);
    expect(result[0].requiereRevision).toBeFalsy();
  });

  it('returns empty array for empty input', () => {
    const result = reconciliar([], 0);
    expect(result).toEqual([]);
  });

  describe('onProgress callback', () => {
    it('invokes onProgress once per row with (current, total)', () => {
      const movs: MovimientoBancarioInput[] = [
        makeMov({ ordinal: 1, debito: 100, saldo: 900 }),
        makeMov({ ordinal: 2, credito: 200, saldo: 1100 }),
        makeMov({ ordinal: 3, debito: 50, saldo: 1050 }),
      ];
      const onProgress = vi.fn();
      reconciliar(movs, 1000, 0.01, onProgress);

      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3);
      expect(onProgress).toHaveBeenNthCalledWith(2, 2, 3);
      expect(onProgress).toHaveBeenNthCalledWith(3, 3, 3);
    });

    it('does not invoke onProgress for empty input', () => {
      const onProgress = vi.fn();
      reconciliar([], 0, 0.01, onProgress);
      expect(onProgress).not.toHaveBeenCalled();
    });

    it('works without onProgress (optional param, backward compatible)', () => {
      const movs: MovimientoBancarioInput[] = [
        makeMov({ ordinal: 1, debito: 100, saldo: 900 }),
      ];
      expect(() => reconciliar(movs, 1000)).not.toThrow();
    });
  });
});
