import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  yearMonthSchema,
  dateStringSchema,
  budgetSchema,
  ejecucionSchema,
  partialBudgetSchema,
  partialEjecucionSchema,
  documentoMedioSchema,
  partialDocumentoMedioSchema,
} from '@/lib/schemas';

// ── yearMonthSchema ────────────────────────────────────────────

describe('yearMonthSchema', () => {
  it('accepts valid YYYY-MM', () => {
    expect(yearMonthSchema.parse('2026-01')).toBe('2026-01');
    expect(yearMonthSchema.parse('2024-12')).toBe('2024-12');
    expect(yearMonthSchema.parse('2026-03')).toBe('2026-03');
  });

  it('rejects invalid month (13)', () => {
    expect(() => yearMonthSchema.parse('2026-13')).toThrow();
  });

  it('rejects month zero', () => {
    expect(() => yearMonthSchema.parse('2026-00')).toThrow();
  });

  it('rejects non-numeric input', () => {
    expect(() => yearMonthSchema.parse('abc')).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => yearMonthSchema.parse('')).toThrow();
  });

  it('rejects YYYY-MM-DD format', () => {
    expect(() => yearMonthSchema.parse('2026-01-15')).toThrow();
  });
});

// ── dateStringSchema ────────────────────────────────────────────

describe('dateStringSchema', () => {
  it('accepts valid YYYY-MM-DD', () => {
    expect(dateStringSchema.parse('2026-01-15')).toBe('2026-01-15');
    expect(dateStringSchema.parse('2024-12-01')).toBe('2024-12-01');
    expect(dateStringSchema.parse('2026-03-31')).toBe('2026-03-31');
  });

  it('rejects invalid month (13)', () => {
    expect(() => dateStringSchema.parse('2026-13-01')).toThrow();
  });

  it('rejects day 32', () => {
    expect(() => dateStringSchema.parse('2026-01-32')).toThrow();
  });

  it('rejects day zero', () => {
    expect(() => dateStringSchema.parse('2026-01-00')).toThrow();
  });

  it('rejects non-numeric input', () => {
    expect(() => dateStringSchema.parse('abc')).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => dateStringSchema.parse('')).toThrow();
  });

  it('rejects YYYY-MM format (truncated)', () => {
    expect(() => dateStringSchema.parse('2026-03')).toThrow();
  });

  it('rejects malformed separator', () => {
    expect(() => dateStringSchema.parse('2026/03/15')).toThrow();
  });
});

// ── Helpers for valid objects ───────────────────────────────────

const validBudget = {
  descripcion: 'Compra de materiales',
  projectId: 'proj-001',
  projectName: 'Proyecto Test',
  entityId: 'ent-001',
  entityName: 'Cliente Test',
  entityType: 'client' as const,
  tipo: 'egreso' as const,
  montoPresupuestado: 500000,
  mesPresupuestado: 'Marzo' as const,
  fechaPresupuestado: '2026-03',
  estadoProyecto: 'Activo',
};

const validEjecucion = {
  descripcion: 'Pago realizado',
  projectId: 'proj-001',
  projectName: 'Proyecto Test',
  entityId: 'ent-001',
  entityName: 'Cliente Test',
  entityType: 'client' as const,
  tipo: 'egreso' as const,
  montoEjecutado: 500000,
  fechaEjecutado: '2026-03-15',
};

// ── budgetSchema ────────────────────────────────────────────────

describe('budgetSchema', () => {
  it('accepts a full valid object', () => {
    expect(budgetSchema.parse(validBudget)).toEqual(validBudget);
  });

  it('rejects missing required field (descripcion)', () => {
    const { descripcion: _, ...rest } = validBudget;
    expect(() => budgetSchema.parse(rest)).toThrow();
  });

  it('rejects empty descripcion', () => {
    expect(() => budgetSchema.parse({ ...validBudget, descripcion: '' })).toThrow();
  });

  it('rejects invalid fechaPresupuestado', () => {
    expect(() => budgetSchema.parse({ ...validBudget, fechaPresupuestado: '2026-13' })).toThrow();
    expect(() => budgetSchema.parse({ ...validBudget, fechaPresupuestado: '' })).toThrow();
  });

  it('rejects invalid mesPresupuestado', () => {
    expect(() => budgetSchema.parse({ ...validBudget, mesPresupuestado: '' })).toThrow();
    expect(() => budgetSchema.parse({ ...validBudget, mesPresupuestado: 'InvalidMes' })).toThrow();
  });

  it('accepts optional fields omitted (archivado, totalEjecutado, linkedEjecuciones)', () => {
    const obj = {
      descripcion: 'Test',
      projectId: 'p1',
      projectName: 'P1',
      entityId: 'e1',
      entityName: 'E1',
      entityType: '' as const,
      tipo: 'ingreso' as const,
      montoPresupuestado: 100,
      mesPresupuestado: 'Enero' as const,
      fechaPresupuestado: '2026-01',
      estadoProyecto: 'Activo',
    };
    expect(budgetSchema.parse(obj)).toEqual(obj);
  });

  it('accepts entityType as empty string', () => {
    expect(budgetSchema.parse({ ...validBudget, entityType: '' })).toBeDefined();
  });

  it('rejects invalid tipo', () => {
    expect(() => budgetSchema.parse({ ...validBudget, tipo: 'invalido' })).toThrow();
  });

  it('accepts object with all optional fields present', () => {
    const obj = {
      ...validBudget,
      archivado: false,
      totalEjecutado: 250000,
      linkedEjecuciones: [{ ejecucionId: 'ej-001', monto: 250000 }],
    };
    expect(budgetSchema.parse(obj)).toEqual(obj);
  });
});

