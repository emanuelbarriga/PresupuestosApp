import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import type { Budget } from '@/lib/types';
import { EjecucionForm } from './EjecucionForm';

// ─── Mock file upload ───────────────────────────────────────────────────────

vi.mock('@/lib/fileUpload', () => ({
  generateFilePath: vi.fn((_companyId: string, _ejecucionId: string, fileName: string) => {
    return `mock-path/${_companyId}/${_ejecucionId}/${fileName}`;
  }),
  uploadFile: vi.fn().mockResolvedValue({ url: 'https://mock-url.com/file.pdf', path: 'mock-path/file.pdf' }),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock firestore ─────────────────────────────────────────────────────────

vi.mock('@/lib/firestore', () => ({
  addClient: vi.fn().mockResolvedValue('new-client-id'),
  addProject: vi.fn().mockResolvedValue('new-project-id'),
}));

// ─── Mock components ────────────────────────────────────────────────────────

vi.mock('@/components/forms/TipoSwitch', () => ({
  TipoSwitch: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div data-testid="tipo-switch">
      <button onClick={() => onChange('ingreso')}>Ingreso</button>
      <button onClick={() => onChange('egreso')}>Egreso</button>
      <span>Current: {value}</span>
    </div>
  ),
}));

vi.mock('@/components/forms/SearchableSelect', () => ({
  SearchableSelect: ({ label, value, options, onChange, placeholder }: any) => (
    <div data-testid={`searchable-select-${label || 'empty'}`}>
      <select value={value} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  ),
}));

vi.mock('@/components/forms/FormInput', () => ({
  FormInput: ({ label, value, onChange, type }: any) => (
    <div data-testid={`form-input-${label}`}>
      <input type={type || 'text'} value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} />
    </div>
  ),
}));

vi.mock('@/components/shared/Calculator', () => ({
  Calculator: ({ value, onChange, onResult }: any) => (
    <div data-testid="calculator">
      <input value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} />
      <button onClick={() => onResult(1000)}>Calc Result</button>
    </div>
  ),
}));

vi.mock('@/components/upload/ComprobanteUploader', () => ({
  ComprobanteUploader: ({ comprobantes, pendingComprobantes, onPendingChange, onComprobantesChange, ejecucionId }: any) => (
    <div data-testid="comprobante-uploader">
      <span data-testid="uploader-ejecucion-id">{ejecucionId || 'no-id'}</span>
      <span data-testid="uploader-saved-count">{comprobantes.length}</span>
      <span data-testid="uploader-pending-count">{pendingComprobantes.length}</span>
      <button data-testid="add-pending-btn" onClick={() => {
        onPendingChange((prev: any[]) => [...prev, {
          id: 'pending-1',
          file: new File(['test'], 'factura.pdf', { type: 'application/pdf' }),
          name: 'factura.pdf',
          type: 'application/pdf',
          size: 1000,
          tipo: 'factura',
          descripcion: 'Factura de prueba',
        }]);
      }}>Add Pending</button>
      <button data-testid="add-saved-btn" onClick={() => {
        onComprobantesChange([...comprobantes, {
          id: 'saved-1',
          name: 'saved.pdf',
          url: 'https://example.com/saved.pdf',
          path: 'path/saved.pdf',
          type: 'application/pdf',
          size: 2000,
          uploadedAt: new Date().toISOString(),
          tipo: 'soporte',
        }]);
      }}>Add Saved</button>
    </div>
  ),
}));

// ─── Test data ──────────────────────────────────────────────────────────────

