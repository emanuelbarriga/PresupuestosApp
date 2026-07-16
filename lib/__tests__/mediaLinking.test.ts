import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { DocumentoMedio, Ejecucion } from '@/lib/types';

// ─── Pure function: compute linking diff ─────────────────────────────────

describe('computeLinkingDiff — pure function', () => {
  it('computes added, removed, and kept IDs correctly', async () => {
    // Import dynamically after mocks are set up
    const { computeLinkingDiff } = await import('@/lib/mediaLinking');

    const currentIds = ['ej-1', 'ej-2', 'ej-3'];
    const newIds = ['ej-2', 'ej-3', 'ej-4'];

    const result = computeLinkingDiff(currentIds, newIds);

    expect(result).toEqual({
      added: ['ej-4'],
      removed: ['ej-1'],
      kept: ['ej-2', 'ej-3'],
    });
  });

  it('returns all as added when current is empty', async () => {
    const { computeLinkingDiff } = await import('@/lib/mediaLinking');

    const result = computeLinkingDiff([], ['ej-1', 'ej-2']);

    expect(result.added).toEqual(['ej-1', 'ej-2']);
    expect(result.removed).toEqual([]);
    expect(result.kept).toEqual([]);
  });

  it('returns all as removed when new is empty', async () => {
    const { computeLinkingDiff } = await import('@/lib/mediaLinking');

    const result = computeLinkingDiff(['ej-1', 'ej-2'], []);

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual(['ej-1', 'ej-2']);
    expect(result.kept).toEqual([]);
  });

  it('returns empty diff when both arrays are identical', async () => {
    const { computeLinkingDiff } = await import('@/lib/mediaLinking');

    const result = computeLinkingDiff(['ej-1', 'ej-2'], ['ej-1', 'ej-2']);

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.kept).toEqual(['ej-1', 'ej-2']);
  });
});

// ─── Mock Firestore runTransaction ───────────────────────────────────────

vi.mock('@/lib/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  runTransaction: vi.fn(),
  doc: vi.fn((_db, ...segments) => ({ path: segments.join('/') })),
  collection: vi.fn((_db, path) => ({ path })),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  arrayUnion: vi.fn((...items) => ({ __op: 'arrayUnion', items })),
  arrayRemove: vi.fn((...items) => ({ __op: 'arrayRemove', items })),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage, path) => ({ path })),
  deleteObject: vi.fn().mockResolvedValue(undefined),
}));

// ─── linkDocumentoToEntities ─────────────────────────────────────────────

