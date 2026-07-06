import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import React from 'react';
import type { ActiveForm } from '@/lib/types';

// ─── Mocks ───────────────────────────────────────────────────────────────

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ type: 'collection' as const })),
  doc: vi.fn(() => ({ type: 'doc' as const })),
  addDoc: vi.fn().mockResolvedValue({ id: 'new-id' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  onSnapshot: vi.fn().mockReturnValue(vi.fn()),
  serverTimestamp: vi.fn().mockReturnValue({ toDate: () => new Date() }),
  getFirestore: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
  storage: {},
}));

vi.mock('@/lib/auth', () => ({
  auth: {},
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock('@/context/CompanyContext', () => ({
  useCompany: () => ({ selectedCompany: null, companies: [] }),
}));

vi.mock('@/lib/firestore', () => ({
  subscribeClients: vi.fn(() => vi.fn()),
  subscribeProviders: vi.fn(() => vi.fn()),
  subscribeBudgets: vi.fn(() => vi.fn()),
  subscribeTerceros: vi.fn(() => vi.fn()),
  subscribeSettings: vi.fn(() => vi.fn()),
  subscribeCuentasBancarias: vi.fn(() => vi.fn()),
  subscribeEjecucionesByBudget: vi.fn(() => vi.fn()),
  removeBudgetLink: vi.fn(),
  updateEjecucion: vi.fn(),
  updateBudget: vi.fn(),
  addEjecucion: vi.fn(),
  addClient: vi.fn(),
  addProject: vi.fn(),
  addTercero: vi.fn(),
  updateSettings: vi.fn(),
  createInvitation: vi.fn(),
  updateInvitation: vi.fn(),
  blockMember: vi.fn(),
  updateMemberRole: vi.fn(),
  addMemberToCompany: vi.fn(),
}));

vi.mock('@/lib/fileUpload', () => ({
  validateFile: vi.fn(),
  uploadFile: vi.fn().mockResolvedValue({ url: 'https://example.com/extracto.pdf', path: 'c1/extractos/extracto.pdf' }),
  deleteFile: vi.fn(),
  generateFilePath: vi.fn(),
}));

vi.mock('@/lib/parsers/index', () => ({
  detectarBanco: vi.fn(),
  getParser: vi.fn(),
}));

// Deferred-promise controlled pdfjs mock so we can assert intermediate
// progress states between pages instead of only the final settled state.
let pageDeferreds: Array<{ promise: Promise<any>; resolve: (v: any) => void }> = [];
function makeDeferred() {
  let resolve!: (v: any) => void;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}));

import { ExtractoAddForm } from '@/components/Sidepanel';
import { detectarBanco, getParser } from '@/lib/parsers/index';
import { uploadFile } from '@/lib/fileUpload';

function makePdfFile(name = 'extracto.pdf'): File {
  const file = new File(['%PDF-1.4 contenido falso'], name, { type: 'application/pdf' });
  return file;
}

function setupPdfMock(pageTexts: string[]) {
  pageDeferreds = pageTexts.map(() => makeDeferred());
  return import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjsModule) => {
    (pdfjsModule.getDocument as any).mockReturnValue({
      promise: Promise.resolve({
        numPages: pageTexts.length,
        getPage: vi.fn().mockImplementation((pageNum: number) =>
          pageDeferreds[pageNum - 1].promise.then(() => ({
            getTextContent: vi.fn().mockResolvedValue({ items: [{ str: pageTexts[pageNum - 1] }] }),
          })),
        ),
      }),
    });
  });
}

function resolvePage(idx: number) {
  return act(async () => {
    pageDeferreds[idx].resolve(undefined);
    // Allow the chained .then() + subsequent awaits to flush
    await Promise.resolve();
    await Promise.resolve();
  });
}

const noopSubmit = vi.fn().mockResolvedValue(undefined);

const defaultForm: Extract<ActiveForm, { mode: 'add' }> = { mode: 'add', type: 'extracto', defaults: { accountId: 'acc-1' } };

