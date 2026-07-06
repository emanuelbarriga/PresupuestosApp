import { describe, it, expect } from 'vitest';
import { derivarMesAnio } from '@/lib/parsers/periodo';

describe('derivarMesAnio', () => {
  it('deriva mes y año desde una fecha YYYY-MM-DD', () => {
    expect(derivarMesAnio('2026-02-15')).toEqual({ mes: 'Febrero', anio: 2026 });
  });

  it('deriva Diciembre correctamente (mes 12)', () => {
    expect(derivarMesAnio('2025-12-01')).toEqual({ mes: 'Diciembre', anio: 2025 });
  });

  it('devuelve mes vacío y anio null cuando periodoDesde es undefined', () => {
    expect(derivarMesAnio(undefined)).toEqual({ mes: '', anio: null });
  });

  it('devuelve mes vacío y anio null cuando el formato es inválido', () => {
    expect(derivarMesAnio('no-es-una-fecha')).toEqual({ mes: '', anio: null });
  });

  it('devuelve mes vacío y anio null cuando el mes está fuera de rango (13)', () => {
    expect(derivarMesAnio('2026-13-01')).toEqual({ mes: '', anio: null });
  });
});
