import type { Banco, MovimientoBancarioInput } from '@/lib/types';
import { detectarBanco, getParser } from '@/lib/parsers/index';
import { reconciliar } from '@/lib/parsers/reconciliador';
import { detectarDuplicados } from '@/lib/parsers/detectordup';
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
 * Extract text content from all pages of a PDF using pdfjs-dist.
 */
async function extractPdfText(pdfUrl: string): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument(pdfUrl);
  const pdf = await loadingTask.promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str ?? '')
      .join(' ');
    pages.push(pageText);
  }

  const fullText = pages.join('\n\n').trim();
  if (!fullText) {
    throw new Error('PDF sin contenido de texto extraíble');
  }
  return fullText;
}

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
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      console.warn(`[parsePipeline] ${label} failed (attempt ${attempt}), retrying in ${delay}ms:`, err);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`${label}: max retries exceeded`);
}

/**
 * Run the full parse pipeline for a bank statement PDF.
 *
 * Steps:
 * 1. Update extracto status to 'Parseando'
 * 2. Fetch and extract text from the PDF
 * 3. Detect bank (or use confirmed one)
 * 4. Parse movements using the bank-specific parser
 * 5. Reconcile balances
 * 6. Detect duplicates against existing hashes
 * 7. Batch-write movements to Firestore
 * 8. Update extracto status to 'Completado' or 'Error de parseo'
 */
export async function runParsePipeline(
  companyId: string,
  accountId: string,
  extractoId: string,
  pdfUrl: string,
  bancoConfirmado: Banco | null,
): Promise<PipelineResult> {
  const errores: string[] = [];

  try {
    // Step 1: Mark as parsing
    await withRetry(
      () => updateExtractoStatus(companyId, accountId, extractoId, 'Parseando'),
      'updateExtractoStatus(Parseando)',
    );

    // Step 2: Extract PDF text
    let texto: string;
    try {
      texto = await extractPdfText(pdfUrl);
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

    // Step 6: Detect duplicates
    const hashesExistentes = await withRetry(
      () => fetchMovimientoHashes(companyId, accountId, extractoId),
      'fetchMovimientoHashes',
    );
    const movsFinales = await detectarDuplicados(movsReconciliados, hashesExistentes);

    // Step 7: Batch write (chunk if > 500)
    const totalMovimientos = movsFinales.length;
    const batches: MovimientoBancarioInput[][] = [];
    for (let i = 0; i < totalMovimientos; i += BATCH_SIZE) {
      batches.push(movsFinales.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      await withRetry(
        () => batchAddMovimientos(companyId, accountId, extractoId, batch),
        'batchAddMovimientos',
      );
    }

    // Step 8: Mark as completed
    await withRetry(
      () => updateExtractoStatus(companyId, accountId, extractoId, 'Completado', {
        totalMovimientosParseados: totalMovimientos,
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
