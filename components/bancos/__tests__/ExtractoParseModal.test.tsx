import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { ExtractoParseModal } from '@/components/bancos/ExtractoParseModal';
import type { MovimientoBancarioInput } from '@/lib/types';

// ─── Mock PdfViewer + react-pdf ───────────────────────────────────────────

vi.mock('react-pdf', () => ({
  Document: ({ children, file }: any) => {
    if (!file) return null;
    return <div data-testid="pdf-document">{children}</div>;
  },
  Page: ({ pageNumber }: any) => <div data-testid={`pdf-page-${pageNumber}`} />,
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
}));

vi.mock('react-pdf/dist/Page/AnnotationLayer.css', () => ({}));
vi.mock('react-pdf/dist/Page/TextLayer.css', () => ({}));

function makeFile(name = 'extracto.pdf'): File {
  return new File(['%PDF-1.4 fake content'], name, { type: 'application/pdf' });
}

function makeMovs(): MovimientoBancarioInput[] {
  return [
    { fecha: '2026-01-15', descripcion: 'Pago servicio', debito: 500000, saldo: 500000, moneda: 'COP', ordinal: 1, bancoOrigen: 'Bancolombia' },
    { fecha: '2026-01-20', descripcion: 'Depósito nómina', credito: 1000000, saldo: 1500000, moneda: 'COP', ordinal: 2, bancoOrigen: 'Bancolombia' },
  ];
}

const baseHeader = {
  mes: 'Enero' as const,
  anio: 2026,
  banco: 'Bancolombia' as const,
  saldoInicial: 1000000,
  saldoFinal: 1500000,
};

describe('ExtractoParseModal', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('does not render when open is false', () => {
    render(
      <ExtractoParseModal
        open={false}
        file={null}
        header={null}
        movimientos={[]}
        loading={false}
        progress={null}
        error={null}
        onBancoChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByText('Confirmar extracto')).not.toBeInTheDocument();
  });

  it('shows extraction progress label while loading (stage=extrayendo)', () => {
    render(
      <ExtractoParseModal
        open={true}
        file={makeFile()}
        header={null}
        movimientos={[]}
        loading={true}
        progress={{ stage: 'extrayendo', current: 3, total: 12 }}
        error={null}
        onBancoChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Procesando 3 de 12 páginas')).toBeInTheDocument();
  });

  it('shows reconciliation progress label while loading (stage=reconciliando)', () => {
    render(
      <ExtractoParseModal
        open={true}
        file={makeFile()}
        header={null}
        movimientos={[]}
        loading={true}
        progress={{ stage: 'reconciliando', current: 5, total: 20 }}
        error={null}
        onBancoChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Reconciliando movimiento 5 de 20')).toBeInTheDocument();
  });

  it('renders header fields and movimientos when not loading', () => {
    render(
      <ExtractoParseModal
        open={true}
        file={makeFile()}
        header={baseHeader}
        movimientos={makeMovs()}
        loading={false}
        progress={null}
        error={null}
        onBancoChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Bancolombia')).toBeInTheDocument();
    expect(screen.getByText('Enero')).toBeInTheDocument();
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.getByText('Pago servicio')).toBeInTheDocument();
    expect(screen.getByText('Depósito nómina')).toBeInTheDocument();
  });

  it('renders a PDF preview via PdfViewer using URL.createObjectURL(file)', () => {
    const file = makeFile();
    render(
      <ExtractoParseModal
        open={true}
        file={file}
        header={baseHeader}
        movimientos={makeMovs()}
        loading={false}
        progress={null}
        error={null}
        onBancoChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // NOTE: uses reference equality (`toBe`), not `toHaveBeenCalledWith`.
    // Deep-equality checks against a real jsdom `File` instance trigger an
    // unrelated jsdom internal error ("SecurityError: localStorage is not
    // available for opaque origins") when the diff engine inspects it.
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(createObjectURLSpy.mock.calls[0][0]).toBe(file);
    // PdfViewer renders a Document from react-pdf, not an iframe
    expect(screen.queryByTitle('Vista previa del PDF')).not.toBeInTheDocument();
  });

  it('revokes the object URL on unmount', () => {
    const { unmount } = render(
      <ExtractoParseModal
        open={true}
        file={makeFile()}
        header={baseHeader}
        movimientos={makeMovs()}
        loading={false}
        progress={null}
        error={null}
        onBancoChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    unmount();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('clicking Corregir reveals editable inputs for header fields', () => {
    render(
      <ExtractoParseModal
        open={true}
        file={makeFile()}
        header={baseHeader}
        movimientos={makeMovs()}
        loading={false}
        progress={null}
        error={null}
        onBancoChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Corregir'));
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
  });

  it('changing the bank selector in Corregir mode calls onBancoChange', () => {
    const onBancoChange = vi.fn();
    render(
      <ExtractoParseModal
        open={true}
        file={makeFile()}
        header={baseHeader}
        movimientos={makeMovs()}
        loading={false}
        progress={null}
        error={null}
        onBancoChange={onBancoChange}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Corregir'));
    const selects = screen.getAllByRole('combobox');
    // The first select is the banco selector
    fireEvent.change(selects[0], { target: { value: 'Global66' } });
    expect(onBancoChange).toHaveBeenCalledWith('Global66');
  });

  it('clicking Guardar calls onSave with the current header data', () => {
    const onSave = vi.fn();
    render(
      <ExtractoParseModal
        open={true}
        file={makeFile()}
        header={baseHeader}
        movimientos={makeMovs()}
        loading={false}
        progress={null}
        error={null}
        onBancoChange={vi.fn()}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Guardar'));
    expect(onSave).toHaveBeenCalledWith(baseHeader);
  });

  it('clicking Cancelar calls onCancel', () => {
    const onCancel = vi.fn();
    render(
      <ExtractoParseModal
        open={true}
        file={makeFile()}
        header={baseHeader}
        movimientos={makeMovs()}
        loading={false}
        progress={null}
        error={null}
        onBancoChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables Guardar and shows the error message when error is set', () => {
    render(
      <ExtractoParseModal
        open={true}
        file={makeFile()}
        header={null}
        movimientos={[]}
        loading={false}
        progress={null}
        error="Banco no reconocido"
        onBancoChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Banco no reconocido')).toBeInTheDocument();
    expect(screen.getByText('Guardar')).toBeDisabled();
  });

  it('shows a banco selector without clicking Corregir when error is set and a header exists (manual fallback)', () => {
    const onBancoChange = vi.fn();
    render(
      <ExtractoParseModal
        open={true}
        file={makeFile()}
        header={{ ...baseHeader, banco: 'No detectado' }}
        movimientos={[]}
        loading={false}
        progress={null}
        error="No se pudo detectar el banco automáticamente."
        onBancoChange={onBancoChange}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Bancoomeva' } });
    expect(onBancoChange).toHaveBeenCalledWith('Bancoomeva');
  });
});
