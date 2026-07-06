import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// ─── Mock infrastructure ───────────────────────────────────────────────

const {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  writeBatch,
  mockUnsub,
} = vi.hoisted(() => {
  const mockUnsub = vi.fn();
  const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
  const mockBatchDelete = vi.fn();
  const mockBatchSet = vi.fn();
  return {
    collection: vi.fn(() => ({ type: 'collection' as const })),
    doc: vi.fn(() => ({ type: 'doc' as const, id: 'new-mov-id', path: 'companies/c1/cuentasBancarias/a1/extractos/e1/movimientos/new-mov-id' })),
    addDoc: vi.fn().mockResolvedValue({ id: 'new-id' }),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    getDocs: vi.fn(),
    onSnapshot: vi.fn().mockReturnValue(mockUnsub),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    serverTimestamp: vi.fn().mockReturnValue({ toDate: () => new Date() }),
    writeBatch: vi.fn(() => ({
      set: mockBatchSet,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    })),
    mockUnsub,
  };
});

vi.mock('firebase/firestore', () => ({
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  writeBatch,
  getFirestore: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
}));

// ─── Factory helpers ───────────────────────────────────────────────────

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

// ─── Imports ───────────────────────────────────────────────────────────

import {
  subscribeMovimientos,
  batchAddMovimientos,
  deleteMovimiento,
  fetchMovimientoHashes,
  updateExtractoStatus,
} from '@/lib/firestore';
import type { MovimientoBancarioInput } from '@/lib/types';
import type { Banco } from '@/lib/types';

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('subscribeMovimientos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers listener with correct subcollection path', () => {
    const onData = vi.fn();
    subscribeMovimientos('c1', 'a1', 'e1', onData);

    expect(collection).toHaveBeenCalledWith(
      expect.any(Object),
      'companies', 'c1', 'cuentasBancarias', 'a1', 'extractos', 'e1', 'movimientos',
    );
    expect(onSnapshot).toHaveBeenCalled();
  });

  it('delivers mapped documents to onData', () => {
    const onData = vi.fn();
    subscribeMovimientos('c1', 'a1', 'e1', onData);

    const snapshotCallback = (onSnapshot as Mock).mock.calls[0][1];
    const mockSnapshot = makeMockSnapshot([
      { id: 'm1', fecha: '2026-02-03', descripcion: 'Test', saldo: 1000, moneda: 'COP', ordinal: 1, bancoOrigen: 'Bancolombia' },
      { id: 'm2', fecha: '2026-02-04', descripcion: 'Test2', saldo: 2000, moneda: 'COP', ordinal: 2, bancoOrigen: 'Bancolombia' },
    ]);
    snapshotCallback(mockSnapshot);

    expect(onData).toHaveBeenCalledTimes(1);
    const result = onData.mock.calls[0][0];
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('m1');
    expect(result[1].id).toBe('m2');
  });

  it('returns unsubscribe function', () => {
    const onData = vi.fn();
    const cleanup = subscribeMovimientos('c1', 'a1', 'e1', onData);

    cleanup();
    expect(mockUnsub).toHaveBeenCalledTimes(1);
  });

  it('calls onError when snapshot fails', () => {
    const onData = vi.fn();
    const onError = vi.fn();
    subscribeMovimientos('c1', 'a1', 'e1', onData, onError);

    const errorCallback = (onSnapshot as Mock).mock.calls[0][2];
    const testError = new Error('snapshot error');
    errorCallback(testError);

    expect(onError).toHaveBeenCalledWith(testError);
    expect(onData).not.toHaveBeenCalled();
  });
});

