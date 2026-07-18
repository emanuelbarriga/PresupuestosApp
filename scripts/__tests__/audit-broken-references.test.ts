import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// ─── Mock firebase-admin/firestore ────────────────────────────────────────

const mockFirestore = vi.hoisted(() => {
  const makeSnapshot = (docs: Array<{ id: string; [k: string]: unknown }>) => ({
    docs: docs.map((d) => {
      const { id, ...rest } = d;
      return {
        id,
        data: () => rest,
        forEach: (fn: (d: any) => void) => {
          docs.forEach((doc) =>
            fn({
              id: doc.id,
              data: () => {
                const { id: _id, ...rest } = doc;
                return rest;
              },
            }),
          );
        },
      };
    }),
    forEach: (fn: (d: any) => void) => {
      docs.forEach((doc) => {
        const { id, ...rest } = doc;
        fn({ id, data: () => rest });
      });
    },
    size: docs.length,
  });

  const mockDb = {
    collection: vi.fn(),
  };

  return {
    mockFirestoreModule: {
      getFirestore: vi.fn(() => mockDb),
      Firestore: vi.fn(),
    },
    makeSnapshot,
    mockDb,
  };
});

vi.mock('firebase-admin/firestore', () => mockFirestore.mockFirestoreModule);

// ─── Imports ──────────────────────────────────────────────────────────────

import { runAudit } from '@/scripts/audit-broken-references';
import type { Firestore } from 'firebase-admin/firestore';

// ─── Tests ────────────────────────────────────────────────────────────────

