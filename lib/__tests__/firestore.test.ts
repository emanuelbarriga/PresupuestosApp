import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// ─── Mock infrastructure (hoisted before imports) ───────────────────────────

const {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  setDoc,
  query,
  where,
  writeBatch,
  collectionGroup,
  deleteDoc,
  runTransaction,
  mockUnsub,
} = vi.hoisted(() => {
  const mockUnsub = vi.fn();
  const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
  const mockRunTransaction = vi.fn();
  return {
    collection: vi.fn(() => ({ type: 'collection' as const })),
    doc: vi.fn(() => ({ type: 'doc' as const, path: 'companies/c1/ejecuciones/e1' })),
    addDoc: vi.fn().mockResolvedValue({ id: 'new-id' }),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    onSnapshot: vi.fn().mockReturnValue(mockUnsub),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    serverTimestamp: vi.fn().mockReturnValue({ toDate: () => new Date() }),
    setDoc: vi.fn(),
    query: vi.fn((col) => col),
    where: vi.fn(() => ({ type: 'where' as const })),
    writeBatch: vi.fn(() => ({
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: mockBatchCommit,
    })),
    collectionGroup: vi.fn(() => ({ type: 'collectionGroup' as const })),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    runTransaction: mockRunTransaction,
    mockUnsub,
  };
});

vi.mock('firebase/firestore', () => ({
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  setDoc,
  query,
  where,
  writeBatch,
  collectionGroup,
  deleteDoc,
  runTransaction,
  increment: vi.fn((n: number) => ({ __increment: n })),
  arrayUnion: vi.fn((v: any) => ({ __arrayUnion: v })),
  arrayRemove: vi.fn((v: any) => ({ __arrayRemove: v })),
  getFirestore: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
}));

// ─── Factory helpers ─────────────────────────────────────────────────────────

function makeMockSnapshot(
  docs: Array<{ id: string } & Record<string, unknown>>,
) {
  return {
    docs: docs.map(({ id, ...rest }) => ({
      id,
      data: () => rest,
      exists: true,
    })),
  };
}

// ─── Imports (resolved after mocks) ──────────────────────────────────────────

import { addBudget, addEjecucion, getCompanies, subscribeEjecuciones, subscribeProviders, addBudgetLink, removeBudgetLink, subscribeBudgetLinks, subscribeEjecucionesByBudget, deleteEjecucion, deleteTercero, subscribeTerceros, batchUpdatePresupuestos, batchUpdateEjecuciones, cascadeTerceroName, updateTercero, batchUpdateTerceros, updateDocumentoMedio } from '@/lib/firestore';
import type { Budget, Ejecucion, EjecucionBudgetLink, Tercero } from '@/lib/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Test suites
// ═══════════════════════════════════════════════════════════════════════════════

describe('addBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Task 2.1 — Path construction
  it('builds correct subcollection path', async () => {
    const budgetData = {
      descripcion: 'test',
      montoPresupuestado: 100,
      projectId: 'proj-1',
      projectName: 'proj-1',
      entityId: 'client-1',
      entityName: 'client-1',
      entityType: 'client' as const,
      tipo: 'ingreso' as const,
      mesPresupuestado: 'Enero' as const,
      fechaPresupuestado: '2026-01',
      estadoProyecto: 'Activo' as const,
    };

    const result = await addBudget('compañia-x', budgetData);

    // collection(db, 'companies', 'compañia-x', 'budgets')
    expect(collection).toHaveBeenCalledWith({}, 'companies', 'compañia-x', 'budgets');
    expect(addDoc).toHaveBeenCalled();
    expect(typeof result).toBe('string');
  });
});

describe('getCompanies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Task 2.2 — Corrupted data
  it('handles doc missing required name field', async () => {
    (getDocs as Mock).mockResolvedValue(
      makeMockSnapshot([{ id: 'x', something: 'y' }]),
    );

    const result = await getCompanies();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('x');
    // `as Company` is a TypeScript-only cast — does NOT provide runtime validation
    expect(result[0].name).toBeUndefined();
  });
});

describe('addEjecucion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Task 2.3 — Timestamp injection
  it('includes createdAt sentinel in addDoc payload', async () => {
    await addEjecucion('empresa-1', {
      descripcion: 'test',
      montoEjecutado: 1000,
      projectId: 'proj-1',
      projectName: 'proj-1',
      entityId: 'client-1',
      entityName: 'client-1',
      entityType: 'client',
      tipo: 'egreso',
      fechaEjecutado: '2024-01-15',
      comprobantes: [],
    });

    expect(serverTimestamp).toHaveBeenCalled();
    const dataArg = (addDoc as Mock).mock.calls[0][1];
    expect(dataArg.createdAt).toBeTruthy();
  });
});

