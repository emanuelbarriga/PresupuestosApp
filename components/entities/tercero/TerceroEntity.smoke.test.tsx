import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TerceroEntity } from './TerceroEntity';

// ─── Mock components ────────────────────────────────────────────────────────

const mockUnsub = vi.fn();

vi.mock('@/lib/firestore', () => ({
  // No firestore subscriptions needed for TerceroEntity
}));

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

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockTercero = {
  id: 't1',
  name: 'Juan Pérez',
  apodo: 'Juanpi',
  naturaleza: 'Persona Natural',
  documento: 'CC',
  numeroDocumento: '123456789',
  lugar: 'Bogotá',
  tipo: 'cliente' as const,
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function renderEntity(props: Partial<Parameters<typeof TerceroEntity>[0]> = {}) {
  return render(
    <TerceroEntity
      mode="view"
      companyId="c1"
      record={mockTercero}
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

describe('TerceroEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('view mode', () => {
    it('renderiza el PanelHeader con título Tercero', () => {
      renderEntity();
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Tercero');
    });

    it('renderiza DF fields del tercero', () => {
      renderEntity();
      expect(screen.getByTestId('df-Nombre')).toHaveTextContent('Juan Pérez');
      expect(screen.getByTestId('df-Apodo')).toHaveTextContent('Juanpi');
      expect(screen.getByTestId('df-Naturaleza')).toHaveTextContent('Persona Natural');
      expect(screen.getByTestId('df-Documento')).toHaveTextContent('CC 123456789');
      expect(screen.getByTestId('df-Lugar')).toHaveTextContent('Bogotá');
    });

    it('renderiza el badge de tipo Cliente', () => {
      renderEntity();
      expect(screen.getByText('Cliente')).toBeInTheDocument();
    });

    it('renderiza botón Editar', () => {
      renderEntity();
      expect(screen.getByText('Editar')).toBeInTheDocument();
    });
  });

  describe('create mode', () => {
    it('renderiza PanelHeader con título Nuevo Tercero', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Nuevo Tercero');
    });

    it('renderiza FormInput para Nombre', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('form-input-Nombre *')).toBeInTheDocument();
    });

    it('renderiza FormInput para Apodo', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('form-input-Apodo')).toBeInTheDocument();
    });

    it('renderiza selects de naturaleza y documento', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByText('Persona Natural')).toBeInTheDocument();
      expect(screen.getByText('Persona Jurídica')).toBeInTheDocument();
      expect(screen.getByText('CC')).toBeInTheDocument();
      expect(screen.getByText('NIT')).toBeInTheDocument();
    });

    it('renderiza botón "Crear" en create mode', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByText('Crear')).toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('renderiza PanelHeader con título Editar Tercero', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Editar Tercero');
    });

    it('renderiza el form con datos pre-cargados', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.getByTestId('form-input-Nombre *')).toBeInTheDocument();
    });

    it('renderiza botón "Guardar cambios" en edit mode', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.getByText('Guardar cambios')).toBeInTheDocument();
    });
  });
});
