import type { Banco, Month, MovimientoBancarioInput } from '@/lib/types';
import { detectarBanco, getParser } from '@/lib/parsers/index';
import { reconciliar } from '@/lib/parsers/reconciliador';
import { detectarDuplicados } from '@/lib/parsers/detectordup';
import { extractPdfTextFromBuffer } from '@/lib/parsers/pdfText';
import { derivarMesAnio } from '@/lib/parsers/periodo';
import { updateExtractoStatus, batchAddMovimientos } from '@/lib/firestore';

export interface ParsePreviewResult {
  movimientos: MovimientoBancarioInput[];
  header: { mes: Month; anio: number; banco: Banco; saldoInicial: number; saldoFinal: number };
  detectedBanco: Banco;
}

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

    // Step 2: Extract PDF text from the in-memory buffer (no network needed).
    // Extraemos flat + row-layout en una sola pasada del PDF.
    type ExtractResult = { flat: string; rowLayout: string };
    let texts: ExtractResult;
    try {
      texts = await extractPdfTextFromBuffer(buffer, undefined);
    } catch (err) {
      const msg = `Error al leer el PDF: ${err instanceof Error ? err.message : 'Error desconocido'}`;
      throw new Error(msg);
    }
    const { flat: flatText, rowLayout: rowLayoutText } = texts;

    // Step 3: Detect bank (siempre desde flat mode, que funciona para todos los bancos)
    const banco = bancoConfirmado ?? detectarBanco(flatText);
    if (banco === 'No detectado') {
      throw new Error('Banco no reconocido');
    }

    // Step 4: Seleccionar modo de texto según el banco.
    //   - Bancos como Global66 necesitan flat (sus montos están en diferentes
    //     Y-groups dentro de una misma fila y row-layout los separaría).
    //   - Bancolombia con 2+ páginas produce formato columnar en flat pero
    //     row-layout lo convierte a filas correctas.
    const esBancolombiaColumnar =
      banco === 'Bancolombia' &&
      /\b(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\b/.test(flatText);
    const texto = esBancolombiaColumnar ? rowLayoutText : flatText;

    // Step 5: Parse
    const parser = getParser(banco);
    const parseResult = parser.parse(texto);

    // Step 5: Reconcile
    const movsReconciliados = reconciliar(
      parseResult.movimientos,
      parseResult.context.saldoInicial,
    );
    const revCount = movsReconciliados.filter(m => m.requiereRevision).length;

    // Step 6: Detect duplicates
    // TODO: implement hash-based dedup — fetchMovimientoHashes was removed because
    // the hash field was never written, so dedup has been silently a no-op.
    const movsFinales = await detectarDuplicados(movsReconciliados, []);
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

/**
 * Non-persisting preview adapter: extract, detect, parse, and reconcile
 * from a PDF buffer WITHOUT writing to Firestore.
 *
 * Returns preview data for the user to review before committing.
 */
export async function parseForPreview(
  buffer: ArrayBuffer,
  bancoConfirmado?: Banco | null,
): Promise<ParsePreviewResult> {
  // Step 1: Extract PDF text (flat + row-layout en una sola pasada)
  const { flat: flatText, rowLayout: rowLayoutText } = await extractPdfTextFromBuffer(buffer, undefined);

  // Step 2: Detect bank (siempre desde flat mode)
  const banco = bancoConfirmado ?? detectarBanco(flatText);
  if (banco === 'No detectado') {
    throw new Error('Banco no reconocido');
  }

  // Step 3: Seleccionar modo de texto según el banco
  const esBancolombiaColumnar =
    banco === 'Bancolombia' &&
    /\b(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\b/.test(flatText);
  const texto = esBancolombiaColumnar ? rowLayoutText : flatText;

  // Step 4: Parse
  const parser = getParser(banco);
  const parseResult = parser.parse(texto);

  // Step 4: Reconcile
  const movsReconciliados = reconciliar(
    parseResult.movimientos,
    parseResult.context.saldoInicial,
  );

  // Step 5: Derive month/year from periodo
  const periodoFecha = parseResult.context.periodoHasta ?? parseResult.context.periodoDesde;
  const { mes, anio } = derivarMesAnio(periodoFecha);

  return {
    movimientos: movsReconciliados,
    header: {
      mes: mes || 'Enero',
      anio: anio ?? new Date().getFullYear(),
      banco,
      saldoInicial: parseResult.context.saldoInicial,
      saldoFinal: parseResult.context.saldoFinal,
    },
    detectedBanco: banco,
  };
}

// Legacy export — keeps existing imports working
export const runParsePipeline = _runPipeline;
