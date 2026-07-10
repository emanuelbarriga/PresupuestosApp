import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { CuentaEntity } from './CuentaEntity';

// ─── Mock components ────────────────────────────────────────────────────────

vi.mock('@/lib/firestore', () => ({}));

vi.mock('@/components/shared/PanelHeader', () => ({
  PanelHeader: ({ title }: { title: string }) => <div data-testid="panel-header">{title}</div>,
}));

vi.mock('@/components/shared/DF', () => ({
  DF: ({ label, v }: { label: string; v: string }) => <div data-testid={`df-${label}`}>{label}: {v}</div>,
}));

vi.mock('@/components/forms/FormInput', () => ({
  FormInput: ({ label, value, onChange, type }: any) => (
    <div data-testid={`form-input-${label}`}>
      <input type={type || 'text'} value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} />
    </div>
  ),
}));

vi.mock('@/components/forms/FormSelect', () => ({
  FormSelect: ({ label, value, onChange, options }: any) => (
    <div data-testid={`form-select-${label}`}>
      <select value={value} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}>
        <option value="">Seleccionar...</option>
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  ),
}));

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockCuenta = {
  id: 'c1',
  nombre: 'Cuenta Corriente',
  banco: 'Bancolombia',
  tipo: 'Corriente' as const,
  numero: '123-456-789',
  moneda: 'COP',
  saldoInicial: 5000000,
  saldoActual: 7500000,
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function renderEntity(props: Partial<Parameters<typeof CuentaEntity>[0]> = {}) {
  return render(
    <CuentaEntity
      mode="view"
      companyId="c1"
      record={mockCuenta}
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

describe('CuentaEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('view mode (NEW)', () => {
    it('renderiza el PanelHeader con título Cuenta Bancaria', () => {
      renderEntity();
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Cuenta Bancaria');
    });

    it('renderiza DF fields de la cuenta bancaria', () => {
      renderEntity();
      expect(screen.getByTestId('df-Nombre')).toHaveTextContent('Cuenta Corriente');
      expect(screen.getByTestId('df-Banco')).toHaveTextContent('Bancolombia');
      expect(screen.getByTestId('df-Número')).toHaveTextContent('123-456-789');
      expect(screen.getByTestId('df-Moneda')).toHaveTextContent('COP');
    });

    it('renderiza el badge de tipo Corriente', () => {
      renderEntity();
      expect(screen.getByText('Corriente')).toBeInTheDocument();
    });

    it('renderiza saldos formateados', () => {
      renderEntity();
      expect(screen.getByTestId('df-Saldo inicial')).toHaveTextContent(/\$ 5\.000\.000/);
      expect(screen.getByTestId('df-Saldo actual')).toHaveTextContent(/\$ 7\.500\.000/);
    });

    it('renderiza botón Editar', () => {
      renderEntity();
      expect(screen.getByText('Editar')).toBeInTheDocument();
    });
  });

  describe('create mode', () => {
    it('renderiza PanelHeader con título Nueva Cuenta', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Nueva Cuenta');
    });

    it('renderiza FormInput para Nombre y Banco', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('form-input-Nombre')).toBeInTheDocument();
      expect(screen.getByTestId('form-input-Banco')).toBeInTheDocument();
    });

    it('renderiza FormSelect para Tipo, Moneda', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('form-select-Tipo')).toBeInTheDocument();
      expect(screen.getByTestId('form-select-Moneda')).toBeInTheDocument();
    });

    it('renderiza FormInput para Saldo inicial', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('form-input-Saldo inicial')).toBeInTheDocument();
    });

    it('renderiza botón "Crear" en create mode', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByText('Crear')).toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('renderiza PanelHeader con título Editar Cuenta', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Editar Cuenta');
    });

    it('renderiza el form con datos pre-cargados', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.getByTestId('form-input-Nombre')).toBeInTheDocument();
    });

    it('renderiza botón "Guardar cambios" en edit mode', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.getByText('Guardar cambios')).toBeInTheDocument();
    });
  });
});
