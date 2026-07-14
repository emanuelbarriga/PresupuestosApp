import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Firebase Admin SDK ────────────────────────────────────────────

const mockUpdate = vi.fn();

const mockBucket = {
  file: vi.fn(),
};

function createColRef(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const snap = {
    docs: docs.map(({ id, data }) => ({
      id,
      data: () => data,
      ref: { id, path: `companies/c1/documentos/${id}` },
    })),
    forEach: function (fn: (d: any) => void) { this.docs.forEach(fn); },
    size: docs.length,
  };

  return {
    get: vi.fn().mockResolvedValue(snap),
    doc: vi.fn((id: string) => {
      const found = docs.find((d) => d.id === id);
      return {
        id,
        get: vi.fn().mockResolvedValue({
          id,
          data: () => found?.data ?? {},
          exists: !!found,
        }),
        collection: vi.fn((subPath: string) => {
          if (subPath === 'ejecuciones') {
            return createColRef([]); // nested collection
          }
          return createColRef([]);
        }),
        update: mockUpdate,
      };
    }),
  };
}

const mockDb = {
  collection: vi.fn(),
};

const mockFileInstance = {
  copy: vi.fn().mockResolvedValue([{}]),
  exists: vi.fn().mockResolvedValue([true]),
  delete: vi.fn().mockResolvedValue([{}]),
  name: '',
  getSignedUrl: vi.fn().mockResolvedValue(['https://example.com']),
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

vi.mock('firebase-admin/storage', () => ({
  getStorage: vi.fn(() => ({
    bucket: vi.fn(() => mockBucket),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────

function makeCompaniesSnapshot(ids: string[]) {
  return {
    docs: ids.map((id) => ({
      id,
      data: () => ({ name: `Company ${id}` }),
      ref: { id, path: `companies/${id}` },
    })),
    forEach: function (fn: (d: any) => void) { this.docs.forEach(fn); },
    size: ids.length,
  };
}

function makeDocumentosSnapshot(
  docs: Array<{ id: string } & Record<string, unknown>>,
) {
  return {
    docs: docs.map(({ id, ...rest }) => ({
      id,
      data: () => rest,
      ref: { id, path: `companies/c1/documentos/${id}` },
    })),
    forEach: function (fn: (d: any) => void) { this.docs.forEach(fn); },
    size: docs.length,
  };
}

function makeEjecucionSnapshot(
  docs: Array<{ id: string } & Record<string, unknown>>,
) {
  return {
    docs: docs.map(({ id, ...rest }) => ({
      id,
      data: () => rest,
      ref: { id, path: `companies/c1/ejecuciones/${id}` },
    })),
    forEach: function (fn: (d: any) => void) { this.docs.forEach(fn); },
    size: docs.length,
  };
}

// ─── Tests: downMigrateMedia (5.3 / 7.8) ────────────────────────────────

describe('downMigrateMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBucket.file.mockReturnValue(mockFileInstance);
  });

  it('copies DocumentoMedio records back to Ejecucion.comprobantes arrays', async () => {
    const companiesSnapshot = makeCompaniesSnapshot(['c1']);
    const documentosSnapshot = makeDocumentosSnapshot([
      {
        id: 'doc-1',
        fileName: 'factura.pdf',
        storagePath: 'c1/documentos/uuid-factura.pdf',
        url: 'https://example.com/uuid-factura.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        status: 'enlazado',
        tipoDocumento: 'comprobante_egreso',
        ejecucionIds: ['ej-1'],
        _source: 'migration',
        uploadedAt: '2026-07-01T00:00:00Z',
        createdBy: 'system',
      },
    ]);
    const ejecucionSnapshot = makeEjecucionSnapshot([
      {
        id: 'ej-1',
        descripcion: 'Pago',
        comprobantes: [],
      },
    ]);

    // Mock the chain: companies → doc(cId) → collection('ejecuciones') → doc(ejId) → collection('documentos')
    const empresasRef = createColRef(
      companiesSnapshot.docs.map((d) => ({ id: d.id, data: d.data() })),
    );

    // We need a custom mock for the nested chain
    mockDb.collection.mockImplementation((path: string) => {
      if (path === 'companies') {
        return {
          get: vi.fn().mockResolvedValue(companiesSnapshot),
          doc: vi.fn((cId: string) => ({
            id: cId,
            collection: vi.fn((subPath: string) => {
              if (subPath === 'documentos') {
                return {
                  get: vi.fn().mockResolvedValue(documentosSnapshot),
                };
              }
              if (subPath === 'ejecuciones') {
                return {
                  doc: vi.fn((ejId: string) => ({
                    id: ejId,
                    get: vi.fn().mockResolvedValue({
                      id: ejId,
                      data: () => ({ comprobantes: [] }),
                      exists: true,
                    }),
                    update: mockUpdate,
                    collection: vi.fn(() => ({
                      get: vi.fn().mockResolvedValue({ docs: [], size: 0 }),
                    })),
                  })),
                };
              }
              return { get: vi.fn().mockResolvedValue({ docs: [], size: 0 }) };
            }),
          })),
        };
      }
      return { get: vi.fn().mockResolvedValue({ docs: [], size: 0 }) };
    });

    const { downMigrateMedia } = await import('@/scripts/down-migration-media');
    const result = await downMigrateMedia(mockDb as any, mockBucket as any);

    expect(result.processed).toBe(1); // 1 DocumentoMedio processed
    expect(result.comprobantesCreated).toBe(1); // 1 comprobante added
    expect(result.filesDuplicated).toBe(1); // 1 file duplicated
    expect(result.errors).toEqual([]);

    // Verify storage file copy was called
    expect(mockBucket.file).toHaveBeenCalledWith('c1/documentos/uuid-factura.pdf');
    expect(mockFileInstance.copy).toHaveBeenCalled();

    // Verify ejecucion update was called with comprobantes
    expect(mockUpdate).toHaveBeenCalled();
    const updateArg = (mockUpdate as any).mock.calls[0][0];
    expect(updateArg.comprobantes).toBeDefined();
    expect(Array.isArray(updateArg.comprobantes)).toBe(true);
    expect(updateArg.comprobantes[0].name).toBe('factura.pdf');
    expect(updateArg.comprobantes[0].tipo).toBe('comprobante_egreso');
  });

  it('skips DocumentoMedio records with no ejecucionIds', async () => {
    const companiesSnapshot = makeCompaniesSnapshot(['c1']);
    const documentosSnapshot = makeDocumentosSnapshot([
      {
        id: 'doc-orphan',
        fileName: 'orphan.pdf',
        storagePath: 'c1/documentos/orphan.pdf',
        url: 'https://example.com/orphan.pdf',
        size: 500,
        mimeType: 'application/pdf',
        status: 'por_clasificar',
        ejecucionIds: [],
        _source: 'inbox-upload',
        uploadedAt: '2026-07-01T00:00:00Z',
        createdBy: 'user',
      },
    ]);

    mockDb.collection.mockImplementation((path: string) => {
      if (path === 'companies') {
        return {
          get: vi.fn().mockResolvedValue(companiesSnapshot),
          doc: vi.fn((cId: string) => ({
            id: cId,
            collection: vi.fn((subPath: string) => {
              if (subPath === 'documentos') {
                return { get: vi.fn().mockResolvedValue(documentosSnapshot) };
              }
              return { get: vi.fn().mockResolvedValue({ docs: [], size: 0 }) };
            }),
          })),
        };
      }
      return { get: vi.fn().mockResolvedValue({ docs: [], size: 0 }) };
    });

    const { downMigrateMedia } = await import('@/scripts/down-migration-media');
    const result = await downMigrateMedia(mockDb as any, mockBucket as any);

    expect(result.processed).toBe(0);
    expect(result.comprobantesCreated).toBe(0);
    expect(result.filesDuplicated).toBe(0);
    expect(mockFileInstance.copy).not.toHaveBeenCalled();
  });

  it('handles missing source file in Storage gracefully', async () => {
    const companiesSnapshot = makeCompaniesSnapshot(['c1']);
    const documentosSnapshot = makeDocumentosSnapshot([
      {
        id: 'doc-1',
        fileName: 'missing.pdf',
        storagePath: 'c1/documentos/missing.pdf',
        url: 'https://example.com/missing.pdf',
        size: 100,
        mimeType: 'application/pdf',
        status: 'enlazado',
        tipoDocumento: 'comprobante_egreso',
        ejecucionIds: ['ej-1'],
        _source: 'migration',
        uploadedAt: '2026-07-01T00:00:00Z',
        createdBy: 'system',
      },
    ]);

    // Override file.exists to return false
    mockBucket.file.mockReturnValue({
      ...mockFileInstance,
      exists: vi.fn().mockResolvedValue([false]),
    });

    mockDb.collection.mockImplementation((path: string) => {
      if (path === 'companies') {
        return {
          get: vi.fn().mockResolvedValue(companiesSnapshot),
          doc: vi.fn((cId: string) => ({
            id: cId,
            collection: vi.fn((subPath: string) => {
              if (subPath === 'documentos') {
                return { get: vi.fn().mockResolvedValue(documentosSnapshot) };
              }
              if (subPath === 'ejecuciones') {
                return {
                  doc: vi.fn((ejId: string) => ({
                    id: ejId,
                    get: vi.fn().mockResolvedValue({
                      id: ejId,
                      data: () => ({ comprobantes: [] }),
                      exists: true,
                    }),
                    update: vi.fn(),
                  })),
                };
              }
              return { get: vi.fn().mockResolvedValue({ docs: [], size: 0 }) };
            }),
          })),
        };
      }
      return { get: vi.fn().mockResolvedValue({ docs: [], size: 0 }) };
    });

    const { downMigrateMedia } = await import('@/scripts/down-migration-media');
    const result = await downMigrateMedia(mockDb as any, mockBucket as any);

    expect(result.processed).toBe(1);
    expect(result.filesDuplicated).toBe(0);
    expect(result.comprobantesCreated).toBe(0); // No update if file missing — we skip the rest of the iteration
    expect(result.errors).toEqual([]);
  });
});