describe('subscribeProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Task 2.4a — Subscription lifecycle: correct path
  it('registers listener with correct top-level path', () => {
    const onData = vi.fn();
    const onError = vi.fn();

    subscribeProviders(onData, onError);

    expect(collection).toHaveBeenCalledWith({}, 'terceros');
  });

  // Task 2.4b — Snapshot delivers mapped documents to onData
  it('delivers mapped documents to onData via snapshot callback', () => {
    const onData = vi.fn();
    const onError = vi.fn();

    subscribeProviders(onData, onError);

    const snapshotCallback = (onSnapshot as Mock).mock.calls[0][1];
    const mockSnapshot = makeMockSnapshot([
      { id: 'p1', name: 'Proveedor A' },
      { id: 'p2', name: 'Proveedor B' },
    ]);
    snapshotCallback(mockSnapshot);

    expect(onData).toHaveBeenCalledWith([
      { id: 'p1', name: 'Proveedor A' },
      { id: 'p2', name: 'Proveedor B' },
    ]);
    expect(onError).not.toHaveBeenCalled();
  });

  // Task 2.4c — Unsubscribe cleans up internal listener
  it('unsubscribe cleans up internal listener', () => {
    const onData = vi.fn();
    const onError = vi.fn();

    const cleanup = subscribeProviders(onData, onError);

    cleanup();
    expect(mockUnsub).toHaveBeenCalledTimes(1);
  });

  // Task 2.4d — Error callback
  it('calls onError when snapshot listener fires error', () => {
    const onData = vi.fn();
    const onError = vi.fn();

    subscribeProviders(onData, onError);

    const errorCallback = (onSnapshot as Mock).mock.calls[0][2];
    const testError = new Error('snapshot error');
    errorCallback(testError);

    expect(onError).toHaveBeenCalledWith(testError);
    expect(onData).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Entity References by ID — Tasks 4.1–4.4
// ═══════════════════════════════════════════════════════════════════════════════

describe('entity-references (4.1): Budget/Ejecucion serialize with new fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('4.1a addBudget accepts budget with all new fields', async () => {
    const budgetData: Omit<Budget, 'id'> = {
      descripcion: 'test',
      projectId: 'proj-1',
      projectName: 'Proyecto Test',
      entityId: 'client-1',
      entityName: 'Cliente Test',
      entityType: 'client',
      tipo: 'ingreso',
      montoPresupuestado: 100000,
      mesPresupuestado: 'Enero',
      fechaPresupuestado: '2026-01',
      estadoProyecto: 'Activo',
    };

    const result = await addBudget('compañia-x', budgetData);

    expect(collection).toHaveBeenCalledWith({}, 'companies', 'compañia-x', 'budgets');
    expect(addDoc).toHaveBeenCalled();
    expect(typeof result).toBe('string');

    // Verify the payload includes all new fields
    const payload = (addDoc as Mock).mock.calls[0][1];
    expect(payload.projectId).toBe('proj-1');
    expect(payload.projectName).toBe('Proyecto Test');
    expect(payload.entityId).toBe('client-1');
    expect(payload.entityName).toBe('Cliente Test');
    expect(payload.entityType).toBe('client');
  });

  it('4.1b addEjecucion accepts ejecucion with all new fields', async () => {
    const ejecucionData: Omit<Ejecucion, 'id'> = {
      descripcion: 'test',
      projectId: 'proj-1',
      projectName: 'Proyecto Test',
      entityId: 'provider-1',
      entityName: 'Proveedor Test',
      entityType: 'provider',
      tipo: 'egreso',
      montoEjecutado: 50000,
      fechaEjecutado: '2026-01-15',
      comprobantes: [],
    };

    const result = await addEjecucion('empresa-1', ejecucionData);

    expect(addDoc).toHaveBeenCalled();
    const payload = (addDoc as Mock).mock.calls[0][1];
    expect(payload.projectId).toBe('proj-1');
    expect(payload.entityType).toBe('provider');
    expect(payload.budgetId).toBeUndefined();
  });

  it('4.1c Budget type supports entityType interno with empty entityId', () => {
    const budget: Budget = {
      id: 'b1',
      descripcion: 'Gasto interno',
      projectId: 'proj-1',
      projectName: 'Proyecto Test',
      entityId: '',
      entityName: 'Interno',
      entityType: 'interno',
      tipo: 'egreso',
      montoPresupuestado: 10000,
      mesPresupuestado: 'Enero',
      fechaPresupuestado: '2026-01',
      estadoProyecto: 'Activo',
    };
    expect(budget.entityType).toBe('interno');
    expect(budget.entityId).toBe('');
    expect(budget.entityName).toBe('Interno');
  });

  it('4.1d Ejecucion type supports all entityType variants', () => {
    const clientEj: Ejecucion = {
      id: 'ej1', descripcion: '', projectId: '', projectName: '',
      entityId: 'c1', entityName: 'Cliente', entityType: 'client',
      tipo: 'ingreso', montoEjecutado: 0, fechaEjecutado: '',
      comprobantes: [],
    };
    const providerEj: Ejecucion = {
      id: 'ej2', descripcion: '', projectId: '', projectName: '',
      entityId: 'p1', entityName: 'Proveedor', entityType: 'provider',
      tipo: 'egreso', montoEjecutado: 0, fechaEjecutado: '',
      comprobantes: [],
    };
    const internoEj: Ejecucion = {
      id: 'ej3', descripcion: '', projectId: '', projectName: '',
      entityId: '', entityName: 'Interno', entityType: 'interno',
      tipo: 'ingreso', montoEjecutado: 0, fechaEjecutado: '',
      comprobantes: [],
    };
    expect(clientEj.entityType).toBe('client');
    expect(providerEj.entityType).toBe('provider');
    expect(internoEj.entityType).toBe('interno');
  });
});

describe('entity-references (4.2): Dashboard groups by projectId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('same projectId different names yields 1 group key', () => {
    // Simulate the matrixData grouping logic from Dashboard.tsx
    const budgets: Budget[] = [
      { id: 'b1', descripcion: '', projectId: 'p1', projectName: 'Old Name', entityId: '', entityName: '', entityType: '', tipo: 'ingreso', montoPresupuestado: 100, mesPresupuestado: 'Enero', fechaPresupuestado: '2026-01', estadoProyecto: 'Activo' },
      { id: 'b2', descripcion: '', projectId: 'p1', projectName: 'New Name', entityId: '', entityName: '', entityType: '', tipo: 'ingreso', montoPresupuestado: 200, mesPresupuestado: 'Febrero', fechaPresupuestado: '2026-02', estadoProyecto: 'Activo' },
    ];

    const groups = new Set(budgets.map(b => b.projectId || b.projectName));
    expect(groups.size).toBe(1);
    expect(groups.has('p1')).toBe(true);
  });

  it('empty projectId falls back to projectName for grouping', () => {
    const budgets: Budget[] = [
      { id: 'b1', descripcion: '', projectId: '', projectName: 'Project A', entityId: '', entityName: '', entityType: '', tipo: 'ingreso', montoPresupuestado: 100, mesPresupuestado: 'Enero', fechaPresupuestado: '2026-01', estadoProyecto: 'Activo' },
      { id: 'b2', descripcion: '', projectId: '', projectName: 'Project A', entityId: '', entityName: '', entityType: '', tipo: 'ingreso', montoPresupuestado: 200, mesPresupuestado: 'Febrero', fechaPresupuestado: '2026-02', estadoProyecto: 'Activo' },
    ];

    const groups = new Set(budgets.map(b => b.projectId || b.projectName));
    expect(groups.size).toBe(1);
    expect(groups.has('Project A')).toBe(true);
  });

  it('different projectIds yield separate groups even with same name', () => {
    const budgets: Budget[] = [
      { id: 'b1', descripcion: '', projectId: 'p1', projectName: 'Same Name', entityId: '', entityName: '', entityType: '', tipo: 'ingreso', montoPresupuestado: 100, mesPresupuestado: 'Enero', fechaPresupuestado: '2026-01', estadoProyecto: 'Activo' },
      { id: 'b2', descripcion: '', projectId: 'p2', projectName: 'Same Name', entityId: '', entityName: '', entityType: '', tipo: 'ingreso', montoPresupuestado: 200, mesPresupuestado: 'Febrero', fechaPresupuestado: '2026-02', estadoProyecto: 'Activo' },
    ];

    const groups = new Set(budgets.map(b => b.projectId || b.projectName));
    expect(groups.size).toBe(2);
  });
});