describe('linkDocumentoToEntities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls runTransaction with a transaction function', async () => {
    const { runTransaction } = await import('firebase/firestore');
    const { linkDocumentoToEntities } = await import('@/lib/mediaLinking');

    (runTransaction as Mock).mockImplementation(async (_db, fn) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: vi.fn().mockReturnValue(true),
          data: vi.fn().mockReturnValue({
            _linkedDocumentos: [],
            comprobantes: [],
          }),
        }),
        update: vi.fn(),
      };
      await fn(mockTransaction);
    });

    await linkDocumentoToEntities('c1', 'doc-1', {
      tipoDocumento: 'factura_venta',
      periodo: '2026-07',
      terceroId: 't-1',
      ejecucionIds: ['ej-1'],
    });

    expect(runTransaction).toHaveBeenCalledTimes(1);
  });

  it('reads existing documento and linked ejecuciones within transaction', async () => {
    const { runTransaction } = await import('firebase/firestore');
    const { linkDocumentoToEntities } = await import('@/lib/mediaLinking');
    const { doc: docFn } = await import('firebase/firestore');

    let transactionGetCalls: string[] = [];
    (runTransaction as Mock).mockImplementation(async (_db, fn) => {
      const mockTransaction = {
        get: vi.fn((ref: any) => {
          transactionGetCalls.push(ref.path);
          return {
            exists: vi.fn().mockReturnValue(true),
            data: vi.fn().mockReturnValue({
              _linkedDocumentos: [],
              comprobantes: [],
            }),
          };
        }),
        update: vi.fn(),
      };
      await fn(mockTransaction);
    });

    await linkDocumentoToEntities('c1', 'doc-1', {
      tipoDocumento: 'factura_venta',
      periodo: '2026-07',
      terceroId: 't-1',
      ejecucionIds: ['ej-1', 'ej-2'],
    });

    // Should read the documento itself and both ejecuciones
    expect(transactionGetCalls).toContain('companies/c1/documentos/doc-1');
    expect(transactionGetCalls).toContain('companies/c1/ejecuciones/ej-1');
    expect(transactionGetCalls).toContain('companies/c1/ejecuciones/ej-2');
  });

  it('updates the documento with status enlazado and field data', async () => {
    const { runTransaction } = await import('firebase/firestore');
    const { linkDocumentoToEntities } = await import('@/lib/mediaLinking');
    const { doc: docFn } = await import('firebase/firestore');

    let updates: Array<{ ref: any; data: any }> = [];
    (runTransaction as Mock).mockImplementation(async (_db, fn) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: vi.fn().mockReturnValue(true),
          data: vi.fn().mockReturnValue({
            _linkedDocumentos: [],
            comprobantes: [],
          }),
        }),
        update: vi.fn((ref: any, data: any) => {
          updates.push({ ref, data });
        }),
      };
      await fn(mockTransaction);
    });

    await linkDocumentoToEntities('c1', 'doc-1', {
      tipoDocumento: 'factura_venta',
      periodo: '2026-07',
      terceroId: 't-1',
      projectId: 'p-1',
      ejecucionIds: ['ej-1'],
      metadata: { proveedorTexto: 'Proveedor SA', montoTotal: 1500000 },
    });

    // Find the documento update
    const docUpdate = updates.find(u => u.ref.path.includes('documentos/doc-1'));
    expect(docUpdate).toBeDefined();
    expect(docUpdate!.data.status).toBe('enlazado');
    expect(docUpdate!.data.tipoDocumento).toBe('factura_venta');
    expect(docUpdate!.data.periodo).toBe('2026-07');
    expect(docUpdate!.data.terceroId).toBe('t-1');
    expect(docUpdate!.data.projectId).toBe('p-1');
    expect(docUpdate!.data.ejecucionIds).toEqual(['ej-1']);
    expect(docUpdate!.data.metadata).toEqual({
      proveedorTexto: 'Proveedor SA',
      montoTotal: 1500000,
    });
  });

  it('updates each linked ejecucion with _linkedDocumentos and _estadoComprobantes', async () => {
    const { runTransaction } = await import('firebase/firestore');
    const { linkDocumentoToEntities, computeLinkingDiff } = await import('@/lib/mediaLinking');
    const { derivarEstadoComprobantes } = await import('@/lib/comprobantes');

    let ejecucionUpdates: Array<{ path: string; data: any }> = [];
    (runTransaction as Mock).mockImplementation(async (_db, fn) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: vi.fn().mockReturnValue(true),
          data: vi.fn().mockReturnValue({
            _linkedDocumentos: [],
            comprobantes: [],
          }),
        }),
        update: vi.fn((ref: any, data: any) => {
          ejecucionUpdates.push({ path: ref.path, data });
        }),
      };
      await fn(mockTransaction);
    });

    await linkDocumentoToEntities('c1', 'doc-1', {
      tipoDocumento: 'factura_venta',
      periodo: '2026-07',
      terceroId: 't-1',
      ejecucionIds: ['ej-1'],
      metadata: { montoTotal: 500000 },
    });

    expect(ejecucionUpdates.some(u => u.path.includes('ejecuciones/ej-1'))).toBe(true);
    const ejUpdate = ejecucionUpdates.find(u => u.path.includes('ejecuciones/ej-1'));
    expect(ejUpdate!.data._linkedDocumentos).toBeDefined();
    expect(ejUpdate!.data._linkedDocumentos[0].documentoId).toBe('doc-1');
    expect(ejUpdate!.data._linkedDocumentos[0].tipoDocumento).toBe('factura_venta');
    expect(ejUpdate!.data._linkedDocumentos[0].periodo).toBe('2026-07');
    expect(ejUpdate!.data._linkedDocumentos[0].montoTotal).toBe(500000);
    expect(ejUpdate!.data._estadoComprobantes).toBeDefined();
  });

  it('computes _estadoComprobantes as Falta un comprobante when linking a single required type to empty ejecucion', async () => {
    const { runTransaction } = await import('firebase/firestore');
    const { linkDocumentoToEntities } = await import('@/lib/mediaLinking');
    const { derivarEstadoComprobantes } = await import('@/lib/comprobantes');

    let ejecucionUpdates: Array<{ path: string; data: any }> = [];
    (runTransaction as Mock).mockImplementation(async (_db, fn) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: vi.fn().mockReturnValue(true),
          data: vi.fn().mockReturnValue({
            _linkedDocumentos: [],
            comprobantes: [],
          }),
        }),
        update: vi.fn((ref: any, data: any) => {
          ejecucionUpdates.push({ path: ref.path, data });
        }),
      };
      await fn(mockTransaction);
    });

    await linkDocumentoToEntities('c1', 'doc-1', {
      tipoDocumento: 'comprobante_egreso',
      periodo: '2026-07',
      terceroId: 't-1',
      ejecucionIds: ['ej-1'],
    });

    const ejUpdate = ejecucionUpdates.find(u => u.path.includes('ejecuciones/ej-1'));
    expect(ejUpdate!.data._estadoComprobantes).toBe('Falta un comprobante');
    expect(ejUpdate!.data._linkedDocumentos).toHaveLength(1);
    expect(ejUpdate!.data._linkedDocumentos[0].tipoDocumento).toBe('comprobante_egreso');
  });

  it('computes _estadoComprobantes as Completada when linked documento provides the second required type', async () => {
    const { runTransaction } = await import('firebase/firestore');
    const { linkDocumentoToEntities } = await import('@/lib/mediaLinking');

    let ejecucionUpdates: Array<{ path: string; data: any }> = [];
    (runTransaction as Mock).mockImplementation(async (_db, fn) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: vi.fn().mockReturnValue(true),
          data: vi.fn().mockReturnValue({
            // Ejecucion already has "Comprobante de pago" linked
            _linkedDocumentos: [
              { documentoId: 'doc-pago', tipoDocumento: 'comprobante_egreso' },
            ],
            comprobantes: [],
          }),
        }),
        update: vi.fn((ref: any, data: any) => {
          ejecucionUpdates.push({ path: ref.path, data });
        }),
      };
      await fn(mockTransaction);
    });

    // Link a new "Cuenta de Cobro" type documento
    await linkDocumentoToEntities('c1', 'doc-2', {
      tipoDocumento: 'comprobante_ingreso',
      periodo: '2026-07',
      terceroId: 't-1',
      ejecucionIds: ['ej-1'],
    });

    const ejUpdate = ejecucionUpdates.find(u => u.path.includes('ejecuciones/ej-1'));
    expect(ejUpdate!.data._estadoComprobantes).toBe('Completada');
    expect(ejUpdate!.data._linkedDocumentos).toHaveLength(2);
  });
});



