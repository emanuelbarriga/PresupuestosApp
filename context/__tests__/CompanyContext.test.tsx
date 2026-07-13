import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { act } from 'react';
import React from 'react';
import { CompanyProvider, useCompany } from '@/context/CompanyContext';
import { subscribeUserCompanies } from '@/lib/firestore';
import { useCompanyStore } from '@/stores/companyStore';

// ─── Mock variables (permite cambiar retorno por test) ──────────────────────

const mockUnsub = vi.fn();
let onDataCallback: ((data: any[]) => void) | undefined;

// Permite controlar dinámicamente el valor de usePathname, useAuth, getDoc, etc.
let mockPathname = '/empresa-a/dashboard';
let mockAuthUser: { uid: string } | null = { uid: 'test-uid' };
let mockAuthLoading = false;
let mockSnapshotData: any[] = [];
let mockMemberData: Record<string, any> | null = { role: 'admin' };
let mockGetUserCompaniesSnapshot: any;
let mockGetDoc: any;

// ─── Module mocks ──────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => mockPathname),
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockAuthUser, loading: mockAuthLoading })),
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(() => {
    if (mockGetDoc) return mockGetDoc();
    return Promise.resolve(mockMemberData
      ? { data: () => mockMemberData, exists: () => true }
      : { data: () => null, exists: () => false });
  }),
}));

