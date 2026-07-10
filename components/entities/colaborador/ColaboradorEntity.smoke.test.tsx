import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { EntityProps } from '@/lib/types';
import { ColaboradorEntity } from './ColaboradorEntity';

// ─── Mock contexts ──────────────────────────────────────────────────────────

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'u1', email: 'admin@test.com' },
  })),
}));

vi.mock('@/context/CompanyContext', () => ({
  useCompany: vi.fn(() => ({
    companies: [
      { id: 'c1', name: 'Constructora S.A.' },
      { id: 'c2', name: 'Inmobiliaria XYZ' },
    ],
    selectedCompany: { id: 'c1', name: 'Constructora S.A.' },
  })),
}));

// ─── Mock firestore ─────────────────────────────────────────────────────────

vi.mock('@/lib/firestore', () => ({
  blockMember: vi.fn().mockResolvedValue(undefined),
  updateMemberRole: vi.fn().mockResolvedValue(undefined),
  addMemberToCompany: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock components ────────────────────────────────────────────────────────

vi.mock('@/components/shared/PanelHeader', () => ({
  PanelHeader: ({ title }: { title: string }) => <div data-testid="panel-header">{title}</div>,
}));

vi.mock('@/components/shared/DF', () => ({
  DF: ({ label, v }: { label: string; v: string }) => <div data-testid={`df-${label.replace(/\s+/g, '-')}`}>{label}: {v}</div>,
}));

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockColaborador = {
  userId: 'u2',
  email: 'colaborador@test.com',
  memberships: [
    { companyId: 'c1', companyName: 'Constructora S.A.', role: 'colaborador', blocked: false },
    { companyId: 'c2', companyName: 'Inmobiliaria XYZ', role: 'admin', blocked: true },
  ],
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function baseProps(overrides: Partial<EntityProps> = {}): EntityProps {
  return {
    mode: 'view',
    companyId: 'c1',
    record: mockColaborador,
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onNavigate: vi.fn(),
    onClose: vi.fn(),
    onBack: vi.fn(),
    canGoBack: false,
    ...overrides,
  } as EntityProps;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ColaboradorEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('view mode (NEW)', () => {
    it('renderiza el PanelHeader con título Colaborador', () => {
      render(<ColaboradorEntity {...baseProps()} />);
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Colaborador');
    });

    it('renderiza el email del colaborador', () => {
      render(<ColaboradorEntity {...baseProps()} />);
      expect(screen.getByText('colaborador@test.com')).toBeInTheDocument();
    });

    it('renderiza la lista de membresías con nombre de empresa y rol', () => {
      render(<ColaboradorEntity {...baseProps()} />);
      expect(screen.getByText('Constructora S.A.')).toBeInTheDocument();
      expect(screen.getByText('Inmobiliaria XYZ')).toBeInTheDocument();
    });

    it('renderiza botón Editar', () => {
      render(<ColaboradorEntity {...baseProps()} />);
      expect(screen.getByText('Editar')).toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('renderiza PanelHeader con título Gestionar colaborador', () => {
      render(<ColaboradorEntity {...baseProps({ mode: 'edit' })} />);
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Gestionar colaborador');
    });

    it('muestra el email como readonly', () => {
      render(<ColaboradorEntity {...baseProps({ mode: 'edit' })} />);
      expect(screen.getByText('colaborador@test.com')).toBeInTheDocument();
    });

    it('renderiza toggles de membresía por empresa', () => {
      render(<ColaboradorEntity {...baseProps({ mode: 'edit' })} />);
      expect(screen.getByText('Constructora S.A.')).toBeInTheDocument();
      expect(screen.getByText('Inmobiliaria XYZ')).toBeInTheDocument();
    });

    it('renderiza botón Guardar cambios en edit mode', () => {
      render(<ColaboradorEntity {...baseProps({ mode: 'edit' })} />);
      expect(screen.getByText('Guardar cambios')).toBeInTheDocument();
    });
  });
});
