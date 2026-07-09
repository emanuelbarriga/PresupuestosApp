import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComprobanteUploader } from '@/components/upload/ComprobanteUploader';
import type { Comprobante, SettingsItem } from '@/lib/types';

const mockTipos: SettingsItem[] = [
  { name: 'Factura', color: '#000000', order: 1 },
  { name: 'Cuenta de cobro', color: '#000000', order: 2 },
];

const createComprobante = (overrides: Partial<Comprobante> = {}): Comprobante => ({
  id: 'comp-1',
  name: 'test.pdf',
  url: 'https://example.com/test.pdf',
  type: 'application/pdf',
  size: 500,
  path: 'some/path',
  uploadedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('ComprobanteUploader', () => {
  it('renderiza el input de descripción', () => {
    render(
      <ComprobanteUploader
        companyId="company-1"
        ejecucionId="ej-1"
        comprobantes={[]}
        onComprobantesChange={vi.fn()}
        pendingComprobantes={[]}
        onPendingChange={vi.fn()}
        tiposComprobante={mockTipos}
      />
    );
    expect(screen.getByPlaceholderText('Descripción del comprobante (opcional)')).toBeInTheDocument();
  });

  it('renderiza los tipos de comprobante', () => {
    render(
      <ComprobanteUploader
        companyId="company-1"
        ejecucionId="ej-1"
        comprobantes={[]}
        onComprobantesChange={vi.fn()}
        pendingComprobantes={[]}
        onPendingChange={vi.fn()}
        tiposComprobante={mockTipos}
      />
    );
    expect(screen.getByText('Factura')).toBeInTheDocument();
    expect(screen.getByText('Cuenta de cobro')).toBeInTheDocument();
  });

  it('renderiza el botón de seleccionar archivos', () => {
    render(
      <ComprobanteUploader
        companyId="company-1"
        ejecucionId="ej-1"
        comprobantes={[]}
        onComprobantesChange={vi.fn()}
        pendingComprobantes={[]}
        onPendingChange={vi.fn()}
        tiposComprobante={mockTipos}
      />
    );
    expect(screen.getByText('Seleccionar archivos')).toBeInTheDocument();
  });

  it('muestra comprobantes guardados cuando existen', () => {
    render(
      <ComprobanteUploader
        companyId="company-1"
        ejecucionId="ej-1"
        comprobantes={[createComprobante()]}
        onComprobantesChange={vi.fn()}
        pendingComprobantes={[]}
        onPendingChange={vi.fn()}
        tiposComprobante={mockTipos}
      />
    );
    expect(screen.getByText(/1 comprobante\(s\) guardado\(s\)/)).toBeInTheDocument();
  });

  it('llama a onComprobantesChange al hacer clic en eliminar', async () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    render(
      <ComprobanteUploader
        companyId="company-1"
        ejecucionId="ej-1"
        comprobantes={[createComprobante()]}
        onComprobantesChange={onChange}
        onSaveComprobantes={onSave}
        pendingComprobantes={[]}
        onPendingChange={vi.fn()}
        tiposComprobante={mockTipos}
      />
    );
    const deleteBtn = screen.getByTitle('Eliminar');
    fireEvent.click(deleteBtn);
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([]);
    });
    expect(onSave).toHaveBeenCalled();
  });

  it('no llama a onSaveComprobantes si no está definido (solo onComprobantesChange)', async () => {
    const onChange = vi.fn();
    render(
      <ComprobanteUploader
        companyId="company-1"
        ejecucionId="ej-1"
        comprobantes={[createComprobante()]}
        onComprobantesChange={onChange}
        pendingComprobantes={[]}
        onPendingChange={vi.fn()}
        tiposComprobante={mockTipos}
      />
    );
    const deleteBtn = screen.getByTitle('Eliminar');
    fireEvent.click(deleteBtn);
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([]);
    });
  });

  it('muestra archivos pendientes y su indicador', () => {
    render(
      <ComprobanteUploader
        companyId="company-1"
        ejecucionId="ej-1"
        comprobantes={[]}
        onComprobantesChange={vi.fn()}
        pendingComprobantes={[{
          id: 'pending-1',
          file: new File([''], 'factura.pdf', { type: 'application/pdf' }),
          name: 'factura.pdf',
          type: 'application/pdf',
          size: 1000,
        }]}
        onPendingChange={vi.fn()}
        tiposComprobante={mockTipos}
      />
    );
    expect(screen.getByText(/1 pendiente/)).toBeInTheDocument();
    expect(screen.getByText('Se subirán al guardar la ejecución')).toBeInTheDocument();
  });
});
