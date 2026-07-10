import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { BancolombiaParser, parseMonto, extractSaldos } from '@/lib/parsers/strategies/bancolombia';
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
    it('skips rows with description "0" and zero value (junk)', () => {
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

    it('keeps rows with "0" description and non-zero value (bank bug)', () => {
      const text = [
        'ESTADO DE CUENTA  DESDE:   2026/01/01   HASTA:   2026/01/31',
        'FECHA   DESCRIPCIÓN   SUCURSAL   DCTO.   VALOR   SALDO',
        '2/01   0   -49,800.00   7,378,435.00',
        '3/01   TRANSFERENCIA   CTA   500.00   7,378,935.00',
      ].join('\n');
      const result = parser.parse(text);
      expect(result.movimientos).toHaveLength(2);
      // "0" row with non-zero value must be kept
      expect(result.movimientos[0].descripcion).toBe('0');
      expect(result.movimientos[0].debito).toBe(49800);
      expect(result.movimientos[1].descripcion).toBe('TRANSFERENCIA CTA');
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

  describe('parseMonto', () => {
    it('parses en-US format (comma as thousands, dot as decimal)', () => {
      expect(parseMonto('25,906,412.00')).toBe(25906412);
    });

    it('parses es-CO format (dot as thousands, comma as decimal)', () => {
      expect(parseMonto('25.906.412,00')).toBe(25906412);
    });

    it('parses negative numbers', () => {
      expect(parseMonto('-1,478.29')).toBe(-1478.29);
    });

    it('parses small numbers without thousand separators', () => {
      expect(parseMonto('500.73')).toBe(500.73);
    });

    it('parses zero', () => {
      expect(parseMonto('0.00')).toBe(0);
    });

    it('handles dollar prefix', () => {
      expect(parseMonto('$ 1,478.29')).toBe(1478.29);
    });
  });

  describe('extractSaldos', () => {
    it('extracts with Y-grouping and en-US numbers', () => {
      const text = [
        'SALDO ANTERIOR $ 1,478.29',
        'TOTAL ABONOS $ 140,961,765.20',
        'TOTAL CARGOS $ 70,397,431.54',
        'SALDO ACTUAL $ 70,565,811.95',
        'FECHA   DESCRIPCIÓN   SUCURSAL   DCTO.   VALOR   SALDO',
      ].join('\n');
      const result = extractSaldos(text);
      expect(result).not.toBeNull();
      expect(result!.saldoInicial).toBe(1478.29);
      expect(result!.saldoFinal).toBe(70565811.95);
    });

    it('extracts with flat mode and 4 dollar signs', () => {
      const text = [
        'SALDO ANTERIOR',
        'TOTAL ABONOS',
        'TOTAL CARGOS',
        'SALDO ACTUAL',
        '$  $  $  $',
        '1,478.29  140,961,765.20  70,397,431.54  70,565,811.95',
        'FECHA   DESCRIPCIÓN   SUCURSAL   DCTO.   VALOR   SALDO',
      ].join('\n');
      const result = extractSaldos(text);
      expect(result).not.toBeNull();
      expect(result!.saldoInicial).toBe(1478.29);
      expect(result!.saldoFinal).toBe(70565811.95);
    });

    it('extracts with Y-grouping and es-CO numbers', () => {
      const text = [
        'SALDO ANTERIOR $ 1.478,29',
        'TOTAL ABONOS $ 140.961.765,20',
        'TOTAL CARGOS $ 70.397.431,54',
        'SALDO ACTUAL $ 70.565.811,95',
        'FECHA   DESCRIPCIÓN   SUCURSAL   DCTO.   VALOR   SALDO',
      ].join('\n');
      const result = extractSaldos(text);
      expect(result).not.toBeNull();
      expect(result!.saldoInicial).toBe(1478.29);
      expect(result!.saldoFinal).toBe(70565811.95);
    });
  });

  describe('columnar extraction', () => {
    it('extracts rows from a columnar page with 4 dates and anchor descriptions', () => {
      const text = [
        'ESTADO DE CUENTA  DESDE:   2026/01/31   HASTA:   2026/02/28  CUENTA DE AHORROS',
        'FECHA   DESCRIPCIÓN   SUCURSAL   DCTO.   VALOR   SALDO',
        '7/02  8/02  8/02  9/02  TRANSFERENCIA   CTA   SUC   VIRTUAL  ABONO INTERESES   AHORROS  IMPTO GOBIERNO   4X1000  CUOTA MANEJO   TRJ   DEB   02   26  -147,342.00  -353,273.87  404.56  -716.00  74,187,742.70  73,834,468.83  73,834,873.39  73,834,157.39',
      ].join('\n');

      const result = parser.parse(text);

      expect(result.movimientos).toHaveLength(4);

      // First row: TRANSFERENCIA
      expect(result.movimientos[0].fecha).toBe('2026-02-07');
      expect(result.movimientos[0].descripcion).toContain('TRANSFERENCIA');
      expect(result.movimientos[0].debito).toBe(147342);
      expect(result.movimientos[0].credito).toBeUndefined();
      expect(result.movimientos[0].saldo).toBe(74187742.70);

      // Second row: ABONO INTERESES
      expect(result.movimientos[1].fecha).toBe('2026-02-08');
      expect(result.movimientos[1].descripcion).toContain('ABONO INTERESES');
      expect(result.movimientos[1].debito).toBe(353273.87);
      expect(result.movimientos[1].credito).toBeUndefined();
      expect(result.movimientos[1].saldo).toBe(73834468.83);

      // Third row: IMPTO GOBIERNO (positive valor = credito)
      expect(result.movimientos[2].fecha).toBe('2026-02-08');
      expect(result.movimientos[2].descripcion).toContain('IMPTO GOBIERNO');
      expect(result.movimientos[2].credito).toBe(404.56);
      expect(result.movimientos[2].debito).toBeUndefined();
      expect(result.movimientos[2].saldo).toBe(73834873.39);

      // Fourth row: CUOTA MANEJO
      expect(result.movimientos[3].fecha).toBe('2026-02-09');
      expect(result.movimientos[3].descripcion).toContain('CUOTA MANEJO');
      expect(result.movimientos[3].debito).toBe(716);
      expect(result.movimientos[3].saldo).toBe(73834157.39);
    });
  });

  describe('mixed page extraction', () => {
    it('processes row-by-row page followed by columnar page, dedup and sort', () => {
      // Page 1: row-by-row (2 rows)   Page 2: columnar (4 rows)
      // After dedup (by fecha+saldo) and sort, should have 6 total rows
      const text = [
        'ESTADO DE CUENTA  DESDE:   2026/01/31   HASTA:   2026/02/28  CUENTA DE AHORROS  NÚMERO   12345',
        'FECHA   DESCRIPCIÓN   SUCURSAL   DCTO.   VALOR   SALDO',
        '2/02   ABONO INTERESES   AHORROS   500.73   122,423,693.02',
        '3/02   IMPTO GOBIERNO   4X1000   -2,304.26   122,421,388.76',
        '',
        'ESTADO DE CUENTA  DESDE:   2026/01/31   HASTA:   2026/02/28  PÁGINA:   2',
        'FECHA   DESCRIPCIÓN   SUCURSAL   DCTO.   VALOR   SALDO',
        '7/02  8/02  8/02  9/02  TRANSFERENCIA   CTA   SUC   VIRTUAL  ABONO INTERESES   AHORROS  IMPTO GOBIERNO   4X1000  CUOTA MANEJO   TRJ   DEB   02   26  -147,342.00  -353,273.87  404.56  -716.00  74,187,742.70  73,834,468.83  73,834,873.39  73,834,157.39',
      ].join('\n');

      const result = parser.parse(text);

      // 2 row-by-row + 4 columnar = 6 total
      expect(result.movimientos).toHaveLength(6);

      // All rows sorted by fecha
      expect(result.movimientos[0].fecha).toBe('2026-02-02');
      expect(result.movimientos[1].fecha).toBe('2026-02-03');
      expect(result.movimientos[2].fecha).toBe('2026-02-07');
      expect(result.movimientos[3].fecha).toBe('2026-02-08');
      expect(result.movimientos[4].fecha).toBe('2026-02-08');
      expect(result.movimientos[5].fecha).toBe('2026-02-09');

      // Ordinals are sequential
      expect(result.movimientos[0].ordinal).toBe(1);
      expect(result.movimientos[2].ordinal).toBe(3);
      expect(result.movimientos[5].ordinal).toBe(6);

      // Columnar rows have correct data
      expect(result.movimientos[2].descripcion).toContain('TRANSFERENCIA');
      expect(result.movimientos[2].saldo).toBe(74187742.70);

      // Row-by-row data preserved
      expect(result.movimientos[0].descripcion).toContain('ABONO INTERESES');
      expect(result.movimientos[0].saldo).toBe(122423693.02);
    });

    it('processes the full real fixture with both row and columnar pages', () => {
      const text = readFixture('bancolombia');
      const result = parser.parse(text);

      // The fixture has 18 row-by-row rows + columnar pages
      // Just verify reasonable total and correct saldo context
      expect(result.movimientos.length).toBeGreaterThan(18);
      expect(result.context.saldoInicial).toBe(1478.29);
      expect(result.context.saldoFinal).toBe(70565811.95);
    });
  });
});
