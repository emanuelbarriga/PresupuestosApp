import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { act } from 'react';
import React from 'react';
import { CompanyProvider, useCompany } from '@/context/CompanyContext';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUnsub = vi.fn();
let onDataCallback: ((data: any[]) => void) | undefined;

vi.mock('@/lib/firestore', () => ({
  subscribeCompanies: vi.fn((onData: (data: any[]) => void) => {
    onDataCallback = onData;
    return mockUnsub;
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('CompanyContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onDataCallback = undefined;
  });

  afterEach(() => {
    cleanup();
  });

  // ── Test 1: Happy path ──────────────────────────────────────────────────────

  it('selecciona la empresa exacta cuando companyId coincide', async () => {
    render(
      <CompanyProvider companyId="empresa-b">
        <TestConsumer />
      </CompanyProvider>,
    );

    // Inicia en loading → null, no renderiza hijos
    expect(screen.queryByTestId('selected-name')).not.toBeInTheDocument();

    // Simula la llegada de datos desde Firestore
    await emitData(ALL_MOCK);

    // Debe mostrar la empresa que coincide con companyId
    expect(await screen.findByTestId('selected-name')).toHaveTextContent('Empresa B');
  });

  // ── Test 2: Fallback ────────────────────────────────────────────────────────

  it('selecciona la primera empresa cuando no hay coincidencia de companyId', async () => {
    render(
      <CompanyProvider companyId="empresa-inexistente">
        <TestConsumer />
      </CompanyProvider>,
    );

    await emitData(ALL_MOCK);

    expect(await screen.findByTestId('selected-name')).toHaveTextContent('Empresa A');
  });

  // ── Test 3: Base de datos vacía (caso crítico) ──────────────────────────────

  it('muestra la pantalla de bienvenida cuando no hay empresas (evita el bloqueo)', async () => {
    render(
      <CompanyProvider companyId="empresa-cualquiera">
        <TestConsumer />
      </CompanyProvider>,
    );

    // Simula Firestore devolviendo array vacío
    await emitData([]);

    // No debe renderizar el TestConsumer, pero sí el fallback con "Sin empresas"
    expect(await screen.findByText('Sin empresas')).toBeInTheDocument();
    expect(screen.getByText(/No hay empresas registradas/)).toBeInTheDocument();

    // El TestConsumer NO debe aparecer (porque no hay empresa seleccionada)
    expect(screen.queryByTestId('selected-name')).not.toBeInTheDocument();
  });

  // ── Test 4: setCompany ──────────────────────────────────────────────────────

  it('setCompany cambia la empresa seleccionada y falla silenciosamente con IDs inválidos', async () => {
    render(
      <CompanyProvider companyId="empresa-a">
        <TestConsumer />
      </CompanyProvider>,
    );

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

  // ── Test 5: Cleanup / Unsubscribe ───────────────────────────────────────────

  it('se desuscribe de Firestore al desmontar el provider', async () => {
    const { unmount } = render(
      <CompanyProvider companyId="empresa-a">
        <TestConsumer />
      </CompanyProvider>,
    );

    // En el mount, subscribeCompanies devolvió mockUnsub
    expect(mockUnsub).not.toHaveBeenCalled();

    unmount();

    // Al desmontar, debe llamar a la función de limpieza
    expect(mockUnsub).toHaveBeenCalledTimes(1);
  });

  // ── Test 6: Hook fuera del provider ─────────────────────────────────────────

  it('lanza un error controlado cuando useCompany se usa fuera de CompanyProvider', () => {
    // El error se lanza en el render
    expect(() => render(<TestHookOnly />)).toThrow(
      'useCompany must be used within a CompanyProvider',
    );
  });
});