describe('entity-references (4.3): Datos joins by projectId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('budget projectId matches project id', () => {
    const projects = [{ id: 'proj-x', name: 'Proyecto X', clientId: 'c1', clientName: '', estado: 'Activo' }];
    const budgets: Budget[] = [
      { id: 'b1', descripcion: '', projectId: 'proj-x', projectName: 'Proyecto X', entityId: '', entityName: '', entityType: '', tipo: 'ingreso', montoPresupuestado: 100, mesPresupuestado: 'Enero', fechaPresupuestado: '2026-01', estadoProyecto: 'Activo' },
    ];

    const proyectosConData = projects.map(p => ({
      ...p,
      budgets: budgets.filter(b => b.projectId === p.id),
    }));

    expect(proyectosConData[0].budgets).toHaveLength(1);
    expect(proyectosConData[0].budgets[0].id).toBe('b1');
  });

  it('budget with empty projectId does not match any project by ID', () => {
    const projects = [{ id: 'proj-x', name: 'Proyecto X', clientId: 'c1', clientName: '', estado: 'Activo' }];
    const budgets: Budget[] = [
      { id: 'b1', descripcion: '', projectId: '', projectName: 'Proyecto X', entityId: '', entityName: '', entityType: '', tipo: 'ingreso', montoPresupuestado: 100, mesPresupuestado: 'Enero', fechaPresupuestado: '2026-01', estadoProyecto: 'Activo' },
    ];

    const proyectosConData = projects.map(p => ({
      ...p,
      budgets: budgets.filter(b => b.projectId === p.id),
    }));

    expect(proyectosConData[0].budgets).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Comprobantes — Tasks 1.1 / 4.2
// ═══════════════════════════════════════════════════════════════════════════════

describe('comprobantes (1.1/4.2): Ejecucion deserialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Ejecucion with comprobantes array deserializes correctly', () => {
    const onData = vi.fn();
    const onError = vi.fn();

    subscribeEjecuciones('empresa-1', onData, onError);

    const snapshotCallback = (onSnapshot as Mock).mock.calls[0][1];
    const mockSnapshot = makeMockSnapshot([
      {
        id: 'ej-1',
        descripcion: 'Test',
        projectId: 'proj-1',
        projectName: 'Proyecto',
        entityId: 'prov-1',
        entityName: 'Proveedor',
        entityType: 'provider',
        tipo: 'egreso',
        montoEjecutado: 5000,
        fechaEjecutado: '2026-06-01',
        comprobantes: [
          { id: 'c1', name: 'factura.pdf', url: 'https://storage/1', type: 'application/pdf', size: 1024, uploadedAt: '2026-06-01T12:00:00Z' },
          { id: 'c2', name: 'foto.jpg', url: 'https://storage/2', type: 'image/jpeg', size: 2048, uploadedAt: '2026-06-01T12:30:00Z' },
        ],
      },
    ]);
    snapshotCallback(mockSnapshot);

    expect(onData).toHaveBeenCalledTimes(1);
    const result = onData.mock.calls[0][0] as Ejecucion[];
    expect(result).toHaveLength(1);
    expect(result[0].comprobantes).toHaveLength(2);
    expect(result[0].comprobantes[0].name).toBe('factura.pdf');
    expect(result[0].comprobantes[0].type).toBe('application/pdf');
    expect(result[0].comprobantes[1].name).toBe('foto.jpg');
  });

  it('document without comprobantes field defaults to empty array', () => {
    const onData = vi.fn();
    const onError = vi.fn();

    subscribeEjecuciones('empresa-2', onData, onError);

    const snapshotCallback = (onSnapshot as Mock).mock.calls[0][1];
    // Omit comprobantes entirely — simulate legacy doc
    const mockSnapshot = makeMockSnapshot([
      {
        id: 'ej-legacy',
        descripcion: 'Legacy',
        projectId: 'proj-2',
        projectName: 'Viejo',
        entityId: '',
        entityName: 'Interno',
        entityType: 'interno',
        tipo: 'ingreso',
        montoEjecutado: 1000,
        fechaEjecutado: '2025-01-01',
      },
    ]);
    snapshotCallback(mockSnapshot);

    expect(onData).toHaveBeenCalledTimes(1);
    const result = onData.mock.calls[0][0] as Ejecucion[];
    expect(result).toHaveLength(1);
    expect(result[0].comprobantes).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Bank Account on Ejecucion — PR1-T4
// ═══════════════════════════════════════════════════════════════════════════════

describe('bank-account (PR1-T4): addEjecucion includes cuentaId/cuentaName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes cuentaId and cuentaName when provided', async () => {
    await addEjecucion('empresa-1', {
      descripcion: 'test',
      montoEjecutado: 5000,
      projectId: 'proj-1',
      projectName: 'Proyecto',
      entityId: 'prov-1',
      entityName: 'Proveedor',
      entityType: 'provider',
      tipo: 'egreso',
      fechaEjecutado: '2026-06-01',
      comprobantes: [],
      cuentaId: 'cuenta-1',
      cuentaName: 'Banco XYZ - Corriente (Corriente)',
    });

    const payload = (addDoc as Mock).mock.calls[0][1];
    expect(payload.cuentaId).toBe('cuenta-1');
    expect(payload.cuentaName).toBe('Banco XYZ - Corriente (Corriente)');
  });

  it('omits cuentaId/cuentaName when not provided', async () => {
    await addEjecucion('empresa-1', {
      descripcion: 'test',
      montoEjecutado: 5000,
      projectId: 'proj-1',
      projectName: 'Proyecto',
      entityId: 'prov-1',
      entityName: 'Proveedor',
      entityType: 'provider',
      tipo: 'egreso',
      fechaEjecutado: '2026-06-01',
      comprobantes: [],
    });

    const payload = (addDoc as Mock).mock.calls[0][1];
    expect(payload.cuentaId).toBeUndefined();
    expect(payload.cuentaName).toBeUndefined();
  });
});

describe('bank-account (PR1-T4): subscribeEjecuciones deserializer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deserializes cuentaId and cuentaName from doc', () => {
    const onData = vi.fn();
    const onError = vi.fn();

    subscribeEjecuciones('empresa-1', onData, onError);

    const snapshotCallback = (onSnapshot as Mock).mock.calls[0][1];
    const mockSnapshot = makeMockSnapshot([
      {
        id: 'ej-1',
        descripcion: 'Test',
        projectId: 'proj-1',
        projectName: 'Proyecto',
        entityId: 'prov-1',
        entityName: 'Proveedor',
        entityType: 'provider',
        tipo: 'egreso',
        montoEjecutado: 5000,
        fechaEjecutado: '2026-06-01',
        comprobantes: [],
        cuentaId: 'cuenta-1',
        cuentaName: 'Banco XYZ - Corriente',
      },
    ]);
    snapshotCallback(mockSnapshot);

    const result = onData.mock.calls[0][0] as Ejecucion[];
    expect(result[0].cuentaId).toBe('cuenta-1');
    expect(result[0].cuentaName).toBe('Banco XYZ - Corriente');
  });

  it('handles doc without cuentaId/cuentaName fields', () => {
    const onData = vi.fn();
    const onError = vi.fn();

    subscribeEjecuciones('empresa-2', onData, onError);

    const snapshotCallback = (onSnapshot as Mock).mock.calls[0][1];
    const mockSnapshot = makeMockSnapshot([
      {
        id: 'ej-legacy',
        descripcion: 'Legacy',
        projectId: 'proj-2',
        projectName: 'Viejo',
        entityId: '',
        entityName: 'Interno',
        entityType: 'interno',
        tipo: 'ingreso',
        montoEjecutado: 1000,
        fechaEjecutado: '2025-01-01',
        comprobantes: [],
      },
    ]);
    snapshotCallback(mockSnapshot);

    const result = onData.mock.calls[0][0] as Ejecucion[];
    expect(result[0].cuentaId).toBeUndefined();
    expect(result[0].cuentaName).toBeUndefined();
  });
});

