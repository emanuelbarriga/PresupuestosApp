import { describe, it, expect } from 'vitest';
import type { Banco } from '@/lib/types';
import type { ParseContext, ParseResult, ExtractoParser } from '@/lib/parsers/types';
import type { MovimientoBancarioInput } from '@/lib/types';

describe('Banco enum', () => {
  it('includes all expected bank variants', () => {
    const bancos: Banco[] = ['Bancolombia', 'Bancoomeva', 'Global66', 'No detectado'];
    expect(bancos).toHaveLength(4);
    expect(bancos).toContain('Bancolombia');
    expect(bancos).toContain('Bancoomeva');
    expect(bancos).toContain('Global66');
    expect(bancos).toContain('No detectado');
  });
});

describe('ParseContext', () => {
  it('constructs with all fields', () => {
    const ctx: ParseContext = {
      banco: 'Bancolombia' as Banco,
      saldoInicial: 1000000,
      saldoFinal: 1500000,
      periodoDesde: '2026-02-01',
      periodoHasta: '2026-02-28',
    };
    expect(ctx.banco).toBe('Bancolombia');
    expect(ctx.saldoInicial).toBe(1000000);
    expect(ctx.saldoFinal).toBe(1500000);
    expect(ctx.periodoDesde).toBe('2026-02-01');
    expect(ctx.periodoHasta).toBe('2026-02-28');
  });

  it('constructs without optional periodo fields', () => {
    const ctx: ParseContext = {
      banco: 'Global66' as Banco,
      saldoInicial: 0,
      saldoFinal: 500000,
    };
    expect(ctx.periodoDesde).toBeUndefined();
    expect(ctx.periodoHasta).toBeUndefined();
  });
});

describe('ParseResult', () => {
  it('contains movimientos and context', () => {
    const mockMovimiento: MovimientoBancarioInput = {
      fecha: '2026-02-03',
      descripcion: 'Test',
      saldo: 1000,
      moneda: 'COP',
      ordinal: 1,
      bancoOrigen: 'Bancolombia' as Banco,
    };

    const result: ParseResult = {
      movimientos: [mockMovimiento],
      context: {
        banco: 'Bancolombia' as Banco,
        saldoInicial: 0,
        saldoFinal: 1000,
      },
    };
    expect(result.movimientos).toHaveLength(1);
    expect(result.movimientos[0].fecha).toBe('2026-02-03');
    expect(result.context.saldoFinal).toBe(1000);
  });

  it('includes optional errores array', () => {
    const result: ParseResult = {
      movimientos: [],
      context: {
        banco: 'No detectado' as Banco,
        saldoInicial: 0,
        saldoFinal: 0,
      },
      errores: ['No se detectó el banco'],
    };
    expect(result.errores).toHaveLength(1);
    expect(result.errores![0]).toBe('No se detectó el banco');
  });

  it('works without errores', () => {
    const result: ParseResult = {
      movimientos: [],
      context: {
        banco: 'Bancoomeva' as Banco,
        saldoInicial: 0,
        saldoFinal: 0,
      },
    };
    expect(result.errores).toBeUndefined();
  });
});

describe('ExtractoParser interface', () => {
  it('defines a banco property', () => {
    const parser: ExtractoParser = {
      banco: 'Bancolombia' as Banco,
      parse: (_texto: string) => ({
        movimientos: [],
        context: { banco: 'Bancolombia' as Banco, saldoInicial: 0, saldoFinal: 0 },
      }),
    };
    expect(parser.banco).toBe('Bancolombia');
  });

  it('parse method returns a ParseResult', () => {
    const parser: ExtractoParser = {
      banco: 'Global66' as Banco,
      parse: (texto: string) => {
        const lines = texto.split('\n');
        return {
          movimientos: lines.length > 0
            ? [{
                fecha: '2026-05-01',
                descripcion: lines[0],
                saldo: 1000,
                moneda: 'COP',
                ordinal: 1,
                bancoOrigen: 'Global66' as Banco,
              }]
            : [],
          context: { banco: 'Global66' as Banco, saldoInicial: 0, saldoFinal: 1000 },
        };
      },
    };
    const result = parser.parse('Pago recibido');
    expect(result.movimientos).toHaveLength(1);
    expect(result.movimientos[0].descripcion).toBe('Pago recibido');
    expect(result.context.banco).toBe('Global66');
  });
});
