import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { ActiveForm } from '@/lib/types';
import { DataPanel } from '../DataPanel';

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
  updateBudget: vi.fn(),
  updateEjecucion: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({ db: {}, storage: {} }));
vi.mock('@/lib/auth', () => ({ auth: {} }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/context/CompanyContext', () => ({ useCompany: () => ({ selectedCompany: null, companies: [] }) }));
vi.mock('@/lib/fileUpload', () => ({ deleteFile: vi.fn() }));

describe('DataPanel', () => {
  it('renderiza el título de detalle', () => {
    render(<DataPanel
      data={{
        title: 'Proyecto / Enero',
        subtitle: 'sub',
        formula: 'formula',
        mode: 'Presupuestado',
        tipo: 'ingreso',
        budgets: [],
        ejecuciones: [],
        value: 100000,
        presupuestado: 100000,
        ejecutado: 50000,
        diferencia: 50000,
      }}
      companyId="c1"
      onClose={vi.fn()}
      onNavigate={vi.fn()}
      canGoBack={false}
      onBack={vi.fn()}
    />);
    expect(screen.getByText(/Seleccionado/)).toBeInTheDocument();
  });
});
