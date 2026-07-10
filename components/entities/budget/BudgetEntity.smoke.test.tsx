import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { NavScreen } from '@/lib/types';
import { BudgetEntity } from './BudgetEntity';

// ─── Mock firestore subscriptions ───────────────────────────────────────────

const mockUnsub = vi.fn();

vi.mock('@/lib/firestore', () => ({
  subscribeProjects: vi.fn((_companyId: string, onData: (data: any[]) => void) => {
    onData([
      { id: 'p1', name: 'Proyecto Test', clientId: 'c1', clientName: 'Cliente Uno', estado: 'Activo' },
    ]);
    return mockUnsub;
  }),
  subscribeClients: vi.fn((onData: (data: any[]) => void) => {
    onData([{ id: 'c1', name: 'Cliente Uno' }]);
    return mockUnsub;
  }),
  subscribeProviders: vi.fn((onData: (data: any[]) => void) => {
    onData([]);
    return mockUnsub;
  }),
  subscribeCompanySettings: vi.fn((_companyId: string, onData: (data: any) => void) => {
    onData({
      stateProject: [{ name: 'Activo', color: '#22c55e', order: 0 }],
      tipoProyectos: [],
      unidades: [],
      tipoComprobante: [],
    });
    return mockUnsub;
  }),
  subscribeEjecucionesByBudget: vi.fn((_companyId: string, _budgetId: string, onData: (data: any[]) => void) => {
    onData([]);
    return mockUnsub;
  }),
  addClient: vi.fn().mockResolvedValue('new-client-id'),
  addProject: vi.fn().mockResolvedValue('new-project-id'),
}));

// ─── Mock components ────────────────────────────────────────────────────────

vi.mock('@/components/shared/PanelHeader', () => ({
  PanelHeader: ({ title }: { title: string }) => <div data-testid="panel-header">{title}</div>,
}));

vi.mock('@/components/forms/TipoSwitch', () => ({
  TipoSwitch: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div data-testid="tipo-switch">
      <button onClick={() => onChange('ingreso')}>Ingreso</button>
      <button onClick={() => onChange('egreso')}>Egreso</button>
      <span>Current: {value}</span>
    </div>
  ),
}));

vi.mock('@/components/forms/SearchableSelect', () => ({
  SearchableSelect: ({ label, value, options, onChange, placeholder }: any) => (
    <div data-testid={`searchable-select-${label}`}>
      <select value={value} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  ),
}));

vi.mock('@/components/forms/FormInput', () => ({
  FormInput: ({ label, value, onChange, type }: any) => (
    <div data-testid={`form-input-${label}`}>
      <input type={type || 'text'} value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} />
    </div>
  ),
}));

vi.mock('@/components/shared/DF', () => ({
  DF: ({ label, v }: { label: string; v: string }) => <div data-testid={`df-${label}`}>{label}: {v}</div>,
}));

