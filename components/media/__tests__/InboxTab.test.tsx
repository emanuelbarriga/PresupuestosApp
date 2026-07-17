/**
 * Tests for InboxTab — selection, action bar, batch OCR, retry/dismiss.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { DocumentoMedio } from '@/lib/types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const { mockUnsub, mockUpdateDoc } = vi.hoisted(() => ({
  mockUnsub: vi.fn(),
  mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => {
  const mockOnSnapshot = vi.fn((_q: unknown, onData: (snap: any) => void) => {
    onData({ docs: [], docChanges: () => [] });
    return mockUnsub;
  });
  return {
    collection: vi.fn(() => 'collection-ref'),
    doc: vi.fn((..._args: unknown[]) => ({ type: 'doc', id: 'doc-ref' })),
    getDoc: vi.fn(),
    serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
    query: vi.fn(() => 'query-ref'),
    where: vi.fn(() => 'where-ref'),
    onSnapshot: mockOnSnapshot,
    updateDoc: mockUpdateDoc,
  };
});

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { getIdToken: vi.fn().mockResolvedValue('mock-token') },
  })),
}));

vi.mock('@/lib/mediaService', () => ({
  subscribeDocumentos: vi.fn((_cId: string, _opts: unknown, onData: (docs: DocumentoMedio[]) => void, _onError: unknown) => {
    (globalThis as any).__inbox_onData = onData;
    return mockUnsub;
  }),
  createDocumento: vi.fn(),
}));

vi.mock('@/lib/fileUpload', () => ({
  uploadFileWithTask: vi.fn(() => ({
    promise: Promise.resolve({ path: 'test/path.pdf', url: 'https://example.com/test.pdf' }),
    task: { cancel: vi.fn() },
  })),
  validateFile: vi.fn(() => ({ valid: true })),
  generateMediaFilePath: vi.fn(() => 'test/path.pdf'),
}));

vi.mock('@/lib/firestore', () => ({
  updateDocumentoMedio: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ocr', () => ({
  getFriendlyErrorMessage: vi.fn(
    (_errorBody?: string, status?: number) => {
      if (status === 429) return 'Demasiadas solicitudes. Esperá unos segundos y reintentá.';
      if (status === 502) return 'No se pudo leer el documento. Puede estar borroso o ilegible.';
      return 'Error al procesar el documento. Reintentá más tarde.';
    },
  ),
}));

// ─── Import AFTER mocks ─────────────────────────────────────────────────────

import { InboxTab } from '../InboxTab';

const defaultProps = {
  companyId: 'test-company',
  onNavigate: vi.fn(),
};

function buildDoc(overrides: Partial<DocumentoMedio> & { id?: string } = {}): DocumentoMedio {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    fileName: 'doc.pdf',
    storagePath: 'test/doc.pdf',
    url: 'https://example.com/doc.pdf',
    size: 1024,
    mimeType: 'application/pdf',
    status: 'por_clasificar',
    ejecucionIds: [],
    _source: 'inbox-upload',
    uploadedAt: new Date().toISOString(),
    createdBy: 'user-1',
    ...overrides,
  };
}

function pushDocs(docs: DocumentoMedio[]): void {
  const onData = (globalThis as any).__inbox_onData;
  if (onData) onData(docs);
}

/**
 * Helper to create a fetch mock that resolves all calls with a given response.
 * Each call to fetch() resolves with the SAME response value.
 */
function mockFetchResolves(value: unknown): void {
  globalThis.fetch = vi.fn().mockResolvedValue(value);
}

/**
 * Helper to create a fetch mock where each subsequent call resolves with
 * the corresponding element in the responses array (round-robins).
 */
function mockFetchSequence(responses: unknown[]): void {
  let i = 0;
  globalThis.fetch = vi.fn().mockImplementation(() => {
    const r = responses[i % responses.length];
    i++;
    return Promise.resolve(r);
  });
}

// ─── Tests: Task 3 — Selection + Checkboxes ──────────────────────────────────

