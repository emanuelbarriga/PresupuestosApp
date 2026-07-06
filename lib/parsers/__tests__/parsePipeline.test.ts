import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MovimientoBancarioInput } from '@/lib/types';

// Mock dependencies
vi.mock('@/lib/parsers/index', () => ({
  detectarBanco: vi.fn(),
  getParser: vi.fn(),
}));

vi.mock('@/lib/parsers/reconciliador', () => ({
  reconciliar: vi.fn(),
}));

vi.mock('@/lib/parsers/detectordup', () => ({
  detectarDuplicados: vi.fn(),
}));

vi.mock('@/lib/firestore', () => ({
  updateExtractoStatus: vi.fn(),
  batchAddMovimientos: vi.fn(),
  fetchMovimientoHashes: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
}));

vi.mock('@/lib/types', () => ({}));

// We need to mock pdfjs-dist too
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}));

import { runParsePipelineFromBuffer } from '@/lib/parsers/parsePipeline';
import { detectarBanco, getParser } from '@/lib/parsers/index';
import { reconciliar } from '@/lib/parsers/reconciliador';
import { detectarDuplicados } from '@/lib/parsers/detectordup';
import { updateExtractoStatus, batchAddMovimientos, fetchMovimientoHashes } from '@/lib/firestore';

describe('runParsePipeline', () => {
  const companyId = 'company-1';
  const accountId = 'account-1';
  const extractoId = 'extracto-1';
  const pdfUrl = 'https://example.com/extracto.pdf';
  const mockBuffer = new ArrayBuffer(10);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully parse a PDF and save movements', async () => {
    // Mock PDF text extraction
    const mockGetDocument = vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({
            items: [
              { str: 'EXTRACTO BANCARIO' },
              { str: 'bancolombia.com' },
              { str: 'SALDO ANTERIOR' },
              { str: '1,000,000.00' },
            ],
          }),
        }),
      }),
    });
    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    (pdfjsModule.getDocument as any).mockImplementation(mockGetDocument);

    // Mock bank detection
    vi.mocked(detectarBanco).mockReturnValue('Bancolombia');

    // Mock parser
    const mockMovimientos: MovimientoBancarioInput[] = [
      { fecha: '2026-01-15', descripcion: 'Pago servicio', debito: 500000, saldo: 500000, moneda: 'COP', ordinal: 1, bancoOrigen: 'Bancolombia' },
      { fecha: '2026-01-20', descripcion: 'Depósito', credito: 1000000, saldo: 1500000, moneda: 'COP', ordinal: 2, bancoOrigen: 'Bancolombia' },
    ];
    const mockParseResult = { movimientos: mockMovimientos, context: { banco: 'Bancolombia' as const, saldoInicial: 1000000, saldoFinal: 1500000 } };
    vi.mocked(getParser).mockReturnValue({ banco: 'Bancolombia', parse: vi.fn().mockReturnValue(mockParseResult) });

    // Mock reconcile
    vi.mocked(reconciliar).mockImplementation((movs) => movs);

    // Mock hash detection
    vi.mocked(fetchMovimientoHashes).mockResolvedValue([]);

    // Mock dedup
    vi.mocked(detectarDuplicados).mockImplementation(async (movs) =>
      movs.map(m => ({ ...m, posibleDuplicado: undefined }))
    );

    // Mock batch write
    vi.mocked(batchAddMovimientos).mockResolvedValue(['id-1', 'id-2']);

    const result = await runParsePipelineFromBuffer(companyId, accountId, extractoId, mockBuffer, 'Bancolombia');

    expect(result.success).toBe(true);
    expect(result.totalMovimientos).toBe(2);
    expect(result.errores).toHaveLength(0);

    // Verify pipeline steps
    expect(updateExtractoStatus).toHaveBeenCalledWith(companyId, accountId, extractoId, 'Parseando');
    // detectarBanco should NOT be called when bancoConfirmado is provided
    expect(detectarBanco).not.toHaveBeenCalled();
    expect(getParser).toHaveBeenCalledWith('Bancolombia');
    expect(reconciliar).toHaveBeenCalledWith(mockMovimientos, 1000000);
    expect(fetchMovimientoHashes).toHaveBeenCalledWith(companyId, accountId, extractoId);
    expect(detectarDuplicados).toHaveBeenCalled();
    expect(batchAddMovimientos).toHaveBeenCalledWith(companyId, accountId, extractoId, expect.any(Array));
    expect(updateExtractoStatus).toHaveBeenLastCalledWith(
      companyId, accountId, extractoId, 'Completado',
      expect.objectContaining({ totalMovimientosParseados: 2 }),
    );
  });

  it('should detect bank when bancoConfirmado is null', async () => {
    const mockGetDocument = vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'bancolombia.com' }] }),
        }),
      }),
    });
    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    (pdfjsModule.getDocument as any).mockImplementation(mockGetDocument);

    vi.mocked(detectarBanco).mockReturnValue('Bancolombia');
    vi.mocked(getParser).mockReturnValue({ banco: 'Bancolombia', parse: vi.fn().mockReturnValue({ movimientos: [], context: { banco: 'Bancolombia', saldoInicial: 0, saldoFinal: 0 } }) });
    vi.mocked(reconciliar).mockImplementation((movs) => movs);
    vi.mocked(fetchMovimientoHashes).mockResolvedValue([]);
    vi.mocked(detectarDuplicados).mockImplementation(async (movs) => movs);
    vi.mocked(batchAddMovimientos).mockResolvedValue([]);

    const result = await runParsePipelineFromBuffer(companyId, accountId, extractoId, mockBuffer, null);

    expect(result.success).toBe(true);
    expect(detectarBanco).toHaveBeenCalled();
  });

  it('should return error when bank is NoDetectado and no confirmation', async () => {
    const mockGetDocument = vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'Unknown bank statement' }] }),
        }),
      }),
    });
    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    (pdfjsModule.getDocument as any).mockImplementation(mockGetDocument);

    vi.mocked(detectarBanco).mockReturnValue('No detectado');

    const result = await runParsePipelineFromBuffer(companyId, accountId, extractoId, mockBuffer, null);

    expect(result.success).toBe(false);
    expect(result.errores).toContain('Banco no reconocido');
    expect(updateExtractoStatus).toHaveBeenLastCalledWith(companyId, accountId, extractoId, 'Error de parseo', { errorParseo: 'Banco no reconocido' });
  });

  it('should handle corrupt PDF gracefully', async () => {
    const mockGetDocument = vi.fn().mockReturnValue({
      promise: Promise.reject(new Error('PDF parsing failed: Invalid PDF structure')),
    });
    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    (pdfjsModule.getDocument as any).mockImplementation(mockGetDocument);

    const result = await runParsePipelineFromBuffer(companyId, accountId, extractoId, mockBuffer, 'Bancolombia');

    expect(result.success).toBe(false);
    expect(result.errores).toHaveLength(1);
    expect(result.errores[0]).toContain('PDF');
    expect(updateExtractoStatus).toHaveBeenLastCalledWith(companyId, accountId, extractoId, 'Error de parseo', expect.objectContaining({ errorParseo: expect.stringContaining('PDF') }));
  });

  it('should chunk movements into batches of 500', async () => {
    const manyMovs: MovimientoBancarioInput[] = Array.from({ length: 750 }, (_, i) => ({
      fecha: '2026-01-01',
      descripcion: `Mov ${i + 1}`,
      debito: 1000,
      saldo: 1000 - i * 1000,
      moneda: 'COP',
      ordinal: i + 1,
      bancoOrigen: 'Bancolombia' as const,
    }));

    const mockGetDocument = vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'bancolombia.com' }, { str: 'SALDO ANTERIOR' }, { str: '1,000,000.00' }] }),
        }),
      }),
    });
    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    (pdfjsModule.getDocument as any).mockImplementation(mockGetDocument);

    vi.mocked(detectarBanco).mockReturnValue('Bancolombia');
    vi.mocked(getParser).mockReturnValue({
      banco: 'Bancolombia',
      parse: vi.fn().mockReturnValue({ movimientos: manyMovs, context: { banco: 'Bancolombia', saldoInicial: 1000000, saldoFinal: 0 } }),
    });
    vi.mocked(reconciliar).mockImplementation((movs) => movs);
    vi.mocked(fetchMovimientoHashes).mockResolvedValue([]);
    vi.mocked(detectarDuplicados).mockImplementation(async (movs) => movs);
    vi.mocked(batchAddMovimientos).mockResolvedValue([]);

    const result = await runParsePipelineFromBuffer(companyId, accountId, extractoId, mockBuffer, 'Bancolombia');

    expect(result.success).toBe(true);
    expect(result.totalMovimientos).toBe(750);
    // Should be called twice: batch 1 (500) + batch 2 (250)
    expect(batchAddMovimientos).toHaveBeenCalledTimes(2);
  });

  it('should report requiereRevision count in result', async () => {
    const mockMovimientos: MovimientoBancarioInput[] = [
      { fecha: '2026-01-15', descripcion: 'OK', debito: 500000, saldo: 500000, moneda: 'COP', ordinal: 1, bancoOrigen: 'Bancolombia' },
      { fecha: '2026-01-20', descripcion: 'REVISA', debito: 300000, saldo: 200001, moneda: 'COP', ordinal: 2, bancoOrigen: 'Bancolombia', requiereRevision: true },
    ];

    const mockGetDocument = vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'bancolombia.com' }, { str: 'SALDO ANTERIOR' }, { str: '1,000,000.00' }] }),
        }),
      }),
    });
    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    (pdfjsModule.getDocument as any).mockImplementation(mockGetDocument);

    vi.mocked(detectarBanco).mockReturnValue('Bancolombia');
    vi.mocked(getParser).mockReturnValue({
      banco: 'Bancolombia',
      parse: vi.fn().mockReturnValue({ movimientos: mockMovimientos, context: { banco: 'Bancolombia', saldoInicial: 1000000, saldoFinal: 200001 } }),
    });
    vi.mocked(reconciliar).mockImplementation((movs) => movs);
    vi.mocked(fetchMovimientoHashes).mockResolvedValue([]);
    vi.mocked(detectarDuplicados).mockImplementation(async (movs) =>
      movs.map(m => m.requiereRevision ? m : { ...m, posibleDuplicado: undefined })
    );
    vi.mocked(batchAddMovimientos).mockResolvedValue(['id-1', 'id-2']);

    const result = await runParsePipelineFromBuffer(companyId, accountId, extractoId, mockBuffer, 'Bancolombia');

    expect(result.success).toBe(true);
    expect(result.requiereRevision).toBe(1);
  });
});
