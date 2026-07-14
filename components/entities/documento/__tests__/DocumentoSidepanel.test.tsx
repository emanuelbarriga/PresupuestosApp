import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentoSidepanel } from '../DocumentoSidepanel';

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

  it('renders the PDF preview with iframe and fallback link', () => {
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
    expect(screen.getByTitle('Vista previa del documento')).toBeInTheDocument();
    const iframe = document.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe!.src).toContain(mockDoc.url);

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

    // Periodo field
    expect(screen.getByPlaceholderText('YYYY-MM')).toBeInTheDocument();

    // Tercero select
    expect(screen.getByText('Tercero')).toBeInTheDocument();

    // Proyecto select
    expect(screen.getByText('Proyecto (opcional)')).toBeInTheDocument();

    // Ejecuciones multi-select
    expect(screen.getByText('Ejecuciones (opcional)')).toBeInTheDocument();
  });

  it('renders OCR stub banner', () => {
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

    expect(screen.getByText('OCR disponible en futura versión')).toBeInTheDocument();
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

    // Fill periodo
    const periodoInput = screen.getByPlaceholderText('YYYY-MM') as HTMLInputElement;
    fireEvent.change(periodoInput, { target: { value: '2026-07' } });

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

  it('shows validation error when periodo is missing', async () => {
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

    // Select tipo but no periodo
    fireEvent.click(screen.getByText('Contrato'));
    fireEvent.click(screen.getByText('Guardar y Enlazar'));

    await waitFor(() => {
      expect(screen.getByText('Debe ingresar un período (YYYY-MM)')).toBeInTheDocument();
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
    expect(screen.getByPlaceholderText('Monto total')).toBeInTheDocument();
  });
});
