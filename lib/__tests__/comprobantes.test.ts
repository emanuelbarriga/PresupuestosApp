import { describe, it, expect } from 'vitest';
import { derivarEstadoComprobantes, REQUIRED_COMPROBANTE_TYPES } from '@/lib/comprobantes';
import type { Comprobante } from '@/lib/types';

function makeComprobante(tipo?: string): Comprobante {
  return {
    id: crypto.randomUUID(),
    name: 'test.pdf',
    url: 'https://example.com/test.pdf',
    path: 'path/test.pdf',
    type: 'application/pdf',
    size: 1024,
    uploadedAt: '2026-07-01T00:00:00Z',
    tipo,
  };
}

describe('derivarEstadoComprobantes', () => {
  it('returns Completada when both required types present', () => {
    const comprobantes = [
      makeComprobante('Comprobante de pago'),
      makeComprobante('Cuenta de Cobro'),
    ];
    const result = derivarEstadoComprobantes(comprobantes, REQUIRED_COMPROBANTE_TYPES);
    expect(result).toEqual({ estado: 'Completada' });
  });

  it('returns Falta un comprobante + faltante=falta_cuenta_cobro when only pago present', () => {
    const comprobantes = [
      makeComprobante('Comprobante de pago'),
    ];
    const result = derivarEstadoComprobantes(comprobantes, REQUIRED_COMPROBANTE_TYPES);
    expect(result).toEqual({ estado: 'Falta un comprobante', faltante: 'falta_cuenta_cobro' });
  });

  it('returns Falta un comprobante + faltante=falta_pago when only cuenta de cobro present', () => {
    const comprobantes = [
      makeComprobante('Cuenta de Cobro'),
    ];
    const result = derivarEstadoComprobantes(comprobantes, REQUIRED_COMPROBANTE_TYPES);
    expect(result).toEqual({ estado: 'Falta un comprobante', faltante: 'falta_pago' });
  });

  it('returns Sin comprobantes for empty array', () => {
    const result = derivarEstadoComprobantes([], REQUIRED_COMPROBANTE_TYPES);
    expect(result).toEqual({ estado: 'Sin comprobantes' });
  });

  it('returns Sin comprobantes when only non-required types present', () => {
    const comprobantes = [
      makeComprobante('Factura'),
      makeComprobante('Recibo'),
    ];
    const result = derivarEstadoComprobantes(comprobantes, REQUIRED_COMPROBANTE_TYPES);
    expect(result).toEqual({ estado: 'Sin comprobantes' });
  });

  it('works with default REQUIRED_COMPROBANTE_TYPES when second arg omitted', () => {
    const comprobantes = [
      makeComprobante('Comprobante de pago'),
      makeComprobante('Cuenta de Cobro'),
    ];
    const result = derivarEstadoComprobantes(comprobantes);
    expect(result).toEqual({ estado: 'Completada' });
  });

  it('returns granular faltante when exactly 1 missing, no granularity when 2+ missing', () => {
    // Exactly 1 missing
    const oneMissing = [makeComprobante('Comprobante de pago')];
    const result1 = derivarEstadoComprobantes(oneMissing, REQUIRED_COMPROBANTE_TYPES);
    expect(result1.estado).toBe('Falta un comprobante');
    expect(result1.faltante).toBe('falta_cuenta_cobro');

    // 2+ missing (simulate extended required types)
    const extendedRequired = [
      { name: 'Comprobante de pago', code: 'falta_pago' },
      { name: 'Cuenta de Cobro', code: 'falta_cuenta_cobro' },
      { name: 'Autorización', code: 'falta_autorizacion' },
    ];
    const twoMissing = [makeComprobante('Comprobante de pago')];
    const result2 = derivarEstadoComprobantes(twoMissing, extendedRequired);
    expect(result2.estado).toBe('Falta un comprobante');
    expect(result2.faltante).toBeUndefined();
  });

  it('ignores comprobantes without tipo set', () => {
    const comprobantes = [
      makeComprobante('Comprobante de pago'),
      makeComprobante(undefined), // no tipo
      { ...makeComprobante(), tipo: '' }, // empty tipo
    ];
    const result = derivarEstadoComprobantes(comprobantes, REQUIRED_COMPROBANTE_TYPES);
    expect(result).toEqual({ estado: 'Falta un comprobante', faltante: 'falta_cuenta_cobro' });
  });
});
