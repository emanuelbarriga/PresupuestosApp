import { describe, it, expect } from 'vitest';
import { validateBudgetLinkSum } from '@/lib/validation';

describe('validateBudgetLinkSum', () => {
  it('returns true when links sum equals montoEjecutado', () => {
    expect(validateBudgetLinkSum(50000, [
      { monto: 30000 },
      { monto: 20000 },
    ])).toBe(true);
  });

  it('returns true when difference is within tolerance of 1', () => {
    // diff = 1 → within tolerance
    expect(validateBudgetLinkSum(50000, [
      { monto: 30000 },
      { monto: 19999 },
    ])).toBe(true);
  });

  it('returns false when difference exceeds tolerance of 1', () => {
    // diff = 2 → exceeds tolerance
    expect(validateBudgetLinkSum(50000, [
      { monto: 30000 },
      { monto: 19998 },
    ])).toBe(false);
  });

  it('returns true when links array is empty', () => {
    expect(validateBudgetLinkSum(50000, [])).toBe(true);
  });

  it('handles string monto values', () => {
    expect(validateBudgetLinkSum(50000, [
      { monto: '30000' },
      { monto: '20000' },
    ])).toBe(true);
  });

  it('handles a single link with exact match', () => {
    expect(validateBudgetLinkSum(100000, [
      { monto: 100000 },
    ])).toBe(true);
  });

  it('returns false when sum is significantly higher than montoEjecutado', () => {
    expect(validateBudgetLinkSum(10000, [
      { monto: 15000 },
    ])).toBe(false);
  });

  it('treats missing or invalid monto as 0', () => {
    expect(validateBudgetLinkSum(50000, [
      { monto: 30000 },
      { monto: undefined },
      { monto: null },
    ])).toBe(false); // sum = 30000, diff = 20000
  });
});