describe('entity-references (4.4): Migration idempotent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('doc already having projectId is skipped', () => {
    // Simulate the migration check: skip docs where projectId already exists
    const alreadyMigrated = (data: Record<string, any>): boolean => !!data.projectId;

    expect(alreadyMigrated({ projectId: 'p1', projectName: 'Test' })).toBe(true);
    expect(alreadyMigrated({ projectId: '', projectName: 'Test' })).toBe(false);
    expect(alreadyMigrated({ projectName: 'Test' })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Budget Links — PR3 (N:M Junction)
// ═══════════════════════════════════════════════════════════════════════════════

describe('budget-links (PR3): addBudgetLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses runTransaction to atomically create link and update budget', async () => {
    const mockTxn = { set: vi.fn(), update: vi.fn(), delete: vi.fn(), get: vi.fn() };
    (runTransaction as Mock).mockImplementation(async (_db: any, fn: any) => {
      await fn(mockTxn);
    });

    await addBudgetLink('c1', 'ej-1', { companyId: 'c1', budgetId: 'b-1', monto: 50000 });

    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(mockTxn.set).toHaveBeenCalledTimes(1);
    expect(mockTxn.update).toHaveBeenCalledTimes(1);

    // Verify the link doc is set with the correct data
    const setCall = mockTxn.set.mock.calls[0];
    expect(setCall[1]).toMatchObject({ companyId: 'c1', budgetId: 'b-1', monto: 50000 });

    // Verify the budget is updated with denormalized fields
    const updateCall = mockTxn.update.mock.calls[0];
    expect(updateCall[1]).toHaveProperty('totalEjecutado');
    expect(updateCall[1]).toHaveProperty('linkedEjecuciones');
  });

  it('propagates error when runTransaction fails', async () => {
    (runTransaction as Mock).mockRejectedValue(new Error('Transaction failed'));

    await expect(
      addBudgetLink('c1', 'ej-1', { companyId: 'c1', budgetId: 'b-1', monto: 50000 }),
    ).rejects.toThrow('Transaction failed');
  });
});

describe('budget-links (PR3): removeBudgetLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses runTransaction to atomically delete link and update budget', async () => {
    const mockTxn = {
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ budgetId: 'b-1', monto: 50000 }),
      }),
    };
    (runTransaction as Mock).mockImplementation(async (_db: any, fn: any) => {
      await fn(mockTxn);
    });

    await removeBudgetLink('c1', 'ej-1', 'link-1');

    expect(runTransaction).toHaveBeenCalledTimes(1);
    // Should read the link first
    expect(mockTxn.get).toHaveBeenCalledTimes(1);
    // Should delete the link doc
    expect(mockTxn.delete).toHaveBeenCalledTimes(1);
    // Should update the budget (denormalized fields)
    expect(mockTxn.update).toHaveBeenCalledTimes(1);
  });

  it('skips budget update when link has no budgetId or monto', async () => {
    const mockTxn = {
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ budgetId: '', monto: 0 }),
      }),
    };
    (runTransaction as Mock).mockImplementation(async (_db: any, fn: any) => {
      await fn(mockTxn);
    });

    await removeBudgetLink('c1', 'ej-1', 'link-1');

    expect(mockTxn.delete).toHaveBeenCalledTimes(1);
    // No budget update should happen
    expect(mockTxn.update).not.toHaveBeenCalled();
  });
});

