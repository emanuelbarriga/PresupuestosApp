import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// ─── Mock Firebase Admin SDK ────────────────────────────────────────────

const mockSet = vi.fn().mockResolvedValue(undefined);
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

/**
 * Build a mock CollectionReference for the Admin SDK.
 * Supports .get(), .doc(), .add(), .set(), .batch(), and .collection() chaining.
 */
function createColRef(
  getResult: any,
  docCollectionMap?: Record<string, any>,
) {
  const colRef: any = {
    get: vi.fn().mockResolvedValue(getResult),
    add: vi.fn(),
    doc: vi.fn((id: string) => {
      const docRef: any = {
        id,
        set: mockSet,
        get: vi.fn().mockResolvedValue(getResult.docs?.find((d: any) => d.id === id) ?? { id, data: () => ({}), exists: false }),
        collection: vi.fn((subPath: string) => {
          if (docCollectionMap && docCollectionMap[subPath]) {
            return docCollectionMap[subPath];
          }
          return createColRef({ docs: [], forEach: () => {}, size: 0 });
        }),
      };
      return docRef;
    }),
  };
  return colRef;
}

function makeMockSnapshot(docs: Array<{ id: string } & Record<string, unknown>>) {
  return {
    docs: docs.map(({ id, ...rest }) => ({
      id,
      data: () => rest,
      ref: { id, path: `companies/${id}` },
    })),
    forEach: function (fn: (d: any) => void) { this.docs.forEach(fn); },
    size: docs.length,
  };
}

function makeEjecucionSnapshot(ejecuciones: Array<{ id: string } & Record<string, unknown>>) {
  return {
    docs: ejecuciones.map(({ id, ...rest }) => ({
      id,
      data: () => rest,
      ref: { id, path: `companies/c1/ejecuciones/${id}` },
    })),
    forEach: function (fn: (d: any) => void) { this.docs.forEach(fn); },
    size: ejecuciones.length,
  };
}

const mockDb: any = {
  collection: vi.fn(),
  batch: vi.fn(() => {
    const batchSet = vi.fn((ref, data) => mockSet(ref, data));
    return { set: batchSet, commit: mockBatchCommit };
  }),
};

vi.mock('firebase-admin/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => mockDb),
  FieldValue: {
    serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
  },
}));

// ─── Test: migrateLegacyComprobantes (5.2 / 7.8) ────────────────────────