describe('InboxTab — Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__inbox_onData = undefined;
  });

  it('shows checkbox per document card and toggles selection on click', async () => {
    render(<InboxTab {...defaultProps} />);
    pushDocs([buildDoc({ id: 'doc-1', fileName: 'factura.pdf' })]);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    expect(checkboxes.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(checkboxes[checkboxes.length - 1]); // last checkbox = doc checkbox
    await waitFor(() => {
      expect((checkboxes[checkboxes.length - 1] as HTMLInputElement).checked).toBe(true);
    });
  });

  it('prevents card navigation when clicking checkbox via stopPropagation', async () => {
    render(<InboxTab {...defaultProps} />);
    pushDocs([buildDoc({ id: 'doc-1', fileName: 'factura.pdf' })]);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    fireEvent.click(checkboxes[checkboxes.length - 1]);
    expect(defaultProps.onNavigate).not.toHaveBeenCalled();
  });

  it('select all toggles all visible documents', async () => {
    render(<InboxTab {...defaultProps} />);
    pushDocs([
      buildDoc({ id: 'doc-1', fileName: 'a.pdf' }),
      buildDoc({ id: 'doc-2', fileName: 'b.pdf' }),
      buildDoc({ id: 'doc-3', fileName: 'c.pdf' }),
    ]);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    expect(checkboxes.length).toBe(4); // select-all + 3 doc checkboxes

    // Click select-all (first checkbox in header)
    fireEvent.click(checkboxes[0]);
    await waitFor(() => {
      for (let i = 1; i <= 3; i++) {
        expect((checkboxes[i] as HTMLInputElement).checked).toBe(true);
      }
    });

    fireEvent.click(checkboxes[0]);
    await waitFor(() => {
      for (let i = 1; i <= 3; i++) {
        expect((checkboxes[i] as HTMLInputElement).checked).toBe(false);
      }
    });
  });

  it('select all selects up to 30 when more than 30 documents exist', async () => {
    render(<InboxTab {...defaultProps} />);
    const docs: DocumentoMedio[] = [];
    for (let i = 0; i < 35; i++) {
      docs.push(buildDoc({ id: `doc-${i}`, fileName: `doc-${i}.pdf` }));
    }
    pushDocs(docs);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    expect(checkboxes.length).toBe(36); // select-all + 35 doc checkboxes

    fireEvent.click(checkboxes[0]);

    const selectedCount = Array.from(checkboxes).filter((cb, i) => i > 0 && (cb as HTMLInputElement).checked).length;
    expect(selectedCount).toBe(30);
  });

  it('disables additional checkboxes when 30 selected, keeps selected ones enabled', async () => {
    render(<InboxTab {...defaultProps} />);
    const docs: DocumentoMedio[] = [];
    for (let i = 0; i < 32; i++) {
      docs.push(buildDoc({ id: `doc-${i}`, fileName: `doc-${i}.pdf` }));
    }
    pushDocs(docs);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));

    // Select first 30 doc checkboxes (indices 1-30)
    for (let i = 1; i <= 30; i++) {
      fireEvent.click(checkboxes[i]);
    }

    await waitFor(() => {
      // Checkbox at index 31 (32nd doc) should be disabled
      expect((checkboxes[31] as HTMLInputElement).disabled).toBe(true);
      // Checkbox at index 1 (already selected) should NOT be disabled
      expect((checkboxes[1] as HTMLInputElement).disabled).toBe(false);
    });
  });

  it('shows selection counter with correct count', async () => {
    render(<InboxTab {...defaultProps} />);
    pushDocs([
      buildDoc({ id: 'doc-1', fileName: 'a.pdf' }),
      buildDoc({ id: 'doc-2', fileName: 'b.pdf' }),
    ]);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));

    fireEvent.click(checkboxes[1]);
    await waitFor(() => {
      // Header counter span — there may be duplicates (action bar), check at least one
      const counters = screen.getAllByText(/1 seleccionado/i);
      expect(counters.length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(checkboxes[2]);
    await waitFor(() => {
      const counters = screen.getAllByText(/2 seleccionados/i);
      expect(counters.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows 30/30 máximo at selection limit', async () => {
    render(<InboxTab {...defaultProps} />);
    const docs: DocumentoMedio[] = [];
    for (let i = 0; i < 30; i++) {
      docs.push(buildDoc({ id: `doc-${i}`, fileName: `doc-${i}.pdf` }));
    }
    pushDocs(docs);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    for (let i = 1; i <= 30; i++) {
      fireEvent.click(checkboxes[i]);
    }

    await waitFor(() => {
      expect(screen.getByText(/30\/30 máximo/i)).toBeDefined();
    });
  });
});

// ─── Tests: Task 4 — Floating Action Bar ─────────────────────────────────────

describe('InboxTab — Action Bar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__inbox_onData = undefined;
    (globalThis as any).fetch = undefined;
  });

  it('does not show action bar when nothing is selected', async () => {
    render(<InboxTab {...defaultProps} />);
    pushDocs([buildDoc({ id: 'doc-1', fileName: 'a.pdf' })]);

    await waitFor(() => {
      expect(screen.queryByText(/Extraer con IA/i)).toBeNull();
    });
  });

  it('shows action bar with Extraer con IA (N) when documents selected', async () => {
    render(<InboxTab {...defaultProps} />);
    pushDocs([
      buildDoc({ id: 'doc-1', fileName: 'a.pdf' }),
      buildDoc({ id: 'doc-2', fileName: 'b.pdf' }),
      buildDoc({ id: 'doc-3', fileName: 'c.pdf' }),
    ]);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    for (let i = 1; i <= 3; i++) fireEvent.click(checkboxes[i]);

    await waitFor(() => {
      expect(screen.getByText(/Extraer con IA \(3\)/i)).toBeDefined();
    });
  });

  it('hides action bar when selection is cleared via Limpiar', async () => {
    render(<InboxTab {...defaultProps} />);
    pushDocs([buildDoc({ id: 'doc-1', fileName: 'a.pdf' })]);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    fireEvent.click(checkboxes[1]);

    await waitFor(() => {
      expect(screen.getByText(/Extraer con IA \(1\)/i)).toBeDefined();
    });

    fireEvent.click(screen.getByText(/Limpiar/i));
    await waitFor(() => {
      expect(screen.queryByText(/Extraer con IA/i)).toBeNull();
    });
  });

  it('shows progress counter and Cancel during processing', async () => {
    // Fetch never resolves → stays in processing state
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    render(<InboxTab {...defaultProps} />);
    pushDocs([buildDoc({ id: 'doc-1', fileName: 'a.pdf' })]);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    fireEvent.click(checkboxes[1]);

    const extractBtn = await waitFor(() => screen.getByText(/Extraer con IA \(1\)/i));
    fireEvent.click(extractBtn);

    // Small delay to let START_DOC dispatch
    await waitFor(() => {
      expect(screen.getByText(/0\/1 procesados/i)).toBeDefined();
      expect(screen.getByText(/Cancelar/i)).toBeDefined();
    });
  });

  it('shows done state with Procesados: N/N when all complete', async () => {
    mockFetchResolves({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        proveedorTexto: 'Test Provider',
        tipoDocumentoSugerido: 'factura_compra',
        fechaDocumento: '2026-07-15',
        descripcion: 'Test description',
      }),
    });

    const { getDoc } = await import('firebase/firestore');
    (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      exists: () => true,
      data: () => ({
        tipoDocumento: '',
        periodo: '',
        metadata: { descripcion: '' },
      }),
    });

    render(<InboxTab {...defaultProps} />);
    pushDocs([buildDoc({ id: 'doc-1', fileName: 'a.pdf' })]);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText(/Extraer con IA \(1\)/i));

    await waitFor(() => {
      expect(screen.getByText(/Procesados: 1\/1/i)).toBeDefined();
    }, { timeout: 5000 });
  });
});