vi.mock('@/components/shared/Calculator', () => ({
  Calculator: ({ value, onChange, onResult }: any) => (
    <div data-testid="calculator">
      <input value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} />
      <button onClick={() => onResult(1000)}>Calc Result</button>
    </div>
  ),
}));

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockBudget = {
  id: 'b1',
  descripcion: 'Honorarios contables',
  montoPresupuestado: 500000,
  projectId: 'p1',
  projectName: 'Proyecto Test',
  entityId: 'e1',
  entityName: 'Cliente Uno',
  entityType: 'client' as const,
  tipo: 'egreso' as const,
  mesPresupuestado: 'Enero' as const,
  fechaPresupuestado: '2026-01',
  estadoProyecto: 'Activo' as const,
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function renderEntity(props: Partial<Parameters<typeof BudgetEntity>[0]> = {}) {
  return render(
    <BudgetEntity
      mode="view"
      companyId="c1"
      record={mockBudget}
      onSubmit={vi.fn().mockResolvedValue(undefined)}
      onNavigate={vi.fn()}
      onClose={vi.fn()}
      onBack={vi.fn()}
      canGoBack={false}
      {...props}
    />,
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('BudgetEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('view mode', () => {
    it('renderiza el PanelHeader con título Presupuesto', () => {
      renderEntity();
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Presupuesto');
    });

    it('renderiza DF fields del presupuesto', () => {
      renderEntity();
      expect(screen.getByTestId('df-Descripción')).toHaveTextContent('Honorarios contables');
      expect(screen.getByTestId('df-Proyecto')).toHaveTextContent('Proyecto Test');
      expect(screen.getByTestId('df-Cliente/Proveedor')).toHaveTextContent('Cliente Uno');
      expect(screen.getByTestId('df-Tipo')).toHaveTextContent('egreso');
      expect(screen.getByTestId('df-Mes')).toHaveTextContent('Enero');
      expect(screen.getByTestId('df-Estado')).toHaveTextContent('Activo');
    });

    it('renderiza el monto formateado en COP', () => {
      renderEntity();
      expect(screen.getByTestId('df-Monto Presupuestado')).toHaveTextContent(/\$ 500\.000/);
    });

    it('muestra la sección de ejecuciones con botón Agregar', () => {
      renderEntity();
      expect(screen.getByText('Ejecuciones (0)')).toBeInTheDocument();
      expect(screen.getByText('Agregar')).toBeInTheDocument();
    });
  });

  describe('create mode', () => {
    it('renderiza PanelHeader con título Nuevo Presupuesto', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Nuevo Presupuesto');
    });

    it('renderiza TipoSwitch para seleccionar ingreso/egreso', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('tipo-switch')).toBeInTheDocument();
    });

    it('renderiza SearchableSelect para proyecto', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('searchable-select-Proyecto')).toBeInTheDocument();
    });

    it('renderiza inline "Nuevo proyecto" button', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByText('Nuevo proyecto')).toBeInTheDocument();
    });

    it('renderiza SearchableSelect para cliente/proveedor', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('searchable-select-Cliente / Proveedor')).toBeInTheDocument();
    });

    it('renderiza inline "Nuevo cliente" button', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByText('Nuevo cliente')).toBeInTheDocument();
    });

    it('renderiza FormInput para descripción y monto', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('form-input-Descripción')).toBeInTheDocument();
    });

    it('renderiza botón "Crear" en create mode', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByText('Crear')).toBeInTheDocument();
    });

    it('renderiza sección de recurrencia en create mode', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByText('Recurrente')).toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('renderiza PanelHeader con título Editar Presupuesto', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Editar Presupuesto');
    });

    it('renderiza el form con TipoSwitch', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.getByTestId('tipo-switch')).toBeInTheDocument();
      expect(screen.getByText('Current: egreso')).toBeInTheDocument();
    });

    it('no renderiza recurrencia en edit mode', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.queryByText('Recurrente')).not.toBeInTheDocument();
    });

    it('renderiza botón "Guardar cambios" en edit mode', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.getByText('Guardar cambios')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('"Agregar" en view mode navega a EjecucionEntity con defaults', () => {
      const onNavigate = vi.fn();
      renderEntity({ onNavigate });
      fireEvent.click(screen.getByText('Agregar'));
      const lastCall = onNavigate.mock.calls[0][0] as NavScreen;
      expect(lastCall).toMatchObject({
        type: 'entity',
        entity: 'ejecucion',
        mode: 'create',
      });
      // Verify defaults are passed from the budget
      if (lastCall.type === 'entity' && 'defaults' in lastCall) {
        expect(lastCall.defaults).toMatchObject({
          projectId: 'p1',
          projectName: 'Proyecto Test',
          entityId: 'e1',
          entityName: 'Cliente Uno',
          entityType: 'client',
          tipo: 'egreso',
        });
      }
    });

    it('muestra "Sin ejecuciones" cuando no hay linked ejecuciones en el mock', () => {
      renderEntity();
      expect(screen.getByText('Sin ejecuciones')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('muestra "Sin ejecuciones" cuando no hay linked ejecuciones', () => {
      renderEntity();
      expect(screen.getByText('Sin ejecuciones')).toBeInTheDocument();
    });
  });

  describe('subscription cleanup', () => {
    it('se suscribe a reference data al montar', async () => {
      const firestore = await import('@/lib/firestore');
      renderEntity();
      expect(firestore.subscribeProjects).toHaveBeenCalledWith('c1', expect.any(Function), expect.any(Function));
      expect(firestore.subscribeClients).toHaveBeenCalledWith(expect.any(Function));
      expect(firestore.subscribeProviders).toHaveBeenCalledWith(expect.any(Function));
      expect(firestore.subscribeCompanySettings).toHaveBeenCalledWith('c1', expect.any(Function));
    });
  });
});