// ── ejecucionSchema ─────────────────────────────────────────────

describe('ejecucionSchema', () => {
  it('accepts a full valid object', () => {
    expect(ejecucionSchema.parse(validEjecucion)).toEqual(validEjecucion);
  });

  it('rejects missing required field (descripcion)', () => {
    const { descripcion: _, ...rest } = validEjecucion;
    expect(() => ejecucionSchema.parse(rest)).toThrow();
  });

  it('rejects empty descripcion', () => {
    expect(() => ejecucionSchema.parse({ ...validEjecucion, descripcion: '' })).toThrow();
  });

  it('rejects invalid fechaEjecutado', () => {
    expect(() => ejecucionSchema.parse({ ...validEjecucion, fechaEjecutado: '2026-13-01' })).toThrow();
    expect(() => ejecucionSchema.parse({ ...validEjecucion, fechaEjecutado: '' })).toThrow();
    expect(() => ejecucionSchema.parse({ ...validEjecucion, fechaEjecutado: '2026-01-32' })).toThrow();
  });

  it('accepts optional fields omitted (cuentaId, cuentaName, comprobantes, archivado, _movimientoId, _extractoId)', () => {
    const obj = {
      descripcion: 'Test',
      projectId: 'p1',
      projectName: 'P1',
      entityId: 'e1',
      entityName: 'E1',
      entityType: '' as const,
      tipo: 'ingreso' as const,
      montoEjecutado: 100,
      fechaEjecutado: '2026-01-15',
    };
    expect(ejecucionSchema.parse(obj)).toEqual(obj);
  });

  it('accepts entityType as empty string', () => {
    expect(ejecucionSchema.parse({ ...validEjecucion, entityType: '' })).toBeDefined();
  });

  it('accepts object with all optional fields present', () => {
    const obj = {
      ...validEjecucion,
      cuentaId: 'cta-001',
      cuentaName: 'Banco Test - Corriente',
      comprobantes: [],
      archivado: false,
      _movimientoId: 'mov-001',
      _extractoId: 'ext-001',
    };
    expect(ejecucionSchema.parse(obj)).toEqual(obj);
  });

  it('accepts undefined on optional fields', () => {
    const required = {
      descripcion: 'Test',
      projectId: 'p1',
      projectName: 'P1',
      entityId: 'e1',
      entityName: 'E1',
      entityType: '' as const,
      tipo: 'ingreso' as const,
      montoEjecutado: 100,
      fechaEjecutado: '2026-01-15',
    };
    expect(ejecucionSchema.parse(required)).toBeDefined();
  });
});

// ── Partial schemas ─────────────────────────────────────────────

describe('partialBudgetSchema', () => {
  it('accepts empty object', () => {
    expect(partialBudgetSchema.parse({})).toEqual({});
  });

  it('accepts single field update', () => {
    expect(partialBudgetSchema.parse({ descripcion: 'new desc' })).toEqual({ descripcion: 'new desc' });
  });

  it('rejects invalid date in partial update', () => {
    expect(() => partialBudgetSchema.parse({ fechaPresupuestado: 'bad' })).toThrow();
  });

  it('rejects invalid enum value in partial update', () => {
    expect(() => partialBudgetSchema.parse({ tipo: 'invalido' })).toThrow();
  });
});