// ─── Tests: Task 5 — Batch OCR + Overlays ────────────────────────────────────

describe('InboxTab — Batch OCR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__inbox_onData = undefined;
    (globalThis as any).fetch = undefined;
  });

  it('processes 3 docs and shows final done state', async () => {
    // Each fetch call resolves with success
    mockFetchResolves({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        proveedorTexto: 'Provider',
        tipoDocumentoSugerido: 'factura_compra',
        fechaDocumento: '2026-07-15',
        descripcion: 'Desc',
      }),
    });

    const { getDoc } = await import('firebase/firestore');
    (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      exists: () => true,
      data: () => ({ tipoDocumento: '', periodo: '', metadata: {} }),
    });

    render(<InboxTab {...defaultProps} />);
    pushDocs([
      buildDoc({ id: 'doc-1', fileName: 'a.pdf' }),
      buildDoc({ id: 'doc-2', fileName: 'b.pdf' }),
      buildDoc({ id: 'doc-3', fileName: 'c.pdf' }),
    ]);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    for (let i = 1; i <= 3; i++) fireEvent.click(checkboxes[i]);
    fireEvent.click(screen.getByText(/Extraer con IA \(3\)/i));

    await waitFor(() => {
      expect(screen.getByText(/Procesados: 3\/3/i)).toBeDefined();
    }, { timeout: 5000 });

    // Verify fetch called 3 times (once per doc)
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('shows overlay with spinner during processing', async () => {
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    render(<InboxTab {...defaultProps} />);
    pushDocs([buildDoc({ id: 'doc-1', fileName: 'a.pdf' })]);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText(/Extraer con IA \(1\)/i));

    // Spinner should appear
    await waitFor(() => {
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeNull();
    });
  });

  it('shows error overlay when all docs fail', async () => {
    mockFetchResolves({
      ok: false,
      status: 502,
      text: () => Promise.resolve(''),
    });

    render(<InboxTab {...defaultProps} />);
    pushDocs([
      buildDoc({ id: 'doc-1', fileName: 'a.pdf' }),
      buildDoc({ id: 'doc-2', fileName: 'b.pdf' }),
    ]);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    for (let i = 1; i <= 2; i++) fireEvent.click(checkboxes[i]);
    fireEvent.click(screen.getByText(/Extraer con IA \(2\)/i));

    await waitFor(() => {
      expect(screen.getByText(/Reintentar \(2\)/i)).toBeDefined();
    }, { timeout: 5000 });
  });

  it('writes to Firestore via updateDocumentoMedio on success', async () => {
    mockFetchResolves({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        proveedorTexto: 'Test Provider',
        tipoDocumentoSugerido: 'factura_compra',
        fechaDocumento: '2026-07-15',
        descripcion: 'Test description',
      }),
    });

    const { getDoc } = await import('firebase/firestore');
    (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      exists: () => true,
      data: () => ({ tipoDocumento: '', periodo: '', metadata: { descripcion: '' } }),
    });

    const { updateDocumentoMedio } = await import('@/lib/firestore');

    render(<InboxTab {...defaultProps} />);
    pushDocs([buildDoc({ id: 'doc-1', fileName: 'a.pdf' })]);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText(/Extraer con IA \(1\)/i));

    await waitFor(() => {
      expect(screen.getByText(/Procesados: 1\/1/i)).toBeDefined();
    }, { timeout: 5000 });

    expect(updateDocumentoMedio).toHaveBeenCalled();
  });

  it('cancels in-flight requests when Cancelar is clicked', async () => {
    const abortSpy = vi.fn();
    const originalAbortController = globalThis.AbortController;
    const MockAbortController = function () {
      return {
        abort: abortSpy,
        signal: { aborted: false, addEventListener: vi.fn(), removeEventListener: vi.fn() },
      };
    } as unknown as typeof AbortController;
    (globalThis as any).AbortController = MockAbortController;

    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    render(<InboxTab {...defaultProps} />);
    pushDocs([buildDoc({ id: 'doc-1', fileName: 'a.pdf' })]);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText(/Extraer con IA \(1\)/i));

    await waitFor(() => {
      expect(screen.getByText(/Cancelar/i)).toBeDefined();
    });

    fireEvent.click(screen.getByText(/Cancelar/i));
    expect(abortSpy).toHaveBeenCalled();

    (globalThis as any).AbortController = originalAbortController;
  });
});

