import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';

const { mockBatchUpdateTerceros, mockToastFn } = vi.hoisted(() => {
  const fn = vi.fn();
  return {
    mockBatchUpdateTerceros: vi.fn(),
    mockToastFn: Object.assign(fn, { success: vi.fn(), error: vi.fn() }),
  };
});

vi.mock('@/lib/firestore', () => ({
  batchUpdateTerceros: mockBatchUpdateTerceros,
}));

vi.mock('@/components/shared/PanelHeader', () => ({
  PanelHeader: ({ title, onClose }: { title: string; onClose: () => void }) => (
    <div data-testid="panel-header">
      <span>{title}</span>
      <button data-testid="panel-close" onClick={onClose}>X</button>
    </div>
  ),
}));

vi.mock('react-hot-toast', () => ({
  default: mockToastFn,
  Toaster: () => null,
}));

import { BulkEditTerceroPanel } from './BulkEditTerceroPanel';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderPanel(props: Partial<Parameters<typeof BulkEditTerceroPanel>[0]> = {}) {
  return render(
    <BulkEditTerceroPanel
      selectedIds={['t1', 't2', 't3']}
      companyId="c1"
      onClose={vi.fn()}
      {...props}
    />,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BulkEditTerceroPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renderiza el PanelHeader con título "Editar en lote"', () => {
    renderPanel();
    expect(screen.getByTestId('panel-header')).toHaveTextContent('Editar en lote');
  });

  it('muestra la cantidad de terceros seleccionados', () => {
    renderPanel();
    expect(screen.getByText((content) => content.includes('3 terceros seleccionados'))).toBeInTheDocument();
  });

  it('renderiza el select de Tipo con opción "Sin cambios"', () => {
    renderPanel();
    const selects = screen.getAllByRole('combobox');
    const tipoSelect = selects[0];
    expect(tipoSelect).toBeInTheDocument();
    expect(tipoSelect).toHaveValue('');
  });

  it('renderiza el select de Naturaleza con opción "Sin cambios"', () => {
    renderPanel();
    const selects = screen.getAllByRole('combobox');
    const naturalezaSelect = selects[1];
    expect(naturalezaSelect).toBeInTheDocument();
    expect(naturalezaSelect).toHaveValue('');
  });

  it('renderiza el input de Lugar vacío', () => {
    renderPanel();
    const inputs = screen.getAllByPlaceholderText('Sin cambios');
    const lugarInput = inputs[1]; // segundo input (Nombre es el primero)
    expect(lugarInput).toBeInTheDocument();
    expect(lugarInput).toHaveValue('');
  });

  it('renderiza el select de Archivado con opción "Sin cambios"', () => {
    renderPanel();
    const selects = screen.getAllByRole('combobox');
    const archivadoSelect = selects[2];
    expect(archivadoSelect).toBeInTheDocument();
    expect(archivadoSelect).toHaveValue('');
  });

  it('renderiza el botón "Guardar"', () => {
    renderPanel();
    expect(screen.getByText('Guardar')).toBeInTheDocument();
  });

  it('NO llama a batchUpdateTerceros cuando no hay cambios', async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    fireEvent.click(screen.getByText('Guardar'));

    expect(mockBatchUpdateTerceros).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('llama a batchUpdateTerceros con los campos cambiados', async () => {
    mockBatchUpdateTerceros.mockResolvedValue({ successCount: 3, failedIds: [] });
    const onClose = vi.fn();
    renderPanel({ selectedIds: ['t1', 't2'], onClose });

    // Change tipo
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'cliente' } });
    // Change lugar
    const inputs = screen.getAllByPlaceholderText('Sin cambios');
    fireEvent.change(inputs[1], { target: { value: 'Bogotá' } }); // lugar es el segundo input

    fireEvent.click(screen.getByText('Guardar'));

    // Wait for async
    await vi.waitFor(() => {
      expect(mockBatchUpdateTerceros).toHaveBeenCalledWith(
        ['t1', 't2'],
        { tipo: 'cliente', lugar: 'Bogotá' },
        'c1',
      );
    });
  });

  it('llama onClose sin argumentos cuando todo sale bien', async () => {
    mockBatchUpdateTerceros.mockResolvedValue({ successCount: 2, failedIds: [] });
    const onClose = vi.fn();
    renderPanel({ selectedIds: ['t1', 't2'], onClose });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'proveedor' } });
    fireEvent.click(screen.getByText('Guardar'));

    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalledWith();
    });
  });

  it('llama onClose con failedIds cuando hay fallos parciales', async () => {
    mockBatchUpdateTerceros.mockResolvedValue({ successCount: 1, failedIds: ['t2'] });
    const onClose = vi.fn();
    renderPanel({ selectedIds: ['t1', 't2'], onClose });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'proveedor' } });
    fireEvent.click(screen.getByText('Guardar'));

    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalledWith(['t2']);
    });
  });

  it('solo incluye campos modificados en el payload', async () => {
    mockBatchUpdateTerceros.mockResolvedValue({ successCount: 1, failedIds: [] });
    renderPanel({ selectedIds: ['t1'] });

    // Only change naturaleza
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'Persona Jurídica' } });
    fireEvent.click(screen.getByText('Guardar'));

    await vi.waitFor(() => {
      expect(mockBatchUpdateTerceros).toHaveBeenCalledWith(
        ['t1'],
        { naturaleza: 'Persona Jurídica' },
        'c1',
      );
    });
  });

  it('el botón de cerrar (X) llama onClose sin argumentos', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    fireEvent.click(screen.getByTestId('panel-close'));
    expect(onClose).toHaveBeenCalledWith();
  });
});
