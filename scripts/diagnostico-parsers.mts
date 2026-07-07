#!/usr/bin/env node
/**
 * Diagnóstico de parsers de extractos bancarios.
 *
 * Lee los 3 PDFs reales de datos/extractos/ejemplos/, extrae texto via pdfjs
 * (idéntico al flujo del navegador), y ejecuta cada parser reportando qué
 * produce. Exporta el texto extraído + el resultado del parseo.
 *
 * Uso: npx tsx scripts/diagnostico-parsers.mts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const EJEMPLOS  = resolve(REPO_ROOT, 'datos', 'extractos', 'ejemplos');
const OUTPUT    = resolve(REPO_ROOT, 'diagnostico');

interface Diagnostico {
  banco: string;
  archivo: string;
  paginas: number;
  chars: number;
  deteccion: string;
  contexto: Record<string, unknown>;
  movimientos: number;
  primerosMovs: string[];
  errores: string[];
  warnings: string[];
}

// ─── Text extraction — SAME as extractPdfTextFromBuffer in the browser ─────
async function extractText(pdfPath: string): Promise<{ texto: string; numPages: number }> {
  const buffer = readFileSync(pdfPath);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = resolve(REPO_ROOT, 'public', 'pdf.worker.min.mjs');

  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str ?? '').join(' ');
    pages.push(pageText);
  }

  return { texto: pages.join('\n\n').trim(), numPages: doc.numPages };
}

// ─── Run one parser and collect diagnostics ───────────────────────────────
async function diagnosticar(
  label: string,
  pdfFileName: string,
  parserImport: () => Promise<{ default: new () => any }>,
): Promise<Diagnostico> {
  const pdfPath = resolve(EJEMPLOS, pdfFileName);
  const diag: Diagnostico = {
    banco: label,
    archivo: pdfFileName,
    paginas: 0,
    chars: 0,
    deteccion: '',
    contexto: {},
    movimientos: 0,
    primerosMovs: [],
    errores: [],
    warnings: [],
  };

  try {
    // Step 1: extract text
    const { texto, numPages } = await extractText(pdfPath);
    diag.texto = texto;
    diag.paginas = numPages;
    diag.chars = texto.length;

    // Save raw extracted text
    writeFileSync(resolve(OUTPUT, `${label}_extraido.txt`), texto, 'utf-8');

    // Step 2: detect bank
    const { detectarBanco } = await import('../lib/parsers/index.ts');
    const banco = detectarBanco(texto);
    diag.deteccion = banco;

    if (banco === 'No detectado') {
      diag.errores.push('Banco no detectado — no se puede ejecutar parser');
      return diag;
    }

    // Step 3: run parser
    const { getParser } = await import('../lib/parsers/index.ts');
    const parser = getParser(banco);
    const result = parser.parse(texto);
    diag.contexto = result.context as any;

    // DEBUG comment removed — columnar parser working (110 Bancolombia movs)

    // Step 4: reconcile
    const { reconciliar } = await import('../lib/parsers/reconciliador.ts');
    const movs = reconciliar(result.movimientos, result.context.saldoInicial, 0.01);

    diag.movimientos = movs.length;
    diag.errores.push(...(result.errores ?? []));

    // Show first 5 movimientos
    diag.primerosMovs = movs.slice(0, 5).map(m =>
      `#${m.ordinal}  ${m.fecha}  ${(m.descripcion ?? '').slice(0, 40).padEnd(42)}  ` +
      `${m.debito ? m.debito.toLocaleString('es-CO') : ''.padStart(14)}  ` +
      `${m.credito ? m.credito.toLocaleString('es-CO') : ''.padStart(14)}  ` +
      `${m.saldo.toLocaleString('es-CO')}  ` +
      `${m.requiereRevision ? '⚠' : '✓'}`
    );

    // Warnings
    if (result.movimientos.length > 0 && result.movimientos.length !== movs.length) {
      diag.warnings.push(
        `Parser devolvió ${result.movimientos.length} movs, reconciliador devolvió ${movs.length} (diferencia)`,
      );
    }
    if (movs.length === 0) {
      diag.warnings.push('CERO movimientos extraídos — revisar parser');
    }

    // Check if parser returns same as fixture test expects
    if (banco === 'Bancolombia') {
      if (result.context.saldoInicial !== 1478.29) {
        diag.warnings.push(`Saldo inicial esperado: 1478.29, obtenido: ${result.context.saldoInicial}`);
      }
      if (result.context.saldoFinal !== 70565811.95) {
        diag.warnings.push(`Saldo final esperado: 70565811.95, obtenido: ${result.context.saldoFinal}`);
      }
    }
    if (banco === 'Global66') {
      if (Math.abs(result.context.saldoInicial - 43038109.81) > 0.01) {
        diag.warnings.push(`Saldo inicial esperado: 43038109.81, obtenido: ${result.context.saldoInicial}`);
      }
      if (Math.abs(result.context.saldoFinal - 3352614.80) > 0.01) {
        diag.warnings.push(`Saldo final esperado: 3352614.80, obtenido: ${result.context.saldoFinal}`);
      }
    }
  } catch (err: any) {
    diag.errores.push(`ERROR: ${err.message}`);
    diag.errores.push(err.stack?.slice(0, 300) ?? '');
  }

  return diag;
}

// ─── Print summary ────────────────────────────────────────────────────────
function imprimir(diag: Diagnostico) {
  const sep = '─'.repeat(72);
  console.log(`\n${sep}`);
  console.log(`  ${diag.banco}  —  ${diag.archivo}`);
  console.log(sep);
  console.log(`  Páginas:    ${diag.paginas}`);
  console.log(`  Caracteres: ${diag.chars.toLocaleString()}`);
  console.log(`  Detección:  ${diag.deteccion}`);
  console.log(`  Contexto:   ${JSON.stringify(diag.contexto, null, 2)}`);
  console.log(`  Movimientos: ${diag.movimientos}`);
  if (diag.primerosMovs.length > 0) {
    console.log(`  ┌ Ord Fecha       Descripción                               Débito          Crédito         Saldo          Estado`);
    for (const m of diag.primerosMovs) {
      console.log(`  │ ${m}`);
    }
  }
  if (diag.warnings.length > 0) {
    console.log(`\n  ⚠ WARNINGS:`);
    for (const w of diag.warnings) console.log(`    • ${w}`);
  }
  if (diag.errores.length > 0) {
    console.log(`\n  ❌ ERRORES:`);
    for (const e of diag.errores) console.log(`    • ${e}`);
  }
  console.log(`\n  Texto extraído guardado en: diagnostico/${diag.banco}_extraido.txt`);
}

async function main() {
  mkdirSync(OUTPUT, { recursive: true });

  const resultados = await Promise.all([
    diagnosticar('Bancolombia', '82900017677_202602_4342786396.pdf', () =>
      import('../lib/parsers/strategies/bancolombia.ts'),
    ),
    diagnosticar('Bancoomeva', 'Extracto Bancoomeva Enero  2026.pdf', () =>
      import('../lib/parsers/strategies/bancoomeva.ts'),
    ),
    diagnosticar('Global66', 'extracto_movimientos_start=01-05-2026_end=31-05-2026.pdf', () =>
      import('../lib/parsers/strategies/global66.ts'),
    ),
  ]);

  for (const r of resultados) {
    imprimir(r);
    // Save full diagnostic report
    const reportPath = resolve(OUTPUT, `${r.banco}_reporte.json`);
    writeFileSync(reportPath, JSON.stringify(r, null, 2), 'utf-8');
  }

  // Summary table
  console.log('\n' + '═'.repeat(72));
  console.log('  RESUMEN');
  console.log('═'.repeat(72));
  console.log(`  Banco         Movs  Detección        SaldoInicial     SaldoFinal`);
  for (const r of resultados) {
    console.log(
      `  ${r.banco.padEnd(14)} ${String(r.movimientos).padStart(4)}  ${r.deteccion.padEnd(15)} ` +
      `${((r.contexto as any)?.saldoInicial ?? 0).toLocaleString('es-CO').padStart(14)} ` +
      `${((r.contexto as any)?.saldoFinal ?? 0).toLocaleString('es-CO').padStart(14)}`
    );
  }
  console.log('═'.repeat(72));
  console.log(`Diagnósticos guardados en: ${OUTPUT}/`);
}

main().catch(console.error);