// ─── unlinkDocumentoFromEjecucion ─────────────────────────────────────────

describe('unlinkDocumentoFromEjecucion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes ejecucionId from documento and updates ejecucion', async () => {
    const { runTransaction } = await import('firebase/firestore');
    const { unlinkDocumentoFromEjecucion } = await import('@/lib/mediaLinking');

    let updates: Array<{ ref: any; data: any }> = [];
    (runTransaction as Mock).mockImplementation(async (_db, fn) => {
      const mockTransaction = {
        get: vi.fn().mockImplementation((ref: any) => {
          if (ref.path.includes('documentos')) {
            return {
              exists: vi.fn().mockReturnValue(true),
              data: vi.fn().mockReturnValue({
                status: 'enlazado',
                ejecucionIds: ['ej-1', 'ej-2'],
                _source: 'ejecucion-form',
                fileName: 'doc.pdf',
                storagePath: 'c1/documentos/doc.pdf',
                url: 'https://example.com',
                size: 100,
                mimeType: 'application/pdf',
              }),
            };
          }
          return {
            exists: vi.fn().mockReturnValue(true),
            data: vi.fn().mockReturnValue({
              _linkedDocumentos: [{ documentoId: 'doc-1', tipoDocumento: 'factura_venta' }],
            }),
          };
        }),
        update: vi.fn((ref: any, data: any) => {
          updates.push({ ref, data });
        }),
      };
      await fn(mockTransaction);
    });

    await unlinkDocumentoFromEjecucion('c1', 'doc-1', 'ej-1');

    // Should update the documento (remove ejecucionId)
    const docUpdate = updates.find(u => u.ref.path.includes('documentos/doc-1'));
    expect(docUpdate).toBeDefined();
    expect(docUpdate!.data.ejecucionIds).toBeDefined();

    // Should update the ejecucion (remove _linkedDocumentos entry)
    const ejUpdate = updates.find(u => u.ref.path.includes('ejecuciones/ej-1'));
    expect(ejUpdate).toBeDefined();
  });

  it('reverts status to por_clasificar when ejecucionIds becomes empty', async () => {
    const { runTransaction } = await import('firebase/firestore');
    const { unlinkDocumentoFromEjecucion } = await import('@/lib/mediaLinking');

    let updates: Array<{ ref: any; data: any }> = [];
    (runTransaction as Mock).mockImplementation(async (_db, fn) => {
      const mockTransaction = {
        get: vi.fn().mockImplementation((ref: any) => {
          if (ref.path.includes('documentos')) {
            return {
              exists: vi.fn().mockReturnValue(true),
              data: vi.fn().mockReturnValue({
                status: 'enlazado',
                ejecucionIds: ['ej-1'],
                _source: 'ejecucion-form',
                fileName: 'doc.pdf',
                storagePath: 'c1/documentos/doc.pdf',
                url: 'https://example.com',
                size: 100,
                mimeType: 'application/pdf',
              }),
            };
          }
          return {
            exists: vi.fn().mockReturnValue(true),
            data: vi.fn().mockReturnValue({
              _linkedDocumentos: [{ documentoId: 'doc-1', tipoDocumento: 'factura_venta' }],
            }),
          };
        }),
        update: vi.fn((ref: any, data: any) => {
          updates.push({ ref, data });
        }),
      };
      await fn(mockTransaction);
    });

    await unlinkDocumentoFromEjecucion('c1', 'doc-1', 'ej-1');

    const docUpdate = updates.find(u => u.ref.path.includes('documentos/doc-1'));
    expect(docUpdate!.data.status).toBe('por_clasificar');
    expect(docUpdate!.data.ejecucionIds).toEqual([]);
  });

  it('recomputes _estadoComprobantes on ejecucion after unlinking a documento', async () => {
    const { runTransaction } = await import('firebase/firestore');
    const { unlinkDocumentoFromEjecucion } = await import('@/lib/mediaLinking');

    let updates: Array<{ ref: any; data: any }> = [];
    (runTransaction as Mock).mockImplementation(async (_db, fn) => {
      const mockTransaction = {
        get: vi.fn().mockImplementation((ref: any) => {
          if (ref.path.includes('documentos')) {
            return {
              exists: vi.fn().mockReturnValue(true),
              data: vi.fn().mockReturnValue({
                status: 'enlazado',
                ejecucionIds: ['ej-1', 'ej-2'],
                _source: 'ejecucion-form',
                fileName: 'doc.pdf',
                storagePath: 'c1/documentos/doc.pdf',
                url: 'https://example.com',
                size: 100,
                mimeType: 'application/pdf',
              }),
            };
          }
          // ejecucion has one remaining linked doc: "Cuenta de Cobro"
          return {
            exists: vi.fn().mockReturnValue(true),
            data: vi.fn().mockReturnValue({
              _linkedDocumentos: [
                { documentoId: 'doc-keep', tipoDocumento: 'comprobante_ingreso' },
                { documentoId: 'doc-unlink', tipoDocumento: 'comprobante_egreso' },
              ],
            }),
          };
        }),
        update: vi.fn((ref: any, data: any) => {
          updates.push({ ref, data });
        }),
      };
      await fn(mockTransaction);
    });

    await unlinkDocumentoFromEjecucion('c1', 'doc-unlink', 'ej-1');

    const ejUpdate = updates.find(u => u.ref.path.includes('ejecuciones/ej-1'));
    expect(ejUpdate).toBeDefined();
    // After removing the "Comprobante de pago" doc, only "Cuenta de Cobro" remains → Falta un comprobante
    expect(ejUpdate!.data._estadoComprobantes).toBe('Falta un comprobante');
    expect(ejUpdate!.data._linkedDocumentos).toHaveLength(1);
  });

  it('sets _estadoComprobantes to Sin comprobantes when unlinking last documento from ejecucion', async () => {
    const { runTransaction } = await import('firebase/firestore');
    const { unlinkDocumentoFromEjecucion } = await import('@/lib/mediaLinking');

    let updates: Array<{ ref: any; data: any }> = [];
    (runTransaction as Mock).mockImplementation(async (_db, fn) => {
      const mockTransaction = {
        get: vi.fn().mockImplementation((ref: any) => {
          if (ref.path.includes('documentos')) {
            return {
              exists: vi.fn().mockReturnValue(true),
              data: vi.fn().mockReturnValue({
                status: 'enlazado',
                ejecucionIds: ['ej-1'],
                _source: 'ejecucion-form',
                fileName: 'doc.pdf',
                storagePath: 'c1/documentos/doc.pdf',
                url: 'https://example.com',
                size: 100,
                mimeType: 'application/pdf',
              }),
            };
          }
          return {
            exists: vi.fn().mockReturnValue(true),
            data: vi.fn().mockReturnValue({
              _linkedDocumentos: [
                { documentoId: 'doc-unlink', tipoDocumento: 'comprobante_egreso' },
              ],
            }),
          };
        }),
        update: vi.fn((ref: any, data: any) => {
          updates.push({ ref, data });
        }),
      };
      await fn(mockTransaction);
    });

    await unlinkDocumentoFromEjecucion('c1', 'doc-unlink', 'ej-1');

    const ejUpdate = updates.find(u => u.ref.path.includes('ejecuciones/ej-1'));
    expect(ejUpdate).toBeDefined();
    expect(ejUpdate!.data._estadoComprobantes).toBe('Sin comprobantes');
    expect(ejUpdate!.data._linkedDocumentos).toHaveLength(0);
  });
});

