import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { ActiveForm } from '@/lib/types';
import { FormPanel } from '../FormPanel';

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
  subscribeClients: vi.fn(() => vi.fn()),
  subscribeProviders: vi.fn(() => vi.fn()),
  subscribeBudgets: vi.fn(() => vi.fn()),
  subscribeTerceros: vi.fn(() => vi.fn()),
  subscribeSettings: vi.fn(() => vi.fn()),
  subscribeCuentasBancarias: vi.fn(() => vi.fn()),
  addClient: vi.fn(),
  addProject: vi.fn(),
  addTercero: vi.fn(),
  updateEjecucion: vi.fn(),
  updateBudget: vi.fn(),
  addEjecucion: vi.fn(),
  createInvitation: vi.fn(),
  updateInvitation: vi.fn(),
  blockMember: vi.fn(),
  updateMemberRole: vi.fn(),
  addMemberToCompany: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({ db: {}, storage: {} }));
vi.mock('@/lib/auth', () => ({ auth: {} }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/context/CompanyContext', () => ({ useCompany: () => ({ selectedCompany: null, companies: [] }) }));
vi.mock('@/lib/fileUpload', () => ({ deleteFile: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() }, Toaster: () => null }));

describe('FormPanel', () => {
  it('renderiza el título del formulario para add budget', () => {
    const form = { mode: 'add' as const, type: 'budget' as const };
    render(<FormPanel form={form} companyId="c1" onClose={vi.fn()} onSubmit={vi.fn()} canGoBack={false} onBack={vi.fn()} />);
    expect(screen.getByText(/Presupuesto/)).toBeInTheDocument();
  });
});
