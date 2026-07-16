import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// ─── Hoisted mock helpers ────────────────────────────────────────────────────

const { mockUnsub, mockLinkDocumentoToEntities } = vi.hoisted(() => ({
  mockUnsub: vi.fn(),
  mockLinkDocumentoToEntities: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/firebase', () => ({
  db: { type: 'db' as const },
  app: { type: 'app' as const },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'collection-ref'),
  onSnapshot: vi.fn((_ref: unknown, callback: (snap: any) => void) => {
    callback({
      docs: [],
      forEach: () => {},
    });
    return mockUnsub;
  }),
}));

vi.mock('@/lib/mediaLinking', () => ({
  linkDocumentoToEntities: mockLinkDocumentoToEntities,
}));

vi.mock('@/lib/auth', () => ({
  auth: { currentUser: null },
}));

vi.mock('react-pdf', () => ({
  Document: ({ children, file }: any) => {
    if (!file) return null;
    return <div data-testid="pdf-document">{children}</div>;
  },
  Page: ({ pageNumber }: any) => <div data-testid={`pdf-page-${pageNumber}`} />,
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
}));

vi.mock('react-pdf/dist/Page/AnnotationLayer.css', () => ({}));
vi.mock('react-pdf/dist/Page/TextLayer.css', () => ({}));

// ─── Import AFTER mocks ──────────────────────────────────────────────────────

import { DocumentoEntity } from '../DocumentoEntity';

// ─── Mock data ───────────────────────────────────────────────────────────────

const mockDoc = {
  id: 'doc-1',
  fileName: 'factura-test.pdf',
  storagePath: 'c1/documentos/uuid-factura.pdf',
  url: 'https://storage.example.com/factura.pdf',
  size: 102400,
  mimeType: 'application/pdf',
  status: 'por_clasificar' as const,
  ejecucionIds: [],
  _source: 'inbox-upload' as const,
  uploadedAt: '2026-07-14T00:00:00Z',
  createdBy: 'user-1',
};

const defaultProps = {
  mode: 'view' as const,
  companyId: 'c1',
  record: mockDoc,
  onNavigate: vi.fn(),
  onClose: vi.fn(),
  onBack: vi.fn(),
  canGoBack: false,
  onSubmit: vi.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DocumentoEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders DocumentoSidepanel with the documento', () => {
    render(<DocumentoEntity {...defaultProps} />);

    // DocumentoSidepanel renders the file name in the header
    expect(screen.getByText('Clasificar Documento')).toBeInTheDocument();
  });

  it('forwards onDocumentoUpdated to DocumentoSidepanel', async () => {
    const onDocumentoUpdated = vi.fn();

    render(
      <DocumentoEntity
        {...defaultProps}
        onDocumentoUpdated={onDocumentoUpdated}
      />,
    );

    // Select tipo
    fireEvent.click(screen.getByText('Contrato'));

    // Fill fecha
    const fechaInput = screen.getByLabelText(/Fecha del Documento/) as HTMLInputElement;
    fireEvent.change(fechaInput, { target: { value: '2026-07-01' } });

    // Click save
    fireEvent.click(screen.getByText('Guardar y Enlazar'));

    await waitFor(() => {
      expect(mockLinkDocumentoToEntities).toHaveBeenCalledTimes(1);
    });

    // onDocumentoUpdated should have been called after linkDocumentoToEntities
    await waitFor(() => {
      expect(onDocumentoUpdated).toHaveBeenCalledWith(
        'doc-1',
        '2026-07', // periodo derived from fecha
        'contrato',
      );
    });
  });

  it('works without onDocumentoUpdated prop (retrocompatible)', async () => {
    render(<DocumentoEntity {...defaultProps} />);

    // Select tipo
    fireEvent.click(screen.getByText('Factura Venta'));

    // Fill fecha
    const fechaInput = screen.getByLabelText(/Fecha del Documento/) as HTMLInputElement;
    fireEvent.change(fechaInput, { target: { value: '2026-07-01' } });

    // Click save — should not throw
    fireEvent.click(screen.getByText('Guardar y Enlazar'));

    await waitFor(() => {
      expect(mockLinkDocumentoToEntities).toHaveBeenCalledTimes(1);
    });
  });
});
