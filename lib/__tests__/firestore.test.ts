import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// ─── Mock infrastructure (hoisted before imports) ───────────────────────────

const {
  collection,
  doc,
  addDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  setDoc,
  query,
  where,
  mockUnsub,
} = vi.hoisted(() => {
  const mockUnsub = vi.fn();
  return {
    collection: vi.fn(() => ({ type: 'collection' as const })),
    doc: vi.fn(() => ({ type: 'doc' as const })),
    addDoc: vi.fn().mockResolvedValue({ id: 'new-id' }),
    getDocs: vi.fn(),
    onSnapshot: vi.fn().mockReturnValue(mockUnsub),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    serverTimestamp: vi.fn().mockReturnValue({ toDate: () => new Date() }),
    setDoc: vi.fn(),
    query: vi.fn((col) => col),
    where: vi.fn(() => ({ type: 'where' as const })),
    mockUnsub,
  };
});

vi.mock('firebase/firestore', () => ({
  collection,
  doc,
  addDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  setDoc,
  query,
  where,
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

import { addBudget, addEjecucion, getCompanies, subscribeEjecuciones, subscribeProviders } from '@/lib/firestore';
import type { Budget, Ejecucion } from '@/lib/types';

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
