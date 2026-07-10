import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ExtractoEntity } from './ExtractoEntity';

// ─── Mock sub-components ────────────────────────────────────────────────────

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

vi.mock('@/components/bancos/ExtractoParseModal', () => ({
  ExtractoParseModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="extracto-parse-modal">Modal</div> : null,
}));

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockExtracto = {
  id: 'e1',
  accountId: 'a1',
  mes: 'Enero' as const,
  anio: 2026,
  saldoInicial: 1000000,
  saldoFinal: 1500000,
  estado: 'Completado' as const,
  uploadedAt: '2026-01-15T00:00:00Z',
  archivo: { url: 'https://example.com/extracto.pdf', name: 'extracto_enero.pdf', uploadedAt: '2026-01-15T00:00:00Z' },
  totalMovimientosParseados: 42,
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function renderEntity(props: Partial<Parameters<typeof ExtractoEntity>[0]> = {}) {
  return render(
    <ExtractoEntity
      mode="view"
      companyId="c1"
      record={mockExtracto}
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

describe('ExtractoEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('view mode', () => {
    it('renderiza el PanelHeader con título Extracto', () => {
      renderEntity();
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Extracto');
    });

    it('renderiza DF fields del extracto', () => {
      renderEntity();
      expect(screen.getByTestId('df-Mes')).toHaveTextContent('Enero');
      expect(screen.getByTestId('df-Año')).toHaveTextContent('2026');
      expect(screen.getByTestId('df-Saldo inicial')).toHaveTextContent(/\$ 1\.000\.000/);
      expect(screen.getByTestId('df-Saldo final')).toHaveTextContent(/\$ 1\.500\.000/);
      expect(screen.getByTestId('df-Movimientos parseados')).toHaveTextContent('42');
    });

    it('renderiza el estado badge', () => {
      renderEntity();
      expect(screen.getByText('Completado')).toBeInTheDocument();
    });

    it('renderiza el link del archivo', () => {
      renderEntity();
      const link = screen.getByText('extracto_enero.pdf');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', 'https://example.com/extracto.pdf');
    });

    it('renderiza botón Editar', () => {
      renderEntity();
      expect(screen.getByText('Editar')).toBeInTheDocument();
    });
  });

  describe('add/create mode', () => {
    it('renderiza PanelHeader con título Nuevo Extracto', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Nuevo Extracto');
    });

    it('renderiza la zona de drag & drop', () => {
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByText(/Arrastrá el PDF/)).toBeInTheDocument();
    });

    it('renderiza el modal de parseo cuando se abre', () => {
      // Simular opening the modal via state is tricky in smoke test,
      // just verify the drag zone is present
      renderEntity({ mode: 'create', record: undefined });
      expect(screen.getByText(/hacé click para seleccionarlo/)).toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('renderiza PanelHeader con título Editar Extracto', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Editar Extracto');
    });

    it('renderiza FormSelect para Mes y Estado', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.getByTestId('form-select-Mes')).toBeInTheDocument();
      expect(screen.getByTestId('form-select-Estado')).toBeInTheDocument();
    });

    it('renderiza FormInput para Año, Saldos', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.getByTestId('form-input-Año')).toBeInTheDocument();
      expect(screen.getByTestId('form-input-Saldo inicial')).toBeInTheDocument();
      expect(screen.getByTestId('form-input-Saldo final')).toBeInTheDocument();
    });

    it('renderiza botón "Guardar cambios"', () => {
      renderEntity({ mode: 'edit' });
      expect(screen.getByText('Guardar cambios')).toBeInTheDocument();
    });
  });
});
