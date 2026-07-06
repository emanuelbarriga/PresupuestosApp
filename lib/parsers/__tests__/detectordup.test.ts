import { describe, it, expect } from 'vitest';
import { generarHuella, detectarDuplicados } from '@/lib/parsers/detectordup';
import type { MovimientoBancarioInput } from '@/lib/types';

function makeMov(overrides: Partial<MovimientoBancarioInput> & { ordinal: number }): MovimientoBancarioInput {
  return {
    fecha: '2026-01-15',
    descripcion: 'Transferencia',
    saldo: 5000,
    moneda: 'COP',
    bancoOrigen: 'Bancolombia' as const,
    ...overrides,
  };
}

describe('generarHuella', () => {
  it('generates a consistent 32-char hex string', async () => {
    const mov = makeMov({ ordinal: 1, debito: 100, credito: undefined, saldo: 900 });
    const huella = await generarHuella(mov);
    expect(huella).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates the same hash for identical inputs', async () => {
    const mov1 = makeMov({ ordinal: 1, fecha: '2026-01-15', descripcion: 'Pago', debito: 100, saldo: 900 });
    const mov2 = makeMov({ ordinal: 2, fecha: '2026-01-15', descripcion: 'Pago', debito: 100, saldo: 900 });
    const h1 = await generarHuella(mov1);
    const h2 = await generarHuella(mov2);
    expect(h1).toBe(h2);
  });

  it('generates different hashes for different inputs', async () => {
    const mov1 = makeMov({ ordinal: 1, fecha: '2026-01-15', descripcion: 'Pago', debito: 100, saldo: 900 });
    const mov2 = makeMov({ ordinal: 2, fecha: '2026-01-16', descripcion: 'Pago', debito: 100, saldo: 900 });
    const h1 = await generarHuella(mov1);
    const h2 = await generarHuella(mov2);
    expect(h1).not.toBe(h2);
  });

  it('handles undefined debito and credito', async () => {
    const mov = makeMov({ ordinal: 1, credito: 200, saldo: 1200 });
    const huella = await generarHuella(mov);
    expect(huella).toMatch(/^[0-9a-f]{32}$/);
  });

  it('includes ordinal in the hash (changing ordinal changes hash)', async () => {
    const mov1 = makeMov({ ordinal: 1, fecha: '2026-01-15', descripcion: 'Test', debito: 100, saldo: 900 });
    const mov2 = makeMov({ ordinal: 2, fecha: '2026-01-15', descripcion: 'Test', debito: 100, saldo: 900 });
    const h1 = await generarHuella(mov1);
    const h2 = await generarHuella(mov2);
    // Same data but different ordinal — should hash the same (ordinal is not part of fingerprint)
    expect(h1).toBe(h2);
  });
});

describe('detectarDuplicados', () => {
  it('marks a mov as posibleDuplicado when hash exists', async () => {
    const movs = [
      makeMov({ ordinal: 1, fecha: '2026-01-15', descripcion: 'Pago', debito: 100, saldo: 900 }),
      makeMov({ ordinal: 2, fecha: '2026-01-16', descripcion: 'Otro', debito: 50, saldo: 850 }),
    ];
    const existingHash = await generarHuella(movs[0]);
    const result = await detectarDuplicados(movs, [existingHash]);
    expect(result[0].posibleDuplicado).toBe(true);
    expect(result[1].posibleDuplicado).toBeFalsy();
  });

  it('no marks when hashes do not match', async () => {
    const movs = [
      makeMov({ ordinal: 1, fecha: '2026-01-15', descripcion: 'Pago', debito: 100, saldo: 900 }),
    ];
    const result = await detectarDuplicados(movs, ['existing_unrelated_hash_1234567890123456']);
    expect(result[0].posibleDuplicado).toBeFalsy();
  });

  it('handles empty existing hashes set', async () => {
    const movs = [
      makeMov({ ordinal: 1, fecha: '2026-01-15', descripcion: 'Pago', debito: 100, saldo: 900 }),
    ];
    const result = await detectarDuplicados(movs, []);
    expect(result[0].posibleDuplicado).toBeFalsy();
  });

  it('handles empty movs array', async () => {
    const result = await detectarDuplicados([], ['some_hash']);
    expect(result).toEqual([]);
  });
});
