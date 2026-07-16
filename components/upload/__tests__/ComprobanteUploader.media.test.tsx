import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ComprobanteUploader } from '@/components/upload/ComprobanteUploader';

// ─── Mocks ───────────────────────────────────────────────────────────────

const mockUploadFileWithTask = vi.fn();
const mockGenerateMediaFilePath = vi.fn();
const mockValidateFile = vi.fn();
const mockCreateDocumento = vi.fn();

vi.mock('@/lib/fileUpload', () => ({
  uploadFileWithTask: (...args: any[]) => mockUploadFileWithTask(...args),
  generateMediaFilePath: (...args: any[]) => mockGenerateMediaFilePath(...args),
  validateFile: (...args: any[]) => mockValidateFile(...args),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/mediaService', () => ({
  createDocumento: (...args: any[]) => mockCreateDocumento(...args),
}));

vi.mock('@/lib/firebase', () => ({ db: {}, storage: {} }));

// ─── Setup ───────────────────────────────────────────────────────────────

const mockTipos = [
  { name: 'Factura', color: '#000', order: 1 },
  { name: 'Cuenta de cobro', color: '#000', order: 2 },
];

function createFile(name = 'test.pdf', type = 'application/pdf', size = 5000): File {
  return new File(['x'.repeat(size)], name, { type });
}

function renderUploader(props: Record<string, any> = {}) {
  return render(
    <ComprobanteUploader
      companyId="c1"
      ejecucionId={undefined}
      comprobantes={[]}
      onComprobantesChange={vi.fn()}
      tiposComprobante={mockTipos}
      {...props}
    />,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('ComprobanteUploader — media refactor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateFile.mockReturnValue({ valid: true });
    mockGenerateMediaFilePath.mockReturnValue('c1/documentos/uuid-test.pdf');
    mockUploadFileWithTask.mockReturnValue({
      promise: Promise.resolve({ url: 'https://example.com/test.pdf', path: 'c1/documentos/uuid-test.pdf' }),
      task: { cancel: vi.fn(), on: vi.fn() },
    });
    mockCreateDocumento.mockResolvedValue('new-doc-id-1');
  });

  it('shows uploading state when file is selected', async () => {
    renderUploader({ onUploadComplete: vi.fn() });

    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [createFile()] } });

    // Should show uploading indicator
    await waitFor(() => {
      expect(screen.getByText(/subiendo/)).toBeInTheDocument();
    });
  });

  it('validates file and shows error for invalid files', async () => {
    mockValidateFile.mockReturnValue({ valid: false, error: 'Tipo no soportado' });

    renderUploader({ onUploadComplete: vi.fn() });

    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [createFile('bad.exe', 'application/x-msdownload')] } });

    await waitFor(() => {
      expect(screen.getByText(/Tipo no soportado/i)).toBeInTheDocument();
    });

    expect(mockUploadFileWithTask).not.toHaveBeenCalled();
  });

  it('shows existing comprobantes', () => {
    const comprobantes = [
      { id: 'c1', name: 'existing.pdf', url: 'https://example.com/existing.pdf', path: 'some/path', type: 'application/pdf', size: 500, uploadedAt: '2026-01-01T00:00:00.000Z' },
    ];

    renderUploader({ comprobantes });

    expect(screen.getByText(/1 comprobante\(s\) guardado\(s\)/)).toBeInTheDocument();
  });

  it('renders description input and tipo buttons', () => {
    renderUploader();

    expect(screen.getByPlaceholderText('Descripción del comprobante (opcional)')).toBeInTheDocument();
    expect(screen.getByText('Factura')).toBeInTheDocument();
    expect(screen.getByText('Cuenta de cobro')).toBeInTheDocument();
  });
});