vi.mock('@/lib/firestore', () => ({
  subscribeUserCompanies: vi.fn((_userId: string, onData: (data: any[]) => void) => {
    onDataCallback = onData;
    return mockUnsub;
  }),
  getUserCompaniesSnapshot: vi.fn(() => {
    if (mockGetUserCompaniesSnapshot) return mockGetUserCompaniesSnapshot();
    return Promise.resolve(mockSnapshotData);
  }),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

const MOCK_A = { id: 'empresa-a', name: 'Empresa A' };
const MOCK_B = { id: 'empresa-b', name: 'Empresa B' };
const ALL_MOCK = [MOCK_A, MOCK_B];

/** Dispara onData simulado envuelto en act() y espera a que React procese */
async function emitData(data: any[]) {
  await act(async () => {
    onDataCallback!(data);
  });
}

function TestConsumer() {
  const { selectedCompany, companies, setCompany } = useCompany();
  return (
    <div>
      <p data-testid="company-count">{companies.length}</p>
      <p data-testid="selected-name">{selectedCompany?.name ?? 'none'}</p>
      <button data-testid="set-company-a" onClick={() => setCompany('empresa-a')}>
        Set A
      </button>
      <button data-testid="set-company-b" onClick={() => setCompany('empresa-b')}>
        Set B
      </button>
      <button data-testid="set-company-x" onClick={() => setCompany('no-existe')}>
        Set X
      </button>
    </div>
  );
}

function TestHookOnly() {
  useCompany();
  return <div />;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('CompanyContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onDataCallback = undefined;

    // Default mocks for company-route tests
    mockPathname = '/empresa-a/dashboard';
    mockAuthUser = { uid: 'test-uid' };
    mockAuthLoading = false;
    mockSnapshotData = ALL_MOCK;
    mockMemberData = { role: 'admin' };
    mockGetUserCompaniesSnapshot = undefined;
    mockGetDoc = undefined;
  });

  afterEach(() => {
    cleanup();
  });

  // ── Test 1: Happy path ──────────────────────────────────────────────────

  it('selecciona la empresa exacta cuando companyId coincide', async () => {
    mockPathname = '/empresa-b/dashboard';
    mockSnapshotData = ALL_MOCK;

    render(
      <CompanyProvider userId="test-uid">
        <TestConsumer />
      </CompanyProvider>,
    );

    // Inicia en membership loading → no renderiza hijos
    expect(screen.queryByTestId('selected-name')).not.toBeInTheDocument();

    // Esperar a que membership guard resuelva + subscription se active
    // membership guard usa getUserCompaniesSnapshot y getDoc que están mockeados
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Simula la llegada de datos desde Firestore
    await emitData(ALL_MOCK);

    // Debe mostrar la empresa que coincide con companyId
    expect(await screen.findByTestId('selected-name')).toHaveTextContent('Empresa B');
  });

  // ── Test 2: Fallback ────────────────────────────────────────────────────

  it('selecciona la primera empresa cuando no hay coincidencia de companyId', async () => {
    // La URL es empresa-inexistente. El membership guard necesita que
    // getUserCompaniesSnapshot incluya esa empresa para pasar el check.
    mockPathname = '/empresa-inexistente/dashboard';
    mockSnapshotData = [
      { id: 'empresa-inexistente', name: 'Empresa Inexistente' },
      ...ALL_MOCK,
    ];

    render(
      <CompanyProvider userId="test-uid">
        <TestConsumer />
      </CompanyProvider>,
    );

    // Esperar membership guard
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await emitData(ALL_MOCK);

    // La empresa-inexistente no está en ALL_MOCK (solo A y B), así que
    // selecciona la primera: Empresa A
    expect(await screen.findByTestId('selected-name')).toHaveTextContent('Empresa A');
  });

  // ── Test 3: Base de datos vacía (caso crítico) ──────────────────────────

  it('muestra la pantalla de bienvenida cuando no hay empresas (evita el bloqueo)', async () => {
    mockPathname = '/empresa-cualquiera/dashboard';
    mockSnapshotData = [{ id: 'empresa-cualquiera', name: 'Cualquiera' }];

    render(
      <CompanyProvider userId="test-uid">
        <TestConsumer />
      </CompanyProvider>,
    );

    // Esperar membership guard
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Simula Firestore devolviendo array vacío
    await emitData([]);

    // No debe renderizar el TestConsumer, pero sí el fallback con "Sin acceso"
    expect(await screen.findByText('Sin acceso')).toBeInTheDocument();

    // El TestConsumer NO debe aparecer (porque no hay empresa seleccionada)
    expect(screen.queryByTestId('selected-name')).not.toBeInTheDocument();
  });

  // ── Test 4: setCompany ──────────────────────────────────────────────────

  it('setCompany cambia la empresa seleccionada y falla silenciosamente con IDs inválidos', async () => {
    mockPathname = '/empresa-a/dashboard';
    mockSnapshotData = ALL_MOCK;

    render(
      <CompanyProvider userId="test-uid">
        <TestConsumer />
      </CompanyProvider>,
    );

    // Esperar membership guard
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await emitData(ALL_MOCK);

    // Verifica estado inicial
    expect(await screen.findByTestId('selected-name')).toHaveTextContent('Empresa A');
    expect(screen.getByTestId('company-count')).toHaveTextContent('2');

    // Cambia a Empresa B
    await act(async () => {
      screen.getByTestId('set-company-b').click();
    });
    expect(screen.getByTestId('selected-name')).toHaveTextContent('Empresa B');

    // Cambia a Empresa A
    await act(async () => {
      screen.getByTestId('set-company-a').click();
    });
    expect(screen.getByTestId('selected-name')).toHaveTextContent('Empresa A');

    // ID inexistente no debe cambiar el estado
    await act(async () => {
      screen.getByTestId('set-company-x').click();
    });
    expect(screen.getByTestId('selected-name')).toHaveTextContent('Empresa A');
  });

  // ── Test 5: Dual-write to Zustand store ─────────────────────────────────

  it('sincroniza el estado con el store de Zustand después de emitir datos', async () => {
    mockPathname = '/empresa-a/dashboard';
    mockSnapshotData = ALL_MOCK;

    render(
      <CompanyProvider userId="test-uid">
        <TestConsumer />
      </CompanyProvider>,
    );

    // Esperar membership guard
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await emitData(ALL_MOCK);

    // Verificar que el store de Zustand tiene los mismos datos
    const storeState = useCompanyStore.getState();
    expect(storeState.companies).toEqual(ALL_MOCK);
    expect(storeState.selectedCompany).toEqual(MOCK_A);
    expect(storeState.mode).toBe('individual');
  });

  it('sincroniza el conjunto mode con el store de Zustand', async () => {
    mockPathname = '/all/conjunto';

    render(
      <CompanyProvider userId="test-uid">
        <TestConsumer />
      </CompanyProvider>,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await emitData(ALL_MOCK);

    const storeState = useCompanyStore.getState();
    expect(storeState.companies).toEqual(ALL_MOCK);
    expect(storeState.selectedCompany).toBeNull();
    expect(storeState.mode).toBe('conjunto');
    expect(storeState.isConjunto).toBe(true);
  });

  // ── Test 6: Cleanup / Unsubscribe ───────────────────────────────────────

  it('se desuscribe de Firestore al desmontar el provider', async () => {
    mockPathname = '/empresa-a/dashboard';
    mockSnapshotData = ALL_MOCK;

    const { unmount } = render(
      <CompanyProvider userId="test-uid">
        <TestConsumer />
      </CompanyProvider>,
    );

    // Esperar membership guard
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // En el mount, subscribeCompanies devolvió mockUnsub (aún no llamado)
    expect(mockUnsub).not.toHaveBeenCalled();

    unmount();

    // Al desmontar, debe llamar a la función de limpieza
    expect(mockUnsub).toHaveBeenCalledTimes(1);
  });

  // ── Test 6: Hook fuera del provider ─────────────────────────────────────

  it('lanza un error controlado cuando useCompany se usa fuera de CompanyProvider', () => {
    expect(() => render(<TestHookOnly />)).toThrow(
      'useCompany must be used within a CompanyProvider',
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tests 2.7: Rutas sin companyId
  // ═══════════════════════════════════════════════════════════════════════

  describe('rutas sin companyId (2.7)', () => {
    const PUBLIC_ROUTES = ['/login', '/register', '/select-company', '/onboarding', '/pending-approval', '/'];

    it.each(PUBLIC_ROUTES)('renderiza children sin contexto en ruta %s', async (route) => {
      mockPathname = route;

      render(
        <CompanyProvider userId={null}>
          <div data-testid="public-child">public content</div>
        </CompanyProvider>,
      );

      // En rutas públicas no hay loading — renderiza inmediatamente
      expect(await screen.findByTestId('public-child')).toHaveTextContent('public content');
    });

    it('no subscribe a Firestore en rutas públicas', () => {
      mockPathname = '/login';

      render(
        <CompanyProvider userId={null}>
          <div>public</div>
        </CompanyProvider>,
      );

      // subscribeUserCompanies no debe haberse llamado
      expect(subscribeUserCompanies).not.toHaveBeenCalled();
    });

    it('provee valores default en rutas públicas', () => {
      mockPathname = '/select-company';

      function CheckValues() {
        const ctx = useCompany();
        return (
          <div>
            <p data-testid="ctx-company">{ctx.selectedCompany === null ? 'null' : 'set'}</p>
            <p data-testid="ctx-companies-count">{ctx.companies.length}</p>
            <p data-testid="ctx-role">{ctx.userRole === null ? 'null' : ctx.userRole}</p>
            <p data-testid="ctx-is-conjunto">{ctx.isConjunto ? 'true' : 'false'}</p>
          </div>
        );
      }

      render(
        <CompanyProvider userId={null}>
          <CheckValues />
        </CompanyProvider>,
      );

      expect(screen.getByTestId('ctx-company')).toHaveTextContent('null');
      expect(screen.getByTestId('ctx-companies-count')).toHaveTextContent('0');
      expect(screen.getByTestId('ctx-role')).toHaveTextContent('null');
      expect(screen.getByTestId('ctx-is-conjunto')).toHaveTextContent('false');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tests 2.8: Membership guard
  // ═══════════════════════════════════════════════════════════════════════

  describe('membership guard (2.8)', () => {
    it('granted: permite acceso cuando el usuario es miembro', async () => {
      mockPathname = '/empresa-a/dashboard';
      mockSnapshotData = [MOCK_A, MOCK_B];
      mockMemberData = { role: 'admin' };

      render(
        <CompanyProvider userId="test-uid">
          <TestConsumer />
        </CompanyProvider>,
      );

      // Todavía en loading (membership no checked)
      expect(screen.queryByTestId('selected-name')).not.toBeInTheDocument();

      // Esperar a que el effect de membership guard se resuelva
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // Ahora membership = granted, subscription debería comenzar
      await emitData(ALL_MOCK);

      expect(await screen.findByTestId('selected-name')).toHaveTextContent('Empresa A');
    });

    it('denied (no member): muestra acceso denegado cuando el usuario no es miembro', async () => {
      mockPathname = '/empresa-x/dashboard';
      mockSnapshotData = [MOCK_A, MOCK_B]; // empresa-x NO está en la snapshot

      render(
        <CompanyProvider userId="test-uid">
          <TestConsumer />
        </CompanyProvider>,
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(await screen.findByText('No tenés acceso a esta empresa.')).toBeInTheDocument();
      expect(screen.queryByTestId('selected-name')).not.toBeInTheDocument();
    });

    it('denied (blocked): muestra acceso denegado cuando el usuario está bloqueado', async () => {
      mockPathname = '/empresa-a/dashboard';
      mockSnapshotData = [MOCK_A, MOCK_B];
      mockMemberData = { role: 'admin', blocked: true };

      render(
        <CompanyProvider userId="test-uid">
          <TestConsumer />
        </CompanyProvider>,
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(await screen.findByText('No tenés acceso a esta empresa.')).toBeInTheDocument();
    });

    it('all (conjunto): permite acceso sin membership check para empresa "all"', async () => {
      mockPathname = '/all/conjunto';
      // No importa qué devuelva getUserCompaniesSnapshot, "all" tiene bypass

      render(
        <CompanyProvider userId="test-uid">
          <TestConsumer />
        </CompanyProvider>,
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // subscription se activa, emitimos datos
      await emitData(ALL_MOCK);

      // En modo 'all' (conjunto), selectedCompany es null
      expect(await screen.findByTestId('selected-name')).toHaveTextContent('none');
    });

    it('muestra spinner mientras membership se está verificando', () => {
      mockPathname = '/empresa-a/dashboard';
      mockAuthLoading = false;
      // No resolver el snapshot para mantener el estado loading

      render(
        <CompanyProvider userId="test-uid">
          <div data-testid="child">should not appear</div>
        </CompanyProvider>,
      );

      // Debe mostrar el spinner en lugar de los hijos
      expect(screen.queryByTestId('child')).not.toBeInTheDocument();

      // Buscar el spinner por el border-indigo-600 (clase de Tailwind)
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });
});
