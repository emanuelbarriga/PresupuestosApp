import type { Banco, MovimientoBancarioInput } from '@/lib/types';
import type { ExtractoParser, ParseResult, ParseContext } from '@/lib/parsers/types';

/**
 * Merge split amounts in Global66 extracted text.
 *
 * Global66 PDF amounts often get split across PDF lines, producing text like:
 *   "$2,208,017 .00"  → should be "$2,208,017.00"
 *   "$10,930,25 2.02" → should be "$10,930,252.02"
 *   "$736,006.0 0"    → should be "$736,006.00"
 *
 * Strategy: within "$..." patterns, remove ALL spaces between digit characters.
 */
function mergeAmounts(text: string): string {
  // Apply merge per-line to avoid crossing line boundaries
  const lines = text.split('\n');
  const merged = lines.map(line =>
      line.replace(/\$(\d[\d,.]*(?:\s+[\d.][\d.,]*)*)/g, (_match, p1) => {
      return '$' + p1.replace(/\s+/g, '');
    })
  );
  return merged.join('\n');
}

function parseMonto(text: string): number {
  const cleaned = text.replace(/[$,\s]/g, '');
  return parseFloat(cleaned);
}

export class Global66Parser implements ExtractoParser {
  readonly banco: Banco = 'Global66';

  parse(texto: string): ParseResult {
    // Step 1: merge split amounts
    const merged = mergeAmounts(texto);

    const lines = merged.split('\n').map(l => l.trim()).filter(Boolean);

    const context = this.extractContext(lines);

    // Filter: keep only transaction rows (lines starting with YYYY-MM-DD)
    const rowLines = lines.filter(line => /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(line));

    const movimientos: MovimientoBancarioInput[] = [];
    let ordinal = 0;

    for (const line of rowLines) {
      const mov = this.parseRow(line);
      if (mov) {
        ordinal++;
        movimientos.push({ ...mov, ordinal });
      }
    }

    return { movimientos, context };
  }

  private extractContext(lines: string[]): ParseContext {
    const fullText = lines.join('  ');

    let periodoDesde: string | undefined;
    let periodoHasta: string | undefined;
    const periodMatch = fullText.match(/Desde:\s*(\d{2}-[A-Za-z]{3}-\d{4})\s+Hasta:\s*(\d{2}-[A-Za-z]{3}-\d{4})/i);
    if (periodMatch) {
      periodoDesde = this.normalizePeriodDate(periodMatch[1]);
      periodoHasta = this.normalizePeriodDate(periodMatch[2]);
    }

    const saldoInicialMatch = fullText.match(/Inicio de per[íi]odo:\s*\$([\d,]+\.\d{2})/i);
    const saldoFinalMatch = fullText.match(/Final de per[íi]odo:\s*\$([\d,]+\.\d{2})/i);

    return {
      banco: this.banco,
      saldoInicial: saldoInicialMatch ? parseMonto(saldoInicialMatch[1]) : 0,
      saldoFinal: saldoFinalMatch ? parseMonto(saldoFinalMatch[1]) : 0,
      periodoDesde,
      periodoHasta,
    };
  }

  private normalizePeriodDate(dateStr: string): string {
    // Format: "01-May-2026" → "2026-05-01"
    const months: Record<string, string> = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
    };
    const [day, monthStr, year] = dateStr.split('-');
    const month = months[monthStr] || '01';
    return `${year}-${month}-${String(day).padStart(2, '0')}`;
  }

  private parseRow(line: string): Omit<MovimientoBancarioInput, 'ordinal'> | null {
    // Match timestamp at start
    const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+/);
    if (!tsMatch) return null;

    const fecha = tsMatch[1];
    const horaOriginal = tsMatch[2];
    const rest = line.slice(tsMatch[0].length).trim();

    // Find all $amount patterns (after merge, these are complete numbers)
    const amountPattern = /\$([\d,]+\.\d{2})/g;
    const amounts: Array<{ value: string; start: number }> = [];
    let amMatch: RegExpExecArray | null;

    while ((amMatch = amountPattern.exec(rest)) !== null) {
      amounts.push({ value: amMatch[1], start: amMatch.index });
    }

    // We need at least 2 amounts (debito|abono + saldo)
    if (amounts.length < 2) return null;

    // The last amount is always saldo
    const saldo = parseMonto(amounts[amounts.length - 1].value);

    // Everything before the first $amount is description + Movimiento + Tarjeta
    const textBefore = rest.slice(0, amounts[0].start);
    const descripcion = this.extractDescripcion(textBefore);

    if (amounts.length >= 3) {
      // 3 amounts: debito, abono, saldo (rare — both columns populated)
      return {
        fecha,
        horaOriginal,
        descripcion,
        debito: parseMonto(amounts[0].value),
        credito: parseMonto(amounts[1].value),
        saldo,
        moneda: 'COP',
        bancoOrigen: this.banco,
      };
    }

    // 2 amounts: amount + saldo. In Global66 real data, the amount is always
    // in the Débito column (money leaving the account). Abono credits are rare.
    const firstAmount = parseMonto(amounts[0].value);

    return {
      fecha,
      horaOriginal,
      descripcion,
      debito: firstAmount,
      saldo,
      moneda: 'COP',
      bancoOrigen: this.banco,
    };
  }

  /** Extract clean description, stripping Movimiento and Tarjeta columns */
  private extractDescripcion(textBefore: string): string {
    // The text before the first $ has format: "Descripción   Movimiento   Tarjeta"
    // Strip trailing numeric/alpha references that are Movimiento/Tarjeta column values
    const trimmed = textBefore.trim();

    // Split by 3+ spaces to isolate the Movimiento/Tarjeta columns
    const parts = trimmed.split(/\s{3,}/);
    return parts[0].trim();
  }
}
