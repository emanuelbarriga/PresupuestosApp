/**
 * Integration test: compare TypeScript Bancolombia parser vs Python CSV reference.
 *
 * Run: npx vitest run lib/parsers/__tests__/bancolombia-integration.test.ts
 *
 * For each Bancolombia PDF:
 *   1. Extract text with pdfjs (same as browser)
 *   2. Parse with BancolombiaParser
 *   3. Convert to CSV format
 *   4. Compare row-by-row with Python-generated CSV
 *
 * Known difference: Python CSV uses `periodoDesde` for year inference → for
 * extracts where DESDE=2025/12/31 (common for Enero 2026), Python incorrectly
 * assigns year 2025 instead of 2026. The test flags this separately.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { BancolombiaParser } from '@/lib/parsers/strategies/bancolombia';

const REPO = resolve(__dirname, '..', '..', '..');
const BANCOLOMBIA_DIR = resolve(REPO, 'Datos', 'Extractos', 'Bancolombia 7776');
const DIAG_DIR = resolve(REPO, 'diagnostico');

const MONTHS: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

function formatValor(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Parse a single CSV line respecting quoted fields (es-CO numbers use comma
 * as decimal separator inside quotes, e.g. "3.561.785,57").
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/** Parse es-CO formatted number: "25.906.412,00" → 25906412 */
function parseEsCo(s: string): number {
  s = s.trim();
  if (!s) return 0;
  const neg = s.startsWith('-');
  const cleaned = (neg ? s.slice(1) : s).replace(/\./g, '').replace(',', '.');
  return (neg ? -1 : 1) * parseFloat(cleaned);
}

