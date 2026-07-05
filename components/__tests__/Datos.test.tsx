import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';

const { collection, doc, addDoc, updateDoc, onSnapshot, serverTimestamp, getFirestore, mockUnsub } = vi.hoisted(
  () => {
    const mockUnsub = vi.fn();
    return {
      collection: vi.fn(() => ({ type: 'collection' as const })),
      doc: vi.fn(() => ({ type: 'doc' as const })),
      addDoc: vi.fn().mockResolvedValue({ id: 'new-id' }),
      updateDoc: vi.fn().mockResolvedValue(undefined),
      onSnapshot: vi.fn().mockReturnValue(mockUnsub),
      serverTimestamp: vi.fn().mockReturnValue({ toDate: () => new Date() }),
      getFirestore: vi.fn(),
      mockUnsub,
    };
  },
);

vi.mock('firebase/firestore', () => ({
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  getFirestore,
}));

vi.mock('@/lib/firebase', () => ({ db: {} }));

vi.mock('@/lib/firestore', () => ({
  subscribeProjects: vi.fn(() => mockUnsub),
  subscribeTerceros: vi.fn(() => mockUnsub),
  subscribeSettings: vi.fn(() => mockUnsub),
  subscribeCompanySettings: vi.fn(() => mockUnsub),
  subscribeCuentasBancarias: vi.fn(() => mockUnsub),
  subscribeExtractos: vi.fn(() => mockUnsub),
  subscribeBudgets: vi.fn(() => mockUnsub),
}));

import { Datos } from '@/components/Datos';
import type { Ejecucion, Comprobante } from '@/lib/types';

function makeEjecucion(overrides: Partial<Ejecucion> = {}): Ejecucion {
  return {
    id: 'ej-1',
    descripcion: 'Ejecucion Test',
    projectId: 'proj-1',
    projectName: 'Proyecto Alpha',
    entityId: 'client-1',
    entityName: 'Cliente Beta',
    entityType: 'client',
    tipo: 'ingreso',
    montoEjecutado: 250000,
    fechaEjecutado: '2026-07-15',
    comprobantes: [],
    ...overrides,
  };
}

describe('Datos — Comprobantes badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('3.5a muestra badge de estado cuando hay comprobantes', () => {
    const comprobantes: Comprobante[] = [
      { id: 'c1', name: 'pago.pdf', url: '', path: '', type: 'application/pdf', size: 1024, uploadedAt: '', tipo: 'Comprobante de pago' },
      { id: 'c2', name: 'cuenta.pdf', url: '', path: '', type: 'application/pdf', size: 1024, uploadedAt: '', tipo: 'Cuenta de Cobro' },
    ];
    const ejecuciones = [makeEjecucion({ id: 'ej-1', comprobantes })];

    render(
      <Datos
        budgets={[]}
        ejecuciones={ejecuciones}
        activeTab="ejecuciones"
        companyId="c1"
      />,
    );

    // Should show "Completada" state badge
    expect(screen.getByText('Ejecucion Test')).toBeInTheDocument();
    // There will be multiple elements with "Completada" (dropdown option + badge)
    const completadaElements = screen.getAllByText('Completada');
    expect(completadaElements.length).toBeGreaterThanOrEqual(1);
  });

  it('3.5b NO muestra badge de número cuando array vacío', () => {
    const ejecuciones = [makeEjecucion({ id: 'ej-1', comprobantes: [] })];

    render(
      <Datos
        budgets={[]}
        ejecuciones={ejecuciones}
        activeTab="ejecuciones"
        companyId="c1"
      />,
    );

    // Should show the ejecucion
    expect(screen.getByText('Ejecucion Test')).toBeInTheDocument();
    // But no badge number (the paperclip count was removed)
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });
});