describe('budget-links (PR3): subscribeBudgetLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listens on budgetLinks subcollection for an ejecucion', () => {
    const onData = vi.fn();
    const onError = vi.fn();

    subscribeBudgetLinks('c1', 'ej-1', onData, onError);

    expect(collection).toHaveBeenCalledWith(
      expect.any(Object), 'companies', 'c1', 'ejecuciones', 'ej-1', 'budgetLinks',
    );
    expect(onSnapshot).toHaveBeenCalled();
  });
});

describe('budget-links (PR3): subscribeEjecucionesByBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to collectionGroup budgetLinks and fetches linked ejecuciones', () => {
    const onData = vi.fn();
    const mockUnsub = vi.fn();

    // Mock: collectionGroup returns a base ref, query composes it
    (collectionGroup as Mock).mockReturnValue({ type: 'collectionGroup' as const, path: 'budgetLinks' });
    (query as Mock).mockReturnValue({ type: 'query' as const, collectionGroup: 'budgetLinks' });

    // Mock: onSnapshot calls back with budgetLink docs whose paths encode ejecucionId
    (onSnapshot as Mock).mockImplementation((_q: any, onNext: any, _onError: any) => {
      onNext({
        docs: [
          {
            id: 'link-1',
            ref: { path: 'companies/c1/ejecuciones/ej-1/budgetLinks/link-1' },
            data: () => ({ companyId: 'c1', budgetId: 'b-1', monto: 50000 }),
          },
          {
            id: 'link-2',
            ref: { path: 'companies/c1/ejecuciones/ej-2/budgetLinks/link-2' },
            data: () => ({ companyId: 'c1', budgetId: 'b-1', monto: 25000 }),
          },
        ],
      });
      return mockUnsub;
    });

    // Mock: fetchDocsByIds → getDocs returns the ejecucion documents
    (getDocs as Mock).mockResolvedValue({
      docs: [
        { id: 'ej-1', data: () => ({ descripcion: 'Pago 1', montoEjecutado: 50000, tipo: 'egreso', comprobantes: [] }) },
        { id: 'ej-2', data: () => ({ descripcion: 'Pago 2', montoEjecutado: 25000, tipo: 'egreso', comprobantes: [] }) },
      ],
    });

    subscribeEjecucionesByBudget('c1', 'b-1', onData);

    expect(collectionGroup).toHaveBeenCalledWith(expect.any(Object), 'budgetLinks');
    expect(query).toHaveBeenCalled();
    expect(onSnapshot).toHaveBeenCalled();
  });

  it('calls onData with empty array when no budgetLinks exist', () => {
    const onData = vi.fn();

    (collectionGroup as Mock).mockReturnValue({ type: 'collectionGroup' as const, path: 'budgetLinks' });
    (query as Mock).mockReturnValue({ type: 'query' as const, collectionGroup: 'budgetLinks' });
    (onSnapshot as Mock).mockImplementation((_q: any, onNext: any, _onError: any) => {
      onNext({ docs: [] });
      return vi.fn();
    });

    subscribeEjecucionesByBudget('c1', 'b-1', onData);

    expect(onData).toHaveBeenCalledWith([]);
  });
});