// ─── deleteDocumentoComplete ──────────────────────────────────────────────

describe('deleteDocumentoComplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes from Storage and Firestore atomically', async () => {
    // Mock getDoc to return a valid snapshot for the initial read
    const { runTransaction, getDoc: mockGetDoc } = await import('firebase/firestore');
    (mockGetDoc as Mock).mockResolvedValue({
      exists: vi.fn().mockReturnValue(true),
      data: vi.fn().mockReturnValue({
        fileName: 'doc.pdf',
        storagePath: 'c1/documentos/doc.pdf',
        url: 'https://example.com',
        size: 100,
        mimeType: 'application/pdf',
        status: 'enlazado',
        ejecucionIds: ['ej-1'],
        _source: 'inbox-upload',
      }),
    });

    const { deleteDocumentoComplete } = await import('@/lib/mediaLinking');

    let transactionUpdateCalled = false;
    let transactionDeleteCalled = false;

    (runTransaction as Mock).mockImplementation(async (_db, fn) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: vi.fn().mockReturnValue(true),
          data: vi.fn().mockReturnValue({
            _linkedDocumentos: [{ documentoId: 'doc-1', tipoDocumento: 'factura_venta' }],
          }),
        }),
        update: vi.fn((_ref, _data) => { transactionUpdateCalled = true; }),
        delete: vi.fn((_ref) => { transactionDeleteCalled = true; }),
      };
      await fn(mockTransaction);
    });

    await deleteDocumentoComplete('c1', 'doc-1', 'c1/documentos/doc.pdf');

    expect(runTransaction).toHaveBeenCalled();
    expect(transactionUpdateCalled).toBe(true);
    expect(transactionDeleteCalled).toBe(true);
  });
});