describe('batchAddMovimientos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeMov = (ordinal: number, overrides?: Partial<MovimientoBancarioInput>): MovimientoBancarioInput => ({
    fecha: '2026-02-03',
    descripcion: `Mov ${ordinal}`,
    saldo: 1000 * ordinal,
    moneda: 'COP',
    ordinal,
    bancoOrigen: 'Bancolombia' as Banco,
    ...overrides,
  });

  it('writes batch with correct subcollection path', async () => {
    const movs = [makeMov(1), makeMov(2)];
    const ids = await batchAddMovimientos('c1', 'a1', 'e1', movs);

    expect(collection).toHaveBeenCalledWith(
      expect.any(Object),
      'companies', 'c1', 'cuentasBancarias', 'a1', 'extractos', 'e1', 'movimientos',
    );
    expect(writeBatch).toHaveBeenCalled();
    expect(writeBatch).toHaveBeenCalledWith({});
    expect(ids).toHaveLength(2);
  });

  it('assigns createdAt via serverTimestamp', async () => {
    const movs = [makeMov(1)];
    await batchAddMovimientos('c1', 'a1', 'e1', movs);

    // First doc ref creation triggers doc() call
    expect(serverTimestamp).toHaveBeenCalled();
  });

  it('handles up to 500 movimientos', async () => {
    const movs = Array.from({ length: 500 }, (_, i) => makeMov(i + 1));
    const ids = await batchAddMovimientos('c1', 'a1', 'e1', movs);

    expect(ids).toHaveLength(500);
  });

  it('throws when given more than 500 movimientos (Firestore batch limit)', async () => {
    const movs = Array.from({ length: 501 }, (_, i) => makeMov(i + 1));
    await expect(
      batchAddMovimientos('c1', 'a1', 'e1', movs),
    ).rejects.toThrow('batch');
  });
});

describe('deleteMovimiento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls deleteDoc with correct path', async () => {
    await deleteMovimiento('c1', 'a1', 'e1', 'm1');

    expect(doc).toHaveBeenCalledWith(
      expect.any(Object),
      'companies', 'c1', 'cuentasBancarias', 'a1', 'extractos', 'e1', 'movimientos', 'm1',
    );
    expect(deleteDoc).toHaveBeenCalled();
  });
});

describe('fetchMovimientoHashes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns hash values from documents', async () => {
    (getDocs as Mock).mockResolvedValue(
      makeMockSnapshot([
        { id: 'm1', hash: 'abc123' },
        { id: 'm2', hash: 'def456' },
        { id: 'm3' }, // no hash
      ]),
    );

    const hashes = await fetchMovimientoHashes('c1', 'a1', 'e1');

    expect(getDocs).toHaveBeenCalled();
    expect(hashes).toContain('abc123');
    expect(hashes).toContain('def456');
    expect(hashes).toHaveLength(2); // only docs with hash
  });

  it('returns empty array when no documents have hashes', async () => {
    (getDocs as Mock).mockResolvedValue(makeMockSnapshot([]));

    const hashes = await fetchMovimientoHashes('c1', 'a1', 'e1');
    expect(hashes).toEqual([]);
  });
});

describe('updateExtractoStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates estado on the extracto doc', async () => {
    await updateExtractoStatus('c1', 'a1', 'e1', 'Parseando');

    expect(doc).toHaveBeenCalledWith(
      expect.any(Object),
      'companies', 'c1', 'cuentasBancarias', 'a1', 'extractos', 'e1',
    );
    expect(updateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ estado: 'Parseando' }),
    );
  });

  it('includes totalMovimientosParseados when provided in meta', async () => {
    await updateExtractoStatus('c1', 'a1', 'e1', 'Completado', { totalMovimientosParseados: 42 });

    expect(updateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        estado: 'Completado',
        totalMovimientosParseados: 42,
      }),
    );
  });

  it('includes errorParseo when provided in meta', async () => {
    await updateExtractoStatus('c1', 'a1', 'e1', 'Error de parseo', {
      errorParseo: 'PDF corrupto',
    });

    expect(updateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        estado: 'Error de parseo',
        errorParseo: 'PDF corrupto',
      }),
    );
  });

  it('includes only estado when no meta provided', async () => {
    await updateExtractoStatus('c1', 'a1', 'e1', 'Completado');

    expect(updateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      { estado: 'Completado', updatedAt: expect.any(Object) },
    );
  });
});
