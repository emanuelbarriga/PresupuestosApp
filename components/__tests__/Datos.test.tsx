import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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

  it('3.5a muestra badge con número de comprobantes cuando > 0', () => {
    const comprobantes: Comprobante[] = [
      { id: 'c1', name: 'factura.pdf', url: 'https://example.com/factura.pdf', path: 'path/factura.pdf', type: 'application/pdf', size: 1024, uploadedAt: '2026-07-01T00:00:00Z' },
      { id: 'c2', name: 'recibo.jpg', url: 'https://example.com/recibo.jpg', path: 'path/recibo.jpg', type: 'image/jpeg', size: 2048, uploadedAt: '2026-07-02T00:00:00Z' },
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

    // Badge should show "2"
    expect(screen.getByText('2')).toBeInTheDocument();
    // Row should be clickable
    expect(screen.getByText('Ejecucion Test')).toBeInTheDocument();
  });

  it('3.5b NO muestra badge cuando comprobantes está vacío', () => {
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
    // But no badge number (suponiendo que no hay otro texto "2")
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });
});