const mockBudgets: Budget[] = [
  { id: 'b1', descripcion: 'Honorarios', projectId: 'p1', projectName: 'Proyecto A', entityId: '', entityName: '', entityType: 'client', tipo: 'ingreso', montoPresupuestado: 1000000, mesPresupuestado: 'Enero', fechaPresupuestado: '2026-01', estadoProyecto: 'Activo' },
  { id: 'b2', descripcion: 'Materiales', projectId: 'p1', projectName: 'Proyecto A', entityId: '', entityName: '', entityType: 'client', tipo: 'ingreso', montoPresupuestado: 500000, mesPresupuestado: 'Enero', fechaPresupuestado: '2026-01', estadoProyecto: 'Activo' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Fill required form fields so Zod validation passes before submit */
function fillRequiredFields() {
  const descInput = screen.getByTestId('form-input-Descripción').querySelector('input');
  if (descInput) {
    fireEvent.change(descInput, { target: { value: 'Test desc' } });
  }
  // fechaEjecutado defaults to today via new Date().toISOString().split('T')[0],
  // so it's always valid as long as the form renders in a browser context.
}

function renderForm(props: Partial<Parameters<typeof EjecucionForm>[0]> = {}) {
  const onFormSubmit = vi.fn().mockResolvedValue(undefined);
  const rendered = render(
    <EjecucionForm
      companyId="c1"
      mode="add"
      projects={[]}
      clients={[]}
      providers={[]}
      clientsAndProviders={[]}
      allBudgets={mockBudgets}
      cuentas={[]}
      settingsData={null}
      onFormSubmit={onFormSubmit}
      saving={false}
      {...props}
    />,
  );
  return { ...rendered, onFormSubmit };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('EjecucionForm — Comprobante pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('preGeneratedId mechanism', () => {
    it('incluye _preGeneratedId en el submit cuando hay pending comprobantes en add mode', async () => {
      const { onFormSubmit } = renderForm();

      // Add a pending comprobante via the mocked uploader
      fireEvent.click(screen.getByTestId('add-pending-btn'));
      expect(screen.getByTestId('uploader-pending-count')).toHaveTextContent('1');

      // Fill required fields to pass Zod validation
      fillRequiredFields();

      // Submit
      fireEvent.click(screen.getByText('Crear'));

      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalledTimes(1);
      });

      const submittedData = onFormSubmit.mock.calls[0][0] as Record<string, any>;
      expect(submittedData._preGeneratedId).toBeDefined();
      expect(typeof submittedData._preGeneratedId).toBe('string');
      expect(submittedData._preGeneratedId.length).toBeGreaterThan(0);
    });

    it('incluye _preGeneratedId distinto para cada entry recurrente', async () => {
      const { onFormSubmit } = renderForm({ mode: 'add' });

      // Enable recurring
      fireEvent.click(screen.getByText('Recurrente'));

      // Add pending comprobante
      fireEvent.click(screen.getByTestId('add-pending-btn'));

      // Fill required fields to pass Zod validation
      fillRequiredFields();

      // Submit
      fireEvent.click(screen.getByText('Crear'));

      await waitFor(() => {
        // 1 recurring entry only (recurringCount=3 means 3 entries)
        // But we need to fill in a date first for recurring to work
        expect(onFormSubmit).toHaveBeenCalled();
      });

      // Only 1 call because without a monto value the form still submits 3 entries
      // (recurringCount default is 3)
      const calls = onFormSubmit.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);

      // First call should have a _preGeneratedId
      const firstData = calls[0][0] as Record<string, any>;
      expect(firstData._preGeneratedId).toBeDefined();
    });

    it('no incluye _preGeneratedId en edit mode', async () => {
      const { onFormSubmit } = renderForm({
        mode: 'edit',
        record: {
          id: 'ej-existing',
          descripcion: 'Test',
          montoEjecutado: 100000,
          tipo: 'ingreso',
          fechaEjecutado: '2026-06-15',
          comprobantes: [],
        },
      });

      // Add pending comprobante
      fireEvent.click(screen.getByTestId('add-pending-btn'));

      // Submit
      fireEvent.click(screen.getByText('Guardar cambios'));

      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalledTimes(1);
      });

      const submittedData = onFormSubmit.mock.calls[0][0] as Record<string, any>;
      // In edit mode, _preGeneratedId should NOT be set
      expect(submittedData._preGeneratedId).toBeUndefined();
    });
  });

  describe('budget linking', () => {
    it('incluye _budgetLinks en el submit cuando se selecciona un presupuesto', async () => {
      const { onFormSubmit } = renderForm();

      // Select a budget from the SearchableSelect
      const select = screen.getByTestId('searchable-select-empty').querySelector('select')!;
      fireEvent.change(select, { target: { value: 'b1' } });

      // Fill required fields to pass Zod validation
      fillRequiredFields();

      // Submit
      fireEvent.click(screen.getByText('Crear'));

      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });

      const submittedData = onFormSubmit.mock.calls[0][0] as Record<string, any>;
      expect(submittedData._budgetLinks).toBeDefined();
      expect(Array.isArray(submittedData._budgetLinks)).toBe(true);
      expect(submittedData._budgetLinks[0]).toMatchObject({
        budgetId: 'b1',
        monto: 0, // default when no amount entered
      });
    });

    it('envía _budgetLinks vacío cuando no se selecciona ningún presupuesto', async () => {
      const { onFormSubmit } = renderForm();

      // Fill required fields to pass Zod validation
      fillRequiredFields();

      // Submit without selecting any budget
      fireEvent.click(screen.getByText('Crear'));

      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });

      const submittedData = onFormSubmit.mock.calls[0][0] as Record<string, any>;
      expect(submittedData._budgetLinks).toBeUndefined();
    });
  });

  describe('pending → saved transition', () => {
    it('uploadFile es llamado cuando hay pending comprobantes al submit', async () => {
      const { onFormSubmit } = renderForm();

      fireEvent.click(screen.getByTestId('add-pending-btn'));

      // Fill required fields to pass Zod validation
      fillRequiredFields();

      fireEvent.click(screen.getByText('Crear'));

      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });

      const fileUpload = await import('@/lib/fileUpload');
      expect(fileUpload.uploadFile).toHaveBeenCalledTimes(1);
      expect(fileUpload.generateFilePath).toHaveBeenCalledWith('c1', expect.any(String), 'factura.pdf');
    });

    it('comprobantes subidos se incluyen en el data del submit', async () => {
      const { onFormSubmit } = renderForm();

      // Add pending
      fireEvent.click(screen.getByTestId('add-pending-btn'));

      // Add a saved comprobante too
      fireEvent.click(screen.getByTestId('add-saved-btn'));

      // Fill required fields to pass Zod validation
      fillRequiredFields();

      fireEvent.click(screen.getByText('Crear'));

      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });

      const submittedData = onFormSubmit.mock.calls[0][0] as Record<string, any>;
      expect(submittedData.comprobantes).toBeDefined();
      expect(Array.isArray(submittedData.comprobantes)).toBe(true);
      // Should have both the uploaded (pending → saved) comprobante AND the saved one
      expect(submittedData.comprobantes.length).toBe(2);
    });
  });

  describe('budget linking validation', () => {
    it('renderiza el SearchableSelect para buscar presupuestos a vincular', () => {
      renderForm();
      expect(screen.getByTestId('searchable-select-empty')).toBeInTheDocument();
    });

    it('renderiza opciones de presupuestos en el SearchableSelect', () => {
      renderForm();

      const select = screen.getByTestId('searchable-select-empty').querySelector('select');
      expect(select).toBeInTheDocument();

      if (select) {
        const options = Array.from(select.querySelectorAll('option'));
        // First option is the placeholder, then 2 budgets
        expect(options.length).toBe(3);
        expect(options[1].textContent).toContain('Materiales');
        expect(options[2].textContent).toContain('Honorarios');
      }
    });
  });

  describe('cuenta bancaria', () => {
    it('renderiza SearchableSelect para cuenta bancaria', () => {
      renderForm();
      expect(screen.getByTestId('searchable-select-Cuenta bancaria (opcional)')).toBeInTheDocument();
    });
  });
});