describe('partialEjecucionSchema', () => {
  it('accepts empty object', () => {
    expect(partialEjecucionSchema.parse({})).toEqual({});
  });

  it('accepts single field update', () => {
    expect(partialEjecucionSchema.parse({ descripcion: 'new desc' })).toEqual({ descripcion: 'new desc' });
  });

  it('rejects invalid date in partial update', () => {
    expect(() => partialEjecucionSchema.parse({ fechaEjecutado: 'bad' })).toThrow();
  });

  it('rejects invalid enum value in partial update', () => {
    expect(() => partialEjecucionSchema.parse({ tipo: 'invalido' })).toThrow();
  });

  it('accepts _estadoComprobantes on ejecucionSchema', () => {
    const obj = {
      descripcion: 'Test',
      projectId: 'p1',
      projectName: 'P1',
      entityId: 'e1',
      entityName: 'E1',
      entityType: '' as const,
      tipo: 'ingreso' as const,
      montoEjecutado: 100,
      fechaEjecutado: '2026-01-15',
      _estadoComprobantes: 'Completada' as const,
    };
    expect(ejecucionSchema.parse(obj)._estadoComprobantes).toBe('Completada');
  });

  it('rejects invalid _estadoComprobantes value', () => {
    expect(() => ejecucionSchema.parse({
      descripcion: 'Test',
      projectId: 'p1',
      projectName: 'P1',
      entityId: 'e1',
      entityName: 'E1',
      entityType: '' as const,
      tipo: 'ingreso' as const,
      montoEjecutado: 100,
      fechaEjecutado: '2026-01-15',
      _estadoComprobantes: 'Invalido',
    })).toThrow();
  });
});

// ── documentoMedioSchema ──────────────────────────────────────────

describe('documentoMedioSchema', () => {
  const validDoc = {
    id: 'doc-001',
    fileName: 'factura.pdf',
    storagePath: 'c1/documentos/uuid-factura.pdf',
    url: 'https://example.com/factura.pdf',
    size: 1024000,
    mimeType: 'application/pdf',
    status: 'por_clasificar' as const,
    ejecucionIds: [],
    _source: 'inbox-upload' as const,
    uploadedAt: '2026-07-14T00:00:00Z',
    createdBy: 'user-123',
  };

  it('accepts a valid minimal DocumentoMedio', () => {
    expect(documentoMedioSchema.parse(validDoc)).toMatchObject(validDoc);
  });

  it('accepts all optional fields present', () => {
    const doc = {
      ...validDoc,
      status: 'enlazado' as const,
      tipoDocumento: 'factura_venta' as const,
      periodo: '2026-07',
      terceroId: 'ter-001',
      projectId: 'proj-001',
      ejecucionIds: ['ej-001'],
      metadata: {
        proveedorTexto: 'Proveedor SA',
        nit: '900123456-7',
        fechaDocumento: '2026-07-01',
        montoTotal: 1500000,
      },
      updatedAt: '2026-07-14T01:00:00Z',
    };
    expect(documentoMedioSchema.parse(doc)).toMatchObject(doc);
  });

  it('rejects id as empty string', () => {
    expect(() => documentoMedioSchema.parse({ ...validDoc, id: '' })).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() => documentoMedioSchema.parse({ ...validDoc, status: 'invalid' })).toThrow();
  });

  it('rejects invalid mimeType as empty', () => {
    expect(() => documentoMedioSchema.parse({ ...validDoc, mimeType: '' })).toThrow();
  });

  it('rejects negative size', () => {
    expect(() => documentoMedioSchema.parse({ ...validDoc, size: -1 })).toThrow();
  });

  it('rejects invalid periodo format', () => {
    expect(() => documentoMedioSchema.parse({ ...validDoc, periodo: '2026-13' })).toThrow();
    expect(() => documentoMedioSchema.parse({ ...validDoc, periodo: '26-01' })).toThrow();
  });

  it('rejects invalid _source', () => {
    expect(() => documentoMedioSchema.parse({ ...validDoc, _source: 'invalid' })).toThrow();
  });

  it('rejects missing id', () => {
    const { id: _, ...rest } = validDoc;
    expect(() => documentoMedioSchema.parse(rest)).toThrow();
  });
});

describe('partialDocumentoMedioSchema', () => {
  it('accepts empty object', () => {
    expect(partialDocumentoMedioSchema.parse({})).toEqual({});
  });

  it('accepts single field update', () => {
    expect(partialDocumentoMedioSchema.parse({ status: 'enlazado' })).toEqual({ status: 'enlazado' });
  });

  it('rejects invalid status in partial update', () => {
    expect(() => partialDocumentoMedioSchema.parse({ status: 'invalid' })).toThrow();
  });
});
