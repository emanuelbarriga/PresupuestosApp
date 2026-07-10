import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Global66Parser } from '@/lib/parsers/strategies/global66';
import { Banco } from '@/lib/types';

function readFixture(name: string): string {
  return readFileSync(resolve(__dirname, '..', '__fixtures__', `${name}.txt`), 'utf-8');
}

describe('Global66Parser', () => {
  const parser = new Global66Parser();

  it('has the correct banco property', () => {
    expect(parser.banco).toBe('Global66' as Banco);
  });

  describe('basic parsing', () => {
    const text = [
      'Movimientos de cuenta en COP  Nombre:   Test  Período consultado:  Desde:   01-May-2026  Hasta:   31-May-2026',
      'Fecha   Descripción   Movimiento   Tarjeta   Débito   Abono   Saldo',
      '2026-05-01 11:58:08   Envío a cuenta bancaria   12214628  $2,208,017.00  $40,830,092.81',
      '2026-05-01 11:58:08   Costo tipo de cambio   0.0  $22,303.00  $40,807,789.81',
      '2026-05-11 13:52:01   Envío a Carlos mario   8116755  $10,930,252.02  $29,134,097.79',
    ].join('\n');

    const result = parser.parse(text);

    it('parses all transactions', () => {
      expect(result.movimientos).toHaveLength(3);
    });

    it('normalizes fecha to YYYY-MM-DD', () => {
      expect(result.movimientos[0].fecha).toBe('2026-05-01');
      expect(result.movimientos[1].fecha).toBe('2026-05-01');
      expect(result.movimientos[2].fecha).toBe('2026-05-11');
    });

    it('preserves horaOriginal', () => {
      expect(result.movimientos[0].horaOriginal).toBe('11:58:08');
      expect(result.movimientos[2].horaOriginal).toBe('13:52:01');
    });

    it('parses descripcion correctly, stripping Movimiento ref', () => {
      expect(result.movimientos[0].descripcion).toBe('Envío a cuenta bancaria');
      expect(result.movimientos[1].descripcion).toBe('Costo tipo de cambio');
      expect(result.movimientos[2].descripcion).toBe('Envío a Carlos mario');
    });

    it('parses debito correctly', () => {
      expect(result.movimientos[0].debito).toBe(2208017.00);
      expect(result.movimientos[0].credito).toBeUndefined();
      expect(result.movimientos[1].debito).toBe(22303.00);
      expect(result.movimientos[1].credito).toBeUndefined();
      expect(result.movimientos[2].debito).toBe(10930252.02);
      expect(result.movimientos[2].credito).toBeUndefined();
    });

    it('parses saldo correctly', () => {
      expect(result.movimientos[0].saldo).toBe(40830092.81);
      expect(result.movimientos[1].saldo).toBe(40807789.81);
      expect(result.movimientos[2].saldo).toBe(29134097.79);
    });

    it('sets ordinal sequentially', () => {
      expect(result.movimientos[0].ordinal).toBe(1);
      expect(result.movimientos[1].ordinal).toBe(2);
      expect(result.movimientos[2].ordinal).toBe(3);
    });
  });

  describe('multi-line amount merge', () => {
    it('merges $amount .decimal -> $amount.decimal', () => {
      const text = [
        'Movimientos de cuenta en COP  Período consultado:  Desde:   01-May-2026  Hasta:   31-May-2026',
        'Fecha   Descripción   Movimiento   Tarjeta   Débito   Abono   Saldo',
        '2026-05-01 11:58:08   Envío   12214628  $2,208,017 .00  $40,830,092.81',
      ].join('\n');
      const result = parser.parse(text);
      expect(result.movimientos[0].debito).toBe(2208017.00);
    });

    it('merges $amount integer continuation ($XX,XXX,XX X.XX -> $XX,XXX,XXX.XX)', () => {
      const text = [
        'Movimientos de cuenta en COP  Período consultado:  Desde:   01-May-2026  Hasta:   31-May-2026',
        'Fecha   Descripción   Movimiento   Tarjeta   Débito   Abono   Saldo',
        '2026-05-11 13:52:01   Envío   8116755  $10,930,25 2.02  $29,134,097.79',
      ].join('\n');
      const result = parser.parse(text);
      expect(result.movimientos[0].debito).toBe(10930252.02);
    });

    it('merges saldo with split amount', () => {
      const text = [
        'Movimientos de cuenta en COP  Período consultado:  Desde:   01-May-2026  Hasta:   31-May-2026',
        'Fecha   Descripción   Movimiento   Tarjeta   Débito   Abono   Saldo',
        '2026-05-01 11:58:08   Costo   0.0  $22,303.00  $40,807,78 9.81',
      ].join('\n');
      const result = parser.parse(text);
      expect(result.movimientos[0].saldo).toBe(40807789.81);
    });

    it('merges debito with .decimal split at end ($X,XXX.X X -> $X,XXX.XX)', () => {
      const text = [
        'Movimientos de cuenta en COP  Período consultado:  Desde:   01-May-2026  Hasta:   31-May-2026',
        'Fecha   Descripción   Movimiento   Tarjeta   Débito   Abono   Saldo',
        '2026-05-01 11:59:55   Envío   12214684  $736,006.0 0  $40,071,783.81',
      ].join('\n');
      const result = parser.parse(text);
      expect(result.movimientos[0].debito).toBe(736006.00);
    });
  });

  describe('row parsing edge cases', () => {
    it('strips Movimiento column value from description', () => {
      const text = [
        'Movimientos de cuenta en COP  Período consultado:  Desde:   01-May-2026  Hasta:   31-May-2026',
        'Fecha   Descripción   Movimiento   Tarjeta   Débito   Abono   Saldo',
        '2026-05-27 12:06:46   Envío a cuenta bancaria   12713869 $19,999,999.94 $3,435,201.86',
      ].join('\n');
      const result = parser.parse(text);
      expect(result.movimientos[0].descripcion).toBe('Envío a cuenta bancaria');
      expect(result.movimientos[0].debito).toBe(19999999.94);
      expect(result.movimientos[0].saldo).toBe(3435201.86);
    });
  });

  describe('context extraction', () => {
    it('extracts periodo from header', () => {
      const text = [
        'Movimientos de cuenta en COP  Período consultado:  Desde:   01-May-2026  Hasta:   31-May-2026',
        'Fecha   Descripción   Movimiento   Tarjeta   Débito   Abono   Saldo',
        '2026-05-01 11:58:08   Test   0.0  $100.00  $1,000.00',
      ].join('\n');
      const result = parser.parse(text);
      expect(result.context.periodoDesde).toBe('2026-05-01');
      expect(result.context.periodoHasta).toBe('2026-05-31');
    });
  });

  describe('parse real fixture text', () => {
    it('parses transactions from global66 fixture', () => {
      const text = `Movimientos de cuenta en COP  Nombre:   Samán estudio s.a.s.  Período consultado:  Desde:   01-May-2026  Hasta:   31-May-2026
Fecha   Descripción   Movimiento   Tarjeta   Débito   Abono   Saldo
2026-05-01 11:58:08   Envío a cuenta bancaria   12214628 $2,208,017 .00 $40,830,09 2.81
2026-05-01 11:58:08   Costo tipo de cambio   0.0   $22,303.00 $40,807,78 9.81
2026-05-01 11:59:55   Envío a cuenta bancaria   12214684 $736,006.0 0 $40,071,78 3.81
2026-05-21 20:51:06   Envío a Claudia marcela   12620076 $3,301,983 .59 $23,459,67 6.68`;

      const result = parser.parse(text);
      expect(result.movimientos.length).toBeGreaterThanOrEqual(4);

      // Check first transaction after merge
      expect(result.movimientos[0].fecha).toBe('2026-05-01');
      expect(result.movimientos[0].horaOriginal).toBe('11:58:08');
      expect(result.movimientos[0].descripcion).toContain('Envío a cuenta bancaria');
      expect(result.movimientos[0].debito).toBe(2208017.00);
      expect(result.movimientos[0].saldo).toBe(40830092.81);

      // Check second transaction
      expect(result.movimientos[1].debito).toBe(22303.00);
      expect(result.movimientos[1].saldo).toBe(40807789.81);
    });

    it('extracts saldoInicial and saldoFinal from "Inicio/Final de período" of the real fixture', () => {
      const text = readFixture('global66');
      const result = parser.parse(text);
      expect(result.context.saldoInicial).toBe(43038109.81);
      expect(result.context.saldoFinal).toBe(3352614.80);
    });
  });

  describe('es-CO number format support', () => {
    it('parses amounts with es-CO format (dot=thousands, comma=decimal)', () => {
      const text = [
        'Movimientos de cuenta en COP  Período consultado:  Desde:   01-May-2026  Hasta:   31-May-2026',
        'Inicio de período:  $43.038.109,81  Final de período:  $3.352.614,80',
        'Fecha   Descripción   Movimiento   Tarjeta   Débito   Abono   Saldo',
        '2026-05-01 11:58:08   Envío a cuenta   12214628  $2.208.017,00  $40.830.092,81',
        '2026-05-01 11:58:08   Costo tipo de cambio   0.0  $22.303,00  $40.807.789,81',
      ].join('\n');
      const result = parser.parse(text);
      expect(result.movimientos).toHaveLength(2);
      expect(result.movimientos[0].debito).toBe(2208017.00);
      expect(result.movimientos[0].saldo).toBe(40830092.81);
      expect(result.movimientos[1].debito).toBe(22303.00);
      expect(result.movimientos[1].saldo).toBe(40807789.81);
      expect(result.context.saldoInicial).toBe(43038109.81);
      expect(result.context.saldoFinal).toBe(3352614.80);
    });
  });
});