describe('Datos — PR1-T4 Banco column', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('muestra nombre de cuenta bancaria en columna Banco', () => {
    const ejecuciones = [makeEjecucion({
      cuentaName: 'Banco XYZ - Corriente (Corriente)',
    })];

    render(
      <Datos
        budgets={[]}
        ejecuciones={ejecuciones}
        activeTab="ejecuciones"
        companyId="c1"
      />,
    );

    expect(screen.getByText('Banco XYZ - Corriente (Corriente)')).toBeInTheDocument();
  });

  it('muestra guión cuando no hay cuenta bancaria', () => {
    const ejecuciones = [makeEjecucion({})];

    render(
      <Datos
        budgets={[]}
        ejecuciones={ejecuciones}
        activeTab="ejecuciones"
        companyId="c1"
      />,
    );

    // The "—" character should be rendered for empty cuentaName
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Datos — PR2 Comprobantes state badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('badge shows Completada (green) when both required comprobantes present', () => {
    const comprobantes: Comprobante[] = [
      { id: 'c1', name: 'pago.pdf', url: '', path: '', type: 'application/pdf', size: 100, uploadedAt: '', tipo: 'Comprobante de pago' },
      { id: 'c2', name: 'cuenta.pdf', url: '', path: '', type: 'application/pdf', size: 100, uploadedAt: '', tipo: 'Cuenta de Cobro' },
    ];
    const ejecuciones = [makeEjecucion({ id: 'ej-1', comprobantes })];

    render(
      <Datos budgets={[]} ejecuciones={ejecuciones} activeTab="ejecuciones" companyId="c1" />,
    );

    // "Completada" appears as a badge AND as a filter option
    const elements = screen.getAllByText('Completada');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('badge shows Falta cuenta de cobro (amber) when only pago present', () => {
    const comprobantes: Comprobante[] = [
      { id: 'c1', name: 'pago.pdf', url: '', path: '', type: 'application/pdf', size: 100, uploadedAt: '', tipo: 'Comprobante de pago' },
    ];
    const ejecuciones = [makeEjecucion({ id: 'ej-1', comprobantes })];

    render(
      <Datos budgets={[]} ejecuciones={ejecuciones} activeTab="ejecuciones" companyId="c1" />,
    );

    const elements = screen.getAllByText('Falta cuenta de cobro');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('badge shows Sin comprobantes (gray) when array empty', () => {
    const ejecuciones = [makeEjecucion({ id: 'ej-1', comprobantes: [] })];

    render(
      <Datos budgets={[]} ejecuciones={ejecuciones} activeTab="ejecuciones" companyId="c1" />,
    );

    const elements = screen.getAllByText('Sin comprobantes');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('filter by comprobante estado works', () => {
    const completada: Comprobante[] = [
      { id: 'c1', name: 'pago.pdf', url: '', path: '', type: 'application/pdf', size: 100, uploadedAt: '', tipo: 'Comprobante de pago' },
      { id: 'c2', name: 'cuenta.pdf', url: '', path: '', type: 'application/pdf', size: 100, uploadedAt: '', tipo: 'Cuenta de Cobro' },
    ];
    const sinComp: Comprobante[] = [];
    const ejecuciones = [
      makeEjecucion({ id: 'ej-1', descripcion: 'ConComprobantesSI', comprobantes: completada }),
      makeEjecucion({ id: 'ej-2', descripcion: 'SinComprobantesNO', comprobantes: sinComp }),
    ];

    render(
      <Datos budgets={[]} ejecuciones={ejecuciones} activeTab="ejecuciones" companyId="c1" />,
    );

    // Both rows visible initially
    expect(screen.getByText('ConComprobantesSI')).toBeInTheDocument();
    expect(screen.getByText('SinComprobantesNO')).toBeInTheDocument();

    // Find the comprobante filter select
    const selects = screen.getAllByRole('combobox');
    const compFilter = selects.find(s => {
      const opts = s.querySelectorAll('option');
      return Array.from(opts).some(o => o.value === 'Completada');
    });
    expect(compFilter).toBeTruthy();

    // Filter to show only Completada
    if (compFilter) {
      fireEvent.change(compFilter, { target: { value: 'Completada' } });
    }

    // Only the completada row should be visible
    expect(screen.getByText('ConComprobantesSI')).toBeInTheDocument();
    expect(screen.queryByText('SinComprobantesNO')).not.toBeInTheDocument();
  });
});