describe('budget-links: deleteEjecucion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('decrements budget totalEjecutado and removes linkedEjecuciones for each link', async () => {
    const docs = [
      { id: 'link-1', data: () => ({ budgetId: 'b-1', monto: 50000 }) },
      { id: 'link-2', data: () => ({ budgetId: 'b-2', monto: 25000 }) },
    ];
    const emptyDocs = { docs: [], forEach: ([] as any[]).forEach.bind([]) };
    (getDocs as Mock)
      .mockResolvedValueOnce(emptyDocs)  // documentos query (empty)
      .mockResolvedValue({ docs, forEach: docs.forEach.bind(docs) }); // budgetLinks

    await deleteEjecucion('c1', 'ej-1');

    // Should have called batch.update for each link's budget
    expect(writeBatch).toHaveBeenCalledTimes(1);
    const batch = (writeBatch as Mock).mock.results[0].value;
    expect(batch.update).toHaveBeenCalledTimes(2);
    expect(batch.delete).toHaveBeenCalledTimes(3); // 2 links + 1 ejecucion
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('does not update budgets when ejecucion has no budget links', async () => {
    const emptyDocs = { docs: [], forEach: ([] as any[]).forEach.bind([]) };
    (getDocs as Mock)
      .mockResolvedValueOnce(emptyDocs)  // documentos query
      .mockResolvedValue(emptyDocs);     // budgetLinks

    await deleteEjecucion('c1', 'ej-1');

    const batch = (writeBatch as Mock).mock.results[0].value;
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.delete).toHaveBeenCalledTimes(1); // solo ejecucion doc
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('uses increment(-monto) and arrayRemove for denormalized fields', async () => {
    const docs = [
      { id: 'link-1', data: () => ({ budgetId: 'b-1', monto: 50000 }) },
    ];
    const emptyDocs = { docs: [], forEach: ([] as any[]).forEach.bind([]) };
    (getDocs as Mock)
      .mockResolvedValueOnce(emptyDocs)  // documentos query
      .mockResolvedValue({ docs, forEach: docs.forEach.bind(docs) }); // budgetLinks

    await deleteEjecucion('c1', 'ej-1');

    const batch = (writeBatch as Mock).mock.results[0].value;
    expect(batch.update).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        totalEjecutado: { __increment: -50000 },
        linkedEjecuciones: { __arrayRemove: { ejecucionId: 'ej-1', monto: 50000 } },
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// deleteEjecucion — documento unlinking (sistema-medios-desacoplado / PR 3)
// ═══════════════════════════════════════════════════════════════════════════════

describe('deleteEjecucion — documento unlinking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeDocSnapshot(
    docs: Array<{ id: string } & Record<string, unknown>>,
  ) {
    return {
      docs: docs.map(({ id, ...rest }) => ({
        id,
        data: () => rest,
        ref: { id, path: `companies/c1/documentos/${id}` },
      })),
      forEach: function (fn: (d: any) => void) {
        (this as any).docs.forEach(fn);
      },
    };
  }

  it('unlinks linked documentos via batch update on deleteEjecucion', async () => {
    const linkedDocs = [
      { id: 'doc-1', ejecucionIds: ['ej-1', 'ej-2'], status: 'enlazado', fileName: 'a.pdf' },
      { id: 'doc-2', ejecucionIds: ['ej-1'], status: 'enlazado', fileName: 'b.pdf' },
    ];
    const linkDocs = [
      { id: 'link-1', data: () => ({ budgetId: 'b-1', monto: 50000 }) },
    ];
    (getDoc as Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ descripcion: 'test', _movimientoId: 'mov1', _extractoId: 'ext1', cuentaId: 'c1' }),
    });

    // First getDocs call = documentos, second = budgetLinks
    (getDocs as Mock)
      .mockResolvedValueOnce(makeDocSnapshot(linkedDocs))
      .mockResolvedValue({ docs: linkDocs, forEach: linkDocs.forEach.bind(linkDocs) });

    await deleteEjecucion('c1', 'ej-1');

    const batch = (writeBatch as Mock).mock.results[0].value;

    // Should update doc-1: removes 'ej-1' from ejecucionIds, keeps 'ej-2'
    expect(batch.update).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        ejecucionIds: ['ej-2'],
        updatedAt: expect.any(Object),
      }),
    );

    // Should update doc-2: removes 'ej-1', ejecucionIds empty → status por_clasificar
    expect(batch.update).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        ejecucionIds: [],
        status: 'por_clasificar',
        updatedAt: expect.any(Object),
      }),
    );
  });

  it('does not unlink when ejecucion has no linked documentos', async () => {
    (getDoc as Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ descripcion: 'test' }),
    });

    // First getDocs = documentos (empty), second = budgetLinks (empty)
    (getDocs as Mock)
      .mockResolvedValueOnce(makeDocSnapshot([]))
      .mockResolvedValue({ docs: [], forEach: ([] as any[]).forEach.bind([]) });

    await deleteEjecucion('c1', 'ej-1');

    const batch = (writeBatch as Mock).mock.results[0].value;
    // Only the ejecucion delete, no documento updates
    expect(batch.delete).toHaveBeenCalledTimes(1);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('handles documento without ejecucionIds field gracefully', async () => {
    const linkedDocs = [
      // Documento missing ejecucionIds entirely (empty field)
      { id: 'doc-1', status: 'enlazado', fileName: 'a.pdf' },
    ];
    (getDoc as Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ descripcion: 'test' }),
    });

    (getDocs as Mock)
      .mockResolvedValueOnce(makeDocSnapshot(linkedDocs))
      .mockResolvedValue({ docs: [], forEach: ([] as any[]).forEach.bind([]) });

    await deleteEjecucion('c1', 'ej-1');

    const batch = (writeBatch as Mock).mock.results[0].value;
    // Should handle gracefully: treats missing ejecucionIds as []
    expect(batch.update).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        ejecucionIds: [],
        status: 'por_clasificar',
      }),
    );
  });

  it('unlinks documentos AND processes budget links in the same batch', async () => {
    const linkedDocs = [
      { id: 'doc-1', ejecucionIds: ['ej-1'], status: 'enlazado', fileName: 'a.pdf' },
    ];
    const linkDocs = [
      { id: 'link-1', data: () => ({ budgetId: 'b-1', monto: 50000 }) },
    ];
    (getDoc as Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ descripcion: 'test' }),
    });

    (getDocs as Mock)
      .mockResolvedValueOnce(makeDocSnapshot(linkedDocs))
      .mockResolvedValue({ docs: linkDocs, forEach: linkDocs.forEach.bind(linkDocs) });

    await deleteEjecucion('c1', 'ej-1');

    const batch = (writeBatch as Mock).mock.results[0].value;

    // Should have: 1 batch.update for budget + 1 batch.update for doc + 1 batch.delete for link + 1 batch.delete for ejecucion
    expect(batch.update).toHaveBeenCalledTimes(2);
    expect(batch.delete).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});

describe('budget-links: subscribeEjecucionesByBudget isSubscribed guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call onData after unsubscribe', () => {
    const onData = vi.fn();
    let capturedOnNext: any;
    const mockUnsub = vi.fn();

    (collectionGroup as Mock).mockReturnValue({ type: 'collectionGroup' as const });
    (query as Mock).mockReturnValue({ type: 'query' as const });
    (onSnapshot as Mock).mockImplementation((_q: any, onNext: any, _onError: any) => {
      capturedOnNext = onNext;
      return mockUnsub;
    });

    const unsub = subscribeEjecucionesByBudget('c1', 'b-1', onData);

    // Unsubscribe first
    unsub();

    // Then a snapshot fires (stale callback)
    capturedOnNext({ docs: [] });

    // onData should NOT have been called after unsubscribe
    expect(onData).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T9 — Delete Ejecucion con movimiento reset (PR1-T1)
// ═══════════════════════════════════════════════════════════════════════════════

describe('deleteEjecucion con movimiento reset (PR1-T1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets linked movimiento when ejecucion has _movimientoId + budgetLinks', async () => {
    (getDoc as Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({
        _movimientoId: 'mov1',
        _extractoId: 'ext1',
        cuentaId: 'c1',
      }),
    });

    const docs = [
      { id: 'link-1', data: () => ({ budgetId: 'b-1', monto: 50000 }) },
    ];
    const emptyDocs = { docs: [], forEach: ([] as any[]).forEach.bind([]) };
    (getDocs as Mock)
      .mockResolvedValueOnce(emptyDocs)  // documentos query
      .mockResolvedValue({ docs, forEach: docs.forEach.bind(docs) }); // budgetLinks

    await deleteEjecucion('c1', 'ej-1');

    expect(writeBatch).toHaveBeenCalledTimes(1);
    const batch = (writeBatch as Mock).mock.results[0].value;

    // Budget reintegration update
    expect(batch.update).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        totalEjecutado: { __increment: -50000 },
        linkedEjecuciones: { __arrayRemove: { ejecucionId: 'ej-1', monto: 50000 } },
      }),
    );

    // Movimiento reset update
    expect(batch.update).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ convertido: false, _ejecucionId: '' }),
    );

    // 1 link delete + 1 ejecucion delete
    expect(batch.delete).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('skips movimiento reset when ejecucion has no _movimientoId and no links', async () => {
    (getDoc as Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ descripcion: 'test' }),
    });

    const emptyDocs = { docs: [], forEach: ([] as any[]).forEach.bind([]) };
    (getDocs as Mock)
      .mockResolvedValueOnce(emptyDocs)  // documentos query
      .mockResolvedValue(emptyDocs);     // budgetLinks

    await deleteEjecucion('c1', 'ej-1');

    const batch = (writeBatch as Mock).mock.results[0].value;
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.delete).toHaveBeenCalledTimes(1); // solo ejecucion doc
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T9 — Tercero archiving (PR3): deleteTercero + subscribeTerceros
// ═══════════════════════════════════════════════════════════════════════════════

