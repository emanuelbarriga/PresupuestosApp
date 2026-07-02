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
  updateEjecucion: vi.fn().mockResolvedValue(undefined),
  addEjecucion: vi.fn().mockResolvedValue('new-id'),
  addClient: vi.fn().mockResolvedValue('new-id'),
  addProject: vi.fn().mockResolvedValue('new-id'),
}));

// ─── Imports (resolved after mocks) ─────────────────────────────────────────

import { Sidepanel } from '@/components/Sidepanel';
import { Dashboard } from '@/components/Dashboard';
import type {
  Budget,
  Ejecucion,
  Project,
  Client,
  ActiveForm,
  FormType,
  Month,
  SidepanelData,
} from '@/lib/types';

// ─── Factory helpers ─────────────────────────────────────────────────────────

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    descripcion: 'Presupuesto Test',
    proyectoAsignado: 'Proyecto Alpha',
    clienteOProveedor: 'Cliente Beta',
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
    proyectoAsignado: 'Proyecto Alpha',
    clienteOProveedor: 'Cliente Beta',
    tipo: 'ingreso',
    montoEjecutado: 250000,
    fechaEjecutado: '2026-07-15',
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
  const parent = label.closest('div')!;
  const input = parent.querySelector('input');
  if (!input) throw new Error(`No input found for label "${labelText}"`);
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

  describe('R12 — Dashboard data construction', () => {
    it('handleCellClick construye SidepanelData con title y budgets correctos', () => {
      const budgets = [
        makeBudget({
          id: 'b1',
          proyectoAsignado: 'Proyecto X',
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
          proyectoAsignado: 'Proyecto X',
          tipo: 'ingreso',
          montoEjecutado: 50000,
          fechaEjecutado: '2026-07-15',
        }),
      ];
      const budgets = [
        makeBudget({
          id: 'b1',
          proyectoAsignado: 'Proyecto X',
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

  describe('R5 — SimpleForm fields per form type', () => {
    it('type=project muestra campos name y clientName', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'project' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
        />,
      );

      expect(screen.getByText('Nombre')).toBeInTheDocument();
      expect(screen.getByText('Cliente')).toBeInTheDocument();
    });

    it('type=client muestra solo campo name', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'client' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
        />,
      );

      expect(screen.getByText('Nombre')).toBeInTheDocument();
      // Cliente label should NOT appear for client type
      expect(screen.queryByText('Cliente')).not.toBeInTheDocument();
    });

    it('type=provider muestra solo campo name', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'provider' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
        />,
      );

      expect(screen.getByText('Nombre')).toBeInTheDocument();
      expect(screen.queryByText('Cliente')).not.toBeInTheDocument();
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
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
        />,
      );

      // Emit projects so SearchableSelect has options
      await emitProjects([
        makeProject({ id: 'p1', name: 'Proyecto Alpha' }),
        makeProject({ id: 'p2', name: 'Proyecto Beta' }),
        makeProject({ id: 'p3', name: 'Proyecto Gamma' }),
      ]);

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
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
        />,
      );

      await emitProjects([
        makeProject({ id: 'p1', name: 'Proyecto Alpha' }),
        makeProject({ id: 'p2', name: 'Proyecto Beta' }),
        makeProject({ id: 'p3', name: 'Proyecto Gamma' }),
      ]);

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
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'budget' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={onFormSubmit}
        />,
      );

      await emitProjects([
        makeProject({ id: 'p1', name: 'Proyecto Alpha' }),
        makeProject({ id: 'p2', name: 'Proyecto Beta' }),
      ]);

      const projectInput = getInputByLabel('Proyecto');
      fireEvent.focus(projectInput);

      // Click on 'Proyecto Beta'
      fireEvent.click(screen.getByText('Proyecto Beta'));

      // Dropdown should be closed — options no longer visible
      expect(screen.queryByText('Proyecto Alpha')).not.toBeInTheDocument();
      expect(screen.queryByText('Proyecto Beta')).not.toBeInTheDocument();

      // Verify via submit that proyectoAsignado was set
      fireEvent.click(screen.getByText('Crear'));
      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });
      const data = onFormSubmit.mock.calls[0][1] as Record<string, any>;
      expect(data.proyectoAsignado).toBe('Proyecto Beta');
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
        />,
      );

      expect(screen.getByText('Nuevo Ejecución')).toBeInTheDocument();
      expect(screen.getByText('Monto Ejecutado')).toBeInTheDocument();
      expect(screen.getByText('Fecha de ejecución')).toBeInTheDocument();
      expect(screen.getByText('Vincular presupuesto (opcional)')).toBeInTheDocument();
      expect(screen.getByText('Crear')).toBeInTheDocument();
    });

    it('type=project muestra SimpleForm con nombre y cliente', () => {
      render(
        <Sidepanel
          data={null}
          recordDetail={null}
          activeForm={{ mode: 'add', type: 'project' }}
          companyId="c1"
          onClose={vi.fn()}
          onFormSubmit={vi.fn().mockResolvedValue(undefined)}
        />,
      );

      expect(screen.getByText('Nuevo Proyecto')).toBeInTheDocument();
      expect(screen.getByText('Nombre')).toBeInTheDocument();
      expect(screen.getByText('Cliente')).toBeInTheDocument();
    });
  });

  describe('R7 — BudgetView with linked ejecuciones + inline add', () => {
    it('muestra campos del budget y ejecuciones vinculadas', () => {
      const budget = makeBudget({
        descripcion: 'Anticipo Obra',
        proyectoAsignado: 'Edificio A',
        clienteOProveedor: 'Constructora X',
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
        />,
      );

      expect(screen.getByText('Sin ejecuciones')).toBeInTheDocument();
    });
  });

  describe('R8 — EjecucionView with budget linking', () => {
    it('muestra campos de la ejecucion y "Sin presupuesto vinculado"', () => {
      const ejecucion = makeEjecucion({
        descripcion: 'Pago proveedor',
        proyectoAsignado: 'Obra A',
        clienteOProveedor: 'Proveedor X',
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
        />,
      );

      // Emit budgets AFTER render so the subscription callback is captured
      await emitBudgets([makeBudget({ id: 'b1', descripcion: 'Anticipo Obra' })]);

      expect(screen.getByText('Anticipo Obra')).toBeInTheDocument();
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
        />,
      );

      expect(screen.getByText('Anticipo A')).toBeInTheDocument();
      expect(screen.getByText('Anticipo B')).toBeInTheDocument();
      expect(screen.getByText('Pago A')).toBeInTheDocument();
      expect(screen.getByText('$ 300.000', { exact: false })).toBeInTheDocument();
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
        />,
      );

      expect(screen.getByText('Proyecto X / Julio')).toBeInTheDocument();
    });
  });
});
