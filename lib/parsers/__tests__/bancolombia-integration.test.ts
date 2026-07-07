/**
 * Integration test: parse Bancolombia PDF → CSV → compare with reference.
 *
 * Run: npx vitest run lib/parsers/__tests__/bancolombia-integration.test.ts
 *
 * The test passes ONLY if the generated CSV matches the reference file
 * 82900017677_202602_4342786396-clean.csv exactly.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { BancolombiaParser } from '@/lib/parsers/strategies/bancolombia';

const REPO = resolve(__dirname, '..', '..', '..');
const EJEMPLOS = resolve(REPO, 'datos', 'extractos', 'ejemplos');
// Also look in Datos/ (alternate path)
const EJEMPLOS_ALT = resolve(REPO, 'Datos', 'Extractos', 'ejemplos');
const PDF_FILE = '82900017677_202602_4342786396.pdf';
const CSV_REF = '82900017677_202602_4342786396-clean.csv';
const OUTPUT = resolve(REPO, 'diagnostico', 'bancolombia-test-output.csv');

const MONTHS: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

/**
 * Format a number in es-CO locale: dots as thousands, comma as decimal.
 * E.g. 25906412 → "25.906.412,00", -2304.26 → "-2.304,26"
 */
function formatValor(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Convert parsed movements to the reference CSV format */
function toCsv(
  movimientos: { fecha: string; descripcion: string; debito?: number; credito?: number; saldo: number }[],
  context: { saldoInicial: number; saldoFinal: number; banco: string; periodoDesde?: string },
  cuentaNum: string,
): string {
  const lines: string[] = [];

  // Metadata header
  lines.push(',,,,,');
  lines.push(`Banco,${context.banco},,,,`);
  lines.push(`Cuenta,${cuentaNum},,,,`);

  // Extract month/year from periodoDesde or first movement
  let mes = '';
  let anio = '';
  if (context.periodoDesde) {
    const parts = context.periodoDesde.split('-');
    mes = MONTHS[parts[1] ?? ''] ?? '';
    anio = parts[0] ?? '';
  }
  lines.push(`Mes,${mes},,,,`);
  lines.push(`Año,${anio},,,,`);
  lines.push(`Saldo anterior,"${formatValor(context.saldoInicial)}",,,,`);
  lines.push(`Saldo final,"${formatValor(context.saldoFinal)}",,,,`);
  lines.push(',,,,,');

  // Column header
  lines.push('FECHA,DESCRIPCIÓN,SUCURSAL,DCTO.,VALOR,SALDO');

  // Data rows
  for (const mov of movimientos) {
    const valor = mov.debito != null ? -mov.debito : (mov.credito ?? 0);
    lines.push([
      mov.fecha,
      mov.descripcion.replace(/,/g, '|'), // Escape commas in descriptions
      '',   // SUCURSAL
      '',   // DCTO.
      `"${formatValor(valor)}"`,
      `"${formatValor(mov.saldo)}"`,
    ].join(','));
  }

  // End marker
  lines.push(',FIN ESTADO DE CUENTA,,,,');

  return lines.join('\n') + '\n';
}

describe('Bancolombia PDF integration', () => {
  it('generates CSV identical to the reference', async () => {
    // Find the PDF
    const pdfPath = resolve(EJEMPLOS, PDF_FILE);
    const refCsvPath = resolve(EJEMPLOS, CSV_REF);

    // Fallback to alternative path
    const finalPdfPath = existsSync(pdfPath) ? pdfPath : resolve(EJEMPLOS_ALT, PDF_FILE);
    const finalRefPath = existsSync(refCsvPath) ? refCsvPath : resolve(EJEMPLOS_ALT, CSV_REF);

    // 1. Extract text from PDF using pdfjs (same as browser)
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const buffer = readFileSync(finalPdfPath);
    const data = new Uint8Array(buffer);
    const doc = await pdfjs.getDocument({ data }).promise;

    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str ?? '')
        .join(' ');
      pages.push(pageText);
    }
    const text = pages.join('\n\n').trim();

    // 2. Parse with BancolombiaParser
    const parser = new BancolombiaParser();
    const result = parser.parse(text);

    // 3. Get account number from extracted text
    const cuentaMatch = text.match(/(\d{11,})/);
    const cuentaNum = cuentaMatch?.[1] ?? '00000000000';

    // 4. Generate CSV
    const csv = toCsv(result.movimientos, result.context, cuentaNum);
    writeFileSync(OUTPUT, csv, 'utf-8');

    // 5. Read reference CSV
    const refCsv = readFileSync(finalRefPath, 'utf-8');

    // 6. Compare line by line for useful diffs
    const genLines = csv.split('\n');
    const refLines = refCsv.split('\n');
    const maxLines = Math.max(genLines.length, refLines.length);

    const diffLines: string[] = [];
    for (let i = 0; i < maxLines; i++) {
      const gen = genLines[i] ?? '';
      const ref = refLines[i] ?? '';
      if (gen !== ref) {
        diffLines.push(`Line ${i + 1}:`);
        diffLines.push(`  gen: ${gen}`);
        diffLines.push(`  ref: ${ref}`);
        // Only report first 10 diffs
        if (diffLines.length >= 30) {
          diffLines.push('  ... (more diffs truncated)');
          break;
        }
      }
    }

    // 7. Save diff report
    const diffPath = resolve(REPO, 'diagnostico', 'bancolombia-csv-diff.txt');
    if (diffLines.length > 0) {
      writeFileSync(diffPath, diffLines.join('\n'), 'utf-8');
      console.log(`\nCSV diff saved to: ${diffPath}`);
    }

    // 8. Assert
    expect(csv).toBe(refCsv);
  });

  it('reports row counts', async () => {
    const refCsvPath = resolve(EJEMPLOS, CSV_REF);
    const finalRefPath = existsSync(refCsvPath) ? refCsvPath : resolve(EJEMPLOS_ALT, CSV_REF);
    const refCsv = readFileSync(finalRefPath, 'utf-8');
    const refRows = refCsv.split('\n').filter(l => /^\d{4}-\d{2}-\d{2}/.test(l));
    console.log(`\nReference CSV: ${refRows.length} data rows`);

    // Parse PDF
    const pdfPath = resolve(EJEMPLOS, PDF_FILE);
    const finalPdfPath = existsSync(pdfPath) ? pdfPath : resolve(EJEMPLOS_ALT, PDF_FILE);
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const buffer = readFileSync(finalPdfPath);
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => item.str ?? '').join(' '));
    }
    const parser = new BancolombiaParser();
    const result = parser.parse(pages.join('\n\n').trim());
    console.log(`Generated: ${result.movimientos.length} data rows`);
    console.log(`Saldo inicial: ${result.context.saldoInicial}`);
    console.log(`Saldo final: ${result.context.saldoFinal}`);
  });
});

// existsSync imported from fs