describe('tercero-archiving (PR3): deleteTercero soft delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls updateDoc with archivado: true instead of deleteDoc', async () => {
    await deleteTercero('t1');

    expect(updateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ archivado: true }),
    );
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});

describe('tercero-archiving (PR3): subscribeTerceros with includeArchivados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters out archivados by default (includeArchivados=false)', () => {
    const onData = vi.fn();
    const onError = vi.fn();

    subscribeTerceros(onData, onError);

    const snapshotCallback = (onSnapshot as Mock).mock.calls[0][1];
    const mockSnapshot = makeMockSnapshot([
      { id: 't1', name: 'Activo 1', archivado: false },
      { id: 't2', name: 'Archivado', archivado: true },
      { id: 't3', name: 'Activo 2', archivado: false },
    ]);
    snapshotCallback(mockSnapshot);

    expect(onData).toHaveBeenCalledTimes(1);
    const result = onData.mock.calls[0][0] as Tercero[];
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('t1');
    expect(result[1].id).toBe('t3');
  });

  it('includes archivados when includeArchivados=true', () => {
    const onData = vi.fn();
    const onError = vi.fn();

    subscribeTerceros(onData, onError, true);

    const snapshotCallback = (onSnapshot as Mock).mock.calls[0][1];
    const mockSnapshot = makeMockSnapshot([
      { id: 't1', name: 'Activo 1', archivado: false },
      { id: 't2', name: 'Archivado', archivado: true },
      { id: 't3', name: 'Activo 2' }, // sin archivado field
    ]);
    snapshotCallback(mockSnapshot);

    expect(onData).toHaveBeenCalledTimes(1);
    const result = onData.mock.calls[0][0] as Tercero[];
    expect(result).toHaveLength(3);
  });

  it('handles docs without archivado field (undefined)', () => {
    const onData = vi.fn();
    const onError = vi.fn();

    subscribeTerceros(onData, onError);

    const snapshotCallback = (onSnapshot as Mock).mock.calls[0][1];
    const mockSnapshot = makeMockSnapshot([
      { id: 't1', name: 'Legacy doc' }, // sin archivado
      { id: 't2', name: 'Archivado', archivado: true },
    ]);
    snapshotCallback(mockSnapshot);

    expect(onData).toHaveBeenCalledTimes(1);
    const result = onData.mock.calls[0][0] as Tercero[];
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T-10 — batchUpdatePresupuestos / batchUpdateEjecuciones
// ═══════════════════════════════════════════════════════════════════════════════

describe('T-10: batchUpdatePresupuestos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns successCount=3 with all IDs resolved', async () => {
    (updateDoc as Mock).mockResolvedValue(undefined);

    const result = await batchUpdatePresupuestos(
      'c1',
      ['b1', 'b2', 'b3'],
      { descripcion: 'Updated' },
    );

    expect(result).toEqual({ successCount: 3, failedIds: [] });
    expect(updateDoc).toHaveBeenCalledTimes(3);
  });

  it('returns partial failure with one rejected ID', async () => {
    (updateDoc as Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);

    const result = await batchUpdatePresupuestos(
      'c1',
      ['b1', 'b2', 'b3'],
      { descripcion: 'Updated' },
    );

    expect(result).toEqual({ successCount: 2, failedIds: ['b2'] });
  });

  it('returns zero counts for empty ids array', async () => {
    const result = await batchUpdatePresupuestos('c1', [], { descripcion: 'Updated' });
    expect(result).toEqual({ successCount: 0, failedIds: [] });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('rejects on invalid data without calling updateDoc', async () => {
    await expect(
      batchUpdatePresupuestos('c1', ['b1'], { tipo: 'invalido' }),
    ).rejects.toThrow();
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

describe('T-10: batchUpdateEjecuciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns successCount=3 with all IDs resolved', async () => {
    (updateDoc as Mock).mockResolvedValue(undefined);

    const result = await batchUpdateEjecuciones(
      'c1',
      ['e1', 'e2', 'e3'],
      { descripcion: 'Updated' },
    );

    expect(result).toEqual({ successCount: 3, failedIds: [] });
    expect(updateDoc).toHaveBeenCalledTimes(3);
  });

  it('returns partial failure with one rejected ID', async () => {
    (updateDoc as Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);

    const result = await batchUpdateEjecuciones(
      'c1',
      ['e1', 'e2', 'e3'],
      { descripcion: 'Updated' },
    );

    expect(result).toEqual({ successCount: 2, failedIds: ['e2'] });
  });

  it('returns zero counts for empty ids array', async () => {
    const result = await batchUpdateEjecuciones('c1', [], { descripcion: 'Updated' });
    expect(result).toEqual({ successCount: 0, failedIds: [] });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('rejects on invalid data without calling updateDoc', async () => {
    await expect(
      batchUpdateEjecuciones('c1', ['e1'], { tipo: 'invalido' }),
    ).rejects.toThrow();
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T-11 — cascadeTerceroName
// ═══════════════════════════════════════════════════════════════════════════════

describe('T-11: cascadeTerceroName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when no linked docs exist', async () => {
    (getDocs as Mock).mockResolvedValue({ size: 0, docs: [] });

    await cascadeTerceroName('c1', 't1', 'New Name');

    expect(writeBatch).not.toHaveBeenCalled();
  });

  it('updates 5 docs (2 budgets + 3 ejecuciones) in a single batch', async () => {
    const budgetDocs = [
      { id: 'b1', ref: { path: 'companies/c1/budgets/b1' } },
      { id: 'b2', ref: { path: 'companies/c1/budgets/b2' } },
    ];
    const ejecucionDocs = [
      { id: 'e1', ref: { path: 'companies/c1/ejecuciones/e1' } },
      { id: 'e2', ref: { path: 'companies/c1/ejecuciones/e2' } },
      { id: 'e3', ref: { path: 'companies/c1/ejecuciones/e3' } },
    ];

    (getDocs as Mock)
      .mockResolvedValueOnce({ size: 2, docs: budgetDocs })
      .mockResolvedValueOnce({ size: 3, docs: ejecucionDocs });

    await cascadeTerceroName('c1', 't1', 'New Name');

    const batch = (writeBatch as Mock).mock.results[0].value;
    expect(batch.update).toHaveBeenCalledTimes(5);
    expect(batch.update).toHaveBeenCalledWith(budgetDocs[0].ref, { entityName: 'New Name' });
    expect(batch.update).toHaveBeenCalledWith(budgetDocs[1].ref, { entityName: 'New Name' });
    expect(batch.update).toHaveBeenCalledWith(ejecucionDocs[0].ref, { entityName: 'New Name' });
    expect(batch.update).toHaveBeenCalledWith(ejecucionDocs[1].ref, { entityName: 'New Name' });
    expect(batch.update).toHaveBeenCalledWith(ejecucionDocs[2].ref, { entityName: 'New Name' });
    expect(batch.commit).toHaveBeenCalled();
  });

  it('warns and truncates when >500 linked docs', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const manyDocs = Array.from({ length: 600 }, (_, i) => ({
      id: `d${i}`,
      ref: { path: `companies/c1/budgets/d${i}` },
    }));

    (getDocs as Mock)
      .mockResolvedValueOnce({ size: 300, docs: manyDocs.slice(0, 300) })
      .mockResolvedValueOnce({ size: 300, docs: manyDocs.slice(300) });

    await cascadeTerceroName('c1', 't1', 'New Name');

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('cascadeTerceroName: 600 docs > 500'),
    );
    const batch = (writeBatch as Mock).mock.results[0].value;
    expect(batch.update).toHaveBeenCalledTimes(500);
    warnSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T-12 — updateTercero / batchUpdateTerceros cascade
// ═══════════════════════════════════════════════════════════════════════════════

describe('T-12: updateTercero cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls cascadeTerceroName when name and companyId are provided', async () => {
    (updateDoc as Mock).mockResolvedValue(undefined);
    (getDocs as Mock).mockResolvedValue({ size: 0, docs: [] });

    await updateTercero('t1', { name: 'New Name' }, 'c1');

    expect(updateDoc).toHaveBeenCalled();
    // cascadeTerceroName is the only consumer of getDocs inside updateTercero
    expect(getDocs).toHaveBeenCalled();
  });

  it('does NOT cascade when name is not in data', async () => {
    (updateDoc as Mock).mockResolvedValue(undefined);

    await updateTercero('t1', { tipo: 'cliente' }, 'c1');

    expect(updateDoc).toHaveBeenCalled();
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('does NOT cascade when companyId is not provided', async () => {
    (updateDoc as Mock).mockResolvedValue(undefined);

    await updateTercero('t1', { name: 'New Name' });

    expect(updateDoc).toHaveBeenCalled();
    expect(getDocs).not.toHaveBeenCalled();
  });
});

describe('T-12: batchUpdateTerceros cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cascades only for successful IDs', async () => {
    (updateDoc as Mock)
      .mockResolvedValueOnce(undefined) // t1 succeeds
      .mockResolvedValueOnce(undefined) // t2 succeeds
      .mockRejectedValueOnce(new Error('fail')); // t3 fails
    (getDocs as Mock).mockResolvedValue({ size: 0, docs: [] });

    const result = await batchUpdateTerceros(
      ['t1', 't2', 't3'],
      { name: 'New Name' },
      'c1',
    );

    expect(result).toEqual({ successCount: 2, failedIds: ['t3'] });
    // cascadeTerceroName was triggered for t1 and t2 (not t3)
    expect(getDocs).toHaveBeenCalled();
  });

  it('does NOT cascade when name is not in payload', async () => {
    (updateDoc as Mock).mockResolvedValue(undefined);

    const result = await batchUpdateTerceros(
      ['t1', 't2'],
      { tipo: 'cliente' },
      'c1',
    );

    expect(result).toEqual({ successCount: 2, failedIds: [] });
    expect(getDocs).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// batch-ocr: updateDocumentoMedio
// ═══════════════════════════════════════════════════════════════════════════════

describe('updateDocumentoMedio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates documento with correct path and includes updatedAt', async () => {
    (updateDoc as Mock).mockResolvedValue(undefined);

    const { updateDocumentoMedio } = await import('@/lib/firestore');
    await updateDocumentoMedio('c1', 'doc-1', { tipoDocumento: 'factura_compra' });

    expect(doc).toHaveBeenCalledWith({}, 'companies', 'c1', 'documentos', 'doc-1');
    expect(updateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        tipoDocumento: 'factura_compra',
        updatedAt: expect.any(Object),
      }),
    );
  });

  it('merges multiple fields into the documento', async () => {
    (updateDoc as Mock).mockResolvedValue(undefined);

    const { updateDocumentoMedio } = await import('@/lib/firestore');
    await updateDocumentoMedio('c1', 'doc-2', {
      status: 'enlazado',
      ejecucionIds: ['ej-1'],
      ocrData: { proveedorTexto: 'Test' },
    });

    expect(updateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        status: 'enlazado',
        ejecucionIds: ['ej-1'],
        ocrData: { proveedorTexto: 'Test' },
        updatedAt: expect.any(Object),
      }),
    );
    expect(serverTimestamp).toHaveBeenCalled();
  });
});
