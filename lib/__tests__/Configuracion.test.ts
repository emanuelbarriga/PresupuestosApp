import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Firebase deps to prevent module-level side effects ───────────────

vi.mock('@/lib/firebase', () => ({
  app: {},
}));

vi.mock('@/lib/auth', () => ({
  auth: {},
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

// ─── SUT ──────────────────────────────────────────────────────────────────

import { toMillis } from '@/components/Configuracion';

describe('toMillis', () => {
  it('convierte string ISO a timestamp UNIX', () => {
    const result = toMillis('2026-07-06T00:53:15.447Z');
    expect(result).toBe(new Date('2026-07-06T00:53:15.447Z').getTime());
  });

  it('convierte Firestore Timestamp object a timestamp UNIX', () => {
    const ts = { seconds: 1712345678, nanoseconds: 0 };
    const result = toMillis(ts);
    expect(result).toBe(1712345678 * 1000);
  });

  it('retorna 0 para null', () => {
    expect(toMillis(null)).toBe(0);
  });

  it('retorna 0 para undefined', () => {
    expect(toMillis(undefined)).toBe(0);
  });

  it('retorna NaN para valores inválidos que no son parseables', () => {
    const result = toMillis({});
    expect(Number.isNaN(result)).toBe(true);
  });
});
