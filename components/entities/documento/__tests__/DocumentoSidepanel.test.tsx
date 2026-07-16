import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentoSidepanel } from '../DocumentoSidepanel';
import { PERIODO_SIN_ASIGNAR, TIPO_DOCUMENTO_DEFAULT } from '@/lib/schemas';

// --- Mock auth ---
vi.mock('@/lib/auth', () => ({
  auth: { currentUser: { getIdToken: vi.fn().mockResolvedValue('mock-firebase-token') } },
}));


// ─── Mock data ───────────────────────────────────────────────────────────

const mockDoc = {
  id: 'doc-1',
  fileName: 'factura-2026-07.pdf',
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

const mockEnlazadoDoc = {
  id: 'doc-enlazado-1',
  fileName: 'factura-clasificada.pdf',
  storagePath: 'c1/documentos/uuid-clasificada.pdf',
  url: 'https://storage.example.com/clasificada.pdf',
  size: 204800,
  mimeType: 'image/png',
  status: 'enlazado' as const,
  tipoDocumento: 'factura_venta' as const,
  periodo: '2026-07',
  terceroId: 't-1',
  projectId: 'p-1',
  ejecucionIds: ['ej-1', 'ej-2'],
  metadata: {
    nit: '900123456-7',
    proveedorTexto: 'Carlos Pérez SAS',
    montoTotal: 1500000,
    fechaDocumento: '2026-07-10',
  },
  _source: 'inbox-upload' as const,
  uploadedAt: '2026-07-14T00:00:00Z',
  createdBy: 'user-1',
};

const mockTerceros = [
  { value: 't-1', label: 'Carlos Pérez' },
  { value: 't-2', label: 'María García' },
];

const mockProyectos = [
  { value: 'p-1', label: 'DDTL' },
  { value: 'p-2', label: 'FMP' },
];

const mockEjecuciones = [
  { value: 'ej-1', label: 'Enero 2026' },
  { value: 'ej-2', label: 'Febrero 2026' },
  { value: 'ej-3', label: 'Marzo 2026' },
];

// ─── Tests ───────────────────────────────────────────────────────────────

describe('DocumentoSidepanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the PDF preview with PdfViewer and fallback link', () => {
    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
      />,
    );

    // Preview section
    expect(document.querySelector('iframe')).toBeNull();

    // Fallback link
    const fallbackLink = screen.getByText('Abrir en nueva pestaña');
    expect(fallbackLink).toBeInTheDocument();
    expect(fallbackLink.closest('a')).toHaveAttribute('href', mockDoc.url);
    expect(fallbackLink.closest('a')).toHaveAttribute('target', '_blank');
  });

  it('renders the classification form with all required fields', () => {
    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
      />,
    );

    // TipoDocumento chips (8 types)
    expect(screen.getByText('Factura Venta')).toBeInTheDocument();
    expect(screen.getByText('Factura Compra')).toBeInTheDocument();
    expect(screen.getByText('Extracto Bancario')).toBeInTheDocument();
    expect(screen.getByText('Comprobante Egreso')).toBeInTheDocument();
    expect(screen.getByText('Comprobante Ingreso')).toBeInTheDocument();
    expect(screen.getByText('Planilla')).toBeInTheDocument();
    expect(screen.getByText('Contrato')).toBeInTheDocument();
    expect(screen.getByText('Otro')).toBeInTheDocument();

    // Fecha field
    expect(screen.getByLabelText(/Fecha del Documento/)).toBeInTheDocument();

    // Tercero select
    expect(screen.getByText('Tercero')).toBeInTheDocument();

    // Proyecto select
    expect(screen.getByText('Proyecto (opcional)')).toBeInTheDocument();

    // Ejecuciones multi-select
    expect(screen.getByText('Ejecuciones (opcional)')).toBeInTheDocument();
  });

  it('renders "Extraer con IA" button instead of OCR stub', () => {
    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
      />,
    );

    expect(screen.getByText('Extraer con IA')).toBeInTheDocument();
  });

  it('renders the Guardar y Enlazar button with loading state', () => {
    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
      />,
    );

    expect(screen.getByText('Guardar y Enlazar')).toBeInTheDocument();
  });

  it('shows spinner and disabled state when saving', () => {
    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
        saving={true}
      />,
    );

    const button = screen.getByRole('button', { name: /guardando/i });
    expect(button).toBeDisabled();
  });

  it('calls onSave with form data when Guardar y Enlazar is clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={onSave}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
      />,
    );

    // Select tipo
    fireEvent.click(screen.getByText('Factura Venta'));

    // Fill fecha
    const fechaInput = screen.getByLabelText(/Fecha del Documento/) as HTMLInputElement;
    fireEvent.change(fechaInput, { target: { value: '2026-07-15' } });

    // Click save
    fireEvent.click(screen.getByText('Guardar y Enlazar'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const saveData = onSave.mock.calls[0][0];
    expect(saveData.tipoDocumento).toBe('factura_venta');
    expect(saveData.periodo).toBe('2026-07');
  });

  it('shows validation error when tipoDocumento is missing', async () => {
    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
      />,
    );

    // Click save without selecting tipo
    fireEvent.click(screen.getByText('Guardar y Enlazar'));

    await waitFor(() => {
      expect(screen.getByText('Debe seleccionar un tipo de documento')).toBeInTheDocument();
    });
  });

  it('saves without fecha when only tipo is selected', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={onSave}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
      />,
    );

    fireEvent.click(screen.getByText('Contrato'));
    fireEvent.click(screen.getByText('Guardar y Enlazar'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  it('renders manual metadata fields', () => {
    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
      />,
    );

    expect(screen.getByText('Metadatos (opcional)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('NIT')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Proveedor')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0')).toBeInTheDocument();
  });

  // ─── T6: Pre-fill desde documento existente ────────────────────────────────

  it('pre-fills fields from enlazado documento', () => {
    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockEnlazadoDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
      />,
    );

    // Fecha should be pre-filled from metadata
    const fechaInput = screen.getByLabelText(/Fecha del Documento/) as HTMLInputElement;
    expect(fechaInput.value).toBe('2026-07-10');

    // NIT pre-filled
    const nitInput = screen.getByPlaceholderText('NIT') as HTMLInputElement;
    expect(nitInput.value).toBe('900123456-7');

    // Proveedor pre-filled
    const provInput = screen.getByPlaceholderText('Proveedor') as HTMLInputElement;
    expect(provInput.value).toBe('Carlos Pérez SAS');

    // Monto pre-filled
    const montoInput = screen.getByPlaceholderText('0') as HTMLInputElement;
    expect(montoInput.value).toBe('1500000');

    // TipoDocumento chip selected (Factura Venta)
    const facturaVentaBtn = screen.getByText('Factura Venta');
    expect(facturaVentaBtn.className).toContain('bg-indigo-100');
  });

  it('pre-fills with empty values when documento has no classification fields', () => {
    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
      />,
    );

    const fechaInput = screen.getByLabelText(/Fecha del Documento/) as HTMLInputElement;
    expect(fechaInput.value).toBe('');

    const montoInput = screen.getByPlaceholderText('0') as HTMLInputElement;
    expect(montoInput.value).toBe('');

    const nitInput = screen.getByPlaceholderText('NIT') as HTMLInputElement;
    expect(nitInput.value).toBe('');
  });

  it('re-initializes fields when documento.id changes', () => {
    const { rerender } = render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockEnlazadoDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
      />,
    );

    // Initial: pre-filled
    let fechaInput = screen.getByLabelText(/Fecha del Documento/) as HTMLInputElement;
    expect(fechaInput.value).toBe('2026-07-10');

    // Rerender with a different documento (sin metadata.fechaDocumento)
    rerender(
      <DocumentoSidepanel
        companyId="c1"
        documento={{ ...mockDoc, id: 'doc-2' }}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
      />,
    );

    // Should be reset to empty
    fechaInput = screen.getByLabelText(/Fecha del Documento/) as HTMLInputElement;
    expect(fechaInput.value).toBe('');
  });

  // ─── T6: onDocumentoUpdated callback ──────────────────────────────────────

  it('calls onDocumentoUpdated after successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDocumentoUpdated = vi.fn();

    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockEnlazadoDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={onSave}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
        onDocumentoUpdated={onDocumentoUpdated}
      />,
    );

    // The form is pre-filled; just click save
    fireEvent.click(screen.getByText('Guardar y Enlazar'));

    await waitFor(() => {
      expect(onDocumentoUpdated).toHaveBeenCalledTimes(1);
    });

    expect(onDocumentoUpdated).toHaveBeenCalledWith(
      'doc-enlazado-1',
      '2026-07',
      'factura_venta',
    );
  });

  it('does not call onDocumentoUpdated when save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));
    const onDocumentoUpdated = vi.fn();

    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockEnlazadoDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={onSave}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
        onDocumentoUpdated={onDocumentoUpdated}
      />,
    );

    fireEvent.click(screen.getByText('Guardar y Enlazar'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });

    // Small delay to ensure onDocumentoUpdated is NOT called
    await new Promise((r) => setTimeout(r, 100));
    expect(onDocumentoUpdated).not.toHaveBeenCalled();
  });

  it('is retrocompatible — works without onDocumentoUpdated prop', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockEnlazadoDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={onSave}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
      />,
    );

    fireEvent.click(screen.getByText('Guardar y Enlazar'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  // ─── T6: Validación de periodo acepta sin_periodo ─────────────────────────

  it('applies TIPO_DOCUMENTO_DEFAULT when tipoDocumento is not pre-filled', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={onSave}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
      />,
    );

    // TipoDocumento is '' initially (no selection)
    // Set periodo to pass validation
    const periodoInput = screen.getByLabelText(/Fecha del Documento/) as HTMLInputElement;
    fireEvent.change(periodoInput, { target: { value: '2026-07' } });

    // Click save without selecting tipo — validation should fail first
    fireEvent.click(screen.getByText('Guardar y Enlazar'));

    // Tipo validation fails because it's empty
    await waitFor(() => {
      expect(screen.getByText('Debe seleccionar un tipo de documento')).toBeInTheDocument();
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('applies default values on save — empty periodo and tipoDocumento', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={onSave}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
      />,
    );

    // Set periodo to sin_periodo to pass validation
    const periodoInput = screen.getByLabelText(/Fecha del Documento/) as HTMLInputElement;
    fireEvent.change(periodoInput, { target: { value: 'sin_periodo' } });

    // No tipo selected — validation will fail
    fireEvent.click(screen.getByText('Guardar y Enlazar'));

    await waitFor(() => {
      expect(screen.getByText('Debe seleccionar un tipo de documento')).toBeInTheDocument();
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onDocumentoUpdated after saving with fecha', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDocumentoUpdated = vi.fn();

    render(
      <DocumentoSidepanel
        companyId="c1"
        documento={mockDoc}
        terceroOptions={mockTerceros}
        proyectoOptions={mockProyectos}
        ejecucionOptions={mockEjecuciones}
        onSave={onSave}
        onClose={vi.fn()}
        onBack={vi.fn()}
        canGoBack={false}
        onDocumentoUpdated={onDocumentoUpdated}
      />,
    );

    // Select tipo
    fireEvent.click(screen.getByText('Otro'));

    // Set fecha
    const fechaInput = screen.getByLabelText(/Fecha del Documento/) as HTMLInputElement;
    fireEvent.change(fechaInput, { target: { value: '2026-07-01' } });

    fireEvent.click(screen.getByText('Guardar y Enlazar'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(onDocumentoUpdated).toHaveBeenCalledTimes(1);
    });
  });
});
