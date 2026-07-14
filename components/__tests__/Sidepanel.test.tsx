import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Mock infrastructure ────────────────────────────────────────────────────

const { mockUnsub, mockLinkDocToEntities } = vi.hoisted(() => ({
  mockUnsub: vi.fn(),
  mockLinkDocToEntities: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ type: 'collection' as const })),
  doc: vi.fn(() => ({ type: 'doc' as const })),
  addDoc: vi.fn().mockResolvedValue({ id: 'new-id' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  onSnapshot: vi.fn().mockReturnValue(mockUnsub),
  serverTimestamp: vi.fn().mockReturnValue({ toDate: () => new Date() }),
  getFirestore: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({ db: {}, storage: {} }));
vi.mock('@/lib/auth', () => ({ auth: {} }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/context/CompanyContext', () => ({ useCompany: () => ({ selectedCompany: null, companies: [] }) }));

vi.mock('@/lib/mediaLinking', () => ({
  linkDocumentoToEntities: mockLinkDocToEntities,
}));

vi.mock('@/lib/fileUpload', () => ({
  validateFile: vi.fn().mockReturnValue({ valid: true as const }),
  uploadFile: vi.fn().mockResolvedValue({ url: 'https://example.com/file.pdf', path: 'c1/eje-1/file.pdf' }),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  generateFilePath: vi.fn().mockReturnValue('c1/eje-1/file.pdf'),
}));

// Mock all firestore subscriptions used by entity components
vi.mock('@/lib/firestore', () => ({
  subscribeProjects: vi.fn(() => mockUnsub),
  subscribeClients: vi.fn(() => mockUnsub),
  subscribeProviders: vi.fn(() => mockUnsub),
  subscribeSettings: vi.fn(() => mockUnsub),
  subscribeCompanySettings: vi.fn(() => mockUnsub),
  subscribeBudgets: vi.fn(() => mockUnsub),
  subscribeEjecuciones: vi.fn(() => mockUnsub),
  subscribeCuentasBancarias: vi.fn(() => mockUnsub),
  subscribeTerceros: vi.fn(() => mockUnsub),
  subscribeEjecucionesByBudget: vi.fn(() => mockUnsub),
  subscribeBudgetLinks: vi.fn(() => mockUnsub),
  removeBudgetLink: vi.fn().mockResolvedValue(undefined),
  addBudgetLink: vi.fn().mockResolvedValue(undefined),
  updateSettings: vi.fn().mockResolvedValue(undefined),
  updateEjecucion: vi.fn().mockResolvedValue(undefined),
  addEjecucion: vi.fn().mockResolvedValue('new-id'),
  addClient: vi.fn().mockResolvedValue('new-id'),
  addTercero: vi.fn().mockResolvedValue('new-id'),
  addProject: vi.fn().mockResolvedValue('new-id'),
}));

// Mock the child entity components to simplify testing — we just need to verify routing
vi.mock('@/components/entities/EntityList', () => ({
  EntityList: vi.fn(({ title, mode, tipo, onClose, onBack, canGoBack, onSubmit, onNavigate }: any) => (
    <div data-testid="entity-list">
      <span data-testid="entity-list-title">{title}</span>
      <span data-testid="entity-list-mode">{mode}</span>
      <span data-testid="entity-list-tipo">{tipo}</span>
    </div>
  )),
}));

vi.mock('@/components/panels/CustomizePanel', () => ({
  CustomizePanel: vi.fn(({ onClose, onBack }: any) => (
    <div data-testid="customize-panel">
      <button data-testid="customize-close" onClick={onClose}>X</button>
      <button data-testid="customize-back" onClick={onBack}>Back</button>
    </div>
  )),
}));

vi.mock('@/components/panels/TerceroGroupPanel', () => ({
  TerceroGroupPanel: vi.fn(({ projects, onCellClick }: any) => (
    <div data-testid="tercero-panel">
      {projects.map((p: any) => <span key={p.projectId} data-testid="tercero-project">{p.projectName}</span>)}
    </div>
  )),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import { Sidepanel } from '@/components/Sidepanel';
import type { NavScreen, SidepanelData, EntityType, Budget, Ejecucion } from '@/lib/types';

// ─── Factory helpers ─────────────────────────────────────────────────────────

function makeScreen(overrides?: Partial<NavScreen>): NavScreen {
  return { type: 'entity', entity: 'budget', mode: 'view', record: { id: 'b1' }, ...overrides } as NavScreen;
}

function makeEntityScreen(entity: EntityType, mode: 'create' | 'edit' | 'view', overrides?: Partial<NavScreen>): NavScreen {
  return { type: 'entity', entity, mode, record: { id: `${entity}-1` }, ...overrides } as NavScreen;
}

function makeEntityListData(): SidepanelData {
  return {
    title: 'Proyecto X / Julio',
    subtitle: 'Presupuestado de ingresos',
    formula: 'Suma de transacciones',
    budgets: [
      { id: 'b1', descripcion: 'Anticipo A', projectId: 'p1', projectName: 'Proyecto X', entityId: 'e1', entityName: 'Entidad Uno', entityType: 'client', tipo: 'ingreso', montoPresupuestado: 100000, mesPresupuestado: 'Julio', fechaPresupuestado: '2026-07', estadoProyecto: 'Activo' },
    ],
    ejecuciones: [],
    value: 100000,
    presupuestado: 100000,
    ejecutado: 0,
    diferencia: -100000,
    mode: 'Presupuestado',
    tipo: 'ingreso',
  };
}

function makeDetalleTerceroScreen(): NavScreen {
  return {
    id: 'test-1',
    type: 'view',
    detail: {
      type: 'detalle-tercero',
      projects: [
        {
          projectId: 'p1',
          projectName: 'Proyecto Alpha',
          groups: [
            {
              entityId: 'e1',
              entityName: 'Entidad Uno',
              entityType: 'client',
              budgets: [],
              ejecuciones: [],
              totalPresupuestado: 500000,
              totalEjecutado: 200000,
              diferencia: -300000,
            },
          ],
          totalPresupuestado: 500000,
          totalEjecutado: 200000,
          diferencia: -300000,
        },
      ],
      totalPresupuestado: 500000,
      totalEjecutado: 200000,
      diferencia: -300000,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test Suites
// ═══════════════════════════════════════════════════════════════════════════════

describe('Sidepanel — new routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('R1 — Collapsed state', () => {
    it('muestra sidebar colapsado (w-16) cuando screen es undefined', () => {
      const { container } = render(
        <Sidepanel
          screen={undefined}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      const aside = container.querySelector('aside');
      expect(aside?.className).toContain('w-16');
      expect(screen.queryByTestId('entity-list')).not.toBeInTheDocument();
    });

    it('collapsed state muestra iconos de navegación', () => {
      render(
        <Sidepanel
          screen={undefined}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      // All 6 quick-create icons should be rendered (lucide icons render as SVG)
      const buttons = document.querySelectorAll('aside button');
      expect(buttons.length).toBe(6);
    });
  });

  describe('R2 — Entity+mode routing', () => {
    it('entity=budget mode=view no renderiza nada visible de panels', () => {
      render(
        <Sidepanel
          screen={makeEntityScreen('budget', 'view')}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      // Should show the PanelHeader from BudgetEntity
      expect(screen.getByText('Presupuesto')).toBeInTheDocument();
      // Should NOT show legacy panels
      expect(screen.queryByTestId('entity-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('customize-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tercero-panel')).not.toBeInTheDocument();
    });

    it('entity=budget mode=create muestra "Nuevo Presupuesto"', () => {
      render(
        <Sidepanel
          screen={makeEntityScreen('budget', 'create')}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      expect(screen.getByText('Nuevo Presupuesto')).toBeInTheDocument();
    });

    it('entity=ejecucion mode=view muestra "Ejecución"', () => {
      render(
        <Sidepanel
          screen={makeEntityScreen('ejecucion', 'view')}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      expect(screen.getByText('Ejecución')).toBeInTheDocument();
    });

    it('entity=project mode=view muestra "Proyecto"', () => {
      render(
        <Sidepanel
          screen={makeEntityScreen('project', 'view')}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      expect(screen.getByText('Proyecto')).toBeInTheDocument();
    });

    it('entity=project mode=create muestra "Nuevo Proyecto"', () => {
      render(
        <Sidepanel
          screen={makeEntityScreen('project', 'create')}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      expect(screen.getByText('Nuevo Proyecto')).toBeInTheDocument();
    });

    it('entity=tercero mode=view muestra "Tercero"', () => {
      render(
        <Sidepanel
          screen={makeEntityScreen('tercero', 'view')}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      expect(screen.getByText('Tercero')).toBeInTheDocument();
    });

    it('entity=cuenta mode=view muestra "Cuenta Bancaria"', () => {
      render(
        <Sidepanel
          screen={makeEntityScreen('cuenta', 'view')}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      expect(screen.getByText('Cuenta Bancaria')).toBeInTheDocument();
    });

    it('entity=extracto mode=view muestra "Extracto"', () => {
      render(
        <Sidepanel
          screen={makeEntityScreen('extracto', 'view')}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      expect(screen.getByText('Extracto')).toBeInTheDocument();
    });

    it('entity=documento mode=view muestra el panel con clasificación', () => {
      render(
        <Sidepanel
          screen={makeEntityScreen('documento', 'view', { record: { id: 'doc-1', fileName: 'factura.pdf', mimeType: 'application/pdf', status: 'por_clasificar', ejecucionIds: [], _source: 'inbox-upload', uploadedAt: '2026-07-14T00:00:00Z', createdBy: 'user-1' } })}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      // PanelHeader title
      expect(screen.getByText('Clasificar Documento')).toBeInTheDocument();
      // File name should be visible in preview section
      expect(screen.getByText('factura.pdf')).toBeInTheDocument();
      // Should show classification form with tipo chips
      expect(screen.getByText('Factura Venta')).toBeInTheDocument();
    });

    it('forwards onDocumentoUpdated to DocumentoEntity from Sidepanel prop', async () => {
      const onDocUpdated = vi.fn();

      render(
        <Sidepanel
          screen={makeEntityScreen('documento', 'view', { record: { id: 'doc-1', fileName: 'factura.pdf', mimeType: 'application/pdf', status: 'por_clasificar', ejecucionIds: [], _source: 'inbox-upload', uploadedAt: '2026-07-14T00:00:00Z', createdBy: 'user-1' } })}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
          onDocumentoUpdated={onDocUpdated}
        />,
      );

      // Select tipo
      fireEvent.click(screen.getByText('Contrato'));

      // Fill periodo
      const periodoInput = screen.getByPlaceholderText('YYYY-MM') as HTMLInputElement;
      fireEvent.change(periodoInput, { target: { value: '2026-07' } });

      // Click save
      fireEvent.click(screen.getByText('Guardar y Enlazar'));

      await waitFor(() => {
        expect(mockLinkDocToEntities).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(onDocUpdated).toHaveBeenCalledWith('doc-1', '2026-07', 'contrato');
      });
    });

    it('entity=settings mode=view renderiza SettingsEntity sin PanelHeader', () => {
      const settingsScreen: NavScreen = {
        type: 'entity',
        entity: 'settings',
        mode: 'view',
        record: { category: 'stateProject', title: 'Estados de proyecto', items: [] },
      };
      render(
        <Sidepanel
          screen={settingsScreen}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      // SettingsEntity renders SettingsEditor directly (no PanelHeader)
      expect(screen.getByText('Estados de proyecto')).toBeInTheDocument();
    });
  });

  describe('R3 — Entity-list routing', () => {
    it('type=entity-list renderiza EntityList con datos', () => {
      render(
        <Sidepanel
          screen={{ type: 'entity-list', data: makeEntityListData() }}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      expect(screen.getByTestId('entity-list')).toBeInTheDocument();
      expect(screen.getByText('Proyecto X / Julio')).toBeInTheDocument();
    });

    it('EntityList recibe mode y tipo correctos', () => {
      render(
        <Sidepanel
          screen={{ type: 'entity-list', data: makeEntityListData() }}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      expect(screen.getByTestId('entity-list-mode').textContent).toBe('Presupuestado');
      expect(screen.getByTestId('entity-list-tipo').textContent).toBe('ingreso');
    });
  });

  describe('R4 — Customize panel routing', () => {
    it('type=customize renderiza CustomizePanel', () => {
      render(
        <Sidepanel
          screen={{ type: 'customize' }}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
          projects={[]}
          selectedProjects={new Set()}
          projectSearch=""
          onProjectsChange={vi.fn()}
          onSearchChange={vi.fn()}
        />,
      );

      expect(screen.getByTestId('customize-panel')).toBeInTheDocument();
    });

    it('CustomizePanel close llama onClose', () => {
      const onClose = vi.fn();
      render(
        <Sidepanel
          screen={{ type: 'customize' }}
          companyId="c1"
          onClose={onClose}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
          projects={[]}
          selectedProjects={new Set()}
          projectSearch=""
          onProjectsChange={vi.fn()}
          onSearchChange={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTestId('customize-close'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('R5 — Detalle-tercero routing', () => {
    it('detail type=detalle-tercero renderiza TerceroGroupPanel', () => {
      render(
        <Sidepanel
          screen={makeDetalleTerceroScreen()}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      expect(screen.getByTestId('tercero-panel')).toBeInTheDocument();
      expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
    });
  });

  describe('R6 — Back button behavior', () => {
    it('PanelHeader en entity screen muestra back cuando canGoBack=true', () => {
      render(
        <Sidepanel
          screen={makeEntityScreen('budget', 'view')}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={true}
        />,
      );

      // PanelHeader with back button has 2 buttons: back arrow + X
      const headerDiv = screen.getByText('Presupuesto').closest('[class*="border-b"]')!;
      const buttons = headerDiv.querySelectorAll('button');
      expect(buttons.length).toBe(2);
    });

    it('PanelHeader sin back cuando canGoBack=false', () => {
      render(
        <Sidepanel
          screen={makeEntityScreen('budget', 'view')}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      const headerDiv = screen.getByText('Presupuesto').closest('[class*="border-b"]')!;
      const buttons = headerDiv.querySelectorAll('button');
      expect(buttons.length).toBe(1);
    });

    it('click back llama onBack, click X llama onClose', () => {
      const onBack = vi.fn();
      const onClose = vi.fn();
      render(
        <Sidepanel
          screen={makeEntityScreen('budget', 'view')}
          companyId="c1"
          onClose={onClose}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={onBack}
          canGoBack={true}
        />,
      );

      const headerDiv = screen.getByText('Presupuesto').closest('[class*="border-b"]')!;
      const buttons = headerDiv.querySelectorAll('button');
      // First button = back, second = close
      fireEvent.click(buttons[0]);
      expect(onBack).toHaveBeenCalledTimes(1);

      fireEvent.click(buttons[1]);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('R7 — Expanded state layout', () => {
    it('expanded sidebar tiene w-[360px]', () => {
      const { container } = render(
        <Sidepanel
          screen={makeEntityScreen('budget', 'view')}
          companyId="c1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
          canGoBack={false}
        />,
      );

      const aside = container.querySelector('aside');
      expect(aside?.className).toContain('w-[360px]');
    });
  });
});
