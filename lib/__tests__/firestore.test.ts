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

import { addBudget, addEjecucion, getCompanies, subscribeProviders } from '@/lib/firestore';

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
      proyectoAsignado: 'proj-1',
      clienteOProveedor: 'client-1',
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
      proyectoAsignado: 'proj-1',
      clienteOProveedor: 'client-1',
      tipo: 'egreso',
      fechaEjecutado: '2024-01-15',
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

    expect(collection).toHaveBeenCalledWith({}, 'providers');
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
