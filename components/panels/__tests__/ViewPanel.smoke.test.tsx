import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { RecordDetail, NavScreen } from '@/lib/types';
import { ViewPanel } from '../ViewPanel';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ type: 'collection' as const })),
  doc: vi.fn(() => ({ type: 'doc' as const })),
  addDoc: vi.fn().mockResolvedValue({ id: 'new-id' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  onSnapshot: vi.fn().mockReturnValue(vi.fn()),
  serverTimestamp: vi.fn().mockReturnValue({ toDate: () => new Date() }),
  getFirestore: vi.fn(),
}));

vi.mock('@/lib/firestore', () => ({
  subscribeEjecucionesByBudget: vi.fn(() => vi.fn()),
  updateEjecucion: vi.fn(),
  updateBudget: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({ db: {}, storage: {} }));
vi.mock('@/lib/auth', () => ({ auth: {} }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/context/CompanyContext', () => ({ useCompany: () => ({ selectedCompany: null, companies: [] }) }));
vi.mock('@/lib/fileUpload', () => ({ deleteFile: vi.fn() }));

describe('ViewPanel', () => {
  const baseProps = {
    companyId: 'c1',
    onClose: vi.fn(),
    onFormSubmit: vi.fn(),
    onNavigate: vi.fn() as (screen: NavScreen) => void,
    canGoBack: false,
    onBack: vi.fn(),
  };

  it('renderiza el detalle de presupuesto', () => {
    const detail: RecordDetail = { type: 'budget', budget: { id: 'b1', descripcion: 'Presupuesto test', montoPresupuestado: 100000, mesPresupuestado: 'Enero' as const, tipo: 'ingreso' as const, fechaPresupuestado: '2026-01-15', projectId: 'p1', projectName: 'Proyecto', entityId: 'e1', entityName: 'Entidad', entityType: 'client', estadoProyecto: 'Activo' as const }, ejecuciones: [] };
    render(<ViewPanel {...baseProps} recordDetail={detail} />);
    expect(screen.getByText('Presupuesto')).toBeInTheDocument();
  });
});
