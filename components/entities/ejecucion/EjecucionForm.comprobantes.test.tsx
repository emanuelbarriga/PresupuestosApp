import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import type { Budget } from '@/lib/types';
import { EjecucionForm } from './EjecucionForm';

// ─── Mock file upload ────────────────────────────────────────────────────

vi.mock('@/lib/fileUpload', () => ({
  generateMediaFilePath: vi.fn((_cId: string, fileName: string) => `c1/documentos/uuid-${fileName}`),
  validateFile: vi.fn().mockReturnValue({ valid: true }),
  uploadFileWithTask: vi.fn().mockReturnValue({
    promise: Promise.resolve({ url: 'https://mock-url.com/file.pdf', path: 'c1/documentos/file.pdf' }),
    task: { cancel: vi.fn(), on: vi.fn() },
  }),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/mediaService', () => ({
  createDocumento: vi.fn().mockResolvedValue('new-doc-id'),
}));

vi.mock('@/lib/mediaLinking', () => ({
  linkDocumentoToEntities: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock firestore ──────────────────────────────────────────────────────

vi.mock('@/lib/firestore', () => ({
  addClient: vi.fn().mockResolvedValue('new-client-id'),
  addProject: vi.fn().mockResolvedValue('new-project-id'),
}));

// ─── Mock components ─────────────────────────────────────────────────────

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
  MultiSearchableSelect: ({ label, values, onChange, options, placeholder }: any) => (
    <div data-testid={`multi-searchable-select-${label || 'empty'}`}>
      <span>Selected: {values.join(',')}</span>
      <select onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val && !values.includes(val)) onChange([...values, val]);
      }}>
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
  ComprobanteUploader: ({ onUploadComplete, comprobantes, onComprobantesChange, ejecucionId }: any) => {
    const [docs, setDocs] = React.useState<{ id: string; name: string; url: string; path: string; type: string; size: number; uploadedAt: string }[]>([]);
    return (
      <div data-testid="comprobante-uploader">
        <span data-testid="uploader-ejecucion-id">{ejecucionId || 'no-id'}</span>
        <span data-testid="uploader-saved-count">{comprobantes.length}</span>
        <span data-testid="uploader-uploaded-count">{docs.length}</span>
        <button data-testid="upload-file-btn" onClick={async () => {
          const docId = `uploaded-doc-${Date.now()}`;
          setDocs(prev => [...prev, { id: docId, name: 'factura.pdf', url: 'https://example.com/doc.pdf', path: 'c1/documentos/doc.pdf', type: 'application/pdf', size: 1000, uploadedAt: new Date().toISOString() }]);
          onUploadComplete?.(docId);
        }}>Simular Subida</button>
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
    );
  },
}));

// ─── Test data ───────────────────────────────────────────────────────────

const mockBudgets: Budget[] = [
  { id: 'b1', descripcion: 'Honorarios', projectId: 'p1', projectName: 'Proyecto A', entityId: '', entityName: '', entityType: 'client', tipo: 'ingreso', montoPresupuestado: 1000000, mesPresupuestado: 'Enero', fechaPresupuestado: '2026-01', estadoProyecto: 'Activo' },
  { id: 'b2', descripcion: 'Materiales', projectId: 'p1', projectName: 'Proyecto A', entityId: '', entityName: '', entityType: 'client', tipo: 'ingreso', montoPresupuestado: 500000, mesPresupuestado: 'Enero', fechaPresupuestado: '2026-01', estadoProyecto: 'Activo' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────

function fillRequiredFields() {
  const descInput = screen.getByTestId('form-input-Descripción').querySelector('input');
  if (descInput) {
    fireEvent.change(descInput, { target: { value: 'Test desc' } });
  }
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

// ─── Tests ───────────────────────────────────────────────────────────────

describe('EjecucionForm — media refactor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('document upload tracking', () => {
    it('llama a linkDocumentoToEntities después del submit exitoso cuando hay documentos subidos', async () => {
      const { onFormSubmit } = renderForm();

      // Simulate upload
      fireEvent.click(screen.getByTestId('upload-file-btn'));

      fillRequiredFields();

      // Submit
      fireEvent.click(screen.getByText('Crear'));

      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });

      const linkModule = await import('@/lib/mediaLinking');
      expect(linkModule.linkDocumentoToEntities).toHaveBeenCalled();
    });

    it('NO llama a linkDocumentoToEntities cuando no hay documentos subidos', async () => {
      const { onFormSubmit } = renderForm();

      fillRequiredFields();

      fireEvent.click(screen.getByText('Crear'));

      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });

      const linkModule = await import('@/lib/mediaLinking');
      expect(linkModule.linkDocumentoToEntities).not.toHaveBeenCalled();
    });

    it('incluye _preGeneratedId y NO comprobantes en el submit data', async () => {
      const { onFormSubmit } = renderForm();

      fireEvent.click(screen.getByTestId('upload-file-btn'));
      fillRequiredFields();

      fireEvent.click(screen.getByText('Crear'));

      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });

      const submittedData = onFormSubmit.mock.calls[0][0] as Record<string, any>;
      // _preGeneratedId should be set for add mode
      expect(submittedData._preGeneratedId).toBeDefined();
      // comprobantes should NOT be in the payload (deprecated)
      expect(submittedData.comprobantes).toBeUndefined();
    });
  });

  describe('budget linking', () => {
    it('incluye _budgetLinks en el submit cuando se selecciona un presupuesto', async () => {
      const { onFormSubmit } = renderForm();

      const select = screen.getByTestId('searchable-select-empty').querySelector('select')!;
      fireEvent.change(select, { target: { value: 'b1' } });

      fillRequiredFields();

      fireEvent.click(screen.getByText('Crear'));

      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });

      const submittedData = onFormSubmit.mock.calls[0][0] as Record<string, any>;
      expect(submittedData._budgetLinks).toBeDefined();
      expect(Array.isArray(submittedData._budgetLinks)).toBe(true);
      expect(submittedData._budgetLinks[0]).toMatchObject({
        budgetId: 'b1',
        monto: 0,
      });
    });
  });

  describe('cuenta bancaria', () => {
    it('renderiza SearchableSelect para cuenta bancaria', () => {
      renderForm();
      expect(screen.getByTestId('searchable-select-Cuenta bancaria (opcional)')).toBeInTheDocument();
    });
  });
});
