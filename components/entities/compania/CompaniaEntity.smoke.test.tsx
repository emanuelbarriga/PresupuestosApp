import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { EntityProps } from '@/lib/types';
import { CompaniaEntity } from './CompaniaEntity';

// ─── Mock contexts ──────────────────────────────────────────────────────────

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'u1', email: 'admin@test.com', getIdToken: vi.fn().mockResolvedValue('mock-token') },
  })),
}));

vi.mock('@/context/CompanyContext', () => ({
  useCompany: vi.fn(() => ({
    companies: [{ id: 'c1', name: 'Constructora S.A.' }],
    selectedCompany: { id: 'c1', name: 'Constructora S.A.' },
  })),
}));

// ─── Mock global fetch ──────────────────────────────────────────────────────

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ─── Mock components ────────────────────────────────────────────────────────

vi.mock('@/components/shared/PanelHeader', () => ({
  PanelHeader: ({ title }: { title: string }) => <div data-testid="panel-header">{title}</div>,
}));

vi.mock('@/components/shared/DF', () => ({
  DF: ({ label, v }: { label: string; v: string }) => <div data-testid={`df-${label.replace(/\s+/g, '-')}`}>{label}: {v}</div>,
}));

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockCompania = {
  id: 'c1',
  name: 'Constructora S.A.',
  createdAt: '2026-06-15T10:00:00Z',
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function baseProps(overrides: Partial<EntityProps> = {}): EntityProps {
  return {
    mode: 'view',
    companyId: 'c1',
    record: mockCompania,
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onNavigate: vi.fn(),
    onClose: vi.fn(),
    onBack: vi.fn(),
    canGoBack: false,
    ...overrides,
  } as EntityProps;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CompaniaEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('view mode (NEW)', () => {
    it('renderiza el PanelHeader con título Empresa', () => {
      render(<CompaniaEntity {...baseProps()} />);
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Empresa');
    });

    it('renderiza el nombre de la empresa', () => {
      render(<CompaniaEntity {...baseProps()} />);
      expect(screen.getByTestId('df-Nombre')).toHaveTextContent('Constructora S.A.');
    });

    it('renderiza la fecha de creación', () => {
      render(<CompaniaEntity {...baseProps()} />);
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });
  });

  describe('create mode', () => {
    it('renderiza PanelHeader con título Crear empresa', () => {
      render(<CompaniaEntity {...baseProps({ mode: 'create', record: undefined })} />);
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Crear empresa');
    });

    it('renderiza input de nombre de empresa', () => {
      render(<CompaniaEntity {...baseProps({ mode: 'create', record: undefined })} />);
      expect(screen.getByPlaceholderText('Ej: Constructora S.A.')).toBeInTheDocument();
    });

    it('renderiza la explicación del rol admin', () => {
      render(<CompaniaEntity {...baseProps({ mode: 'create', record: undefined })} />);
      expect(screen.getByText(/administrador/)).toBeInTheDocument();
    });

    it('renderiza botón Crear empresa en create mode', () => {
      render(<CompaniaEntity {...baseProps({ mode: 'create', record: undefined })} />);
      expect(screen.getByRole('button', { name: 'Crear empresa' })).toBeInTheDocument();
    });
  });
});
