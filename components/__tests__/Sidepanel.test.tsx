import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act, waitFor, within } from '@testing-library/react';
import React from 'react';

// ─── Mock infrastructure (hoisted before imports) ───────────────────────────

const { collection, doc, addDoc, updateDoc, onSnapshot, serverTimestamp, getFirestore, mockUnsub } = vi.hoisted(
  () => {
    const mockUnsub = vi.fn();
    return {
      collection: vi.fn(() => ({ type: 'collection' as const })),
      doc: vi.fn(() => ({ type: 'doc' as const })),
      addDoc: vi.fn().mockResolvedValue({ id: 'new-id' }),
      updateDoc: vi.fn().mockResolvedValue(undefined),
      onSnapshot: vi.fn().mockReturnValue(mockUnsub),
      serverTimestamp: vi.fn().mockReturnValue({ toDate: () => new Date() }),
      getFirestore: vi.fn(),
      mockUnsub,
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

vi.mock('@/lib/firebase', () => ({
  db: {},
  storage: {},
}));

vi.mock('@/lib/fileUpload', () => ({
  validateFile: vi.fn().mockImplementation((file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.type)) return { valid: false as const, error: 'Tipo no soportado: ' + file.type + '. Permitidos: PDF, JPG, PNG' };
    if (file.size > 5 * 1024 * 1024) return { valid: false as const, error: 'Archivo demasiado grande. Máximo: 5MB' };
    return { valid: true as const };
  }),
  uploadFile: vi.fn().mockResolvedValue({ url: 'https://example.com/file.pdf', path: 'c1/ejecuciones/ej-1/file.pdf' }),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  generateFilePath: vi.fn().mockImplementation((companyId: string, ejecucionId: string, fileName: string) =>
    `${companyId}/ejecuciones/${ejecucionId}/${fileName}`,
  ),
}));

// ─── Callback capture variables ─────────────────────────────────────────────

let onProjectsCallback: ((data: any[]) => void) | undefined;
let onClientsCallback: ((data: any[]) => void) | undefined;
let onBudgetsCallback: ((data: any[]) => void) | undefined;

vi.mock('@/lib/firestore', () => ({
  subscribeProjects: vi.fn(
    (_companyId: string, onData: (data: any[]) => void) => {
      onProjectsCallback = onData;
      return mockUnsub;
    },
  ),
  subscribeClients: vi.fn((onData: (data: any[]) => void) => {
    onClientsCallback = onData;
    return mockUnsub;
  }),
  subscribeProviders: vi.fn((onData: (data: any[]) => void) => {
    onData([]);
    return mockUnsub;
  }),
  subscribeBudgets: vi.fn(
    (_companyId: string, onData: (data: any[]) => void) => {
      onBudgetsCallback = onData;
      return mockUnsub;
    },
  ),
  subscribeTerceros: vi.fn((onData: (data: any[]) => void) => {
    onData([]);
    return mockUnsub;
  }),
  subscribeSettings: vi.fn((onData: (data: any) => void) => {
    onData({
      stateProject: [
        { name: 'Activo', color: '#22c55e', order: 0 },
        { name: 'Cerrado', color: '#64748b', order: 1 },
        { name: 'Negociación', color: '#f97316', order: 2 },
        { name: 'En ejecución', color: '#6366f1', order: 3 },
        { name: 'Cancelado', color: '#ef4444', order: 4 },
      ],
      tipoProyectos: [
        { name: 'Serie', color: '#a855f7', order: 0 },
        { name: 'Película', color: '#ec4899', order: 1 },
        { name: 'Reallity', color: '#f59e0b', order: 2 },
        { name: 'Shot', color: '#14b8a6', order: 3 },
      ],
      unidades: [
        { name: 'episodios', color: '#06b6d4', order: 0 },
        { name: 'secuencias', color: '#8b5cf6', order: 1 },
        { name: 'plano', color: '#84cc16', order: 2 },
        { name: 'película', color: '#f472b6', order: 3 },
      ],
    });
    return mockUnsub;
  }),
  updateSettings: vi.fn().mockResolvedValue(undefined),
  updateEjecucion: vi.fn().mockResolvedValue(undefined),
  addEjecucion: vi.fn().mockResolvedValue('new-id'),
  addClient: vi.fn().mockResolvedValue('new-id'),
  addTercero: vi.fn().mockResolvedValue('new-id'),
  addProject: vi.fn().mockResolvedValue('new-id'),
}));

// ─── Imports (resolved after mocks) ─────────────────────────────────────────

import { Sidepanel } from '@/components/Sidepanel';
import { Dashboard, buildTerceroGroups } from '@/components/Dashboard';
import type {
  Budget,
  Ejecucion,
  Comprobante,
  Project,
  Client,
  ActiveForm,
  FormType,
  Month,
  SidepanelData,
  RecordDetail,
  NavScreen,
  DetalleTerceroGroup,
} from '@/lib/types';

// ─── Factory helpers ─────────────────────────────────────────────────────────

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    descripcion: 'Presupuesto Test',
    projectId: 'proj-1',
    projectName: 'Proyecto Alpha',
    entityId: 'client-1',
    entityName: 'Cliente Beta',
    entityType: 'client',
    tipo: 'ingreso',
    montoPresupuestado: 500000,
    mesPresupuestado: 'Julio',
    fechaPresupuestado: '2026-07',
    estadoProyecto: 'Activo',
    ...overrides,
  };
}

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

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Proyecto Alpha',
    clientId: 'client-1',
    clientName: 'Cliente Beta',
    estado: 'Activo',
    ...overrides,
  };
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    name: 'Cliente Beta',
    ...overrides,
  };
}

function makeActiveForm(
  mode: 'add' | 'edit' = 'add',
  type: FormType = 'budget',
  record?: Budget | Ejecucion | Project | Client,
): ActiveForm {
  if (mode === 'edit' && record) {
    if (type === 'budget') return { mode: 'edit', type: 'budget', record: record as Budget };
    if (type === 'ejecucion')
      return { mode: 'edit', type: 'ejecucion', record: record as Ejecucion };
    if (type === 'project') return { mode: 'edit', type: 'project', record: record as Project };
    if (type === 'client') return { mode: 'edit', type: 'client', record: record as Client };
    return { mode: 'edit', type: 'provider', record: record as any };
  }
  return { mode: 'add', type };
}

// ─── Emission helpers (wraps state updates in act()) ────────────────────────

async function emitProjects(data: any[]) {
  if (onProjectsCallback) {
    await act(async () => {
      onProjectsCallback!(data);
    });
  }
}

async function emitClients(data: any[]) {
  if (onClientsCallback) {
    await act(async () => {
      onClientsCallback!(data);
    });
  }
}

async function emitBudgets(data: any[]) {
  if (onBudgetsCallback) {
    await act(async () => {
      onBudgetsCallback!(data);
    });
  }
}

// ─── DOM helper — find input by associated label text ───────────────────────

