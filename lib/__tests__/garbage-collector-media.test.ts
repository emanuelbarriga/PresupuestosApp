import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Firebase Admin SDK ────────────────────────────────────────────

interface MockStorageFile {
  name: string;
  delete: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
}

let mockBucketFiles: MockStorageFile[] = [];
let mockFirestoreDocs: Array<{ id: string; data: Record<string, unknown> }> = [];

const mockFileDelete = vi.fn().mockResolvedValue([{}]);

function makeMockStorageFile(name: string): MockStorageFile {
  return {
    name,
    delete: vi.fn().mockResolvedValue([{}]),
    exists: vi.fn().mockResolvedValue([true]),
  };
}

const mockFileInstance = {
  delete: mockFileDelete,
  exists: vi.fn().mockResolvedValue([true]),
  copy: vi.fn().mockResolvedValue([{}]),
  name: '',
};

const mockBucket = {
  file: vi.fn(() => mockFileInstance),
  getFiles: vi.fn(),
};

const mockDb: any = {
  collection: vi.fn(),
  batch: vi.fn(() => ({
    delete: vi.fn(),
    set: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
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

function makeDocumentosSnapshot() {
  return {
    docs: mockFirestoreDocs.map(({ id, data }) => ({
      id,
      data: () => data,
      ref: { id, path: `companies/c1/documentos/${id}`, delete: vi.fn().mockResolvedValue(undefined) },
    })),
    forEach: function (fn: (d: any) => void) { this.docs.forEach(fn); },
    size: mockFirestoreDocs.length,
  };
}

function setupMockDb() {
  const companiesSnapshot = makeCompaniesSnapshot(['c1']);

  mockDb.collection.mockImplementation((path: string) => {
    if (path === 'companies') {
      return {
        get: vi.fn().mockResolvedValue(companiesSnapshot),
        doc: vi.fn((cId: string) => ({
          id: cId,
          collection: vi.fn((subPath: string) => {
            if (subPath === 'documentos') {
              return { get: vi.fn().mockResolvedValue(makeDocumentosSnapshot()) };
            }
            return { get: vi.fn().mockResolvedValue({ docs: [], size: 0 }) };
          }),
        })),
      };
    }
    return { get: vi.fn().mockResolvedValue({ docs: [], size: 0 }) };
  });
}

// ─── Tests: garbageCollectMedia (5.4 / 7.9 / 7.10) ─────────────────────

describe('garbageCollectMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFirestoreDocs = [];
    mockBucketFiles = [];
    mockBucket.file.mockReturnValue(mockFileInstance);
  });

  // ── 7.9: Phantom file cross-reference ─────────────────────────────────

  describe('phantom file cleanup (7.9)', () => {
    it('deletes Storage files without matching Firestore record', async () => {
      // Setup: one file in Storage, no records in Firestore
      const phantomFile = makeMockStorageFile('companies/c1/documentos/orphan.pdf');
      mockBucketFiles = [phantomFile];
      mockBucket.getFiles.mockResolvedValue([mockBucketFiles]);
      mockFirestoreDocs = [];

      setupMockDb();

      const { garbageCollectMedia } = await import('@/scripts/garbage-collector-media');
      const result = await garbageCollectMedia(mockDb, mockBucket as any, {
        dryRun: false,
      });

      expect(result.phantomFilesDeleted).toBe(1);
      expect(result.storageFilesFound).toBe(1);
      expect(result.firestoreRecordsFound).toBe(0);
      expect(phantomFile.delete).toHaveBeenCalledTimes(1);
      expect(result.errors).toEqual([]);
    });

    it('does NOT delete files that have matching Firestore records', async () => {
      const storagePath = 'companies/c1/documentos/mydoc.pdf';
      const matchedFile = makeMockStorageFile(storagePath);
      mockBucketFiles = [matchedFile];
      mockBucket.getFiles.mockResolvedValue([mockBucketFiles]);
      mockFirestoreDocs = [
        {
          id: 'doc-1',
          data: {
            fileName: 'mydoc.pdf',
            storagePath,
            status: 'enlazado',
          },
        },
      ];

      setupMockDb();

      const { garbageCollectMedia } = await import('@/scripts/garbage-collector-media');
      const result = await garbageCollectMedia(mockDb, mockBucket as any, {
        dryRun: false,
      });

      expect(result.phantomFilesDeleted).toBe(0);
      expect(result.storageFilesFound).toBe(1);
      expect(result.firestoreRecordsFound).toBe(1);
      expect(matchedFile.delete).not.toHaveBeenCalled();
    });

    it('dry-run mode reports phantom files without deleting', async () => {
      const phantomFile = makeMockStorageFile('companies/c1/documentos/orphan.pdf');
      mockBucketFiles = [phantomFile];
      mockBucket.getFiles.mockResolvedValue([mockBucketFiles]);
      mockFirestoreDocs = [];

      setupMockDb();

      const { garbageCollectMedia } = await import('@/scripts/garbage-collector-media');
      const result = await garbageCollectMedia(mockDb, mockBucket as any, {
        dryRun: true,
      });

      expect(result.phantomFilesDeleted).toBe(1); // Would delete
      expect(phantomFile.delete).not.toHaveBeenCalled(); // But didn't (dry-run)
    });
  });

  // ── 7.10: Abandoned draft cleanup ─────────────────────────────────────

  describe('abandoned draft cleanup (7.10)', () => {
    it('deletes abandoned drafts older than 24h with _source:ejecucion-form', async () => {
      const now = new Date('2026-07-14T12:00:00Z');
      mockFirestoreDocs = [
        {
          id: 'abandoned-1',
          data: {
            fileName: 'old-draft.pdf',
            storagePath: 'companies/c1/documentos/old-draft.pdf',
            status: 'por_clasificar',
            _source: 'ejecucion-form',
            uploadedAt: '2026-07-12T10:00:00Z', // > 24h ago
            ejecucionIds: [],
          },
        },
        {
          id: 'recent-1',
          data: {
            fileName: 'recent.pdf',
            storagePath: 'companies/c1/documentos/recent.pdf',
            status: 'por_clasificar',
            _source: 'ejecucion-form',
            uploadedAt: '2026-07-14T11:00:00Z', // < 24h ago
            ejecucionIds: [],
          },
        },
        {
          id: 'linked-1',
          data: {
            fileName: 'linked.pdf',
            storagePath: 'companies/c1/documentos/linked.pdf',
            status: 'enlazado',
            _source: 'ejecucion-form',
            uploadedAt: '2026-07-10T10:00:00Z',
            ejecucionIds: ['ej-1'],
          },
        },
      ];

      setupMockDb();

      // Clear phantom file results (no files listed)
      mockBucket.getFiles.mockResolvedValue([[]]);

      const { garbageCollectMedia } = await import('@/scripts/garbage-collector-media');
      const result = await garbageCollectMedia(mockDb, mockBucket as any, {
        dryRun: false,
        now,
      });

      expect(result.abandonedDraftsDeleted).toBe(1); // Only the old, unlinked draft
      expect(result.staleUnlinkedDeleted).toBe(0);
      // First call should be for the abandoned draft storage file
      expect(mockFileInstance.delete).toHaveBeenCalledTimes(1); // Phantom files are 0, but the abandoned draft file is deleted
      expect(result.errors).toEqual([]);
    });

    it('skips drafts with _source different from ejecucion-form', async () => {
      const now = new Date('2026-07-14T12:00:00Z');
      mockFirestoreDocs = [
        {
          id: 'inbox-draft',
          data: {
            fileName: 'inbox.pdf',
            storagePath: 'companies/c1/documentos/inbox.pdf',
            status: 'por_clasificar',
            _source: 'inbox-upload',
            uploadedAt: '2026-07-10T10:00:00Z',
            ejecucionIds: [],
          },
        },
      ];

      setupMockDb();
      mockBucket.getFiles.mockResolvedValue([[]]);

      const { garbageCollectMedia } = await import('@/scripts/garbage-collector-media');
      const result = await garbageCollectMedia(mockDb, mockBucket as any, {
        dryRun: false,
        now,
      });

      expect(result.abandonedDraftsDeleted).toBe(0);
      expect(mockFileInstance.delete).not.toHaveBeenCalled();
    });
  });

  // ── Stale unlinked cleanup ────────────────────────────────────────────

  describe('stale unlinked cleanup', () => {
    it('deletes por_clasificar older than 30d with no ejecucionIds', async () => {
      const now = new Date('2026-07-14T12:00:00Z');
      mockFirestoreDocs = [
        {
          id: 'stale-1',
          data: {
            fileName: 'stale.pdf',
            storagePath: 'companies/c1/documentos/stale.pdf',
            status: 'por_clasificar',
            _source: 'inbox-upload',
            uploadedAt: '2026-06-01T10:00:00Z', // > 30d ago
            ejecucionIds: [],
          },
        },
        {
          id: 'recent-unlinked',
          data: {
            fileName: 'recent.pdf',
            storagePath: 'companies/c1/documentos/recent.pdf',
            status: 'por_clasificar',
            _source: 'inbox-upload',
            uploadedAt: '2026-07-10T10:00:00Z', // < 30d ago
            ejecucionIds: [],
          },
        },
      ];

      setupMockDb();
      mockBucket.getFiles.mockResolvedValue([[]]);

      const { garbageCollectMedia } = await import('@/scripts/garbage-collector-media');
      const result = await garbageCollectMedia(mockDb, mockBucket as any, {
        dryRun: false,
        now,
      });

      expect(result.staleUnlinkedDeleted).toBe(1); // Only the 30d+ old one
      expect(result.abandonedDraftsDeleted).toBe(0);
      expect(result.phantomFilesDeleted).toBe(0);
      expect(mockFileInstance.delete).toHaveBeenCalledTimes(1);
      expect(result.errors).toEqual([]);
    });
  });
});
