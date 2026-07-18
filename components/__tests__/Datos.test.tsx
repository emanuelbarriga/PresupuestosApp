import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const { collection, doc, addDoc, updateDoc, onSnapshot, serverTimestamp, getFirestore, mockUnsub, mockTerceros, mockCountResults, mockToast } = vi.hoisted(
  () => {
    const mockUnsub = vi.fn();
    const mockTerceros: any[] = [];
    const mockCountResults = { ejecuciones: 0, budgets: 0, documentos: 0, proyectos: 0 };
    const mockToast = Object.assign(
      vi.fn(() => 'toast-id'),
      { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
    );
    return {
      collection: vi.fn(() => ({ type: 'collection' as const })),
      doc: vi.fn(() => ({ type: 'doc' as const })),
      addDoc: vi.fn().mockResolvedValue({ id: 'new-id' }),
      updateDoc: vi.fn().mockResolvedValue(undefined),
      onSnapshot: vi.fn().mockReturnValue(mockUnsub),
      serverTimestamp: vi.fn().mockReturnValue({ toDate: () => new Date() }),
      getFirestore: vi.fn(),
      mockUnsub,
      mockTerceros,
      mockCountResults,
      mockToast,
    };
  },
);

vi.mock('firebase/firestore', () => ({
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  getFirestore,
}));

vi.mock('react-hot-toast', () => ({ default: mockToast, Toaster: () => null }));

vi.mock('@/lib/firebase', () => ({ db: {} }));

vi.mock('@/lib/firestore', () => ({
  subscribeProjects: vi.fn(() => mockUnsub),
  subscribeTerceros: vi.fn((onData: any) => {
    // Call synchronously so React batches the state update during render
    if (mockTerceros.length > 0) {
      onData([...mockTerceros]);
    }
    return mockUnsub;
  }),
  subscribeSettings: vi.fn(() => mockUnsub),
  subscribeCompanySettings: vi.fn(() => mockUnsub),
  subscribeCuentasBancarias: vi.fn(() => mockUnsub),
  subscribeExtractos: vi.fn(() => mockUnsub),
  subscribeBudgets: vi.fn(() => mockUnsub),
  countEjecucionesByTercero: vi.fn(() => Promise.resolve(mockCountResults.ejecuciones)),
  countBudgetsByTercero: vi.fn(() => Promise.resolve(mockCountResults.budgets)),
  countDocumentosByTercero: vi.fn(() => Promise.resolve(mockCountResults.documentos)),
  countProyectosByTercero: vi.fn(() => Promise.resolve(mockCountResults.proyectos)),
  deleteTercero: vi.fn().mockResolvedValue(undefined),
}));

import { Datos } from '@/components/Datos';
import type { Ejecucion, Comprobante, Tercero, NavScreen } from '@/lib/types';

function makeEjecucion(overrides: Partial<Ejecucion> = {}): Ejecucion {
  return {
    id: 'ej-1',
    descripcion: 'Ejecucion Test',
    projectId: 'proj-1',
    projectName: 'Proyecto Alpha',
    entityId: 'client-1',
    entityName: 'Cliente Beta',
    entityType: 'client',
    tipo: 'ingreso',
    montoEjecutado: 250000,
    fechaEjecutado: '2026-07-15',
    comprobantes: [],
    ...overrides,
  };
}

describe('Datos — Comprobantes badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('3.5a muestra badge de estado cuando hay comprobantes', () => {
    const comprobantes: Comprobante[] = [
      { id: 'c1', name: 'pago.pdf', url: '', path: '', type: 'application/pdf', size: 1024, uploadedAt: '', tipo: 'Comprobante de pago' },
      { id: 'c2', name: 'cuenta.pdf', url: '', path: '', type: 'application/pdf', size: 1024, uploadedAt: '', tipo: 'Cuenta de Cobro' },
    ];
    const ejecuciones = [makeEjecucion({ id: 'ej-1', comprobantes })];

    render(
      <Datos
        budgets={[]}
        ejecuciones={ejecuciones}
        activeTab="ejecuciones"
        companyId="c1"
      />,
    );

    // Should show "Completada" state badge
    expect(screen.getByText('Ejecucion Test')).toBeInTheDocument();
    // There will be multiple elements with "Completada" (dropdown option + badge)
    const completadaElements = screen.getAllByText('Completada');
    expect(completadaElements.length).toBeGreaterThanOrEqual(1);
  });

  it('3.5b NO muestra badge de número cuando array vacío', () => {
    const ejecuciones = [makeEjecucion({ id: 'ej-1', comprobantes: [] })];

    render(
      <Datos
        budgets={[]}
        ejecuciones={ejecuciones}
        activeTab="ejecuciones"
        companyId="c1"
      />,
    );

    // Should show the ejecucion
    expect(screen.getByText('Ejecucion Test')).toBeInTheDocument();
    // But no badge number (the paperclip count was removed)
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });
});