// ─── Tests: Task 6 — Retry + Dismiss ─────────────────────────────────────────

describe('InboxTab — Retry & Dismiss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__inbox_onData = undefined;
    (globalThis as any).fetch = undefined;
  });

  it('shows Reintentar (N) when batch completes with errors', async () => {
    mockFetchResolves({
      ok: false,
      status: 502,
      text: () => Promise.resolve(''),
    });

    render(<InboxTab {...defaultProps} />);
    pushDocs([
      buildDoc({ id: 'doc-1', fileName: 'a.pdf' }),
      buildDoc({ id: 'doc-2', fileName: 'b.pdf' }),
    ]);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    for (let i = 1; i <= 2; i++) fireEvent.click(checkboxes[i]);
    fireEvent.click(screen.getByText(/Extraer con IA \(2\)/i));

    await waitFor(() => {
      expect(screen.getByText(/Reintentar \(2\)/i)).toBeDefined();
    }, { timeout: 5000 });
  });

  it('retry only processes failed docs again', async () => {
    // All calls fail first (first batch), then succeed (retry)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          proveedorTexto: 'Provider',
          tipoDocumentoSugerido: 'factura_compra',
          fechaDocumento: '2026-07-15',
          descripcion: 'Desc',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          proveedorTexto: 'Provider 2',
          tipoDocumentoSugerido: 'factura_venta',
          fechaDocumento: '2026-07-16',
          descripcion: 'Desc 2',
        }),
      });
    globalThis.fetch = fetchMock;

    const { getDoc } = await import('firebase/firestore');
    (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      exists: () => true,
      data: () => ({ tipoDocumento: '', periodo: '', metadata: {} }),
    });

    render(<InboxTab {...defaultProps} />);
    pushDocs([
      buildDoc({ id: 'doc-1', fileName: 'a.pdf' }),
      buildDoc({ id: 'doc-2', fileName: 'b.pdf' }),
    ]);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    for (let i = 1; i <= 2; i++) fireEvent.click(checkboxes[i]);
    fireEvent.click(screen.getByText(/Extraer con IA \(2\)/i));

    // Wait for initial batch to complete with errors
    await waitFor(() => {
      expect(screen.getByText(/Reintentar \(2\)/i)).toBeDefined();
    }, { timeout: 5000 });

    // Click retry
    fireEvent.click(screen.getByText(/Reintentar \(2\)/i));

    // After retry, all should succeed
    await waitFor(() => {
      expect(screen.getByText(/Procesados: 2\/2/i)).toBeDefined();
    }, { timeout: 5000 });

    // Total: 2 initial + 2 retry = 4
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });

  it('dismisses error overlay when unchecking a failed doc', async () => {
    mockFetchResolves({
      ok: false,
      status: 502,
      text: () => Promise.resolve(''),
    });

    render(<InboxTab {...defaultProps} />);
    pushDocs([
      buildDoc({ id: 'doc-1', fileName: 'a.pdf' }),
      buildDoc({ id: 'doc-2', fileName: 'b.pdf' }),
    ]);

    const checkboxes = await waitFor(() => screen.getAllByRole('checkbox'));
    for (let i = 1; i <= 2; i++) fireEvent.click(checkboxes[i]);
    fireEvent.click(screen.getByText(/Extraer con IA \(2\)/i));

    await waitFor(() => {
      expect(screen.getByText(/Reintentar \(2\)/i)).toBeDefined();
    }, { timeout: 5000 });

    // Uncheck the first doc — this should dispatch DISMISS_DOC
    fireEvent.click(checkboxes[1]);

    await waitFor(() => {
      // After dismissing one error, retry should now show (1) instead of (2)
      expect(screen.getByText(/Reintentar \(1\)/i)).toBeDefined();
    });
  });
});
