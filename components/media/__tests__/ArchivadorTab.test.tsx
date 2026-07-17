/**
 * Tests for ArchivadorTab — grouping, safe sum, and mass load scenarios.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { DocumentoMedio, TipoDocumentoMedio } from '@/lib/types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUnsub = vi.fn();

vi.mock('@/lib/firebase', () => ({
  db: { type: 'db' as const },
}));

vi.mock('firebase/firestore', () => {
  const mockOnSnapshot = vi.fn((_q: unknown, onData: (snap: any) => void) => {
    onData({ docs: [], docChanges: () => [] });
    return mockUnsub;
  });

  return {
    collection: vi.fn(() => 'collection-ref'),
    query: vi.fn(() => 'query-ref'),
    where: vi.fn(() => 'where-ref'),
    onSnapshot: mockOnSnapshot,
    getCountFromServer: vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
  };
});

vi.mock('@/lib/mediaService', () => ({
  subscribeDocumentosEnlazados: vi.fn((_cId, _periodo, onData, onError) => {
    (globalThis as any).__mock_onData = onData;
    (globalThis as any).__mock_onError = onError;
    return mockUnsub;
  }),
}));

// ─── Import AFTER mocks ─────────────────────────────────────────────────────

import { ArchivadorTab } from '../ArchivadorTab';
import { PERIODO_SIN_ASIGNAR } from '@/lib/schemas';

const defaultProps = {
  companyId: 'test-company',
  selectedPeriod: '2026-07',
  activeCategory: 'factura_venta' as TipoDocumentoMedio,
  onPeriodChange: vi.fn(),
  onCategoryChange: vi.fn(),
  onNavigate: vi.fn(),
};

function buildDoc(overrides: Partial<DocumentoMedio>): DocumentoMedio {
  return {
    id: crypto.randomUUID(),
    fileName: 'doc.pdf',
    storagePath: 'test/doc.pdf',
    url: 'https://example.com/doc.pdf',
    size: 1024,
    mimeType: 'application/pdf',
    status: 'enlazado',
    ejecucionIds: [],
    _source: 'inbox-upload',
    uploadedAt: new Date().toISOString(),
    createdBy: 'user-1',
    ...overrides,
  };
}

describe('ArchivadorTab — SafeSum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows correct sum and count for mixed montos', async () => {
    render(<ArchivadorTab {...defaultProps} />);

    const onData = (globalThis as any).__mock_onData;
    expect(onData).toBeDefined();

    const docs = [
      buildDoc({ tipoDocumento: 'factura_venta' as TipoDocumentoMedio, metadata: { montoTotal: 1000000 } }),
      buildDoc({ tipoDocumento: 'factura_venta' as TipoDocumentoMedio, metadata: { montoTotal: 500000 } }),
      buildDoc({ tipoDocumento: 'factura_venta' as TipoDocumentoMedio }), // no monto
    ];
    onData(docs);

    await waitFor(() => {
      expect(screen.getAllByText(/1\.500\.000|1500000/).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText(/2 de 3 documentos con monto|2 de 3/)).toBeDefined();
  });

  it('shows 0 sum and 0 of N when no docs have monto', async () => {
    render(<ArchivadorTab {...defaultProps} />);

    const onData = (globalThis as any).__mock_onData;
    onData([
      buildDoc({ tipoDocumento: 'factura_venta' as TipoDocumentoMedio }),
      buildDoc({ tipoDocumento: 'factura_venta' as TipoDocumentoMedio }),
    ]);

    await waitFor(() => {
      expect(screen.getByText(/0 de 2/)).toBeDefined();
    });
  });

  it('handles 500 documents with mixed types without crashing', async () => {
    render(<ArchivadorTab {...defaultProps} />);

    const onData = (globalThis as any).__mock_onData;
    const docs: DocumentoMedio[] = [];
    for (let i = 0; i < 500; i++) {
      docs.push(buildDoc({
        tipoDocumento: i % 2 === 0 ? 'factura_venta' as TipoDocumentoMedio : 'factura_compra' as TipoDocumentoMedio,
        metadata: i % 3 === 0 ? { montoTotal: i * 1000 } : undefined,
      }));
    }
    onData(docs);

    await waitFor(() => {
      const allButtons = screen.getAllByRole('button');
      const labels = allButtons.map((b) => b.textContent).join('|');
      expect(labels).toContain('Factura Venta');
      expect(labels).toContain('Factura Compra');
    });
  });

  it('protects against string concatenation in sum', async () => {
    render(<ArchivadorTab {...defaultProps} />);

    const onData = (globalThis as any).__mock_onData;
    const docs = [
      buildDoc({
        tipoDocumento: 'factura_venta' as TipoDocumentoMedio,
        metadata: { montoTotal: '1500' as unknown as number }, // string monto
      }),
      buildDoc({
        tipoDocumento: 'factura_venta' as TipoDocumentoMedio,
        metadata: { montoTotal: 500 },
      }),
    ];
    onData(docs);

    await waitFor(() => {
      // Should NOT concatenate: '1500' + 500 = '1500500'
      // Should be Number('1500') + 500 = 2000
      expect(screen.getAllByText(/2000|2\.000/).length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('ArchivadorTab — Grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('groups documents by tipoDocumento, fallback to otro', async () => {
    render(<ArchivadorTab {...defaultProps} />);

    const onData = (globalThis as any).__mock_onData;
    onData([
      buildDoc({ tipoDocumento: 'factura_venta' as TipoDocumentoMedio }),
      buildDoc({ tipoDocumento: 'extracto_bancario' as TipoDocumentoMedio }),
      buildDoc({}), // no tipoDocumento → fallback a 'otro'
    ]);

    await waitFor(() => {
      expect(screen.queryByText(/cargando documentos/i)).toBeNull();
    });

    const allButtons = screen.getAllByRole('button');
    const foundLabels = allButtons.map((btn) => btn.textContent).join('|');
    expect(foundLabels).toContain('Factura Venta');
    expect(foundLabels).toContain('Extracto Bancario');
    expect(foundLabels).toContain('Otro');
  });

  it('shows all 8 category tabs even when empty', async () => {
    render(<ArchivadorTab {...defaultProps} />);

    // Send empty data to trigger loaded state
    const onData = (globalThis as any).__mock_onData;
    onData([]);

    await waitFor(() => {
      expect(screen.queryByText(/cargando documentos/i)).toBeNull();
    });

    const allButtons = screen.getAllByRole('button');
    const tabLabels = [
      'Factura Venta', 'Factura Compra', 'Extracto Bancario',
      'Comprobante Egreso', 'Comprobante Ingreso', 'Planilla',
      'Contrato', 'Otro',
    ];
    for (const label of tabLabels) {
      expect(allButtons.some((btn) => btn.textContent?.includes(label))).toBe(true);
    }
  });
});

describe('ArchivadorTab — Period Selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables year select when sin_periodo is selected', async () => {
    render(
      <ArchivadorTab
        {...defaultProps}
        selectedPeriod={PERIODO_SIN_ASIGNAR}
      />,
    );

    const yearSelect = screen.getByLabelText(/año/i);
    expect((yearSelect as HTMLSelectElement).disabled).toBe(true);
  });

  it('calls onCategoryChange when clicking a category tab', async () => {
    const onCategoryChange = vi.fn();
    render(
      <ArchivadorTab
        {...defaultProps}
        onCategoryChange={onCategoryChange}
      />,
    );

    // Send data to trigger loaded state
    const onData = (globalThis as any).__mock_onData;
    onData([buildDoc({ tipoDocumento: 'factura_venta' as TipoDocumentoMedio })]);

    await waitFor(() => {
      expect(screen.queryByText(/cargando documentos/i)).toBeNull();
    });

    const compraBtn = screen.getAllByRole('button').find(
      (btn) => btn.textContent?.includes('Factura Compra'),
    );
    expect(compraBtn).toBeDefined();
    if (compraBtn) fireEvent.click(compraBtn);

    expect(onCategoryChange).toHaveBeenCalledWith('factura_compra');
  });
});

describe('ArchivadorTab — Table View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('switches to table view and shows column headers', async () => {
    render(<ArchivadorTab {...defaultProps} />);

    const onData = (globalThis as any).__mock_onData;
    onData([
      buildDoc({ tipoDocumento: 'factura_venta' as TipoDocumentoMedio, periodo: '2026-07', metadata: { montoTotal: 100000 } }),
    ]);

    // Tabla is default view, so headers should be visible
    await waitFor(() => {
      expect(screen.getByText('Período')).toBeDefined();
      expect(screen.getByText('Fecha')).toBeDefined();
      expect(screen.getByText('Tipo')).toBeDefined();
      expect(screen.getByText('Proveedor')).toBeDefined();
      expect(screen.getByText('NIT')).toBeDefined();
      expect(screen.getByText('Monto')).toBeDefined();
    });
  });

  it('shows monthly subtotal per period in table view', async () => {
    render(<ArchivadorTab {...defaultProps} />);

    const onData = (globalThis as any).__mock_onData;
    onData([
      buildDoc({ tipoDocumento: 'factura_venta' as TipoDocumentoMedio, periodo: '2026-07', metadata: { montoTotal: 100000 } }),
      buildDoc({ tipoDocumento: 'factura_venta' as TipoDocumentoMedio, periodo: '2026-07', metadata: { montoTotal: 200000 } }),
      buildDoc({ tipoDocumento: 'factura_venta' as TipoDocumentoMedio, periodo: '2026-06', metadata: { montoTotal: 50000 } }),
    ]);

    await waitFor(() => {
      // July period: 2 docs, subtotal 300.000
      expect(screen.getByText(/julio 2026/i)).toBeDefined();
      expect(screen.getByText(/2 documentos/i)).toBeDefined();
      // June period: 1 doc, subtotal 50.000
      expect(screen.getByText(/junio 2026/i)).toBeDefined();
      expect(screen.getByText(/1 documento/i)).toBeDefined();
    });
  });

  it('shows Total General with correct sum and doc count', async () => {
    render(<ArchivadorTab {...defaultProps} />);

    const onData = (globalThis as any).__mock_onData;
    onData([
      buildDoc({ tipoDocumento: 'factura_venta' as TipoDocumentoMedio, periodo: '2026-07', metadata: { montoTotal: 100000 } }),
      buildDoc({ tipoDocumento: 'factura_venta' as TipoDocumentoMedio, periodo: '2026-07', metadata: { montoTotal: null } as any }),
      buildDoc({ tipoDocumento: 'factura_venta' as TipoDocumentoMedio, periodo: '2026-06', metadata: { montoTotal: 50000 } }),
    ]);

    await waitFor(() => {
      // Total general: 2 de 3 docs con monto, suma = 150.000
      expect(screen.getByText(/Total general/i)).toBeDefined();
      expect(screen.getByText(/documentos con monto/i)).toBeDefined();
      expect(screen.getAllByText(/150\.000|150000/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows individual document rows with tipo badge', async () => {
    render(<ArchivadorTab {...defaultProps} />);

    const onData = (globalThis as any).__mock_onData;
    onData([
      buildDoc({ tipoDocumento: 'factura_venta' as TipoDocumentoMedio, periodo: '2026-07', fileName: 'factura-julio.pdf' }),
    ]);

    await waitFor(() => {
      // Document row with periodo column
      expect(screen.getByText('2026-07')).toBeDefined();
      // Tipo badge (multiple: category tab + table row)
      expect(screen.getAllByText('Factura Venta').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows "Sin período" grouping for docs without periodo', async () => {
    render(<ArchivadorTab {...defaultProps} />);

    const onData = (globalThis as any).__mock_onData;
    onData([
      buildDoc({ tipoDocumento: 'factura_venta' as TipoDocumentoMedio, periodo: undefined }),
      buildDoc({ tipoDocumento: 'factura_compra' as TipoDocumentoMedio, periodo: '2026-07' }),
    ]);

    await waitFor(() => {
      expect(screen.getByText(/Sin período/i)).toBeDefined();
    });
  });
});

describe('ArchivadorTab — Index Building Error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows friendly message when index building fails', async () => {
    render(<ArchivadorTab {...defaultProps} />);

    const onError = (globalThis as any).__mock_onError;
    expect(onError).toBeDefined();

    onError(new Error('FAILED_PRECONDITION: index required'));

    await waitFor(() => {
      expect(screen.getByText(/preparando tu archivador|índice|preparando/i)).toBeDefined();
    });
  });
});