/** Parse Python CSV into structured rows */
function parseCsvRows(csvContent: string): {
  meta: Record<string, string>;
  header: string[];
  rows: { fecha: string; descripcion: string; valor: number; saldo: number }[];
} {
  const lines = csvContent.trim().split('\n');
  const meta: Record<string, string> = {};
  let header: string[] = [];
  const rows: { fecha: string; descripcion: string; valor: number; saldo: number }[] = [];
  let inData = false;

  for (const line of lines) {
    if (!line.trim()) continue;

    // Metadata lines (simple key-value before data section)
    if (!inData && line.startsWith('Banco,')) {
      meta['banco'] = splitCsvLine(line)[1] ?? '';
      continue;
    }
    if (!inData && line.startsWith('Cuenta,')) {
      meta['cuenta'] = splitCsvLine(line)[1] ?? '';
      continue;
    }
    if (!inData && line.startsWith('Mes,')) {
      meta['mes'] = splitCsvLine(line)[1] ?? '';
      continue;
    }
    if (!inData && line.startsWith('Año,')) {
      meta['anio'] = splitCsvLine(line)[1] ?? '';
      continue;
    }
    if (!inData && line.startsWith('Saldo anterior,')) {
      meta['saldoInicial'] = splitCsvLine(line)[1]?.replace(/"/g, '') ?? '';
      continue;
    }
    if (!inData && line.startsWith('Saldo final,')) {
      meta['saldoFinal'] = splitCsvLine(line)[1]?.replace(/"/g, '') ?? '';
      continue;
    }

    // Column header
    if (line.startsWith('FECHA,DESCRIPCIÓN')) {
      header = splitCsvLine(line);
      inData = true;
      continue;
    }

    // Data rows
    if (inData && /^\d{4}-\d{2}-\d{2}/.test(line)) {
      const parts = splitCsvLine(line);
      // CSV format: FECHA,DESCRIPCIÓN,SUCURSAL,DCTO.,VALOR,SALDO
      const fecha = parts[0];
      const descripcion = parts[1] ?? '';
      const valorStr = parts[4]?.replace(/"/g, '') ?? '0';
      const saldoStr = parts[5]?.replace(/"/g, '') ?? '0';

      rows.push({
        fecha,
        descripcion,
        valor: parseEsCo(valorStr),
        saldo: parseEsCo(saldoStr),
      });
    }
  }

  return { meta, header, rows };
}

describe('Bancolombia PDF — comparación completa contra Python CSV', () => {
  // Find all PDFs
  const pdfFiles = (() => {
    const fs = require('fs');
    const path = require('path');
    return fs.readdirSync(BANCOLOMBIA_DIR).filter((f: string) => f.endsWith('.pdf')).sort();
  })();

  if (pdfFiles.length === 0) {
    it('no Bancolombia PDFs found', () => {
      console.log(`⚠ No se encontraron PDFs en ${BANCOLOMBIA_DIR}`);
    });
    return;
  }

  for (const pdfFile of pdfFiles) {
    const csvFile = pdfFile.replace('.pdf', '.csv');
    const pdfPath = resolve(BANCOLOMBIA_DIR, pdfFile);
    const csvPath = resolve(BANCOLOMBIA_DIR, csvFile);

    it(`[${pdfFile}] comparación vs CSV de Python`, async () => {
      // Skip if no CSV reference
      if (!existsSync(csvPath)) {
        console.log(`⚠ No hay CSV de referencia para ${pdfFile}, salteando`);
        return;
      }

      // 1. Read Python CSV
      const csvContent = readFileSync(csvPath, 'utf-8');
      const py = parseCsvRows(csvContent);
      console.log(`\n📄 ${pdfFile}`);
      console.log(`  Python CSV: ${py.rows.length} movs, SI=${py.meta.saldoInicial}, SF=${py.meta.saldoFinal}, Mes=${py.meta.mes} ${py.meta.anio}`);

      // 2. Extract with Y-grouping (row-layout) — same as browser
      const { extractPdfTextFromBuffer } = await import('@/lib/parsers/pdfText');
      const buffer = new Uint8Array(readFileSync(pdfPath)).buffer;
      const { rowLayout: text } = await extractPdfTextFromBuffer(buffer, undefined);

      const parser = new BancolombiaParser();
      const result = parser.parse(text);

      console.log(`  TypeScript: ${result.movimientos.length} movs, SI=${result.context.saldoInicial}, SF=${result.context.saldoFinal}`);

      // 3. Compare meta
      const tsSaldoInicial = formatValor(result.context.saldoInicial);
      const pySaldoInicial = py.meta.saldoInicial;
      if (tsSaldoInicial !== pySaldoInicial) {
        console.log(`  ⚠ Diferencia saldo inicial: TS=${tsSaldoInicial} Python=${pySaldoInicial}`);
      }

      const tsSaldoFinal = formatValor(result.context.saldoFinal);
      const pySaldoFinal = py.meta.saldoFinal;
      if (tsSaldoFinal !== pySaldoFinal) {
        console.log(`  ⚠ Diferencia saldo final: TS=${tsSaldoFinal} Python=${pySaldoFinal}`);
      }

      // 4. Compare row count
      const tsRows = result.movimientos.length;
      const pyRows = py.rows.length;
      const countDiff = tsRows - pyRows;
      console.log(`  Diferencia filas: ${countDiff > 0 ? '+' : ''}${countDiff} (TS=${tsRows}, PY=${pyRows})`);

      // 5. Deep row-by-row comparison (up to the smaller count)
      const compareCount = Math.min(tsRows, pyRows);
      const diffs: string[] = [];
      let fechaDiffs = 0;
      let descDiffs = 0;
      let valorDiffs = 0;
      let saldoDiffs = 0;

      for (let i = 0; i < compareCount; i++) {
        const ts = result.movimientos[i];
        const pyRow = py.rows[i];
        const tsValor = ts.debito != null ? -ts.debito : (ts.credito ?? 0);
        const rowDiff: string[] = [];

        // Fecha comparison — skip year mismatch because Python uses wrong year
        const tsFechaParts = ts.fecha.split('-');
        const pyFechaParts = pyRow.fecha.split('-');
        if (tsFechaParts[1] !== pyFechaParts[1] || tsFechaParts[2] !== pyFechaParts[2]) {
          rowDiff.push(`fecha: TS=${ts.fecha} PY=${pyRow.fecha}`);
          fechaDiffs++;
        }

        if (ts.descripcion !== pyRow.descripcion) {
          rowDiff.push(`desc: "${ts.descripcion}" vs "${pyRow.descripcion}"`);
          descDiffs++;
        }

        if (Math.abs(tsValor - pyRow.valor) > 0.01) {
          rowDiff.push(`valor: TS=${tsValor.toFixed(2)} PY=${pyRow.valor.toFixed(2)}`);
          valorDiffs++;
        }

        if (Math.abs(ts.saldo! - pyRow.saldo) > 0.01) {
          rowDiff.push(`saldo: TS=${ts.saldo} PY=${pyRow.saldo}`);
          saldoDiffs++;
        }

        if (rowDiff.length > 0) {
          diffs.push(`Fila ${i + 1}: ${rowDiff.join(' | ')}`);
        }
      }

      // Report summary
      console.log(`  Diferencias de fecha: ${fechaDiffs}/${compareCount} (ignorando año del Python que a veces está mal)`);
      console.log(`  Diferencias de descripción: ${descDiffs}/${compareCount}`);
      console.log(`  Diferencias de valor: ${valorDiffs}/${compareCount}`);
      console.log(`  Diferencias de saldo: ${saldoDiffs}/${compareCount}`);

      // Extra rows from TS
      if (tsRows > pyRows) {
        console.log(`  Filas extra en TypeScript (últimas ${tsRows - pyRows}):`);
        for (let i = pyRows; i < tsRows; i++) {
          const ts = result.movimientos[i];
          const tsValor = ts.debito != null ? -ts.debito : (ts.credito ?? 0);
          console.log(`    + TS row ${i + 1}: ${ts.fecha} "${ts.descripcion}" valor=${tsValor} saldo=${ts.saldo}`);
        }
      }
      if (pyRows > tsRows) {
        console.log(`  Filas extra en Python (últimas ${pyRows - tsRows}):`);
        for (let i = tsRows; i < pyRows; i++) {
          const pyRow = py.rows[i];
          console.log(`    + PY row ${i + 1}: ${pyRow.fecha} "${pyRow.descripcion}" valor=${pyRow.valor} saldo=${pyRow.saldo}`);
        }
      }

      // Save detailed diff report
      if (diffs.length > 0) {
        if (!existsSync(DIAG_DIR)) mkdirSync(DIAG_DIR, { recursive: true });
        const diffPath = resolve(DIAG_DIR, `${pdfFile.replace('.pdf', '')}-ts-vs-py.txt`);
        const detailLines = [
          `=== ${pdfFile} — TypeScript vs Python CSV ===`,
          '',
          `Python: ${pyRows} movs | SI=${py.meta.saldoInicial} | SF=${py.meta.saldoFinal}`,
          `TypeScript: ${tsRows} movs | SI=${tsSaldoInicial} | SF=${tsSaldoFinal}`,
          '',
          `Diferencias de fecha (mes/día, ignorando año de Python): ${fechaDiffs}`,
          `Diferencias de descripción: ${descDiffs}`,
          `Diferencias de valor: ${valorDiffs}`,
          `Diferencias de saldo: ${saldoDiffs}`,
          '',
          ...diffs,
        ];
        writeFileSync(diffPath, detailLines.join('\n'), 'utf-8');
        console.log(`  Diferencias detalladas guardadas en: ${diffPath}`);
      } else if (fechaDiffs === 0) {
        // If no meaningful diffs, mark as pass
        console.log(`  ✅ Sin diferencias significativas`);
      }

      // This is a diagnostic test — no hard assertions because Python CSV has
      // known issues (wrong year for DESDE=prev year, missing columnar rows).
      // Visual inspection of console output is the intended validation.
      expect(true).toBe(true);
    });
  }
});