describe('migrateLegacyComprobantes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates DocumentoMedio records from legacy comprobantes', async () => {
    const companiesSnapshot = makeMockSnapshot([{ id: 'c1' }]);
    const ejecucionesSnapshot = makeEjecucionSnapshot([
      {
        id: 'ej-1',
        descripcion: 'Pago proveedor',
        comprobantes: [
          { id: 'c1', name: 'factura.pdf', url: 'https://storage/f1', path: 'c1/ejecuciones/ej-1/f1.pdf', type: 'application/pdf', size: 1024, uploadedAt: '2026-06-01T12:00:00Z', tipo: 'Comprobante de pago' },
          { id: 'c2', name: 'cobro.pdf', url: 'https://storage/f2', path: 'c1/ejecuciones/ej-1/f2.pdf', type: 'application/pdf', size: 2048, uploadedAt: '2026-06-01T12:30:00Z', tipo: 'Cuenta de Cobro' },
        ],
      },
      {
        id: 'ej-2',
        descripcion: 'Sin comprobantes',
        comprobantes: [],
      },
    ]);
    const documentosColRef = createColRef({ docs: [], forEach: () => {}, size: 0 });

    const empresasColRef = createColRef(companiesSnapshot, {
      ejecuciones: createColRef(ejecucionesSnapshot),
      documentos: documentosColRef,
    });

    mockDb.collection.mockImplementation((path: string) => {
      // Top-level companies collection
      if (path === 'companies') return empresasColRef;
      // Handle companies/c1/ejecuciones (from .doc().collection())
      // This won't be called if .doc().collection() is used
      return createColRef({ docs: [], forEach: () => {}, size: 0 });
    });

    const { migrateLegacyComprobantes } = await import('@/scripts/migrate-legacy-comprobantes');
    const result = await migrateLegacyComprobantes(mockDb);

    expect(result.migrated).toBe(2);
    expect(result.companies).toBe(1);
    expect(result.errors).toEqual([]);

    // Verify first documento: comprobante_egreso mapping
    const firstDoc = (mockSet as Mock).mock.calls[0][1];
    expect(firstDoc.fileName).toBe('factura.pdf');
    expect(firstDoc.tipoDocumento).toBe('comprobante_egreso');
    expect(firstDoc.status).toBe('enlazado');
    expect(firstDoc._source).toBe('migration');
    expect(firstDoc.ejecucionIds).toEqual(['ej-1']);

    // Verify second documento: comprobante_ingreso mapping
    const secondDoc = (mockSet as Mock).mock.calls[1][1];
    expect(secondDoc.fileName).toBe('cobro.pdf');
    expect(secondDoc.tipoDocumento).toBe('comprobante_ingreso');
    expect(secondDoc.ejecucionIds).toEqual(['ej-1']);
  });

  it('handles unknown legacy tipo by mapping to "otro"', async () => {
    const companiesSnapshot = makeMockSnapshot([{ id: 'c1' }]);
    const ejecucionesSnapshot = makeEjecucionSnapshot([
      {
        id: 'ej-1',
        comprobantes: [
          { id: 'c1', name: 'raro.pdf', url: 'https://storage/r', path: 'c1/ejecuciones/ej-1/r.pdf', type: 'application/pdf', size: 500, uploadedAt: '2026-06-01T12:00:00Z', tipo: 'Factura de venta' },
        ],
      },
    ]);
    const documentosColRef = createColRef({ docs: [], forEach: () => {}, size: 0 });

    mockDb.collection.mockImplementation((path: string) => {
      if (path === 'companies') {
        return createColRef(companiesSnapshot, {
          ejecuciones: createColRef(ejecucionesSnapshot),
          documentos: documentosColRef,
        });
      }
      return createColRef({ docs: [], forEach: () => {}, size: 0 });
    });

    const { migrateLegacyComprobantes } = await import('@/scripts/migrate-legacy-comprobantes');
    const result = await migrateLegacyComprobantes(mockDb);

    expect(result.migrated).toBe(1);
    const doc = (mockSet as Mock).mock.calls[0][1];
    expect(doc.tipoDocumento).toBe('otro');
  });

  it('handles comprobantes with no tipo field gracefully', async () => {
    const companiesSnapshot = makeMockSnapshot([{ id: 'c1' }]);
    const ejecucionesSnapshot = makeEjecucionSnapshot([
      {
        id: 'ej-1',
        comprobantes: [
          { id: 'c1', name: 'sin-tipo.pdf', url: 'https://storage/st', path: 'c1/ejecuciones/ej-1/st.pdf', type: 'application/pdf', size: 300, uploadedAt: '2026-06-01T12:00:00Z' },
        ],
      },
    ]);
    const documentosColRef = createColRef({ docs: [], forEach: () => {}, size: 0 });

    mockDb.collection.mockImplementation((path: string) => {
      if (path === 'companies') {
        return createColRef(companiesSnapshot, {
          ejecuciones: createColRef(ejecucionesSnapshot),
          documentos: documentosColRef,
        });
      }
      return createColRef({ docs: [], forEach: () => {}, size: 0 });
    });

    const { migrateLegacyComprobantes } = await import('@/scripts/migrate-legacy-comprobantes');
    const result = await migrateLegacyComprobantes(mockDb);

    expect(result.migrated).toBe(1);
    const doc = (mockSet as Mock).mock.calls[0][1];
    expect(doc.tipoDocumento).toBeUndefined();
  });

  it('handles ejecucion with no comprobantes field gracefully', async () => {
    const companiesSnapshot = makeMockSnapshot([{ id: 'c1' }]);
    const ejecucionesSnapshot = makeEjecucionSnapshot([
      { id: 'ej-1', descripcion: 'Legacy', montoEjecutado: 1000 },
    ]);
    const documentosColRef = createColRef({ docs: [], forEach: () => {}, size: 0 });

    mockDb.collection.mockImplementation((path: string) => {
      if (path === 'companies') {
        return createColRef(companiesSnapshot, {
          ejecuciones: createColRef(ejecucionesSnapshot),
          documentos: documentosColRef,
        });
      }
      return createColRef({ docs: [], forEach: () => {}, size: 0 });
    });

    const { migrateLegacyComprobantes } = await import('@/scripts/migrate-legacy-comprobantes');
    const result = await migrateLegacyComprobantes(mockDb);

    expect(result.migrated).toBe(0);
    expect(result.errors).toEqual([]);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('collects errors from individual ejecucion processing', async () => {
    // Mock: company c1 fails on get, c2 succeeds with no ejecuciones
    const errMessage = 'Firestore unavailable';
    const companiesSnapshot = makeMockSnapshot([{ id: 'c1' }, { id: 'c2' }]);

    const c1DocRef: any = {
      id: 'c1',
      collection: vi.fn(() => ({
        get: vi.fn().mockRejectedValue(new Error(errMessage)),
      })),
    };

    const c2EjecucionesSnapshot = makeEjecucionSnapshot([]);
    const c2DocRef: any = {
      id: 'c2',
      collection: vi.fn((subPath: string) => {
        if (subPath === 'ejecuciones') {
          return { get: vi.fn().mockResolvedValue(c2EjecucionesSnapshot) };
        }
        return createColRef({ docs: [], forEach: () => {}, size: 0 });
      }),
    };

    const empresasColRef: any = {
      get: vi.fn().mockResolvedValue(companiesSnapshot),
      add: mockSet,
      doc: vi.fn((id: string) => {
        if (id === 'c1') return c1DocRef;
        if (id === 'c2') return c2DocRef;
        return { id, collection: vi.fn(), get: vi.fn() };
      }),
    };

    mockDb.collection.mockImplementation((path: string) => {
      if (path === 'companies') return empresasColRef;
      return createColRef({ docs: [], forEach: () => {}, size: 0 });
    });

    const { migrateLegacyComprobantes } = await import('@/scripts/migrate-legacy-comprobantes');
    const result = await migrateLegacyComprobantes(mockDb);

    expect(result.companies).toBe(2);
    expect(result.migrated).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('c1');
    expect(result.errors[0]).toContain(errMessage);
  });
});