function getInputByLabel(labelText: string): HTMLInputElement {
  const label = screen.getByText(labelText);
  // Walk up to find the container div that also holds the input
  let el = label.parentElement;
  while (el && !el.querySelector('input')) el = el.parentElement;
  if (!el) throw new Error(`No input found for label "${labelText}"`);
  const input = el.querySelector('input')!;
  return input as HTMLInputElement;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test suites
// ═══════════════════════════════════════════════════════════════════════════════

describe('Sidepanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onProjectsCallback = undefined;
    onClientsCallback = undefined;
    onBudgetsCallback = undefined;
  });

  afterEach(() => {
    cleanup();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Phase 2: Pure function behaviour (tested through component interaction)
  // ═════════════════════════════════════════════════════════════════════════

  describe('R1 — handleDateChange date-to-month extraction', () => {
    it('convierte "2026-02-15" a mesPresupuestado="Febrero" y fechaPresupuestado="2026-02"', async () => {
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      const { container } = render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      const dateInput = container.querySelector('input[type="date"]')!;
      expect(dateInput).toBeInTheDocument();

      fireEvent.change(dateInput, { target: { value: '2026-02-15' } });

      // The month indicator appears
      expect(screen.getByText(/Mes calculado/)).toBeInTheDocument();
      expect(screen.getByText(/Febrero/)).toBeInTheDocument();

      // Submit to verify fechaPresupuestado is also set
      fireEvent.click(screen.getByText('Crear'));
      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });
      const data = onFormSubmit.mock.calls[0][1];
      expect(data.fechaPresupuestado).toBe('2026-02');
      expect(data.mesPresupuestado).toBe('Febrero');
    });

    it('convierte "2026-12-01" a mesPresupuestado="Diciembre" y fechaPresupuestado="2026-12"', async () => {
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      const { container } = render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      const dateInput = container.querySelector('input[type="date"]')!;
      fireEvent.change(dateInput, { target: { value: '2026-12-01' } });

      expect(screen.getByText(/Mes calculado/)).toBeInTheDocument();
      expect(screen.getByText(/Diciembre/)).toBeInTheDocument();

      fireEvent.click(screen.getByText('Crear'));
      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });
      const data = onFormSubmit.mock.calls[0][1];
      expect(data.fechaPresupuestado).toBe('2026-12');
      expect(data.mesPresupuestado).toBe('Diciembre');
    });

    it('no modifica month fields cuando la fecha está vacía desde el inicio', async () => {
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      // The form starts with no date → no month indicator
      expect(screen.queryByText(/Mes calculado/)).not.toBeInTheDocument();

      // Submit without setting date → no month fields
      fireEvent.click(screen.getByText('Crear'));
      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });
      const data = onFormSubmit.mock.calls[0][1];
      expect(data.fechaPresupuestado).toBeUndefined();
      expect(data.mesPresupuestado).toBeUndefined();
    });

    it('month index 13 (fecha inválida) no establece campos de mes', async () => {
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      const { container } = render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      const dateInput = container.querySelector('input[type="date"]')!;
      // JSDOM sanitiza "2026-13-01" a '' porque mes 13 es inválido
      fireEvent.change(dateInput, { target: { value: '2026-13-01' } });

      // handleDateChange recibe '' → date es falsy → no establece campos de mes
      expect(screen.queryByText(/Mes calculado/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Crear'));
      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });
      const data = onFormSubmit.mock.calls[0][1];
      // Al recibir string vacío, handleDateChange solo actualiza fechaEjecutado
      // No modifica fechaPresupuestado ni mesPresupuestado
      expect(data.fechaPresupuestado).toBeUndefined();
      expect(data.mesPresupuestado).toBeUndefined();
    });
  });

  describe('R2 — handleSubmit field normalization', () => {
    it('convierte montoPresupuestado string a number y elimina fechaEjecutado en budget', async () => {
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      // Fill descripcion
      fireEvent.change(getInputByLabel('Descripción'), {
        target: { value: 'Mi Presupuesto' },
      });
      // Fill monto
      fireEvent.change(getInputByLabel('Monto Presupuestado'), {
        target: { value: '500000' },
      });

      fireEvent.click(screen.getByText('Crear'));
      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });

      const submittedData = onFormSubmit.mock.calls[0][1] as Record<string, any>;
      expect(submittedData.montoPresupuestado).toBe(500000);
      // fechaEjecutado must be deleted for budget type
      expect(submittedData).not.toHaveProperty('fechaEjecutado');
    });

    it('convierte montoEjecutado string a number para ejecucion', async () => {
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'ejecucion' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      // Fill monto ejecutado
      fireEvent.change(getInputByLabel('Monto Ejecutado'), {
        target: { value: '250000' },
      });

      fireEvent.click(screen.getByText('Crear'));
      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });

      const submittedData = onFormSubmit.mock.calls[0][1] as Record<string, any>;
      expect(submittedData.montoEjecutado).toBe(250000);
    });

    it('convierte NaN a 0 cuando montoPresupuestado no es numérico', async () => {
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      fireEvent.change(getInputByLabel('Monto Presupuestado'), {
        target: { value: 'abc' },
      });

      fireEvent.click(screen.getByText('Crear'));
      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });

      const submittedData = onFormSubmit.mock.calls[0][1] as Record<string, any>;
      expect(submittedData.montoPresupuestado).toBe(0);
    });
  });

  describe('FormPanel submit pops back', () => {
    it('successful submit calls onBack (not onClose)', async () => {
      const onClose = vi.fn();
      const onBack = vi.fn();
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={onClose}
          onFormSubmit={onFormSubmit}
          canGoBack={true}
          onBack={onBack}
          onNavigate={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText('Crear'));
      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });

      // onBack should be called, not onClose
      expect(onBack).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('R12 — Dashboard data construction', () => {
    it('handleCellClick construye SidepanelData con title y budgets correctos', () => {
      const budgets = [
        makeBudget({
          id: 'b1',
          projectName: 'Proyecto X',
          mesPresupuestado: 'Julio',
          montoPresupuestado: 100000,
          tipo: 'ingreso',
          fechaPresupuestado: '2026-07',
        }),
      ];
      const onCellClick = vi.fn();
      const { container } = render(
        <Dashboard onCellClick={onCellClick} budgets={budgets} ejecuciones={[]} />,
      );

      // Click on a monthly cell within the first tbody (ingreso matrix).
      // Use getAllByText and pick [0] — monthly cell appears before row total in DOM order.
      const firstTbody = container.querySelector('tbody')!;
      const monthCell = within(firstTbody).getAllByText(/100\.000/)[0];
      fireEvent.click(monthCell);

      expect(onCellClick).toHaveBeenCalledTimes(1);
      const sidepanelData: SidepanelData = onCellClick.mock.calls[0][0];
      expect(sidepanelData.title).toBe('Proyecto X / Julio');
      expect(sidepanelData.mode).toBe('Presupuestado');
      expect(sidepanelData.value).toBe(100000);
      expect(sidepanelData.presupuestado).toBe(100000);
      expect(sidepanelData.ejecutado).toBe(0);
      expect(sidepanelData.diferencia).toBe(-100000);
      expect(sidepanelData.budgets).toHaveLength(1);
      expect(sidepanelData.budgets[0].id).toBe('b1');
      expect(sidepanelData.ejecuciones).toHaveLength(0);
    });

    it('handleColTotalClick NO llama a onCellClick cuando el total de columna es 0', () => {
      // No data → all column totals are 0
      const onCellClick = vi.fn();
      render(
        <Dashboard onCellClick={onCellClick} budgets={[]} ejecuciones={[]} />,
      );

      // Find "TOTAL GENERAL" row cells — all are 0, shown as '-'
      const totalCells = screen.getAllByText('-');
      // The footer td elements with '-' are the column total cells
      // Click each one — onCellClick should NOT be called (early return)
      totalCells.forEach((cell) => {
        if (cell.closest('tfoot')) {
          fireEvent.click(cell);
        }
      });

      // onCellClick should NOT be called for zero-value column totals
      // (The only calls would be from Grand Total click, which also early-returns
      //  since value is 0. handleGrandTotalClick also has value===0 early return)
      // Actually, handleGrandTotalClick checks value === 0, so nothing is called.
      expect(onCellClick).not.toHaveBeenCalled();
    });

    it('handleCellClick usa ejecuciones pasadas en el SidepanelData', () => {
      const ejecuciones = [
        makeEjecucion({
          id: 'ej1',
          projectName: 'Proyecto X',
          tipo: 'ingreso',
          montoEjecutado: 50000,
          fechaEjecutado: '2026-07-15',
        }),
      ];
      const budgets = [
        makeBudget({
          id: 'b1',
          projectName: 'Proyecto X',
          mesPresupuestado: 'Julio',
          montoPresupuestado: 100000,
          tipo: 'ingreso',
          fechaPresupuestado: '2026-07',
        }),
      ];
      const onCellClick = vi.fn();
      const { container } = render(
        <Dashboard
          onCellClick={onCellClick}
          budgets={budgets}
          ejecuciones={ejecuciones}
        />,
      );

      // Switch to Ejecutado mode
      fireEvent.click(screen.getByText('Ejecutado'));

      // Click a monthly cell within the first tbody (ingreso matrix, Ejecutado mode)
      const firstTbody = container.querySelector('tbody')!;
      const monthCell = within(firstTbody).getAllByText(/50\.000/)[0];
      fireEvent.click(monthCell);

      expect(onCellClick).toHaveBeenCalledTimes(1);
      const data: SidepanelData = onCellClick.mock.calls[0][0];
      expect(data.title).toBe('Proyecto X / Julio');
      expect(data.mode).toBe('Ejecutado');
      expect(data.value).toBe(50000);
      expect(data.ejecuciones).toHaveLength(1);
      expect(data.ejecuciones[0].id).toBe('ej1');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Phase 3: Leaf component rendering
  // ═════════════════════════════════════════════════════════════════════════

  describe('R5 — Rich form fields per form type', () => {
    it('type=project muestra campos Sigla, Tipo de proyecto, Unidades, Cliente y Estado', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'project' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Sigla')).toBeInTheDocument();
      expect(screen.getByText('Nombre completo')).toBeInTheDocument();
      expect(screen.getByText('Tipo de proyecto')).toBeInTheDocument();
      expect(screen.getByText('Cantidad')).toBeInTheDocument();
      expect(screen.getByText('Unidades')).toBeInTheDocument();
      expect(screen.getByText('Cliente')).toBeInTheDocument();
      expect(screen.getByText('Estado')).toBeInTheDocument();
    });

    it('type=client muestra campos del formulario de terceros con tipo por defecto cliente', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'client' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Nombre *')).toBeInTheDocument();
      expect(screen.getByText('Apodo')).toBeInTheDocument();
      expect(screen.getByText('Naturaleza')).toBeInTheDocument();
      expect(screen.getByText('Documento')).toBeInTheDocument();
      expect(screen.getByText('Número de documento')).toBeInTheDocument();
      expect(screen.getByText('Lugar')).toBeInTheDocument();
      expect(screen.getByText('Tipo')).toBeInTheDocument();
      // Cliente label used by budget forms should NOT appear
      expect(screen.queryByText('Cliente / Proveedor')).not.toBeInTheDocument();
    });

    it('type=provider muestra campos del formulario de terceros con tipo por defecto proveedor', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'provider' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Nombre *')).toBeInTheDocument();
      expect(screen.getByText('Apodo')).toBeInTheDocument();
      expect(screen.getByText('Naturaleza')).toBeInTheDocument();
      expect(screen.getByText('Documento')).toBeInTheDocument();
      expect(screen.getByText('Número de documento')).toBeInTheDocument();
      expect(screen.getByText('Lugar')).toBeInTheDocument();
      expect(screen.getByText('Tipo')).toBeInTheDocument();
      // Cliente label used by budget forms should NOT appear
      expect(screen.queryByText('Cliente / Proveedor')).not.toBeInTheDocument();
    });
  });

  describe('R6 — TipoSwitch ingreso/egreso toggle', () => {
    it('hace clic en Egreso cambia el valor a egreso (verificado vía submit)', async () => {
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      // Inicialmente "Ingreso" está activo, "Egreso" está inactivo
      expect(screen.getByText('Ingreso')).toBeInTheDocument();
      expect(screen.getByText('Egreso')).toBeInTheDocument();

      // Click Egreso
      fireEvent.click(screen.getByText('Egreso'));

      // Verify by submitting — tipo should be 'egreso'
      fireEvent.click(screen.getByText('Crear'));
      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });
      const data = onFormSubmit.mock.calls[0][1] as Record<string, any>;
      expect(data.tipo).toBe('egreso');
    });
  });

  describe('R4 — SearchableSelect filtering and interaction', () => {
    it('focus abre dropdown y muestra todas las opciones de proyectos', async () => {
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      const testProjects = [
        makeProject({ id: 'p1', name: 'Proyecto Alpha' }),
        makeProject({ id: 'p2', name: 'Proyecto Beta' }),
        makeProject({ id: 'p3', name: 'Proyecto Gamma' }),
      ];
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          projects={testProjects}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      // Focus on the project search input
      const projectInput = getInputByLabel('Proyecto');
      fireEvent.focus(projectInput);

      // All three should be visible
      expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
      expect(screen.getByText('Proyecto Beta')).toBeInTheDocument();
      expect(screen.getByText('Proyecto Gamma')).toBeInTheDocument();
    });

    it('typing filtra opciones en SearchableSelect', async () => {
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      const testProjects = [
        makeProject({ id: 'p1', name: 'Proyecto Alpha' }),
        makeProject({ id: 'p2', name: 'Proyecto Beta' }),
        makeProject({ id: 'p3', name: 'Proyecto Gamma' }),
      ];
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          projects={testProjects}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      const projectInput = getInputByLabel('Proyecto');
      // Typing opens the dropdown and sets search
      fireEvent.change(projectInput, { target: { value: 'Beta' } });

      // Only Beta should be visible
      expect(screen.queryByText('Proyecto Alpha')).not.toBeInTheDocument();
      expect(screen.getByText('Proyecto Beta')).toBeInTheDocument();
      expect(screen.queryByText('Proyecto Gamma')).not.toBeInTheDocument();
    });

    it('empty search muestra "Sin resultados"', async () => {
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      await emitProjects([
        makeProject({ id: 'p1', name: 'Proyecto Alpha' }),
      ]);

      const projectInput = getInputByLabel('Proyecto');
      fireEvent.change(projectInput, { target: { value: 'Z' } });

      expect(screen.getByText('Sin resultados')).toBeInTheDocument();
    });

    it('seleccionar opción cierra dropdown y llama onChange', async () => {
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      const testProjects = [
        makeProject({ id: 'p1', name: 'Proyecto Alpha' }),
        makeProject({ id: 'p2', name: 'Proyecto Beta' }),
      ];
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          projects={testProjects}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      const projectInput = getInputByLabel('Proyecto');
      fireEvent.focus(projectInput);

      // Click on 'Proyecto Beta'
      fireEvent.click(screen.getByText('Proyecto Beta'));

      // Dropdown should be closed — options no longer visible
      expect(screen.queryByText('Proyecto Alpha')).not.toBeInTheDocument();
      expect(screen.queryByText('Proyecto Beta')).not.toBeInTheDocument();

      // Verify via submit that projectName was set
      fireEvent.click(screen.getByText('Crear'));
      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });
      const data = onFormSubmit.mock.calls[0][1] as Record<string, any>;
      expect(data.projectName).toBe('Proyecto Beta');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Phase 4: Composite component behaviour
  // ═════════════════════════════════════════════════════════════════════════

  describe('R3 — FormPanel conditional rendering per type', () => {
    it('type=budget muestra date picker, tipo, proyecto, cliente, descripcion y monto', async () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );
      await emitProjects([makeProject()]);
      await emitClients([makeClient()]);

      expect(screen.getByText('Nuevo Presupuesto')).toBeInTheDocument();
      expect(screen.getByText('Ingreso')).toBeInTheDocument();
      expect(screen.getByText('Egreso')).toBeInTheDocument();
      expect(screen.getByText('Proyecto')).toBeInTheDocument();
      expect(screen.getByText('Cliente / Proveedor')).toBeInTheDocument();
      expect(screen.getByText('Descripción')).toBeInTheDocument();
      expect(screen.getByText('Monto Presupuestado')).toBeInTheDocument();
      expect(screen.getByText('Fecha del presupuesto')).toBeInTheDocument();
      expect(screen.getByText('Crear')).toBeInTheDocument();
    });

    it('type=ejecucion muestra date, monto y budget linking', async () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'ejecucion' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Nuevo Ejecución')).toBeInTheDocument();
      expect(screen.getByText('Monto Ejecutado')).toBeInTheDocument();
      expect(screen.getByText('Fecha de ejecución')).toBeInTheDocument();
      expect(screen.getByText('Vincular presupuesto (opcional)')).toBeInTheDocument();
      expect(screen.getByText('Crear')).toBeInTheDocument();
    });

    it('type=project muestra formulario rico con Sigla, Tipo de proyecto, Cliente y Estado', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'project' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Nuevo Proyecto')).toBeInTheDocument();
      expect(screen.getByText('Sigla')).toBeInTheDocument();
      expect(screen.getByText('Nombre completo')).toBeInTheDocument();
      expect(screen.getByText('Tipo de proyecto')).toBeInTheDocument();
      expect(screen.getByText('Cliente')).toBeInTheDocument();
      expect(screen.getByText('Estado')).toBeInTheDocument();
    });
  });

  describe('R7 — BudgetView with linked ejecuciones + inline add', () => {
    it('muestra campos del budget y ejecuciones vinculadas', () => {
      const budget = makeBudget({
        descripcion: 'Anticipo Obra',
        projectName: 'Edificio A',
        entityName: 'Constructora X',
        tipo: 'ingreso',
        montoPresupuestado: 100000000,
        mesPresupuestado: 'Julio',
        estadoProyecto: 'Activo',
      });
      const ejecuciones = [
        makeEjecucion({ id: 'ej1', descripcion: 'Pago parcial 1', montoEjecutado: 40000000, fechaEjecutado: '2026-07-15' }),
        makeEjecucion({ id: 'ej2', descripcion: 'Pago parcial 2', montoEjecutado: 60000000, fechaEjecutado: '2026-07-30' }),
      ];

      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'budget', budget, ejecuciones }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Presupuesto')).toBeInTheDocument();
      expect(screen.getByText('Anticipo Obra')).toBeInTheDocument();
      expect(screen.getByText('Edificio A')).toBeInTheDocument();
      expect(screen.getByText('Constructora X')).toBeInTheDocument();
      expect(screen.getByText('$ 100.000.000', { exact: false })).toBeInTheDocument();
      expect(screen.getByText('Julio')).toBeInTheDocument();
      expect(screen.getByText('Activo')).toBeInTheDocument();

      // Linked ejecuciones (text is combined with date in same element)
      expect(screen.getByText(/Pago parcial 1/)).toBeInTheDocument();
      expect(screen.getByText(/Pago parcial 2/)).toBeInTheDocument();

      // "Agregar" button
      expect(screen.getByText('Agregar')).toBeInTheDocument();
    });

    it('click Agregar muestra inline form, Cancelar lo oculta', async () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'budget', budget: makeBudget(), ejecuciones: [] }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText('Agregar'));
      expect(screen.getByText('Nueva ejecución vinculada')).toBeInTheDocument();
      expect(screen.getByText('Cancelar')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancelar'));
      expect(screen.queryByText('Nueva ejecución vinculada')).not.toBeInTheDocument();
    });

    it('muestra "Sin ejecuciones" cuando no hay ninguna', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'budget', budget: makeBudget(), ejecuciones: [] }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Sin ejecuciones')).toBeInTheDocument();
    });
  });

  describe('R8 — EjecucionView with budget linking', () => {
    it('muestra campos de la ejecucion y "Sin presupuesto vinculado"', () => {
      const ejecucion = makeEjecucion({
        descripcion: 'Pago proveedor',
        projectName: 'Obra A',
        entityName: 'Proveedor X',
        tipo: 'egreso',
        montoEjecutado: 5000000,
        fechaEjecutado: '2026-08-10',
        budgetId: '',
      });

      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'ejecucion', ejecucion }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Ejecución')).toBeInTheDocument();
      expect(screen.getByText('Pago proveedor')).toBeInTheDocument();
      expect(screen.getByText('Obra A')).toBeInTheDocument();
      expect(screen.getByText('Proveedor X')).toBeInTheDocument();
      expect(screen.getByText('$ 5.000.000', { exact: false })).toBeInTheDocument();
      expect(screen.getByText('2026-08-10')).toBeInTheDocument();
      expect(screen.getByText('Sin presupuesto vinculado')).toBeInTheDocument();
    });

    it('click "Buscar presupuesto" muestra input de búsqueda', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'ejecucion', ejecucion: makeEjecucion({ budgetId: '' }) }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText('Buscar presupuesto'));
      const searchInput = screen.getByPlaceholderText('Buscar por descripción o proyecto...');
      expect(searchInput).toBeInTheDocument();
    });

    it('muestra presupuesto vinculado cuando budgetId está presente', async () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'ejecucion', ejecucion: makeEjecucion({ budgetId: 'b1' }) }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      // Emit budgets AFTER render so the subscription callback is captured
      await emitBudgets([makeBudget({ id: 'b1', descripcion: 'Anticipo Obra' })]);

      expect(screen.getByText('Anticipo Obra')).toBeInTheDocument();
    });

    it('click linked budget calls onNavigate with view detail', async () => {
      const onNavigate = vi.fn();
      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'ejecucion', ejecucion: makeEjecucion({ budgetId: 'b1' }) }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={onNavigate}
        />,
      );

      await emitBudgets([makeBudget({ id: 'b1', descripcion: 'Presupuesto Vinculado' })]);

      fireEvent.click(screen.getByText('Presupuesto Vinculado'));

      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'view',
          detail: expect.objectContaining({ type: 'budget' }),
        }),
      );
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Phase 5: Top-level dispatch + integration
  // ═════════════════════════════════════════════════════════════════════════

  describe('R9 — ViewPanel record dispatch', () => {
    it('type=budget muestra BudgetView con descripcion del budget', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'budget', budget: makeBudget({ descripcion: 'Presupuesto Test' }), ejecuciones: [] }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Presupuesto Test')).toBeInTheDocument();
    });

    it('type=ejecucion muestra EjecucionView con descripcion', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'ejecucion', ejecucion: makeEjecucion({ descripcion: 'Ejecucion Test' }) }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Ejecucion Test')).toBeInTheDocument();
    });

    it('type=project muestra proyecto con nombre y cliente', () => {
      const project = makeProject({ name: 'Proyecto X', clientName: 'Cliente Y' });

      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'project', project, budgets: [], ejecuciones: [] }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Proyecto X')).toBeInTheDocument();
      expect(screen.getByText('Cliente Y')).toBeInTheDocument();
    });

    it('type=client muestra cliente con proyectos relacionados', () => {
      const client = makeClient({ name: 'Cliente Z' });
      const projects = [makeProject({ name: 'Proyecto Z1', clientName: 'Cliente Z' })];

      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'client', client, projects }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Cliente Z')).toBeInTheDocument();
      expect(screen.getByText('Proyecto Z1')).toBeInTheDocument();
    });

    it('type=provider muestra nombre del proveedor', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'provider', provider: { id: 'prov-1', name: 'Proveedor XYZ' } }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Proveedor XYZ')).toBeInTheDocument();
    });
  });

  describe('R10 — DataPanel rendering', () => {
    it('muestra budgets, ejecuciones, formula y diferencia', () => {
      const data: SidepanelData = {
        title: 'Proyecto X / Julio',
        subtitle: 'Presupuestado de ingresos',
        formula: 'Suma de todas las transacciones',
        budgets: [
          makeBudget({ descripcion: 'Anticipo A', montoPresupuestado: 100000, mesPresupuestado: 'Julio' }),
          makeBudget({ descripcion: 'Anticipo B', montoPresupuestado: 200000, mesPresupuestado: 'Julio' }),
        ],
        ejecuciones: [
          makeEjecucion({ descripcion: 'Pago A', montoEjecutado: 50000, fechaEjecutado: '2026-07-15' }),
        ],
        value: 300000,
        presupuestado: 300000,
        ejecutado: 50000,
        diferencia: -250000,
        mode: 'Presupuestado',
        tipo: 'ingreso',
      };

      render(
        <Sidepanel
          data={data}
          recordDetail={null}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      // En modo Presupuestado muestra budgets, NO ejecuciones en el body
      expect(screen.getByText('Anticipo A')).toBeInTheDocument();
      expect(screen.getByText('Anticipo B')).toBeInTheDocument();
      expect(screen.queryByText('Pago A')).not.toBeInTheDocument();
      // El footer con totales siempre visible (puede aparecer también en headers de grupo)
      expect(screen.getAllByText('$ 300.000', { exact: false }).length).toBeGreaterThan(0);
      expect(screen.getByText('-$ 250.000', { exact: false })).toBeInTheDocument();
    });
  });

  describe('R11 — Sidepanel collapsed/expanded dispatch', () => {
    it('todo null muestra sidebar colapsado (w-16, sin panel de texto)', () => {
      const { container } = render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      // Collapsed sidebar has w-16 class
      const aside = container.querySelector('aside');
      expect(aside?.className).toContain('w-16');
      // No title panel should be visible
      expect(screen.queryByText('Detalle de Celda')).not.toBeInTheDocument();
      expect(screen.queryByText('Nuevo Presupuesto')).not.toBeInTheDocument();
    });

    it('activeForm set muestra FormPanel con titulo del formulario', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Nuevo Presupuesto')).toBeInTheDocument();
    });

    it('recordDetail set muestra ViewPanel con titulo del tipo de registro', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'budget', budget: makeBudget(), ejecuciones: [] }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Presupuesto')).toBeInTheDocument();
    });

    it('data set muestra DataPanel con titulo de la celda', () => {
      const data: SidepanelData = {
        title: 'Proyecto X / Julio',
        subtitle: 'Presupuestado de ingresos',
        formula: 'Suma',
        budgets: [],
        ejecuciones: [],
        value: 0,
        presupuestado: 0,
        ejecutado: 0,
        diferencia: 0,
        mode: 'Presupuestado',
        tipo: 'ingreso',
      };

      render(
        <Sidepanel
          data={data}
          recordDetail={null}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Proyecto X / Julio')).toBeInTheDocument();
    });
  });

  describe('DataPanel navigation via onNavigate', () => {
    function dataPanelData(overrides?: Partial<SidepanelData>): SidepanelData {
      return {
        title: 'Proyecto X / Julio',
        subtitle: 'Presupuestado de ingresos',
        formula: 'Suma de todas las transacciones',
        budgets: [
          makeBudget({ id: 'b1', descripcion: 'Anticipo A', montoPresupuestado: 100000, mesPresupuestado: 'Julio' }),
        ],
        ejecuciones: [],
        value: 100000,
        presupuestado: 100000,
        ejecutado: 0,
        diferencia: -100000,
        mode: 'Presupuestado',
        tipo: 'ingreso',
        ...overrides,
      };
    }

    it('click "Ver" on a budget calls onNavigate with type="view" and budget detail', () => {
      const onNavigate = vi.fn();
      render(
        <Sidepanel data={dataPanelData()} recordDetail={null} activeForm={null}
          companyId="c1" onClose={vi.fn()} onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false} onBack={vi.fn()} onNavigate={onNavigate} />,
      );

      fireEvent.click(screen.getByText('Ver'));

      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'view', detail: expect.objectContaining({ type: 'budget' }) }),
      );
    });

    it('click "Editar" on a budget calls onNavigate with type="form" and edit form', () => {
      const onNavigate = vi.fn();
      render(
        <Sidepanel data={dataPanelData()} recordDetail={null} activeForm={null}
          companyId="c1" onClose={vi.fn()} onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false} onBack={vi.fn()} onNavigate={onNavigate} />,
      );

      fireEvent.click(screen.getByText('Editar'));

      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'form', form: expect.objectContaining({ mode: 'edit', type: 'budget' }) }),
      );
    });

    it('click "+ Ingreso Presupuestado" calls onNavigate with type="form" and add form', () => {
      const onNavigate = vi.fn();
      render(
        <Sidepanel data={dataPanelData()} recordDetail={null} activeForm={null}
          companyId="c1" onClose={vi.fn()} onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false} onBack={vi.fn()} onNavigate={onNavigate} />,
      );

      fireEvent.click(screen.getByText('Ingreso Presupuestado'));

      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'form', form: expect.objectContaining({ mode: 'add' }) }),
      );
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Phase 3: Click proyecto y celda vacía en matriz (SDD click-proyecto-matriz)
  // ═════════════════════════════════════════════════════════════════════════

  describe('R13 — FormPanel add-mode with defaults merge', () => {
    it('3.1 mergea defaults en add mode para budget', async () => {
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget', defaults: { projectName: 'Proyecto X', tipo: 'egreso', mesPresupuestado: 'Julio' } }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      // Verificar que los defaults se precargaron
      fireEvent.click(screen.getByText('Crear'));
      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });
      const data = onFormSubmit.mock.calls[0][1] as Record<string, any>;
      expect(data.projectName).toBe('Proyecto X');
      expect(data.tipo).toBe('egreso');
      expect(data.mesPresupuestado).toBe('Julio');
    });

    it('3.1 mergea defaults en add mode para ejecucion', async () => {
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'ejecucion', defaults: { projectName: 'Proyecto Y', tipo: 'ingreso' } }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText('Crear'));
      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });
      const data = onFormSubmit.mock.calls[0][1] as Record<string, any>;
      expect(data.projectName).toBe('Proyecto Y');
      expect(data.tipo).toBe('ingreso');
    });
  });

  describe('R14 — ProjectView/ViewPanel project state select', () => {
    it('3.2 detecta proyecto inferido cuando no está en projects[]', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={{
            type: 'project',
            project: { id: '', name: 'Proyecto Inferido', clientId: '', clientName: 'Cliente X', estado: 'Activo' },
            budgets: [],
            ejecuciones: [],
          }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          projects={[{ id: 'p1', name: 'Otro Proyecto', clientId: '', clientName: '', estado: 'Activo' }]}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      // Debe mostrar el mensaje de proyecto inferido
      expect(screen.getByText(/Proyecto inferido/)).toBeInTheDocument();
      expect(screen.getByText('Crear proyecto')).toBeInTheDocument();
      // El select debe estar deshabilitado
      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });

    it('3.2 detecta proyecto existente (no inferido) y habilita select', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={{
            type: 'project',
            project: { id: 'p1', name: 'Proyecto Alpha', clientId: '', clientName: 'Cliente Beta', estado: 'Activo' },
            budgets: [],
            ejecuciones: [],
          }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          projects={[{ id: 'p1', name: 'Proyecto Alpha', clientId: '', clientName: 'Cliente Beta', estado: 'Activo' }]}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      // No debe mostrar mensaje de inferido
      expect(screen.queryByText(/Proyecto inferido/)).not.toBeInTheDocument();
      // Select debe estar habilitado
      const select = screen.getByRole('combobox');
      expect(select).not.toBeDisabled();
    });

    it('3.5 cambiar estado en select y click guardar llama onFormSubmit con nuevo estado', async () => {
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <Sidepanel
          data={null}
          recordDetail={{
            type: 'project',
            project: { id: 'p1', name: 'Proyecto Alpha', clientId: '', clientName: 'Cliente Beta', estado: 'Activo' },
            budgets: [],
            ejecuciones: [],
          }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          projects={[{ id: 'p1', name: 'Proyecto Alpha', clientId: '', clientName: 'Cliente Beta', estado: 'Activo' }]}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'Cerrado' } });

      const saveButton = screen.getByRole('button', { name: 'Guardar estado' });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });
      const form = onFormSubmit.mock.calls[0][0] as ActiveForm;
      const data = onFormSubmit.mock.calls[0][1] as Record<string, any>;
      expect(form.mode).toBe('edit');
      expect(form.type).toBe('project');
      expect(data.estado).toBe('Cerrado');
    });
  });

  describe('R15 — Dashboard project click and empty cell click integration', () => {
    it('3.3 click en nombre de proyecto llama onProjectClick con el nombre correcto', () => {
      const budgets = [
        makeBudget({ projectName: 'Proyecto Alpha', mesPresupuestado: 'Julio', montoPresupuestado: 500000 }),
      ];
      const onProjectClick = vi.fn();
      const onCellClick = vi.fn();
      const { container } = render(
        <Dashboard onCellClick={onCellClick} onProjectClick={onProjectClick} budgets={budgets} ejecuciones={[]} />,
      );

      // El nombre del proyecto está en el DOM — buscamos el span clickeable
      const projectSpan = screen.getByText('Proyecto Alpha');
      fireEvent.click(projectSpan);

      expect(onProjectClick).toHaveBeenCalledTimes(1);
      expect(onProjectClick).toHaveBeenCalledWith('proj-1', 'Proyecto Alpha');
      // onCellClick NO debe llamarse
      expect(onCellClick).not.toHaveBeenCalled();
    });

    it('3.4 click en celda vacía llama onEmptyCellClick con proyecto, mes y tipo', () => {
      // Un proyecto con presupuesto en otro mes, dejando vacío Julio
      const budgets = [
        makeBudget({ projectName: 'Proyecto Alpha', mesPresupuestado: 'Agosto', montoPresupuestado: 500000 }),
      ];
      const onEmptyCellClick = vi.fn();
      const onCellClick = vi.fn();
      const { container } = render(
        <Dashboard onCellClick={onCellClick} onEmptyCellClick={onEmptyCellClick} budgets={budgets} ejecuciones={[]} />,
      );

      // Click en la primera celda vacía del primer tbody (primera matriz, ingreso)
      // La primer celda del mes visible (Enero) está vacía — usamos getAllByText('-')[0] dentro del tbody
      const firstTbody = container.querySelector('tbody')!;
      const emptyCells = within(firstTbody).getAllByText('-');
      // La primera celda vacía es Enero para Proyecto Alpha en modo Presupuestado
      fireEvent.click(emptyCells[0]);

      expect(onEmptyCellClick).toHaveBeenCalledTimes(1);
      expect(onEmptyCellClick).toHaveBeenCalledWith('proj-1', 'Proyecto Alpha', 'Enero', 'ingreso', 'Presupuestado');
      // onCellClick NO debe llamarse
      expect(onCellClick).not.toHaveBeenCalled();
    });

    it('3.6 celda con valor > 0 llama onCellClick (no onEmptyCellClick)', () => {
      const budgets = [
        makeBudget({ projectName: 'Proyecto Alpha', mesPresupuestado: 'Julio', montoPresupuestado: 500000 }),
      ];
      const onCellClick = vi.fn();
      const onEmptyCellClick = vi.fn();
      const { container } = render(
        <Dashboard onCellClick={onCellClick} onEmptyCellClick={onEmptyCellClick} budgets={budgets} ejecuciones={[]} />,
      );

      // Click en celda con valor > 0 — usamos getAllByText para obtener la celda del mes (no la del total)
      const firstTbody = container.querySelector('tbody')!;
      const allMatches = within(firstTbody).getAllByText(/500\.000/);
      // allMatches[0] es la celda del mes, allMatches[1] es el total del período
      fireEvent.click(allMatches[0]);

      expect(onCellClick).toHaveBeenCalledTimes(1);
      expect(onEmptyCellClick).not.toHaveBeenCalled();
      // Verificar que los datos son correctos
      const data = onCellClick.mock.calls[0][0] as SidepanelData;
      expect(data.title).toBe('Proyecto Alpha / Julio');
      expect(data.value).toBe(500000);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Detalle por Tercero — buildTerceroGroups
  // ═════════════════════════════════════════════════════════════════════════

  describe('buildTerceroGroups', () => {
    it('agrupa budgets y ejecuciones por proyecto y entidad, agrega totales', () => {
      const budgets = [
        makeBudget({ projectId: 'p1', projectName: 'Proyecto A', entityId: 'e1', entityName: 'Entidad Uno', entityType: 'client', montoPresupuestado: 1000000, tipo: 'ingreso' }),
        makeBudget({ projectId: 'p1', projectName: 'Proyecto A', entityId: 'e1', entityName: 'Entidad Uno', entityType: 'client', montoPresupuestado: 500000, tipo: 'ingreso' }),
        makeBudget({ projectId: 'p1', projectName: 'Proyecto A', entityId: 'e2', entityName: 'Entidad Dos', entityType: 'provider', montoPresupuestado: 300000, tipo: 'egreso' }),
      ];
      const ejecuciones = [
        makeEjecucion({ projectId: 'p1', projectName: 'Proyecto A', entityId: 'e1', entityName: 'Entidad Uno', entityType: 'client', montoEjecutado: 400000, tipo: 'ingreso' }),
        makeEjecucion({ projectId: 'p1', projectName: 'Proyecto A', entityId: 'e2', entityName: 'Entidad Dos', entityType: 'provider', montoEjecutado: 100000, tipo: 'egreso' }),
      ];

      const result = buildTerceroGroups(budgets, ejecuciones, 'Presupuestado');

      expect(result).toHaveLength(1); // 1 project
      const project = result[0];
      expect(project.projectId).toBe('p1');
      expect(project.projectName).toBe('Proyecto A');
      expect(project.groups).toHaveLength(2);

      // Entity Uno: 1.5M presupuestado, 400K ejecutado
      const group1 = project.groups.find(g => g.entityId === 'e1')!;
      expect(group1.entityName).toBe('Entidad Uno');
      expect(group1.entityType).toBe('client');
      expect(group1.totalPresupuestado).toBe(1500000);
      expect(group1.totalEjecutado).toBe(400000);
      expect(group1.diferencia).toBe(-1100000);
      expect(group1.budgets).toHaveLength(2);
      expect(group1.ejecuciones).toHaveLength(1);

      // Entity Dos: 300K presupuestado, 100K ejecutado
      const group2 = project.groups.find(g => g.entityId === 'e2')!;
      expect(group2.entityName).toBe('Entidad Dos');
      expect(group2.entityType).toBe('provider');
      expect(group2.totalPresupuestado).toBe(300000);
      expect(group2.totalEjecutado).toBe(100000);
      expect(group2.diferencia).toBe(-200000);

      // Project totals
      expect(project.totalPresupuestado).toBe(1800000);
      expect(project.totalEjecutado).toBe(500000);
      expect(project.diferencia).toBe(-1300000);
    });

    it('filtra grupos donde presupuestado y ejecutado son ambos 0', () => {
      const budgets = [
        makeBudget({ projectId: 'p1', projectName: 'Proyecto A', entityId: 'e1', entityName: 'Entidad Uno', entityType: 'client', montoPresupuestado: 100000, tipo: 'ingreso' }),
        makeBudget({ projectId: 'p1', projectName: 'Proyecto A', entityId: 'e2', entityName: 'Entidad Cero', entityType: 'provider', montoPresupuestado: 0, tipo: 'egreso' }),
      ];
      const ejecuciones = [
        makeEjecucion({ projectId: 'p1', projectName: 'Proyecto A', entityId: 'e1', entityName: 'Entidad Uno', entityType: 'client', montoEjecutado: 50000, tipo: 'ingreso' }),
      ];

      const result = buildTerceroGroups(budgets, ejecuciones, 'Presupuestado');

      expect(result).toHaveLength(1);
      expect(result[0].groups).toHaveLength(1); // e2 filtered out (all zeros)
      expect(result[0].groups[0].entityId).toBe('e1');
    });

    it('retorna array vacío cuando no hay datos', () => {
      const result = buildTerceroGroups([], [], 'Presupuestado');
      expect(result).toEqual([]);
    });

    it('agrupa multiples proyectos independientemente', () => {
      const budgets = [
        makeBudget({ projectId: 'p1', projectName: 'Proyecto A', entityId: 'e1', entityName: 'Entidad Uno', entityType: 'client', montoPresupuestado: 500000, tipo: 'ingreso' }),
        makeBudget({ projectId: 'p2', projectName: 'Proyecto B', entityId: 'e3', entityName: 'Entidad Tres', entityType: 'client', montoPresupuestado: 750000, tipo: 'ingreso' }),
      ];
      const ejecuciones: any[] = [];

      const result = buildTerceroGroups(budgets, ejecuciones, 'Presupuestado');

      expect(result).toHaveLength(2);
      expect(result[0].projectId).toBe('p1');
      expect(result[1].projectId).toBe('p2');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // TerceroGroupPanel — rendering and interaction
  // ═════════════════════════════════════════════════════════════════════════

  function makeDetalleTerceroRecord(overrides?: Partial<RecordDetail & { type: 'detalle-tercero' }>): RecordDetail {
    return {
      type: 'detalle-tercero',
      projects: [
        {
          projectId: 'p1',
          projectName: 'Proyecto Alpha',
          groups: [
            {
              entityId: 'e1',
              entityName: 'Entidad Uno',
              entityType: 'client',
              budgets: [makeBudget({ projectId: 'p1', projectName: 'Proyecto Alpha', entityId: 'e1', entityName: 'Entidad Uno', entityType: 'client', montoPresupuestado: 500000 })],
              ejecuciones: [makeEjecucion({ projectId: 'p1', projectName: 'Proyecto Alpha', entityId: 'e1', entityName: 'Entidad Uno', entityType: 'client', montoEjecutado: 200000 })],
              totalPresupuestado: 500000,
              totalEjecutado: 200000,
              diferencia: -300000,
            },
            {
              entityId: 'e2',
              entityName: 'Proveedor XYZ',
              entityType: 'provider',
              budgets: [makeBudget({ projectId: 'p1', projectName: 'Proyecto Alpha', entityId: 'e2', entityName: 'Proveedor XYZ', entityType: 'provider', montoPresupuestado: 300000 })],
              ejecuciones: [makeEjecucion({ projectId: 'p1', projectName: 'Proyecto Alpha', entityId: 'e2', entityName: 'Proveedor XYZ', entityType: 'provider', montoEjecutado: 100000 })],
              totalPresupuestado: 300000,
              totalEjecutado: 100000,
              diferencia: -200000,
            },
          ],
          totalPresupuestado: 800000,
          totalEjecutado: 300000,
          diferencia: -500000,
        },
        {
          projectId: 'p2',
          projectName: 'Proyecto Beta',
          groups: [
            {
              entityId: 'e3',
              entityName: 'Entidad Tres',
              entityType: 'client',
              budgets: [makeBudget({ projectId: 'p2', projectName: 'Proyecto Beta', entityId: 'e3', entityName: 'Entidad Tres', entityType: 'client', montoPresupuestado: 1000000 })],
              ejecuciones: [],
              totalPresupuestado: 1000000,
              totalEjecutado: 0,
              diferencia: -1000000,
            },
          ],
          totalPresupuestado: 1000000,
          totalEjecutado: 0,
          diferencia: -1000000,
        },
      ],
      totalPresupuestado: 1800000,
      totalEjecutado: 300000,
      diferencia: -1500000,
      ...overrides,
    };
  }

  describe('TerceroGroupPanel', () => {
    it('renderiza headers de proyecto con totales en COP y grupos de terceros anidados', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={makeDetalleTerceroRecord()}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      // Project headers should be visible
      expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
      expect(screen.getByText('Proyecto Beta')).toBeInTheDocument();

      // Tercero rows should be visible (all expanded by default)
      expect(screen.getByText('Entidad Uno')).toBeInTheDocument();
      expect(screen.getByText('Proveedor XYZ')).toBeInTheDocument();
      expect(screen.getByText('Entidad Tres')).toBeInTheDocument();

      // COP-formatted amounts should be visible
      expect(screen.getByText('$ 500.000', { exact: false })).toBeInTheDocument();
      expect(screen.getAllByText(/\$ 1\.000\.000/).length).toBeGreaterThanOrEqual(2);
    });

    it('collapse/expand toggle en project header oculta/muestra grupos', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={makeDetalleTerceroRecord()}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      // All terceros visible initially
      expect(screen.getByText('Entidad Uno')).toBeInTheDocument();

      // Click project header to collapse
      fireEvent.click(screen.getByText('Proyecto Alpha'));
      expect(screen.queryByText('Entidad Uno')).not.toBeInTheDocument();

      // Click again to expand
      fireEvent.click(screen.getByText('Proyecto Alpha'));
      expect(screen.getByText('Entidad Uno')).toBeInTheDocument();
    });

    it('click en tercero row llama onCellClick con SidepanelData filtrado por proyecto+entidad', () => {
      const onCellClick = vi.fn();
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);

      render(
        <Sidepanel
          data={null}
          recordDetail={makeDetalleTerceroRecord()}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          onCellClick={onCellClick}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      // Click on "Proveedor XYZ" row
      fireEvent.click(screen.getByText('Proveedor XYZ'));

      expect(onCellClick).toHaveBeenCalledTimes(1);
      const data: SidepanelData = onCellClick.mock.calls[0][0];
      expect(data.title).toContain('Proveedor XYZ');
      expect(data.budgets).toHaveLength(1);
      expect(data.budgets[0].entityId).toBe('e2');
      expect(data.ejecuciones).toHaveLength(1);
      expect(data.ejecuciones[0].entityId).toBe('e2');
      expect(data.presupuestado).toBe(300000);
      expect(data.ejecutado).toBe(100000);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Comprobantes de Ejecución — Phase 3: UI + Display
  // ═════════════════════════════════════════════════════════════════════════

  describe('R16 — Comprobantes: upload form + display', () => {
    it('3.1a ADD ejecucion form muestra "Seleccionar archivos" y "Comprobantes" sección', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'ejecucion' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Seleccionar archivos')).toBeInTheDocument();
    });

    it('3.1b ADD form submit sin comprobantes no añade _pendingComprobantes al payload', async () => {
      const onFormSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'ejecucion' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText('Crear'));
      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });
      const data = onFormSubmit.mock.calls[0][1] as Record<string, any>;
      expect(data._pendingComprobantes).toBeUndefined();
    });

    it('3.4a EjecucionView muestra comprobantes y download link', () => {
      const comprobantes: Comprobante[] = [
        { id: 'c1', name: 'factura.pdf', url: 'https://example.com/factura.pdf', path: 'c1/ejecuciones/ej-1/factura.pdf', type: 'application/pdf', size: 204800, uploadedAt: '2026-07-01T00:00:00.000Z' },
        { id: 'c2', name: 'recibo.jpg', url: 'https://example.com/recibo.jpg', path: 'c1/ejecuciones/ej-1/recibo.jpg', type: 'image/jpeg', size: 102400, uploadedAt: '2026-07-02T00:00:00.000Z' },
      ];
      const ejecucion = makeEjecucion({ comprobantes });

      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'ejecucion', ejecucion }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('factura.pdf')).toBeInTheDocument();
      expect(screen.getByText('recibo.jpg')).toBeInTheDocument();
      expect(screen.getByText(/Comprobantes \(2\)/)).toBeInTheDocument();

      // Download links should exist
      const links = screen.getAllByRole('link');
      const pdfLink = links.find(l => l.getAttribute('href') === 'https://example.com/factura.pdf');
      expect(pdfLink).toBeTruthy();
    });

    it('3.4b EjecucionView sin comprobantes no muestra sección', () => {
      const ejecucion = makeEjecucion({ comprobantes: [] });
      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'ejecucion', ejecucion }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.queryByText(/Comprobantes/)).not.toBeInTheDocument();
    });

    it('3.4c click ejecucion row calls onNavigate with view detail', () => {
      const onNavigate = vi.fn();
      const ejecucion = makeEjecucion({ id: 'ej-1', descripcion: 'Pago Test' });
      const budget = makeBudget({ id: 'b1' });

      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'budget', budget, ejecuciones: [ejecucion] }}
          activeForm={null}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={onNavigate}
        />,
      );

      fireEvent.click(screen.getByText(/Pago Test/));

      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'view',
          detail: expect.objectContaining({ type: 'ejecucion' }),
        }),
      );
    });

    it('3.5 EDIT ejecucion form muestra comprobantes existentes en el formulario', () => {
      const comprobantes: Comprobante[] = [
        { id: 'c1', name: 'existente.pdf', url: 'https://example.com/existente.pdf', path: 'c1/ejecuciones/ej-1/existente.pdf', type: 'application/pdf', size: 204800, uploadedAt: '2026-07-01T00:00:00.000Z' },
      ];
      const ejecucion = makeEjecucion({ comprobantes });

      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'edit', type: 'ejecucion', record: ejecucion }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      // Should show the form with the existing comprobante listed
      expect(screen.getByText('existente.pdf')).toBeInTheDocument();
      // Download link should be present
      const links = screen.getAllByRole('link');
      const link = links.find(l => l.getAttribute('href') === 'https://example.com/existente.pdf');
      expect(link).toBeTruthy();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Matriz — filas expandibles de terceros
  // ═════════════════════════════════════════════════════════════════════════

  describe('Matriz expandible por tercero', () => {
    const budgets = [
      makeBudget({ id: 'b1', projectName: 'Proyecto A', entityName: 'Entity Uno', entityId: 'e1', entityType: 'client', montoPresupuestado: 500000, mesPresupuestado: 'Enero', fechaPresupuestado: '2026-01' }),
      makeBudget({ id: 'b2', projectName: 'Proyecto A', entityName: 'Entity Uno', entityId: 'e1', entityType: 'client', montoPresupuestado: 300000, mesPresupuestado: 'Febrero', fechaPresupuestado: '2026-02' }),
      makeBudget({ id: 'b3', projectName: 'Proyecto A', entityName: 'Entity Dos', entityId: 'e2', entityType: 'provider', montoPresupuestado: 200000, mesPresupuestado: 'Enero', fechaPresupuestado: '2026-01' }),
    ];

    it('muestra proyecto con chevron expandible y al click muestra terceros', () => {
      render(
        <Dashboard onCellClick={vi.fn()} budgets={budgets} ejecuciones={[]} />,
      );

      // Find the "Proyecto A" cell, then find the expand button in its row
      const proyectoCell = screen.getByText('Proyecto A').closest('td');
      expect(proyectoCell).toBeTruthy();
      if (!proyectoCell) return;

      // Click first row's first button (the chevron)
      const row = proyectoCell.closest('tr');
      expect(row).toBeTruthy();
      if (!row) return;
      const expandBtn = row.querySelector('button');
      expect(expandBtn).toBeTruthy();
      if (!expandBtn) return;
      fireEvent.click(expandBtn);

      // After expand, tercero rows should appear
      expect(screen.getByText('Entity Uno')).toBeInTheDocument();
      expect(screen.getByText('Entity Dos')).toBeInTheDocument();
      // Entity type badges (C = client, P = provider) — use getAllByText since "C" appears in Cancelado badge too
      expect(screen.getAllByText('C').length).toBeGreaterThanOrEqual(1);
    });

    it('click en tercero cell abre DataPanel con datos filtrados', () => {
      const onCellClick = vi.fn();

      render(
        <Dashboard onCellClick={onCellClick} budgets={budgets} ejecuciones={[]} />,
      );

      // Expand
      const row = screen.getByText('Proyecto A').closest('tr');
      if (row) {
        const expandBtn = row.querySelector('button');
        if (expandBtn) fireEvent.click(expandBtn);
      }

      // Click on Entity Uno Enero cell
      const cell = screen.getAllByText(/\$/).find(el => {
        const tr = el.closest('tr');
        return tr?.textContent?.includes('Entity Uno');
      });
      expect(cell).toBeTruthy();
      if (!cell) return;
      fireEvent.click(cell);

      expect(onCellClick).toHaveBeenCalledTimes(1);
      const calledData = onCellClick.mock.calls[0][0];
      expect(calledData.budgets).toHaveLength(1);
      expect(calledData.budgets[0].entityId).toBe('e1');
      expect(calledData.subtitle).toContain('Entity Uno');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // PanelHeader — back button (← Volver)
  // ═════════════════════════════════════════════════════════════════════════

  describe('PanelHeader — back button', () => {
    it('no muestra botón back cuando canGoBack=false y X cierra', () => {
      const onClose = vi.fn();
      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'budget', budget: makeBudget(), ejecuciones: [makeEjecucion()] }}
          activeForm={null}
          companyId="c1"
          onClose={onClose}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={false}
          onBack={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByText('Presupuesto')).toBeInTheDocument();

      // PanelHeader has border-b — navigate up from h3 to find it
      const headerDiv = screen.getByText('Presupuesto').closest('[class*="border-b"]')!;
      const buttons = headerDiv.querySelectorAll('button');
      expect(buttons.length).toBe(1);

      fireEvent.click(buttons[0]);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('muestra ← Volver cuando canGoBack=true, llama onBack y X sigue funcionando', () => {
      const onBack = vi.fn();
      const onClose = vi.fn();
      render(
        <Sidepanel
          data={null}
          recordDetail={{ type: 'budget', budget: makeBudget(), ejecuciones: [makeEjecucion()] }}
          activeForm={null}
          companyId="c1"
          onClose={onClose}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
          canGoBack={true}
          onBack={onBack}
          onNavigate={vi.fn()}
        />,
      );

      const headerDiv = screen.getByText('Presupuesto').closest('[class*="border-b"]')!;
      const buttons = headerDiv.querySelectorAll('button');
      expect(buttons.length).toBe(2);

      fireEvent.click(buttons[0]);
      expect(onBack).toHaveBeenCalledTimes(1);

      fireEvent.click(buttons[1]);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
