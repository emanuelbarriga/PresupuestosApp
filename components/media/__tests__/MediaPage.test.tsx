import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// ─── Hoisted mock helpers ────────────────────────────────────────────────────

const { mockUnsub, onDataCallback, mockCreateDocumento, mockValidateFile, mockGenerateMediaFilePath } = vi.hoisted(() => ({
  mockUnsub: vi.fn(),
  onDataCallback: { current: null as ((docs: any[]) => void) | null },
  mockCreateDocumento: vi.fn().mockResolvedValue('doc-001'),
  mockValidateFile: vi.fn().mockReturnValue({ valid: true }),
  mockGenerateMediaFilePath: vi.fn().mockReturnValue('c1/documentos/uuid-test.pdf'),
}));

// ─── Infrastructure mocks ───────────────────────────────────────────────────

vi.mock('@/lib/firebase', () => ({
  db: { type: 'db' as const },
  storage: { type: 'storage' as const },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  success: vi.fn(),
  error: vi.fn(),
}));

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid-001'),
});

vi.mock('@/lib/mediaService', () => ({
  subscribeDocumentos: vi.fn((_companyId: string, _filters: any, onData: (docs: any[]) => void) => {
    onDataCallback.current = onData;
    return mockUnsub;
  }),
  createDocumento: mockCreateDocumento,
}));

vi.mock('@/lib/fileUpload', () => ({
  validateFile: mockValidateFile,
  uploadFileWithTask: vi.fn((_file: any, _path: string, onProgress?: (p: number) => void) => {
    onProgress?.(100);
    return {
      promise: Promise.resolve({
        url: 'https://example.com/test.pdf',
        path: 'c1/documentos/uuid-test.pdf',
      }),
      task: { cancel: vi.fn() },
    };
  }),
  generateMediaFilePath: mockGenerateMediaFilePath,
}));

// ─── Import AFTER mocks ─────────────────────────────────────────────────────

import { MediaPage } from '@/components/media/MediaPage';
import type { DocumentoMedio } from '@/lib/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function makeDocumento(overrides: Partial<DocumentoMedio> = {}): DocumentoMedio {
  return {
    id: 'doc-1',
    fileName: 'factura_enero.pdf',
    storagePath: 'c1/documentos/uuid-factura.pdf',
    url: 'https://example.com/factura.pdf',
    size: 250000,
    mimeType: 'application/pdf',
    status: 'por_clasificar',
    ejecucionIds: [],
    _source: 'inbox-upload',
    uploadedAt: new Date().toISOString(),
    createdBy: 'u1',
    metadata: undefined,
    ...overrides,
  };
}

function renderPage() {
  return render(<MediaPage companyId="c1" onNavigate={vi.fn()} />);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('MediaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onDataCallback.current = null;
  });

  afterEach(() => {
    cleanup();
  });

  // ─── R1: Basic render ──────────────────────────────────────────────────────

  it('renderiza el header con titulo', () => {
    renderPage();
    expect(screen.getByText('Medios / Archivos')).toBeInTheDocument();
  });

  it('renderiza el dropzone con instrucciones', () => {
    renderPage();
    expect(screen.getByText('Arrastrá archivos aquí')).toBeInTheDocument();
  });

  it('muestra empty state cuando la bandeja esta vacia', () => {
    renderPage();
    expect(screen.getByText('No hay documentos sin clasificar')).toBeInTheDocument();
  });

  it('renderiza documentos recibidos de la suscripcion', async () => {
    renderPage();
    const doc = makeDocumento({ id: 'd1', fileName: 'factura.pdf' });
    await act(async () => {
      onDataCallback.current?.([doc]);
    });
    expect(screen.getByText('factura.pdf')).toBeInTheDocument();
  });

  it('muestra el badge por clasificar en cada documento', async () => {
    renderPage();
    await act(async () => {
      onDataCallback.current?.([makeDocumento()]);
    });
    expect(screen.getByText('por clasificar')).toBeInTheDocument();
  });

  it('actualiza el contador de documentos', async () => {
    renderPage();
    await act(async () => {
      onDataCallback.current?.([makeDocumento({ id: 'd1' }), makeDocumento({ id: 'd2' })]);
    });
    expect(screen.getByText('2 documentos')).toBeInTheDocument();
  });

  it('muestra 1 documento en singular', async () => {
    renderPage();
    await act(async () => {
      onDataCallback.current?.([makeDocumento({ id: 'd1' })]);
    });
    expect(screen.getByText('1 documento')).toBeInTheDocument();
  });

  // ─── R2: Navigation ────────────────────────────────────────────────────────

  it('click en documento llama a onNavigate con entity=documento', async () => {
    const onNavigate = vi.fn();
    render(<MediaPage companyId="c1" onNavigate={onNavigate} />);
    const doc = makeDocumento({ id: 'd1', fileName: 'factura.pdf' });
    await act(async () => {
      onDataCallback.current?.([doc]);
    });
    fireEvent.click(screen.getByText('factura.pdf'));
    expect(onNavigate).toHaveBeenCalledWith({
      type: 'entity',
      entity: 'documento',
      mode: 'view',
      record: expect.objectContaining({ id: 'd1' }),
    });
  });

  // ─── R3: Subscription lifecycle ─────────────────────────────────────────────

  it('cancela la suscripcion al desmontar', () => {
    const { unmount } = renderPage();
    unmount();
    expect(mockUnsub).toHaveBeenCalledTimes(1);
  });

  // ─── R4: Upload flow ───────────────────────────────────────────────────────

  it('sube archivos al seleccionarlos desde el input file', async () => {
    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test content'], 'factura.pdf', { type: 'application/pdf' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(mockValidateFile).toHaveBeenCalledWith(file);
    expect(mockGenerateMediaFilePath).toHaveBeenCalledWith('c1', 'factura.pdf');
  });

  it('muestra progress card durante la subida', async () => {
    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test content'], 'factura_test.pdf', { type: 'application/pdf' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(screen.getByText('factura_test.pdf')).toBeInTheDocument();
    });
  });

  it('no sube archivos invalidos', async () => {
    mockValidateFile.mockReturnValueOnce({ valid: false, error: 'Tipo no soportado' });
    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['bad'], 'script.exe', { type: 'application/x-msdownload' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(mockCreateDocumento).not.toHaveBeenCalled();
  });

  it('crea DocumentoMedio con status por_clasificar y source inbox-upload', async () => {
    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test'], 'factura.pdf', { type: 'application/pdf' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(mockCreateDocumento).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({
          fileName: 'factura.pdf',
          status: 'por_clasificar',
          _source: 'inbox-upload',
        }),
        expect.any(String),
        'inbox-upload',
      );
    }, { timeout: 3000 });
  });

  // Reset mocks
  afterEach(() => {
    mockValidateFile.mockReturnValue({ valid: true });
  });
});
