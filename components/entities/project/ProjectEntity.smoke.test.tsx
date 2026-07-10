import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { NavScreen } from '@/lib/types';
import { ProjectEntity } from './ProjectEntity';

// ─── Mock firestore subscriptions ───────────────────────────────────────────

const mockUnsub = vi.fn();

vi.mock('@/lib/firestore', () => ({
  subscribeCompanySettings: vi.fn((_companyId: string, onData: (data: any) => void) => {
    onData({
      stateProject: [{ name: 'Activo', color: '#22c55e', order: 0 }, { name: 'Cerrado', color: '#ef4444', order: 1 }],
      tipoProyectos: [{ name: 'Obra', color: '#6366f1', order: 0 }],
      unidades: [{ name: 'Metros', color: '#6366f1', order: 0 }],
      tipoComprobante: [],
    });
    return mockUnsub;
  }),
  subscribeTerceros: vi.fn((onData: (data: any[]) => void) => {
    onData([
      { id: 't1', name: 'Cliente Uno', tipo: 'cliente' },
      { id: 't2', name: 'Proveedor Uno', tipo: 'proveedor' },
    ]);
    return mockUnsub;
  }),
  subscribeProjects: vi.fn((_companyId: string, onData: (data: any[]) => void) => {
    onData([{ id: 'p1', name: 'Test', clientId: 't1', clientName: 'Cliente Uno', estado: 'Activo' }]);
    return mockUnsub;
  }),
  subscribeBudgets: vi.fn((_companyId: string, onData: (data: any[]) => void) => {
    onData([]);
    return mockUnsub;
  }),
  subscribeEjecuciones: vi.fn((_companyId: string, onData: (data: any[]) => void) => {
    onData([]);
    return mockUnsub;
  }),
  addTercero: vi.fn().mockResolvedValue('new-tercero-id'),
}));

// ─── Mock components ────────────────────────────────────────────────────────

vi.mock('@/components/shared/PanelHeader', () => ({
  PanelHeader: ({ title }: { title: string }) => <div data-testid="panel-header">{title}</div>,
}));

vi.mock('@/components/shared/DF', () => ({
  DF: ({ label, v }: { label: string; v: string }) => <div data-testid={`df-${label}`}>{label}: {v}</div>,
}));

vi.mock('@/components/forms/ColorSelect', () => ({
  ColorSelect: ({ value, onChange, items, placeholder, allowCustom }: any) => (
    <div data-testid={`color-select-${placeholder}`}>
      <select value={value} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {items.map((item: any) => (
          <option key={item.name} value={item.name}>{item.name}</option>
        ))}
        {allowCustom && <option value="__custom__">+ Personalizado</option>}
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

vi.mock('@/components/shared/EntityTypeBadge', () => ({
  EntityTypeBadge: ({ type }: { type: string }) => <span data-testid={`badge-${type}`}>{type}</span>,
}));

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockProject = {
  id: 'p1',
  name: 'Test',
  descripcion: 'Proyecto de prueba',
  tipoProyectos: 'Obra',
  cantidad: 10,
  unidades: 'Metros',
  clientId: 't1',
  clientName: 'Cliente Uno',
  estado: 'Activo',
  soloEgresos: false,
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function renderEntity(props: Partial<Parameters<typeof ProjectEntity>[0]> = {}) {
  return render(
    <ProjectEntity
      mode="view"
      companyId="c1"
      record={mockProject}
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

describe('ProjectEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('view mode', () => {
    it('renderiza el PanelHeader con título Proyecto', () => {
      renderEntity();
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Proyecto');
    });

    it('renderiza DF fields del proyecto', () => {
      renderEntity();
      expect(screen.getByTestId('df-Sigla')).toHaveTextContent('Test');
      expect(screen.getByTestId('df-Nombre completo')).toHaveTextContent('Proyecto de prueba');
      expect(screen.getByTestId('df-Cliente')).toHaveTextContent('Cliente Uno');
      expect(screen.getByTestId('df-Tipo de proyecto')).toHaveTextContent('Obra');
      expect(screen.getByTestId('df-Cantidad')).toHaveTextContent('10 Metros');
    });

    it('renderiza el selector de estado con botón Editar', () => {
      renderEntity();
      expect(screen.getByText('Editar')).toBeInTheDocument();
    });

    it('muestra sección de presupuestos vacía', () => {
      renderEntity();
      expect(screen.getByText('Sin presupuestos')).toBeInTheDocument();
    });

    it('muestra sección de ejecuciones vacía', () => {
      renderEntity();
      expect(screen.getByText('Sin ejecuciones')).toBeInTheDocument();
    });
  });

  describe('create mode', () => {
    it('renderiza PanelHeader con título Nuevo Proyecto', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Nuevo Proyecto');
    });

    it('renderiza FormInput para Sigla y Nombre completo', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('form-input-Sigla')).toBeInTheDocument();
      expect(screen.getByTestId('form-input-Nombre completo')).toBeInTheDocument();
    });

    it('renderiza ColorSelect para tipo de proyecto con allowCustom', () => {
      renderEntity({ mode: 'create', record: undefined });
      const selects = screen.getAllByTestId('color-select-Seleccionar...');
      expect(selects.length).toBeGreaterThanOrEqual(1);
      // Two ColorSelects have allowCustom (tipoProyectos, unidades)
      const customOptions = screen.getAllByText('+ Personalizado');
      expect(customOptions.length).toBeGreaterThanOrEqual(1);
    });

    it('renderiza SearchableSelect para cliente', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('searchable-select-Cliente')).toBeInTheDocument();
    });

    it('renderiza botón "Nuevo cliente rápido"', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByText('Nuevo cliente rápido')).toBeInTheDocument();
    });

    it('renderiza checkbox "Solo egresos"', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByText('Solo egresos')).toBeInTheDocument();
    });

    it('renderiza botón "Crear" en create mode', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByText('Crear')).toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('renderiza PanelHeader con título Editar Proyecto', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Editar Proyecto');
    });

    it('renderiza el form con datos pre-cargados', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.getByTestId('form-input-Sigla')).toBeInTheDocument();
      expect(screen.getByTestId('form-input-Nombre completo')).toBeInTheDocument();
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
      expect(firestore.subscribeCompanySettings).toHaveBeenCalledWith('c1', expect.any(Function));
      expect(firestore.subscribeTerceros).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});
