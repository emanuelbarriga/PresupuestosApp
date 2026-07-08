import type { Banco, MovimientoBancarioInput } from '@/lib/types';
import { detectarBanco, getParser } from '@/lib/parsers/index';
import { reconciliar } from '@/lib/parsers/reconciliador';
import { detectarDuplicados } from '@/lib/parsers/detectordup';
import { extractPdfTextFromBuffer } from '@/lib/parsers/pdfText';
import { updateExtractoStatus, batchAddMovimientos, fetchMovimientoHashes } from '@/lib/firestore';

export interface PipelineResult {
  success: boolean;
  totalMovimientos: number;
  errores: string[];
  requiereRevision: number;
  duplicados: number;
}

const BATCH_SIZE = 500;
const MAX_RETRIES = 3;

/**
 * Retry a promise-returning function with exponential backoff.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries: number = MAX_RETRIES,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`${label}: max retries exceeded`);
}

/**
 * Run the full parse pipeline for a bank statement.
 *
 * @param buffer - PDF content as ArrayBuffer (from File or download)
 * @param rest - Firestore paths and options
 */
export async function runParsePipelineFromBuffer(
  companyId: string,
  accountId: string,
  extractoId: string,
  buffer: ArrayBuffer,
  bancoConfirmado: Banco | null,
): Promise<PipelineResult> {
  return _runPipeline(companyId, accountId, extractoId, bancoConfirmado, buffer);
}

async function _runPipeline(
  companyId: string,
  accountId: string,
  extractoId: string,
  bancoConfirmado: Banco | null,
  buffer: ArrayBuffer,
): Promise<PipelineResult> {
  const errores: string[] = [];

  try {
    // Step 1: Mark as parsing
    await withRetry(
      () => updateExtractoStatus(companyId, accountId, extractoId, 'Parseando'),
      'updateExtractoStatus(Parseando)',
    );

    // Step 2: Extract PDF text from the in-memory buffer (no network needed)
    let texto: string;
    try {
      // Usar row-layout (Y-grouping) para convertir páginas columnares
      // en texto fila-por-fila. Funciona para todos los bancos.
      texto = await extractPdfTextFromBuffer(buffer, undefined, 'row-layout');
    } catch (err) {
      const msg = `Error al leer el PDF: ${err instanceof Error ? err.message : 'Error desconocido'}`;
      throw new Error(msg);
    }

    // Step 3: Detect bank
    const banco = bancoConfirmado ?? detectarBanco(texto);
    if (banco === 'No detectado') {
      throw new Error('Banco no reconocido');
    }

    // Step 4: Parse
    const parser = getParser(banco);
    const parseResult = parser.parse(texto);

    // Step 5: Reconcile
    const movsReconciliados = reconciliar(
      parseResult.movimientos,
      parseResult.context.saldoInicial,
    );
    const revCount = movsReconciliados.filter(m => m.requiereRevision).length;

    // Step 6: Detect duplicates
    const hashesExistentes = await withRetry(
      () => fetchMovimientoHashes(companyId, accountId, extractoId),
      'fetchMovimientoHashes',
    );
    const movsFinales = await detectarDuplicados(movsReconciliados, hashesExistentes);
    const dupCount = movsFinales.filter(m => m.posibleDuplicado).length;

    // Step 7: Batch write (chunk if > 500)
    const totalMovimientos = movsFinales.length;
    const batches: MovimientoBancarioInput[][] = [];
    for (let i = 0; i < totalMovimientos; i += BATCH_SIZE) {
      batches.push(movsFinales.slice(i, i + BATCH_SIZE));
    }
    for (const [, batch] of batches.entries()) {
      await withRetry(
        () => batchAddMovimientos(companyId, accountId, extractoId, batch),
        'batchAddMovimientos',
      );
    }

    // Step 8: Mark as completed — saldos vienen del PDF (fuente de verdad)
    await withRetry(
      () => updateExtractoStatus(companyId, accountId, extractoId, 'Completado', {
        totalMovimientosParseados: totalMovimientos,
        saldoInicial: parseResult.context.saldoInicial,
        saldoFinal: parseResult.context.saldoFinal,
      }),
      'updateExtractoStatus(Completado)',
    );

    const requiereRevision = movsFinales.filter(m => m.requiereRevision).length;
    const duplicados = movsFinales.filter(m => m.posibleDuplicado).length;

    return {
      success: true,
      totalMovimientos,
      errores: [],
      requiereRevision,
      duplicados,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido en el pipeline de parseo';
    errores.push(msg);

    try {
      await withRetry(
        () => updateExtractoStatus(companyId, accountId, extractoId, 'Error de parseo', {
          errorParseo: msg,
        }),
        'updateExtractoStatus(Error)',
      );
    } catch (statusErr) {
    }

    return {
      success: false,
      totalMovimientos: 0,
      errores,
      requiereRevision: 0,
      duplicados: 0,
    };
  }
}

// Legacy export — keeps existing imports working
export const runParsePipeline = _runPipeline;
