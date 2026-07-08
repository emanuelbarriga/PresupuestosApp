import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MovimientoBancarioInput } from '@/lib/types';

// Mock ALL dependencies — parsePipeline.ts imports firestore even though
// parseForPreview doesn't use it, so we need the firestore mock too.
vi.mock('@/lib/firestore', () => ({
  updateExtractoStatus: vi.fn(),
  batchAddMovimientos: vi.fn(),
  fetchMovimientoHashes: vi.fn(),
}));

vi.mock('@/lib/parsers/pdfText', () => ({
  extractPdfTextFromBuffer: vi.fn(),
}));

vi.mock('@/lib/parsers/index', () => ({
  detectarBanco: vi.fn(),
  getParser: vi.fn(),
}));

vi.mock('@/lib/parsers/reconciliador', () => ({
  reconciliar: vi.fn(),
}));

vi.mock('@/lib/parsers/periodo', () => ({
  derivarMesAnio: vi.fn(),
}));

import { parseForPreview } from '@/lib/parsers/parsePipeline';
import { extractPdfTextFromBuffer } from '@/lib/parsers/pdfText';
import { detectarBanco, getParser } from '@/lib/parsers/index';
import { reconciliar } from '@/lib/parsers/reconciliador';
import { derivarMesAnio } from '@/lib/parsers/periodo';

describe('parseForPreview', () => {
  const mockBuffer = new ArrayBuffer(10);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract, detect, parse, and reconcile without persisting', async () => {
    // Mock PDF text extraction
    vi.mocked(extractPdfTextFromBuffer).mockResolvedValue('bancolombia.com extracto bancario');

    // Mock bank detection
    vi.mocked(detectarBanco).mockReturnValue('Bancolombia');

    // Mock parser
    const mockMovimientos: MovimientoBancarioInput[] = [
      { fecha: '2026-01-15', descripcion: 'Pago servicio', debito: 500000, saldo: 500000, moneda: 'COP', ordinal: 1, bancoOrigen: 'Bancolombia' },
      { fecha: '2026-01-20', descripcion: 'Depósito', credito: 1000000, saldo: 1500000, moneda: 'COP', ordinal: 2, bancoOrigen: 'Bancolombia' },
    ];
    const mockParseResult = {
      movimientos: mockMovimientos,
      context: { banco: 'Bancolombia' as const, saldoInicial: 1000000, saldoFinal: 1500000, periodoDesde: '2026-01-01', periodoHasta: '2026-01-31' },
    };
    vi.mocked(getParser).mockReturnValue({ banco: 'Bancolombia', parse: vi.fn().mockReturnValue(mockParseResult) });

    // Mock reconcile
    vi.mocked(reconciliar).mockImplementation((movs) => movs);

    // Mock derivarMesAnio
    vi.mocked(derivarMesAnio).mockReturnValue({ mes: 'Enero', anio: 2026 });

    const result = await parseForPreview(mockBuffer);

    // Verify non-persisting pipeline steps
    expect(extractPdfTextFromBuffer).toHaveBeenCalledWith(mockBuffer, undefined, 'row-layout');
    expect(detectarBanco).toHaveBeenCalledWith('bancolombia.com extracto bancario');
    expect(getParser).toHaveBeenCalledWith('Bancolombia');
    expect(reconciliar).toHaveBeenCalledWith(mockMovimientos, 1000000);
    expect(derivarMesAnio).toHaveBeenCalledWith('2026-01-31');

    // Verify result
    expect(result.movimientos).toHaveLength(2);
    expect(result.detectedBanco).toBe('Bancolombia');
    expect(result.header.mes).toBe('Enero');
    expect(result.header.anio).toBe(2026);
    expect(result.header.banco).toBe('Bancolombia');
    expect(result.header.saldoInicial).toBe(1000000);
    expect(result.header.saldoFinal).toBe(1500000);
  });

  it('should use bancoConfirmado when provided instead of detecting', async () => {
    vi.mocked(extractPdfTextFromBuffer).mockResolvedValue('some bank text');
    vi.mocked(getParser).mockReturnValue({
      banco: 'Bancoomeva',
      parse: vi.fn().mockReturnValue({
        movimientos: [],
        context: { banco: 'Bancoomeva' as const, saldoInicial: 0, saldoFinal: 0 },
      }),
    });
    vi.mocked(reconciliar).mockImplementation((movs) => movs);
    vi.mocked(derivarMesAnio).mockReturnValue({ mes: '', anio: null });

    await parseForPreview(mockBuffer, 'Bancoomeva');

    expect(detectarBanco).not.toHaveBeenCalled();
    expect(getParser).toHaveBeenCalledWith('Bancoomeva');
  });

  it('should throw when bank is No detectado and no confirmation', async () => {
    vi.mocked(extractPdfTextFromBuffer).mockResolvedValue('unknown bank text');
    vi.mocked(detectarBanco).mockReturnValue('No detectado');

    await expect(parseForPreview(mockBuffer)).rejects.toThrow('Banco no reconocido');
  });

  it('should fall back to periodoHasta and default year when periodo is missing', async () => {
    vi.mocked(extractPdfTextFromBuffer).mockResolvedValue('bancolombia.com');
    vi.mocked(detectarBanco).mockReturnValue('Bancolombia');
    vi.mocked(getParser).mockReturnValue({
      banco: 'Bancolombia',
      parse: vi.fn().mockReturnValue({
        movimientos: [],
        context: { banco: 'Bancolombia' as const, saldoInicial: 500000, saldoFinal: 600000 },
      }),
    });
    vi.mocked(reconciliar).mockImplementation((movs) => movs);
    vi.mocked(derivarMesAnio).mockReturnValue({ mes: '', anio: null });

    const result = await parseForPreview(mockBuffer, 'Bancolombia');

    expect(result.header.mes).toBe('Enero');
    expect(result.header.anio).toBeGreaterThan(2020);
    expect(result.header.saldoInicial).toBe(500000);
    expect(result.header.saldoFinal).toBe(600000);
  });

  it('should not call any Firestore functions (no persistence)', async () => {
    vi.mocked(extractPdfTextFromBuffer).mockResolvedValue('bancolombia.com');
    vi.mocked(detectarBanco).mockReturnValue('Bancolombia');
    vi.mocked(getParser).mockReturnValue({
      banco: 'Bancolombia',
      parse: vi.fn().mockReturnValue({
        movimientos: [],
        context: { banco: 'Bancolombia' as const, saldoInicial: 0, saldoFinal: 0 },
      }),
    });
    vi.mocked(reconciliar).mockImplementation((movs) => movs);
    vi.mocked(derivarMesAnio).mockReturnValue({ mes: 'Enero', anio: 2026 });

    await parseForPreview(mockBuffer, 'Bancolombia');

    // No Firestore functions should be called (parseForPreview is non-persisting)
    const { updateExtractoStatus, batchAddMovimientos, fetchMovimientoHashes } = await import('@/lib/firestore');
    expect(updateExtractoStatus).not.toHaveBeenCalled();
    expect(batchAddMovimientos).not.toHaveBeenCalled();
    expect(fetchMovimientoHashes).not.toHaveBeenCalled();
  });
});
