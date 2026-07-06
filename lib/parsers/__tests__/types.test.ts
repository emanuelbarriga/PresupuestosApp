import { describe, it, expect } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import type {
  MovimientoBancarioInput,
  MovimientoBancario,
  ExtractoEstado,
  ExtractoBancario,
  Banco,
} from '@/lib/types';

describe('MovimientoBancarioInput', () => {
  it('constructs with all required fields', () => {
    const input: MovimientoBancarioInput = {
      fecha: '2026-02-03',
      descripcion: 'Transferencia',
      saldo: 1500000,
      moneda: 'COP',
      ordinal: 1,
      bancoOrigen: 'Bancolombia' as Banco,
    };
    expect(input.fecha).toBe('2026-02-03');
    expect(input.descripcion).toBe('Transferencia');
    expect(input.saldo).toBe(1500000);
    expect(input.moneda).toBe('COP');
    expect(input.ordinal).toBe(1);
    expect(input.bancoOrigen).toBe('Bancolombia');
  });

  it('constructs with optional fields', () => {
    const input: MovimientoBancarioInput = {
      fecha: '2026-02-03',
      descripcion: 'Pago nomina',
      referencia: 'REF-001',
      debito: 500000,
      credito: undefined,
      saldo: 1000000,
      moneda: 'COP',
      ordinal: 2,
      bancoOrigen: 'Bancoomeva' as Banco,
      horaOriginal: '14:30:00',
      requiereRevision: true,
      posibleDuplicado: false,
    };
    expect(input.referencia).toBe('REF-001');
    expect(input.debito).toBe(500000);
    expect(input.credito).toBeUndefined();
    expect(input.horaOriginal).toBe('14:30:00');
    expect(input.requiereRevision).toBe(true);
    expect(input.posibleDuplicado).toBe(false);
    // Verify default for optional fields when omitted
    const minimal: MovimientoBancarioInput = {
      fecha: '2026-01-01',
      descripcion: 'test',
      saldo: 0,
      moneda: 'COP',
      ordinal: 1,
      bancoOrigen: 'Global66' as Banco,
    };
    expect(minimal.horaOriginal).toBeUndefined();
    expect(minimal.requiereRevision).toBeUndefined();
    expect(minimal.posibleDuplicado).toBeUndefined();
  });

  it('accepts credito without debito', () => {
    const input: MovimientoBancarioInput = {
      fecha: '2026-02-03',
      descripcion: 'Abono',
      credito: 1000000,
      saldo: 2000000,
      moneda: 'COP',
      ordinal: 3,
      bancoOrigen: 'Bancolombia' as Banco,
    };
    expect(input.credito).toBe(1000000);
    expect(input.debito).toBeUndefined();
  });
});

describe('MovimientoBancario', () => {
  it('extends MovimientoBancarioInput with id and createdAt', () => {
    const mockTimestamp = { seconds: 1700000000, nanoseconds: 0 } as Timestamp;
    const mov: MovimientoBancario = {
      id: 'mov-001',
      fecha: '2026-02-03',
      descripcion: 'Test',
      saldo: 1000,
      moneda: 'COP',
      ordinal: 1,
      bancoOrigen: 'Bancolombia' as Banco,
      createdAt: mockTimestamp,
    };
    expect(mov.id).toBe('mov-001');
    expect(mov.createdAt).toEqual(mockTimestamp);
    expect(mov.fecha).toBe('2026-02-03');
  });
});

describe('ExtractoEstado extensions', () => {
  it('accepts the new Parseando state', () => {
    const estado: ExtractoEstado = 'Parseando';
    expect(estado).toBe('Parseando');
  });

  it('accepts Error de parseo state', () => {
    const estado: ExtractoEstado = 'Error de parseo';
    expect(estado).toBe('Error de parseo');
  });

  it('still accepts existing states', () => {
    const pendiente: ExtractoEstado = 'Pendiente';
    const revision: ExtractoEstado = 'En revisión';
    const conciliado: ExtractoEstado = 'Conciliado';
    const completado: ExtractoEstado = 'Completado';
    expect(pendiente).toBe('Pendiente');
    expect(revision).toBe('En revisión');
    expect(conciliado).toBe('Conciliado');
    expect(completado).toBe('Completado');
  });
});

describe('ExtractoBancario extensions', () => {
  it('accepts totalMovimientosParseados', () => {
    const extracto: ExtractoBancario = {
      id: 'ext-1',
      accountId: 'acc-1',
      mes: 'Enero',
      anio: 2026,
      saldoInicial: 0,
      saldoFinal: 1000,
      estado: 'Parseando',
      uploadedAt: '2026-02-01T00:00:00Z',
      totalMovimientosParseados: 42,
    };
    expect(extracto.totalMovimientosParseados).toBe(42);
    expect(extracto.estado).toBe('Parseando');
  });

  it('accepts errorParseo', () => {
    const extracto: ExtractoBancario = {
      id: 'ext-2',
      accountId: 'acc-1',
      mes: 'Enero',
      anio: 2026,
      saldoInicial: 0,
      saldoFinal: 1000,
      estado: 'Error de parseo',
      uploadedAt: '2026-02-01T00:00:00Z',
      errorParseo: 'PDF corrupto: no se encontraron movimientos',
    };
    expect(extracto.errorParseo).toBe('PDF corrupto: no se encontraron movimientos');
    expect(extracto.estado).toBe('Error de parseo');
  });
});