describe('Datos — PR1-T4 Banco column', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('muestra nombre de cuenta bancaria en columna Banco', () => {
    const ejecuciones = [makeEjecucion({
      cuentaName: 'Banco XYZ - Corriente (Corriente)',
    })];

    render(
      <Datos
        budgets={[]}
        ejecuciones={ejecuciones}
        activeTab="ejecuciones"
        companyId="c1"
      />,
    );

    expect(screen.getByText('Banco XYZ - Corriente (Corriente)')).toBeInTheDocument();
  });

  it('muestra guión cuando no hay cuenta bancaria', () => {
    const ejecuciones = [makeEjecucion({})];

    render(
      <Datos
        budgets={[]}
        ejecuciones={ejecuciones}
        activeTab="ejecuciones"
        companyId="c1"
      />,
    );

    // The "—" character should be rendered for empty cuentaName
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Datos — PR2 Comprobantes state badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('badge shows Completada (green) when both required comprobantes present', () => {
    const comprobantes: Comprobante[] = [
      { id: 'c1', name: 'pago.pdf', url: '', path: '', type: 'application/pdf', size: 100, uploadedAt: '', tipo: 'Comprobante de pago' },
      { id: 'c2', name: 'cuenta.pdf', url: '', path: '', type: 'application/pdf', size: 100, uploadedAt: '', tipo: 'Cuenta de Cobro' },
    ];
    const ejecuciones = [makeEjecucion({ id: 'ej-1', comprobantes })];

    render(
      <Datos budgets={[]} ejecuciones={ejecuciones} activeTab="ejecuciones" companyId="c1" />,
    );

    // "Completada" appears as a badge AND as a filter option
    const elements = screen.getAllByText('Completada');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('badge shows Falta cuenta de cobro (amber) when only pago present', () => {
    const comprobantes: Comprobante[] = [
      { id: 'c1', name: 'pago.pdf', url: '', path: '', type: 'application/pdf', size: 100, uploadedAt: '', tipo: 'Comprobante de pago' },
    ];
    const ejecuciones = [makeEjecucion({ id: 'ej-1', comprobantes })];

    render(
      <Datos budgets={[]} ejecuciones={ejecuciones} activeTab="ejecuciones" companyId="c1" />,
    );

    const elements = screen.getAllByText('Falta cuenta de cobro');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('badge shows Sin comprobantes (gray) when array empty', () => {
    const ejecuciones = [makeEjecucion({ id: 'ej-1', comprobantes: [] })];

    render(
      <Datos budgets={[]} ejecuciones={ejecuciones} activeTab="ejecuciones" companyId="c1" />,
    );

    const elements = screen.getAllByText('Sin comprobantes');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('filter by comprobante estado works', () => {
    const completada: Comprobante[] = [
      { id: 'c1', name: 'pago.pdf', url: '', path: '', type: 'application/pdf', size: 100, uploadedAt: '', tipo: 'Comprobante de pago' },
      { id: 'c2', name: 'cuenta.pdf', url: '', path: '', type: 'application/pdf', size: 100, uploadedAt: '', tipo: 'Cuenta de Cobro' },
    ];
    const sinComp: Comprobante[] = [];
    const ejecuciones = [
      makeEjecucion({ id: 'ej-1', descripcion: 'ConComprobantesSI', comprobantes: completada }),
      makeEjecucion({ id: 'ej-2', descripcion: 'SinComprobantesNO', comprobantes: sinComp }),
    ];

    render(
      <Datos budgets={[]} ejecuciones={ejecuciones} activeTab="ejecuciones" companyId="c1" />,
    );

    // Both rows visible initially
    expect(screen.getByText('ConComprobantesSI')).toBeInTheDocument();
    expect(screen.getByText('SinComprobantesNO')).toBeInTheDocument();

    // Find the Comp. filter buttons (TriStateSwitch)
    const compLabel = screen.getAllByText('Comp.')[0];
    const compContainer = compLabel.closest('.flex')!;
    const compButtons = compContainer.querySelectorAll('button');
    expect(compButtons.length).toBeGreaterThanOrEqual(2);

    // Click the "Completada" button (second button)
    fireEvent.click(compButtons[1]);

    // Only the completada row should be visible
    expect(screen.getByText('ConComprobantesSI')).toBeInTheDocument();
    expect(screen.queryByText('SinComprobantesNO')).not.toBeInTheDocument();
  });
});

function makeTercero(overrides: Partial<Tercero> = {}): Tercero {
  return {
    id: 't1',
    name: 'Tercero Test',
    apodo: 'Test',
    naturaleza: 'Persona Natural',
    documento: 'CC',
    numeroDocumento: '12345',
    lugar: 'Bogotá',
    tipo: 'cliente',
    ...overrides,
  };
}

describe('Datos — Terceros bulk edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTerceros.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  /** Get row-level checkboxes (skip the disabled header checkbox) */
  function getRowCheckboxes() {
    return screen.getAllByTestId('select-tercero');
  }

  it('renderiza checkbox column en tabla de terceros', async () => {
    mockTerceros.push(makeTercero({ id: 't1', name: 'Alpha' }));

    const onNavigate = vi.fn();
    render(
      <Datos
        budgets={[]}
        ejecuciones={[]}
        activeTab="terceros"
        companyId="c1"
        onNavigate={onNavigate}
      />,
    );

    // Should render 1 row checkbox
    await waitFor(() => {
      expect(getRowCheckboxes().length).toBe(1);
    });
  });

  it('seleccionar checkbox agrega a selectedTerceros y muestra action bar', async () => {
    mockTerceros.push(makeTercero({ id: 't1', name: 'Alpha' }));
    const onNavigate = vi.fn();

    render(
      <Datos
        budgets={[]}
        ejecuciones={[]}
        activeTab="terceros"
        companyId="c1"
        onNavigate={onNavigate}
      />,
    );

    // Wait for data to render
    await waitFor(() => {
      expect(getRowCheckboxes().length).toBe(1);
    });
    const rowCheckbox = getRowCheckboxes()[0]!;
    fireEvent.click(rowCheckbox);

    // Action bar should appear with count and button
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
    expect(screen.getByText('Editar en lote')).toBeInTheDocument();
  });

  it('action bar desaparece cuando se deselecciona el último item', async () => {
    mockTerceros.push(
      makeTercero({ id: 't1', name: 'Alpha' }),
      makeTercero({ id: 't2', name: 'Beta' }),
    );
    const onNavigate = vi.fn();

    render(
      <Datos
        budgets={[]}
        ejecuciones={[]}
        activeTab="terceros"
        companyId="c1"
        onNavigate={onNavigate}
      />,
    );

    await waitFor(() => {
      expect(getRowCheckboxes().length).toBe(2);
    });
    const [cb1, cb2] = getRowCheckboxes();
    // Select two
    fireEvent.click(cb1);
    fireEvent.click(cb2);
    expect(screen.getByText('2 seleccionados')).toBeInTheDocument();

    // Deselect one
    fireEvent.click(cb1);
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();

    // Deselect the last
    fireEvent.click(cb2);
    expect(screen.queryByText('1 seleccionado')).not.toBeInTheDocument();
    expect(screen.queryByText('Editar en lote')).not.toBeInTheDocument();
  });

  it('"Editar en lote" llama onNavigate con NavScreen correcto', async () => {
    mockTerceros.push(makeTercero({ id: 't1', name: 'Alpha' }));
    const onNavigate = vi.fn();

    render(
      <Datos
        budgets={[]}
        ejecuciones={[]}
        activeTab="terceros"
        companyId="c1"
        onNavigate={onNavigate}
      />,
    );

    // Wait for data to render
    await waitFor(() => {
      expect(getRowCheckboxes().length).toBe(1);
    });
    const rowCheckbox = getRowCheckboxes()[0]!;
    fireEvent.click(rowCheckbox);

    // Click "Editar en lote"
    fireEvent.click(screen.getByText('Editar en lote'));

    // Check that onNavigate was called with the correct screen
    expect(onNavigate).toHaveBeenCalledWith({
      type: 'bulk-edit-tercero',
      selectedIds: ['t1'],
    });
  });

  it('"Limpiar" deselecciona todos los terceros', async () => {
    mockTerceros.push(
      makeTercero({ id: 't1', name: 'Alpha' }),
      makeTercero({ id: 't2', name: 'Beta' }),
    );
    const onNavigate = vi.fn();

    render(
      <Datos
        budgets={[]}
        ejecuciones={[]}
        activeTab="terceros"
        companyId="c1"
        onNavigate={onNavigate}
      />,
    );

    // Wait for data to render
    await waitFor(() => {
      expect(getRowCheckboxes().length).toBe(2);
    });
    const [cb1, cb2] = getRowCheckboxes();
    fireEvent.click(cb1);
    fireEvent.click(cb2);
    await waitFor(() => {
      expect(screen.getByText('2 seleccionados')).toBeInTheDocument();
    });

    // Click the action bar "Limpiar" (last one — filter bar is above, action bar is below)
    const limpiarBtns = screen.getAllByText('Limpiar');
    fireEvent.click(limpiarBtns[limpiarBtns.length - 1]);

    // Action bar should disappear
    await waitFor(() => {
      expect(screen.queryByText('2 seleccionados')).not.toBeInTheDocument();
      expect(screen.queryByText('Editar en lote')).not.toBeInTheDocument();
    });
  });

  it('onNavigate no se llama cuando no hay selección', () => {
    const onNavigate = vi.fn();
    render(
      <Datos
        budgets={[]}
        ejecuciones={[]}
        activeTab="terceros"
        companyId="c1"
        onNavigate={onNavigate}
      />,
    );

    // Action bar not present
    expect(screen.queryByText('Editar en lote')).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Broken References Prevention — Task 3.3: handleDeleteTercero guard
// ═══════════════════════════════════════════════════════════════════════════════

describe('broken-refs (3.3): handleDeleteTercero warns about references', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTerceros.length = 0;
    mockCountResults.ejecuciones = 0;
    mockCountResults.budgets = 0;
    mockCountResults.documentos = 0;
    mockCountResults.proyectos = 0;
  });

  afterEach(() => {
    cleanup();
  });

  /** Helper: render Datos on terceros tab with given mock terceros */
  function renderDatosConTerceros() {
    return render(
      <Datos
        budgets={[]}
        ejecuciones={[]}
        activeTab="terceros"
        companyId="c1"
      />,
    );
  }

  it('calls all 4 count functions when delete button is clicked and shows warning', async () => {
    mockTerceros.push(makeTercero({ id: 't1', name: 'Tercero Con Referencias' }));
    mockCountResults.ejecuciones = 3;
    mockCountResults.budgets = 2;
    mockCountResults.documentos = 1;
    mockCountResults.proyectos = 0;

    renderDatosConTerceros();

    // Wait for terceros to render
    await waitFor(() => {
      expect(screen.getByText('Tercero Con Referencias')).toBeInTheDocument();
    });

    // Click the delete button (title="Borrar")
    const deleteBtn = screen.getByTitle('Borrar');
    fireEvent.click(deleteBtn);

    // Wait for async handler to complete and toast to show
    await waitFor(() => {
      // Toast.error should have been called with the warning message
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining('No se puede eliminar'),
      );
    });

    // Verify the message includes all reference types with counts
    expect(mockToast.error).toHaveBeenCalledWith(
      expect.stringContaining('3 ejecuciónes'),
    );
    expect(mockToast.error).toHaveBeenCalledWith(
      expect.stringContaining('2 presupuestos'),
    );
    expect(mockToast.error).toHaveBeenCalledWith(
      expect.stringContaining('1 documento'),
    );
  });

  it('blocks deletion when any references exist, even if count is 1', async () => {
    mockTerceros.push(makeTercero({ id: 't2', name: 'Tercero Unico' }));
    mockCountResults.ejecuciones = 0;
    mockCountResults.budgets = 1; // solo 1 referencia

    renderDatosConTerceros();

    await waitFor(() => {
      expect(screen.getByText('Tercero Unico')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Borrar'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });

    // Singular form
    expect(mockToast.error).toHaveBeenCalledWith(
      expect.stringContaining('1 presupuesto'),
    );
    // Should NOT have ejecuciones, documentos, proyectos (they are 0)
    expect(mockToast.error).not.toHaveBeenCalledWith(
      expect.stringContaining('ejecuciónes'),
    );
  });

  it('shows toast with all 4 types when all have references', async () => {
    mockTerceros.push(makeTercero({ id: 't3', name: 'Tercero Completo' }));
    mockCountResults.ejecuciones = 5;
    mockCountResults.budgets = 3;
    mockCountResults.documentos = 2;
    mockCountResults.proyectos = 4;

    renderDatosConTerceros();

    await waitFor(() => {
      expect(screen.getByText('Tercero Completo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Borrar'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining('5 ejecuciónes'),
      );
    });

    expect(mockToast.error).toHaveBeenCalledWith(
      expect.stringContaining('3 presupuestos'),
    );
    expect(mockToast.error).toHaveBeenCalledWith(
      expect.stringContaining('2 documentos'),
    );
    expect(mockToast.error).toHaveBeenCalledWith(
      expect.stringContaining('4 proyectos'),
    );
  });

  it('shows confirmation toast when zero references (allows delete)', async () => {
    mockTerceros.push(makeTercero({ id: 't4', name: 'Tercero Sin Referencias' }));
    // All counts already 0 from beforeEach

    renderDatosConTerceros();

    await waitFor(() => {
      expect(screen.getByText('Tercero Sin Referencias')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Borrar'));

    // Should NOT show error toast (zero refs)
    await waitFor(() => {
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    // Should show confirmation dialog via toast() directly (not toast.error)
    expect(mockToast).toHaveBeenCalled();
  });
});