function renderForm(overrides: Partial<{ onSubmit: typeof noopSubmit }> = {}) {
  return render(
    <ExtractoAddForm
      form={defaultForm}
      companyId="company-1"
      title="Nuevo Extracto Bancario"
      onSubmit={overrides.onSubmit ?? noopSubmit}
      onBack={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

function getFileInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

describe('ExtractoAddForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows only a drop-zone and no Mes/Año/Saldo fields upfront', () => {
    renderForm();
    expect(screen.getByText(/arrastr/i)).toBeInTheDocument();
    expect(screen.queryByText('Mes')).not.toBeInTheDocument();
    expect(screen.queryByText('Saldo inicial')).not.toBeInTheDocument();
    expect(screen.queryByText('Saldo final')).not.toBeInTheDocument();
    expect(screen.queryByText('Estado')).not.toBeInTheDocument();
  });

  it('selecting a PDF file auto-detects the bank and opens the confirm modal without an extra click', async () => {
    await setupPdfMock(['bancolombia.com Extracto']);
    vi.mocked(detectarBanco).mockReturnValue('Bancolombia');
    vi.mocked(getParser).mockReturnValue({
      banco: 'Bancolombia',
      parse: vi.fn().mockReturnValue({
        movimientos: [
          { fecha: '2026-01-15', descripcion: 'Pago servicio', debito: 500000, saldo: 500000, moneda: 'COP', ordinal: 1, bancoOrigen: 'Bancolombia' },
        ],
        context: { banco: 'Bancolombia', saldoInicial: 1000000, saldoFinal: 500000, periodoDesde: '2026-01-01' },
      }),
    } as any);

    const { container } = renderForm();
    const input = getFileInput(container);

    await act(async () => {
      fireEvent.change(input, { target: { files: [makePdfFile()] } });
    });

    await resolvePage(0);

    await waitFor(() => {
      expect(screen.getByText('Confirmar extracto')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(detectarBanco).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('Bancolombia')).toBeInTheDocument();
    });
    expect(screen.getByText('Enero')).toBeInTheDocument();
  });

  it('shows page-extraction progress while reading a multi-page PDF', async () => {
    await setupPdfMock(['Página uno bancolombia.com', 'Página dos']);
    vi.mocked(detectarBanco).mockReturnValue('Bancolombia');
    vi.mocked(getParser).mockReturnValue({
      banco: 'Bancolombia',
      parse: vi.fn().mockReturnValue({
        movimientos: [],
        context: { banco: 'Bancolombia', saldoInicial: 0, saldoFinal: 0 },
      }),
    } as any);

    const { container } = renderForm();
    const input = getFileInput(container);

    await act(async () => {
      fireEvent.change(input, { target: { files: [makePdfFile()] } });
    });

    // Resolve only page 1 — page 2 stays pending so we can observe partial progress.
    await act(async () => {
      pageDeferreds[0].resolve(undefined);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('Procesando 1 de 2 páginas')).toBeInTheDocument();
    });

    // Now resolve page 2 and let parsing complete.
    await resolvePage(1);

    await waitFor(() => {
      expect(screen.getByText('Confirmar extracto')).toBeInTheDocument();
    });
  });

  it('falls back to manual bank selection when the bank cannot be auto-detected', async () => {
    await setupPdfMock(['Texto de banco desconocido']);
    vi.mocked(detectarBanco).mockReturnValue('No detectado');

    const { container } = renderForm();
    const input = getFileInput(container);

    await act(async () => {
      fireEvent.change(input, { target: { files: [makePdfFile()] } });
    });
    await resolvePage(0);

    await waitFor(() => {
      expect(screen.getByText(/no se pudo detectar el banco/i)).toBeInTheDocument();
    });
    expect(getParser).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('clicking Guardar uploads the PDF, submits extracto + movimientos, closing the panel', async () => {
    await setupPdfMock(['bancolombia.com Extracto']);
    vi.mocked(detectarBanco).mockReturnValue('Bancolombia');
    vi.mocked(getParser).mockReturnValue({
      banco: 'Bancolombia',
      parse: vi.fn().mockReturnValue({
        movimientos: [
          { fecha: '2026-01-15', descripcion: 'Pago servicio', debito: 500000, saldo: 500000, moneda: 'COP', ordinal: 1, bancoOrigen: 'Bancolombia' },
        ],
        context: { banco: 'Bancolombia', saldoInicial: 1000000, saldoFinal: 500000, periodoDesde: '2026-01-01' },
      }),
    } as any);

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderForm({ onSubmit });
    const input = getFileInput(container);

    await act(async () => {
      fireEvent.change(input, { target: { files: [makePdfFile()] } });
    });
    await resolvePage(0);

    await waitFor(() => {
      expect(screen.getByText('Confirmar extracto')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Guardar'));
    });

    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const [submittedForm, submittedData] = onSubmit.mock.calls[0];
    expect(submittedForm).toEqual(defaultForm);
    expect(submittedData.accountId).toBe('acc-1');
    expect(submittedData.mes).toBe('Enero');
    expect(submittedData.anio).toBe(2026);
    expect(submittedData.saldoInicial).toBe(1000000);
    expect(submittedData.saldoFinal).toBe(500000);
    expect(submittedData.estado).toBe('Completado');
    expect(submittedData._pendingMovimientos).toHaveLength(1);
    expect(submittedData.archivo).toEqual(
      expect.objectContaining({ url: 'https://example.com/extracto.pdf' }),
    );
  });

  it('clicking Cancelar closes the modal and resets the drop-zone without submitting', async () => {
    await setupPdfMock(['bancolombia.com Extracto']);
    vi.mocked(detectarBanco).mockReturnValue('Bancolombia');
    vi.mocked(getParser).mockReturnValue({
      banco: 'Bancolombia',
      parse: vi.fn().mockReturnValue({
        movimientos: [
          { fecha: '2026-01-15', descripcion: 'Pago servicio', debito: 500000, saldo: 500000, moneda: 'COP', ordinal: 1, bancoOrigen: 'Bancolombia' },
        ],
        context: { banco: 'Bancolombia', saldoInicial: 1000000, saldoFinal: 500000, periodoDesde: '2026-01-01' },
      }),
    } as any);

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderForm({ onSubmit });
    const input = getFileInput(container);

    await act(async () => {
      fireEvent.change(input, { target: { files: [makePdfFile()] } });
    });
    await resolvePage(0);

    await waitFor(() => {
      expect(screen.getByText('Confirmar extracto')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancelar'));

    expect(screen.queryByText('Confirmar extracto')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    // Drop-zone is back to its empty state
    expect(screen.getByText(/arrastr/i)).toBeInTheDocument();
  });
});
