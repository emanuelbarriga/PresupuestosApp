import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { BancolombiaParser } from '@/lib/parsers/strategies/bancolombia';
import { Banco } from '@/lib/types';

function readFixture(name: string): string {
  return readFileSync(resolve(__dirname, '..', '__fixtures__', `${name}.txt`), 'utf-8');
}

describe('BancolombiaParser', () => {
  const parser = new BancolombiaParser();

  it('has the correct banco property', () => {
    expect(parser.banco).toBe('Bancolombia' as Banco);
  });

  describe('year inference without cross (DESDE=2025-10-01, HASTA=2025-11-30)', () => {
    const text = [
      'ESTADO DE CUENTA  DESDE:   2025/10/01   HASTA:   2025/11/30  CUENTA DE AHORROS  NÚMERO   12345',
      'FECHA   DESCRIPCIÓN   SUCURSAL   DCTO.   VALOR   SALDO',
      '1/10   ABONO INTERESES   AHORROS   500.00   1,000,500.00',
      '15/10   COMPRA EN EXITO   WOW   -150,000.00   850,500.00',
      '30/11   TRANSFERENCIA   CTA   SUC   VIRTUAL   -500,000.00   350,500.00',
    ].join('\n');

    const result = parser.parse(text);

    it('parses all 3 transactions', () => {
      expect(result.movimientos).toHaveLength(3);
    });

    it('infers year from DESDE for all rows', () => {
      expect(result.movimientos[0].fecha).toBe('2025-10-01');
      expect(result.movimientos[1].fecha).toBe('2025-10-15');
      expect(result.movimientos[2].fecha).toBe('2025-11-30');
    });

    it('detects positive VALOR as credito', () => {
      expect(result.movimientos[0].credito).toBe(500.00);
      expect(result.movimientos[0].debito).toBeUndefined();
    });

    it('detects negative VALOR as debito', () => {
      expect(result.movimientos[1].debito).toBe(150000.00);
      expect(result.movimientos[1].credito).toBeUndefined();
      expect(result.movimientos[2].debito).toBe(500000.00);
      expect(result.movimientos[2].credito).toBeUndefined();
    });

    it('parses saldo correctly', () => {
      expect(result.movimientos[0].saldo).toBe(1000500.00);
      expect(result.movimientos[1].saldo).toBe(850500.00);
      expect(result.movimientos[2].saldo).toBe(350500.00);
    });

    it('sets bancoOrigen', () => {
      expect(result.movimientos[0].bancoOrigen).toBe('Bancolombia');
    });

    it('sets moneda default COP', () => {
      expect(result.movimientos[0].moneda).toBe('COP');
    });

    it('sets ordinal sequentially', () => {
      expect(result.movimientos[0].ordinal).toBe(1);
      expect(result.movimientos[1].ordinal).toBe(2);
      expect(result.movimientos[2].ordinal).toBe(3);
    });
  });

  describe('year inference with DIC→ENE cross (DESDE=2025-12-01, HASTA=2026-01-31)', () => {
    const text = [
      'ESTADO DE CUENTA  DESDE:   2025/12/01   HASTA:   2026/01/31  CUENTA CORRIENTE',
      'FECHA   DESCRIPCIÓN   SUCURSAL   DCTO.   VALOR   SALDO',
      '1/12   ABONO NOMINA   EMPRESA   5,000,000.00   10,000,000.00',
      '15/12   COMPRA   EXITO   -200,000.00   9,800,000.00',
      '1/1   ABONO INTERESES   AHORROS   1,500.00   9,801,500.00',
      '15/1   PAGO SERVICIOS   PUBLICOS   -350,000.00   9,451,500.00',
    ].join('\n');

    const result = parser.parse(text);

    it('uses DESDE year for December rows (2025)', () => {
      expect(result.movimientos[0].fecha).toBe('2025-12-01');
      expect(result.movimientos[1].fecha).toBe('2025-12-15');
    });

    it('uses HASTA year for January cross-over rows (2026)', () => {
      expect(result.movimientos[2].fecha).toBe('2026-01-01');
      expect(result.movimientos[3].fecha).toBe('2026-01-15');
    });
  });

  describe('skip junk rows', () => {
    it('skips rows with description "0"', () => {
      const text = [
        'ESTADO DE CUENTA  DESDE:   2026/01/01   HASTA:   2026/01/31',
        'FECHA   DESCRIPCIÓN   SUCURSAL   DCTO.   VALOR   SALDO',
        '2/01   0   0.00   1,000.00',
        '3/01   TRANSFERENCIA   CTA   500.00   1,500.00',
        '4/01   0   0.00   1,500.00',
      ].join('\n');
      const result = parser.parse(text);
      // Only the valid transaction should be kept
      expect(result.movimientos).toHaveLength(1);
      expect(result.movimientos[0].descripcion).toBe('TRANSFERENCIA CTA');
    });

    it('skips rows containing VIGILADO', () => {
      const text = [
        'ESTADO DE CUENTA  DESDE:   2026/01/01   HASTA:   2026/01/31',
        'VIGILADO SUPEFINANCIERA',
        'FECHA   DESCRIPCIÓN   SUCURSAL   DCTO.   VALOR   SALDO',
        '3/01   COMPRA   EXITO   -100.00   900.00',
      ].join('\n');
      const result = parser.parse(text);
      expect(result.movimientos).toHaveLength(1);
    });

    it('skips header/column-header lines', () => {
      const text = [
        'ESTADO DE CUENTA  DESDE:   2026/01/01   HASTA:   2026/01/31',
        'FECHA   DESCRIPCIÓN   SUCURSAL   DCTO.   VALOR   SALDO',
        '3/01   COMPRA   EXITO   -100.00   900.00',
      ].join('\n');
      const result = parser.parse(text);
      expect(result.movimientos).toHaveLength(1);
    });
  });

  describe('description and SUCURSAL handling', () => {
    it('keeps SUCURSAL as part of description', () => {
      const text = [
        'ESTADO DE CUENTA  DESDE:   2026/01/01   HASTA:   2026/01/31',
        'FECHA   DESCRIPCIÓN   SUCURSAL   DCTO.   VALOR   SALDO',
        '5/01   TRANSF INTERNACIONAL   RECIBIDA   25,906,412.00   50,000,000.00',
      ].join('\n');
      const result = parser.parse(text);
      expect(result.movimientos[0].descripcion).toContain('TRANSF INTERNACIONAL');
      expect(result.movimientos[0].descripcion).toContain('RECIBIDA');
    });
  });

  describe('extract context from header', () => {
    it('extracts DESDE and HASTA dates', () => {
      const text = [
        'ESTADO DE CUENTA  DESDE:   2026/01/31   HASTA:   2026/02/28  CUENTA DE AHORROS',
        'FECHA   DESCRIPCIÓN   SUCURSAL   DCTO.   VALOR   SALDO',
        '1/02   TEST   100.00   1,000.00',
      ].join('\n');
      const result = parser.parse(text);
      expect(result.context.periodoDesde).toBe('2026-01-31');
      expect(result.context.periodoHasta).toBe('2026-02-28');
    });
  });

  describe('parse real fixture text', () => {
    it('parses transactions from real bancolombia fixture text', () => {
      const text = `ESTADO DE CUENTA  DESDE:   2026/01/31   HASTA:   2026/02/28  CUENTA DE AHORROS  NÚMERO   82900017677
FECHA   DESCRIPCIÓN   SUCURSAL   DCTO.   VALOR   SALDO
2/02   TRANSF INTERNACIONAL   RECIBIDA   25,906,412.00   25,907,890.29
2/02   ABONO INTERESES   AHORROS   500.73   122,423,693.02
2/02   IMPTO GOBIERNO   4X1000   -2,304.26   122,421,388.76
3/02   ABONO INTERESES   AHORROS   498.89   121,845,821.60
4/02   PAGO PSE NU   Compa|¡a   de   Finan   -1,000,000.00   120,392,156.80`;

      const result = parser.parse(text);
      expect(result.movimientos.length).toBeGreaterThanOrEqual(5);

      // Check first transaction
      expect(result.movimientos[0].fecha).toBe('2026-02-02');
      expect(result.movimientos[0].descripcion).toContain('TRANSF INTERNACIONAL');
      expect(result.movimientos[0].credito).toBe(25906412.00);
      expect(result.movimientos[0].saldo).toBe(25907890.29);

      // Check debit (negative valor)
      expect(result.movimientos[2].debito).toBe(2304.26);
      expect(result.movimientos[2].credito).toBeUndefined();
      expect(result.movimientos[2].descripcion).toContain('IMPTO GOBIERNO');
    });

    it('extracts saldoInicial and saldoFinal from the RESUMEN block of the real fixture', () => {
      const text = readFixture('bancolombia');
      const result = parser.parse(text);
      expect(result.context.saldoInicial).toBe(1478.29);
      expect(result.context.saldoFinal).toBe(70565811.95);
    });
  });
});
