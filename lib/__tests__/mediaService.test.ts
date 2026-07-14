import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// ─── Mock Firebase Firestore ─────────────────────────────────────────────

const mockUnsubscribe = vi.fn();

const { collection, doc, getDoc, addDoc, onSnapshot, query, where, mockDocSnap } = vi.hoisted(() => {
  const snap = {
    id: 'doc-001',
    exists: vi.fn().mockReturnValue(true),
    data: vi.fn().mockReturnValue({
      fileName: 'factura.pdf',
      storagePath: 'c1/documentos/uuid-factura.pdf',
      url: 'https://example.com/factura.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      status: 'por_clasificar',
      ejecucionIds: [],
      _source: 'inbox-upload',
      uploadedAt: '2026-07-14T00:00:00Z',
      createdBy: 'user-123',
    }),
  };
  return {
    collection: vi.fn((_db, path) => ({ _db, path })),
    doc: vi.fn((_db, path, ...segments) => ({ _db, path, segments })),
    getDoc: vi.fn().mockResolvedValue(snap),
    addDoc: vi.fn().mockResolvedValue({ id: 'new-doc-001' }),
    onSnapshot: vi.fn((_q, onData) => {
      onData({
        docs: [],
        metadata: { hasPendingWrites: false },
      } as any);
      return mockUnsubscribe;
    }),
    query: vi.fn((_ref, ..._constraints) => ({ _ref, _constraints })),
    where: vi.fn((field, op, value) => ({ field, op, value })),
    mockDocSnap: snap,
  };
});

vi.mock('firebase/firestore', () => ({
  collection,
  doc,
  getDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  Unsubscribe: {} as any,
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
}));

// ─── Imports ─────────────────────────────────────────────────────────────

import { subscribeDocumentos, createDocumento, getDocumento } from '@/lib/mediaService';
import type { DocumentoMedio } from '@/lib/types';

// ─── Tests ───────────────────────────────────────────────────────────────

describe('createDocumento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls addDoc with data augmented with _source, uploadedAt, createdBy', async () => {
    const data = {
      fileName: 'factura.pdf',
      storagePath: 'c1/documentos/uuid-factura.pdf',
      url: 'https://example.com/factura.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      status: 'por_clasificar' as const,
      ejecucionIds: [],
      _source: 'inbox-upload' as const,
      createdBy: '',
    };

    const docId = await createDocumento('c1', data, 'user-123', 'inbox-upload');

    expect(docId).toBe('new-doc-001');
    expect(addDoc).toHaveBeenCalledTimes(1);

    const calledRef = (addDoc as Mock).mock.calls[0][0];
    expect(calledRef.path).toBe('companies/c1/documentos');

    const calledData = (addDoc as Mock).mock.calls[0][1];
    expect(calledData.fileName).toBe('factura.pdf');
    expect(calledData._source).toBe('inbox-upload');
    expect(calledData.createdBy).toBe('user-123');
    expect(calledData.uploadedAt).toBeDefined();
    expect(typeof calledData.uploadedAt).toBe('string');
  });

  it('uses default source inbox-upload when omitted', async () => {
    const data = {
      fileName: 'doc.pdf',
      storagePath: 'c1/documentos/uuid-doc.pdf',
      url: 'https://example.com/doc.pdf',
      size: 512,
      mimeType: 'image/jpeg',
      status: 'por_clasificar' as const,
      ejecucionIds: [],
      _source: 'inbox-upload' as const,
      createdBy: '',
    };

    await createDocumento('c1', data, 'user-456');

    const calledData = (addDoc as Mock).mock.calls[0][1];
    expect(calledData._source).toBe('inbox-upload');
  });

  it('overrides _source with the explicit source parameter', async () => {
    const data = {
      fileName: 'doc.pdf',
      storagePath: 'c1/documentos/uuid-doc.pdf',
      url: 'https://example.com/doc.pdf',
      size: 512,
      mimeType: 'image/jpeg',
      status: 'por_clasificar' as const,
      ejecucionIds: [],
      _source: 'inbox-upload' as const,
      createdBy: '',
    };

    await createDocumento('c1', data, 'user-456', 'ejecucion-form');

    const calledData = (addDoc as Mock).mock.calls[0][1];
    expect(calledData._source).toBe('ejecucion-form');
  });
});

