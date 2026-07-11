import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { BancoomevaParser } from '@/lib/parsers/strategies/bancoomeva';
import { Banco } from '@/lib/types';

function readFixture(name: string): string {
  return readFileSync(resolve(__dirname, '..', '__fixtures__', `${name}.txt`), 'utf-8');
}

describe('BancoomevaParser', () => {
  const parser = new BancoomevaParser();

  it('has the correct banco property', () => {
    expect(parser.banco).toBe('Bancoomeva' as Banco);
  });

  describe('basic parsing of valid rows', () => {
    const text = [
      'Extracto de Cuenta  NOMBRE: TEST  PERIODO  DEL: 01-01-2026  AL: 30-01-2026',
      'FECHA   OFICINA   DESCRIPCION   VALOR DEBITO   VALOR CREDITO   SALDO',
      '01-01-2026   OFICINA UNICENTRO BOGOTAN/DND COBRO CHEQUE  1,500,000.00    9,673,999.80',
      '05-01-2026   OFICINA CALI NORTEN/D TRANSFERENCIA    500,000.00  9,173,999.80',
      '10-01-2026   OFICINA MEDELLIN CENTRON/D ABONO NOMINA       2,000,000.00  11,173,999.80',
    ].join('\n');

    const result = parser.parse(text);

    it('parses 3 transactions', () => {
      expect(result.movimientos).toHaveLength(3);
    });

    it('parses fecha correctly', () => {
      expect(result.movimientos[0].fecha).toBe('2026-01-01');
      expect(result.movimientos[1].fecha).toBe('2026-01-05');
      expect(result.movimientos[2].fecha).toBe('2026-01-10');
    });

    it('correctly unsticks OFICINA from DESCRIPCION', () => {
      // The OFICINA value should be extracted, DESCRIPCION should have the reference
      expect(result.movimientos[0].descripcion).toContain('COBRO CHEQUE');
      // The N/D reference should be part of the description
      expect(result.movimientos[0].descripcion).toMatch(/N\/D/);
    });

    it('parses debito from VALOR DEBITO column', () => {
      expect(result.movimientos[0].debito).toBe(1500000.00);
      expect(result.movimientos[0].credito).toBeUndefined();
    });

    it('parses credito from VALOR CREDITO column', () => {
      expect(result.movimientos[2].credito).toBe(2000000.00);
      expect(result.movimientos[2].debito).toBeUndefined();
    });

    it('parses saldo correctly', () => {
      expect(result.movimientos[0].saldo).toBe(9673999.80);
      expect(result.movimientos[1].saldo).toBe(9173999.80);
      expect(result.movimientos[2].saldo).toBe(11173999.80);
    });

    it('sets ordinal sequentially', () => {
      expect(result.movimientos[0].ordinal).toBe(1);
      expect(result.movimientos[1].ordinal).toBe(2);
      expect(result.movimientos[2].ordinal).toBe(3);
    });
  });

  describe('skip per-page summary blocks', () => {
    it('skips summary lines like SALDO INICIAL, TOTAL DEBITO, etc.', () => {
      const text = [
        'Extracto de Cuenta  PERIODO  DEL: 01-01-2026  AL: 30-01-2026',
        'FECHA   OFICINA   DESCRIPCION   VALOR DEBITO   VALOR CREDITO   SALDO',
        '01-01-2026   OFICINA CENTRON/D TRANSFERENCIA  500,000.00    1,000,000.00',
        'SALDO INICIAL  $ 9,673,999.80',
        'RENDIMIENTOS No  $ 8,490.81',
        'TOTAL DEBITO  $ 78,640,146.41',
        'TOTAL CREDITO  $ 96,227,831.81',
        'SALDO FINAL  $ 27,261,685.20',
      ].join('\n');

      const result = parser.parse(text);
      expect(result.movimientos).toHaveLength(1);
      expect(result.movimientos[0].descripcion).toContain('TRANSFERENCIA');
      // The summary block also carries the real saldoInicial/saldoFinal for the extracto
      expect(result.context.saldoInicial).toBe(9673999.80);
      expect(result.context.saldoFinal).toBe(27261685.20);
    });
  });

  describe('row with only debito or only credito', () => {
    it('handles row with debito but no credito', () => {
      const text = [
        'Extracto de Cuenta  DEL: 01-01-2026  AL: 30-01-2026',
        'FECHA   OFICINA   DESCRIPCION   VALOR DEBITO   VALOR CREDITO   SALDO',
        '15-01-2026   OFICINA CENTRON/D PAGO CHEQUE  3,000,000.00    5,000,000.00',
      ].join('\n');
      const result = parser.parse(text);
      expect(result.movimientos[0].debito).toBe(3000000.00);
      expect(result.movimientos[0].credito).toBeUndefined();
    });
  });

  describe('context extraction', () => {
    it('extracts periodo dates from header', () => {
      const text = [
        'Extracto de Cuenta  NOMBRE: TEST  PERIODO  DEL: 01-01-2026  AL: 30-01-2026',
        'FECHA   OFICINA   DESCRIPCION   VALOR DEBITO   VALOR CREDITO   SALDO',
        '01-01-2026   OFICINA ATRANSFERENCIA  100.00    1,000.00',
      ].join('\n');
      const result = parser.parse(text);
      expect(result.context.periodoDesde).toBe('2026-01-01');
      expect(result.context.periodoHasta).toBe('2026-01-30');
    });
  });

  describe('parse real fixture text', () => {
    it('parses transactions from the real bancoomeva fixture', () => {
      const text = readFixture('bancoomeva');
      const result = parser.parse(text);

      // The real fixture is a dense multi-page extract with ~100 rows
      expect(result.movimientos.length).toBeGreaterThanOrEqual(20);

      // First transaction on the fixture
      const first = result.movimientos[0];
      expect(first.fecha).toBe('2026-01-02');
      expect(first.descripcion).toMatch(/N\/C/);
      expect(first.credito).toBe(58.04);
      expect(first.saldo).toBe(9674057.84);

      // No row should have both debito and credito unset
      for (const mov of result.movimientos) {
        expect(mov.debito !== undefined || mov.credito !== undefined).toBe(true);
      }
    });

    it('extracts saldoInicial and saldoFinal from the real fixture', () => {
      const text = readFixture('bancoomeva');
      const result = parser.parse(text);
      expect(result.context.saldoInicial).toBe(9673999.80);
      expect(result.context.saldoFinal).toBe(27261685.20);
    });
  });

  describe('es-CO number format support', () => {
    it('parses rows with es-CO formatted numbers via parseMonto in context', () => {
      // 2-number rows (una columna vacía). Gap heuristic: small gap = DEBITO,
      // large gap (4+ spaces) = CREDITO (DEBITO column empty).
      const text = [
        'Extracto de Cuenta  DEL: 01-01-2026  AL: 30-01-2026',
        'FECHA   OFICINA   DESCRIPCION   VALOR DEBITO   VALOR CREDITO   SALDO',
        '02-01-2026   OFICINA UNICENTRO BOGOTAN/DND COBRO CHEQUE  1.500.000,00    9.674.057,84',
        '05-01-2026   OFICINA MEDELLIN CENTRON/C ABONO NOMINA       58,04  11.173.999,80',
      ].join('\n');
      const result = parser.parse(text);
      expect(result.movimientos).toHaveLength(2);
      // Debido a es-CO, DEBITO = 1500000
      expect(result.movimientos[0].debito).toBe(1500000.00);
      expect(result.movimientos[0].saldo).toBe(9674057.84);
      // Gap grande = empty DEBITO column, so 58,04 is CREDITO
      expect(result.movimientos[1].credito).toBe(58.04);
      expect(result.movimientos[1].saldo).toBe(11173999.80);
    });
  });
});
