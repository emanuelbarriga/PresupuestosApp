import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { EjecucionEntity } from './EjecucionEntity';

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
      stateProject: [],
      tipoProyectos: [],
      unidades: [],
      tipoComprobante: [],
    });
    return mockUnsub;
  }),
  subscribeBudgets: vi.fn((_companyId: string, onData: (data: any[]) => void) => {
    onData([]);
    return mockUnsub;
  }),
  subscribeCuentasBancarias: vi.fn((_companyId: string, onData: (data: any[]) => void) => {
    onData([]);
    return mockUnsub;
  }),
  removeBudgetLink: vi.fn().mockResolvedValue(undefined),
  updateEjecucion: vi.fn().mockResolvedValue(undefined),
  addClient: vi.fn().mockResolvedValue('new-client-id'),
  addProject: vi.fn().mockResolvedValue('new-project-id'),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'mock-doc-ref'),
  onSnapshot: vi.fn((_ref: any, onNext: any) => {
    onNext({ exists: () => true, data: () => ({ comprobantes: [] }) });
    return vi.fn();
  }),
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
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
    <div data-testid={`searchable-select-${label || 'empty'}`}>
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

vi.mock('@/components/upload/ComprobanteUploader', () => ({
  ComprobanteUploader: () => <div data-testid="comprobante-uploader">ComprobanteUploader</div>,
}));

vi.mock('@/components/upload/ComprobantesViewer', () => ({
  ComprobantesViewer: ({ comprobantes }: any) => (
    <div data-testid="comprobantes-viewer">{comprobantes.length} comprobantes</div>
  ),
}));

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockEjecucion = {
  id: 'ej1',
  descripcion: 'Pago honorarios',
  montoEjecutado: 250000,
  projectId: 'p1',
  projectName: 'Proyecto Test',
  entityId: 'e1',
  entityName: 'Cliente Uno',
  entityType: 'client' as const,
  tipo: 'egreso' as const,
  fechaEjecutado: '2026-06-15',
  cuentaId: '',
  cuentaName: '',
  comprobantes: [],
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function renderEntity(props: Partial<Parameters<typeof EjecucionEntity>[0]> = {}) {
  return render(
    <EjecucionEntity
      mode="view"
      companyId="c1"
      record={mockEjecucion}
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

describe('EjecucionEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('view mode', () => {
    it('renderiza el PanelHeader con título Ejecución', () => {
      renderEntity();
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Ejecución');
    });

    it('renderiza DF fields de la ejecución', () => {
      renderEntity();
      expect(screen.getByTestId('df-Descripción')).toHaveTextContent('Pago honorarios');
      expect(screen.getByTestId('df-Proyecto')).toHaveTextContent('Proyecto Test');
      expect(screen.getByTestId('df-Cliente/Proveedor')).toHaveTextContent('Cliente Uno');
      expect(screen.getByTestId('df-Tipo')).toHaveTextContent('egreso');
      expect(screen.getByTestId('df-Monto')).toHaveTextContent('$ 250.000');
      expect(screen.getByTestId('df-Fecha')).toHaveTextContent('2026-06-15');
      expect(screen.getByTestId('df-Cuenta bancaria')).toHaveTextContent('Sin cuenta bancaria');
    });

    it('muestra sección de presupuestos vinculados', () => {
      renderEntity();
      expect(screen.getByText('Presupuestos vinculados (0)')).toBeInTheDocument();
    });

    it('muestra "Sin presupuestos vinculados" cuando no hay links', () => {
      renderEntity();
      expect(screen.getByText('Sin presupuestos vinculados')).toBeInTheDocument();
    });
  });

  describe('create mode', () => {
    it('renderiza PanelHeader con título Nueva Ejecución', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Nueva Ejecución');
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

    it('renderiza ComprobanteUploader', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('comprobante-uploader')).toBeInTheDocument();
    });

    it('renderiza SearchableSelect para cuenta bancaria', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('searchable-select-Cuenta bancaria (opcional)')).toBeInTheDocument();
    });

    it('renderiza sección de recurrencia en create mode', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByText('Recurrente')).toBeInTheDocument();
    });

    it('renderiza botón "Crear" en create mode', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByText('Crear')).toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('renderiza PanelHeader con título Editar Ejecución', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Editar Ejecución');
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

  describe('subscription cleanup', () => {
    it('se suscribe a reference data al montar', async () => {
      const firestore = await import('@/lib/firestore');
      renderEntity();
      expect(firestore.subscribeProjects).toHaveBeenCalledWith('c1', expect.any(Function), expect.any(Function));
      expect(firestore.subscribeClients).toHaveBeenCalledWith(expect.any(Function));
      expect(firestore.subscribeProviders).toHaveBeenCalledWith(expect.any(Function));
      expect(firestore.subscribeCompanySettings).toHaveBeenCalledWith('c1', expect.any(Function));
      expect(firestore.subscribeBudgets).toHaveBeenCalledWith('c1', expect.any(Function));
      expect(firestore.subscribeCuentasBancarias).toHaveBeenCalledWith('c1', expect.any(Function));
    });
  });
});
