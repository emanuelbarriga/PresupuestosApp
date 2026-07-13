import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { EntityProps } from '@/lib/types';
import { InvitacionEntity } from './InvitacionEntity';

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
  createInvitation: vi.fn().mockResolvedValue('new-inv-id'),
  updateInvitation: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock components ────────────────────────────────────────────────────────

vi.mock('@/components/shared/PanelHeader', () => ({
  PanelHeader: ({ title }: { title: string }) => <div data-testid="panel-header">{title}</div>,
}));

vi.mock('@/components/shared/DF', () => ({
  DF: ({ label, v }: { label: string; v: string }) => <div data-testid={`df-${label.replace(/\s+/g, '-')}`}>{label}: {v}</div>,
}));

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockInvitacion = {
  id: 'inv1',
  companyId: 'c1',
  companyName: 'Constructora S.A.',
  email: 'colaborador@test.com',
  role: 'colaborador' as const,
  status: 'pendiente' as const,
  invitedBy: 'u1',
  createdAt: '2026-07-01T12:00:00Z',
  expiresAt: '2026-07-08T12:00:00Z',
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function baseProps(overrides: Partial<EntityProps> = {}): EntityProps {
  return {
    mode: 'view',
    companyId: 'c1',
    record: mockInvitacion,
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onNavigate: vi.fn(),
    onClose: vi.fn(),
    onBack: vi.fn(),
    canGoBack: false,
    ...overrides,
  } as EntityProps;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('InvitacionEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('view mode (NEW)', () => {
    it('renderiza el PanelHeader con título Invitación', () => {
      render(<InvitacionEntity {...baseProps()} />);
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Invitación');
    });

    it('renderiza DF fields de la invitación', () => {
      render(<InvitacionEntity {...baseProps()} />);
      expect(screen.getByTestId('df-Empresa')).toHaveTextContent('Constructora S.A.');
      expect(screen.getByTestId('df-Email')).toHaveTextContent('colaborador@test.com');
    });

    it('renderiza el rol badge', () => {
      render(<InvitacionEntity {...baseProps()} />);
      expect(screen.getByText('Colaborador')).toBeInTheDocument();
    });

    it('renderiza el estado badge', () => {
      render(<InvitacionEntity {...baseProps()} />);
      expect(screen.getByText('pendiente')).toBeInTheDocument();
    });

    it('renderiza la fecha de expiración', () => {
      render(<InvitacionEntity {...baseProps()} />);
      expect(screen.getByText(/julio/)).toBeInTheDocument();
    });

    it('renderiza botón Editar', () => {
      render(<InvitacionEntity {...baseProps()} />);
      expect(screen.getByText('Editar')).toBeInTheDocument();
    });
  });

  describe('create mode', () => {
    it('renderiza PanelHeader con título Invitar colaborador', () => {
      render(<InvitacionEntity {...baseProps({ mode: 'create', record: undefined })} />);
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Invitar colaborador');
    });

    it('renderiza input de email', () => {
      render(<InvitacionEntity {...baseProps({ mode: 'create', record: undefined })} />);
      expect(screen.getByPlaceholderText('colaborador@ejemplo.com')).toBeInTheDocument();
    });

    it('renderiza toggle de expiración (1d/3d/1semana)', () => {
      render(<InvitacionEntity {...baseProps({ mode: 'create', record: undefined })} />);
      expect(screen.getByText('1 día')).toBeInTheDocument();
      expect(screen.getByText('3 días')).toBeInTheDocument();
      expect(screen.getByText('1 semana')).toBeInTheDocument();
    });

    it('renderiza botón Enviar invitación en create mode', () => {
      render(<InvitacionEntity {...baseProps({ mode: 'create', record: undefined })} />);
      expect(screen.getByText(/Enviar invitación/)).toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('renderiza PanelHeader con título Editar invitación', () => {
      render(<InvitacionEntity {...baseProps({ mode: 'edit' })} />);
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Editar invitación');
    });

    it('muestra el email como readonly (deshabilitado)', () => {
      render(<InvitacionEntity {...baseProps({ mode: 'edit' })} />);
      const emailInput = screen.getByDisplayValue('colaborador@test.com');
      expect(emailInput).toBeDisabled();
    });

    it('renderiza fecha de creación', () => {
      render(<InvitacionEntity {...baseProps({ mode: 'edit' })} />);
      // The created date should be displayed
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });

    it('renderiza botón Guardar cambios en edit mode', () => {
      render(<InvitacionEntity {...baseProps({ mode: 'edit' })} />);
      expect(screen.getByText('Guardar cambios')).toBeInTheDocument();
    });
  });
});