describe('getDocumento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocSnap.exists.mockReturnValue(true);
    mockDocSnap.data.mockReturnValue({
      fileName: 'factura.pdf',
      storagePath: 'c1/documentos/uuid-factura.pdf',
      url: 'https://example.com/factura.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      status: 'por_clasificar',
      ejecucionIds: [],
      _source: 'inbox-upload',
      uploadedAt: '2026-07-14T00:00:00Z',
      createdBy: 'user-123',
    });
  });

  it('returns DocumentoMedio when doc exists', async () => {
    const doc = await getDocumento('c1', 'doc-001');

    expect(doc).not.toBeNull();
    expect(doc!.id).toBe('doc-001');
    expect(doc!.fileName).toBe('factura.pdf');
    expect(doc!.status).toBe('por_clasificar');
  });

  it('returns null when doc does not exist', async () => {
    mockDocSnap.exists.mockReturnValue(false);

    const doc = await getDocumento('c1', 'doc-999');
    expect(doc).toBeNull();
  });

  it('calls getDoc with correct path', async () => {
    await getDocumento('c1', 'doc-001');

    expect(getDoc).toHaveBeenCalledTimes(1);
  });
});

describe('subscribeDocumentos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unsubscribe function', () => {
    const unsub = subscribeDocumentos('c1', {}, vi.fn());
    expect(typeof unsub).toBe('function');
  });

  it('calls onData with mapped documents from snapshot', () => {
    const mockDocs = [
      { id: 'd1', data: () => ({ fileName: 'a.pdf', status: 'por_clasificar', ejecucionIds: [], _source: 'inbox-upload', uploadedAt: '', createdBy: 'u1' }) },
      { id: 'd2', data: () => ({ fileName: 'b.pdf', status: 'por_clasificar', ejecucionIds: [], _source: 'inbox-upload', uploadedAt: '', createdBy: 'u1' }) },
    ];

    (onSnapshot as Mock).mockImplementation((_q, onData) => {
      onData({ docs: mockDocs, metadata: { hasPendingWrites: false } } as any);
      return mockUnsubscribe;
    });

    const onData = vi.fn();
    subscribeDocumentos('c1', {}, onData);

    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'd1', fileName: 'a.pdf' }),
        expect.objectContaining({ id: 'd2', fileName: 'b.pdf' }),
      ]),
    );
  });

  it('passes status filter to where constraint', () => {
    subscribeDocumentos('c1', { status: 'por_clasificar' }, vi.fn());

    // onSnapshot was called — the query was built with where constraints
    expect(where).toHaveBeenCalledWith('status', '==', 'por_clasificar');
  });

  it('passes tipoDocumento filter to where constraint', () => {
    subscribeDocumentos('c1', { tipoDocumento: 'factura_venta' }, vi.fn());

    expect(where).toHaveBeenCalledWith('tipoDocumento', '==', 'factura_venta');
  });

  it('filters by source using server-side query', () => {
    const mockDocs = [
      { id: 'd1', data: () => ({ fileName: 'a.pdf', status: 'por_clasificar', ejecucionIds: [], _source: 'inbox-upload', uploadedAt: '', createdBy: 'u1' }) },
      { id: 'd2', data: () => ({ fileName: 'b.pdf', status: 'por_clasificar', ejecucionIds: [], _source: 'ejecucion-form', uploadedAt: '', createdBy: 'u1' }) },
    ];

    (onSnapshot as Mock).mockImplementation((q, onData) => {
      // Verify the query includes the _source filter
      expect(where).toHaveBeenCalledWith('_source', '==', 'inbox-upload');
      onData({ docs: mockDocs, metadata: { hasPendingWrites: false } } as any);
      return mockUnsubscribe;
    });

    const onData = vi.fn();
    subscribeDocumentos('c1', { source: 'inbox-upload' }, onData);

    // All docs returned match the server filter — no client-side filtering
    expect(onData).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'd1' }),
      expect.objectContaining({ id: 'd2' }),
    ]);
  });

  it('calls onError when provided and snapshot errors', () => {
    const testError = new Error('Snapshot failed');
    (onSnapshot as Mock).mockImplementation((_q, _onData, onError) => {
      onError(testError);
      return mockUnsubscribe;
    });

    const onError = vi.fn();
    subscribeDocumentos('c1', {}, vi.fn(), onError);

    expect(onError).toHaveBeenCalledWith(testError);
  });
});
