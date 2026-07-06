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
      console.warn(`[parsePipeline] ${label} failed (attempt ${attempt}), retrying in ${delay}ms:`, err);
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

  console.log('[PARSE-PIPELINE] Starting from buffer', { companyId, accountId, extractoId, bancoConfirmado });

  try {
    // Step 1: Mark as parsing
    console.log('[PARSE-PIPELINE] Step 1: marking as Parseando');
    await withRetry(
      () => updateExtractoStatus(companyId, accountId, extractoId, 'Parseando'),
      'updateExtractoStatus(Parseando)',
    );

    // Step 2: Extract PDF text from the in-memory buffer (no network needed)
    let texto: string;
    try {
      console.log('[PARSE-PIPELINE] Step 2: extracting text from buffer', { size: buffer.byteLength });
      texto = await extractPdfTextFromBuffer(buffer);
      console.log('[PARSE-PIPELINE] PDF extracted', { length: texto.length, preview: texto.slice(0, 200) });
    } catch (err) {
      const msg = `Error al leer el PDF: ${err instanceof Error ? err.message : 'Error desconocido'}`;
      console.error('[PARSE-PIPELINE] PDF extraction failed:', msg);
      throw new Error(msg);
    }

    // Step 3: Detect bank
    console.log('[PARSE-PIPELINE] Step 3: detecting bank');
    const banco = bancoConfirmado ?? detectarBanco(texto);
    console.log('[PARSE-PIPELINE] Bank detected:', banco);
    if (banco === 'No detectado') {
      throw new Error('Banco no reconocido');
    }

    // Step 4: Parse
    console.log('[PARSE-PIPELINE] Step 4: parsing with', banco);
    const parser = getParser(banco);
    const parseResult = parser.parse(texto);
    console.log('[PARSE-PIPELINE] Parse result', { movimientos: parseResult.movimientos.length, saldoInicial: parseResult.context.saldoInicial, saldoFinal: parseResult.context.saldoFinal });

    // Step 5: Reconcile
    console.log('[PARSE-PIPELINE] Step 5: reconciling', { total: parseResult.movimientos.length, saldoInicial: parseResult.context.saldoInicial });
    const movsReconciliados = reconciliar(
      parseResult.movimientos,
      parseResult.context.saldoInicial,
    );
    const revCount = movsReconciliados.filter(m => m.requiereRevision).length;
    console.log('[PARSE-PIPELINE] Reconciliation done', { revisiones: revCount });

    // Step 6: Detect duplicates
    console.log('[PARSE-PIPELINE] Step 6: dedup');
    const hashesExistentes = await withRetry(
      () => fetchMovimientoHashes(companyId, accountId, extractoId),
      'fetchMovimientoHashes',
    );
    console.log('[PARSE-PIPELINE] Existing hashes', { count: hashesExistentes.length });
    const movsFinales = await detectarDuplicados(movsReconciliados, hashesExistentes);
    const dupCount = movsFinales.filter(m => m.posibleDuplicado).length;
    console.log('[PARSE-PIPELINE] Dedup done', { duplicados: dupCount });

    // Step 7: Batch write (chunk if > 500)
    const totalMovimientos = movsFinales.length;
    const batches: MovimientoBancarioInput[][] = [];
    for (let i = 0; i < totalMovimientos; i += BATCH_SIZE) {
      batches.push(movsFinales.slice(i, i + BATCH_SIZE));
    }
    console.log('[PARSE-PIPELINE] Step 7: batch writing', { totalMovimientos, batches: batches.length });

    for (const [idx, batch] of batches.entries()) {
      console.log('[PARSE-PIPELINE] Writing batch', { idx, size: batch.length });
      await withRetry(
        () => batchAddMovimientos(companyId, accountId, extractoId, batch),
        'batchAddMovimientos',
      );
    }

    // Step 8: Mark as completed — saldos vienen del PDF (fuente de verdad)
    console.log('[PARSE-PIPELINE] Step 8: marking as Completado');
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

    console.log('[PARSE-PIPELINE] ✅ Success', { totalMovimientos, requiereRevision, duplicados });

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
      console.error('[parsePipeline] Failed to update error status:', statusErr);
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