describe('audit-broken-references: runAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper: set up collection mock with a company that has subcollections.
   *
   * Configuration:
   *   terceros — Array of tercero docs ({ id, name?, archivado? })
   *   companies — Array of company docs (id only)
   *   subcollections — Map of companyId → { budgets?, ejecuciones?, documentos?, projects? }
   *     Each subcollection value is an array of docs.
   */
  function setupMock(
    terceros: Array<{ id: string; [k: string]: unknown }>,
    companies: Array<{ id: string }>,
    subcollections: Record<string, {
      budgets?: Array<{ id: string; [k: string]: unknown }>;
      ejecuciones?: Array<{ id: string; [k: string]: unknown }>;
      documentos?: Array<{ id: string; [k: string]: unknown }>;
      projects?: Array<{ id: string; [k: string]: unknown }>;
    }>,
  ) {
    const tercerosSnap = mockFirestore.makeSnapshot(terceros);
    const companiesSnap = mockFirestore.makeSnapshot(companies);

    // Build company doc mock: for each company, return a doc with subcollection access
    const companyDocMock = vi.fn((cId: string) => {
      const subs = subcollections[cId] ?? {};
      return {
        collection: vi.fn((subName: string) => {
          const docs = subs[subName as keyof typeof subs] ?? [];
          return { get: vi.fn().mockResolvedValue(mockFirestore.makeSnapshot(docs)) };
        }),
      };
    });

    // Companies collection: has .get() AND .doc()
    const companiesCollectionMock = {
      get: vi.fn().mockResolvedValue(companiesSnap),
      doc: companyDocMock,
    };

    (mockFirestore.mockDb.collection as Mock).mockImplementation((name: string) => {
      if (name === 'terceros') return { get: vi.fn().mockResolvedValue(tercerosSnap) };
      if (name === 'companies') return companiesCollectionMock;
      return { get: vi.fn().mockResolvedValue(mockFirestore.makeSnapshot([])) };
    });
  }

  it('returns zero broken refs when all references are intact', async () => {
    setupMock(
      // Terceros
      [
        { id: 't1', name: 'Cliente Activo', archivado: false },
        { id: 't2', name: 'Proveedor Activo', archivado: false },
      ],
      // Companies
      [{ id: 'c1' }],
      // Subcollections
      {
        c1: {
          budgets: [
            { id: 'b1', descripcion: 'Ingreso', entityId: 't1' },
            { id: 'b2', descripcion: 'Gasto', entityId: 't2' },
          ],
          ejecuciones: [
            { id: 'ej1', descripcion: 'Pago', entityId: 't2' },
          ],
          documentos: [
            { id: 'd1', fileName: 'factura.pdf', terceroId: 't1' },
          ],
          projects: [
            { id: 'p1', name: 'Proyecto', clientId: 't2' },
          ],
        },
      },
    );

    const result = await runAudit(mockFirestore.mockDb as unknown as Firestore);

    expect(result.total).toBe(0);
    expect(result.budgets).toHaveLength(0);
    expect(result.ejecuciones).toHaveLength(0);
    expect(result.documentos).toHaveLength(0);
    expect(result.proyectos).toHaveLength(0);
  });

  it('detects budget with archived tercero', async () => {
    setupMock(
      [
        { id: 't1', name: 'Archivado', archivado: true },
        { id: 't2', name: 'Activo', archivado: false },
      ],
      [{ id: 'c1' }],
      {
        c1: {
          budgets: [
            { id: 'b1', descripcion: 'Con Archivado', entityId: 't1' },
            { id: 'b2', descripcion: 'Con Activo', entityId: 't2' },
          ],
        },
      },
    );

    const result = await runAudit(mockFirestore.mockDb as unknown as Firestore);

    expect(result.total).toBe(1);
    expect(result.budgets).toHaveLength(1);
    expect(result.budgets[0].sourceId).toBe('b1');
    expect(result.budgets[0].terceroArchivado).toBe(true);
    expect(result.budgets[0].terceroExists).toBe(true);
  });

  it('detects ejecucion with nonexistent tercero', async () => {
    setupMock(
      [{ id: 't1', name: 'Existente', archivado: false }],
      [{ id: 'c1' }],
      {
        c1: {
          ejecuciones: [
            { id: 'ej1', descripcion: 'Rota', entityId: 't-inexistente' },
          ],
        },
      },
    );

    const result = await runAudit(mockFirestore.mockDb as unknown as Firestore);

    expect(result.total).toBe(1);
    expect(result.ejecuciones).toHaveLength(1);
    expect(result.ejecuciones[0].sourceId).toBe('ej1');
    expect(result.ejecuciones[0].terceroExists).toBe(false);
    expect(result.ejecuciones[0].terceroName).toBe('(inexistente)');
  });

  it('detects documento with archived tercero', async () => {
    setupMock(
      [{ id: 't1', name: 'Archivado', archivado: true }],
      [{ id: 'c1' }],
      {
        c1: {
          documentos: [
            { id: 'd1', fileName: 'doc.pdf', terceroId: 't1' },
          ],
        },
      },
    );

    const result = await runAudit(mockFirestore.mockDb as unknown as Firestore);

    expect(result.total).toBe(1);
    expect(result.documentos).toHaveLength(1);
    expect(result.documentos[0].sourceId).toBe('d1');
    expect(result.documentos[0].terceroArchivado).toBe(true);
  });

  it('detects proyecto with archived client', async () => {
    setupMock(
      [{ id: 't1', name: 'Cliente Archivado', archivado: true }],
      [{ id: 'c1' }],
      {
        c1: {
          projects: [
            { id: 'p1', name: 'Proyecto', clientId: 't1' },
          ],
        },
      },
    );

    const result = await runAudit(mockFirestore.mockDb as unknown as Firestore);

    expect(result.total).toBe(1);
    expect(result.proyectos).toHaveLength(1);
    expect(result.proyectos[0].sourceId).toBe('p1');
    expect(result.proyectos[0].terceroArchivado).toBe(true);
  });

  it('skips documents without terceroId field', async () => {
    setupMock(
      [{ id: 't1', name: 'Activo', archivado: false }],
      [{ id: 'c1' }],
      {
        c1: {
          documentos: [
            { id: 'd1', fileName: 'sin-tercero.pdf' }, // no terceroId
          ],
        },
      },
    );

    const result = await runAudit(mockFirestore.mockDb as unknown as Firestore);

    expect(result.total).toBe(0);
    expect(result.documentos).toHaveLength(0);
  });

  it('processes multiple companies and accumulates broken refs', async () => {
    setupMock(
      [{ id: 't1', name: 'Archivado', archivado: true }],
      [{ id: 'c1' }, { id: 'c2' }],
      {
        c1: {
          budgets: [{ id: 'b1', descripcion: 'Roto', entityId: 't1' }],
        },
        c2: {
          budgets: [{ id: 'b2', descripcion: 'Roto 2', entityId: 't1' }],
        },
      },
    );

    const result = await runAudit(mockFirestore.mockDb as unknown as Firestore);

    expect(result.total).toBe(2);
    expect(result.budgets).toHaveLength(2);
    expect(result.budgets.map(b => b.sourceId)).toEqual(['b1', 'b2']);
  });
});
