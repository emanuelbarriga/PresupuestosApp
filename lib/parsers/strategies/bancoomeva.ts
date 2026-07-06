import type { Banco, MovimientoBancarioInput } from '@/lib/types';
import type { ExtractoParser, ParseResult, ParseContext } from '@/lib/parsers/types';

function parseMonto(text: string): number {
  const cleaned = text.replace(/[$,\s]/g, '');
  return parseFloat(cleaned);
}

// Lines to skip entirely (page summaries, etc.)
const SUMMARY_PATTERNS = [
  /^SALDO INICIAL/i,
  /^RENDIMIENTOS/i,
  /^TOTAL DEBITO/i,
  /^TOTAL CREDITO/i,
  /^SALDO FINAL/i,
  /^Nuestra línea de Atención/i,
  /^Si usted tiene una queja/i,
  /^Cualquier inconformidad/i,
  /^Recuerde que usted tiene/i,
  /^El Dr\./i,
  /^Puede dirigir sus quejas/i,
  /^La Defensoría del Consumidor/i,
  /^www\.bancoomeva/i,
  /^SALDO DIARIO/i,
  /^MONEDA:/i,
  /^TASA EFECTIVA:/i,
];

function isSummaryLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return SUMMARY_PATTERNS.some(p => p.test(trimmed));
}

function isColumnHeader(line: string): boolean {
  return /^FECHA\s+OFICINA/.test(line.trim());
}

function isHeaderLine(line: string): boolean {
  return line.trim().startsWith('Extracto de Cuenta');
}

export class BancoomevaParser implements ExtractoParser {
  readonly banco: Banco = 'Bancoomeva';

  parse(texto: string): ParseResult {
    const lines = texto.split('\n').map(l => l.trimEnd());
    const context = this.extractContext(lines);

    // Find where actual data starts (after the first column header line that follows the header block)
    const dataStartIndex = this.findDataStart(lines);

    const movimientos: MovimientoBancarioInput[] = [];
    let ordinal = 0;

    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (isSummaryLine(line)) continue;
      if (isColumnHeader(line)) continue;

      const mov = this.parseRow(line);
      if (mov) {
        ordinal++;
        movimientos.push({ ...mov, ordinal });
      }
    }

    return {
      movimientos,
      context,
    };
  }

  private extractContext(lines: string[]): ParseContext {
    // Find period from header
    for (const line of lines) {
      const match = line.match(/DEL:\s*(\d{2}-\d{2}-\d{4})\s+AL:\s*(\d{2}-\d{2}-\d{4})/i);
      if (match) {
        return {
          banco: this.banco,
          saldoInicial: 0,
          saldoFinal: 0,
          periodoDesde: this.normalizeDate(match[1]),
          periodoHasta: this.normalizeDate(match[2]),
        };
      }
    }

    return {
      banco: this.banco,
      saldoInicial: 0,
      saldoFinal: 0,
    };
  }

  private normalizeDate(ddMmYyyy: string): string {
    const [day, month, year] = ddMmYyyy.split('-');
    return `${year}-${month}-${day}`;
  }

  private findDataStart(lines: string[]): number {
    // Find the column header that marks the beginning of transaction data
    for (let i = 0; i < lines.length; i++) {
      if (isColumnHeader(lines[i])) {
        return i + 1;
      }
    }
    return 0;
  }

  private splitOficinaDescripcion(text: string): { oficina: string; descripcion: string } {
    // OFICINA and DESCRIPCION are stuck together in the text.
    // The OFICINA value ends where `N/D` or `N/DND` appears (part of the description reference).
    // Example: "OFICINA UNICENTRO BOGOTAN/DND COBRO CHEQUE"
    // → OFICINA: "UNICENTRO BOGOTA", DESCRIPCION: "N/D COBRO CHEQUE"
    const match = text.match(/^(.*?)(N\/D.*)$/i);
    if (match) {
      return {
        oficina: match[1].trim(),
        descripcion: match[2].trim(),
      };
    }
    // No N/D found — entire text is the OFICINA (no description available)
    return {
      oficina: text.trim(),
      descripcion: text.trim(),
    };
  }

  private parseRow(line: string): Omit<MovimientoBancarioInput, 'ordinal'> | null {
    // Row format: fecha-column-text oficinadescripcion  debito  credito  saldo
    // The date at the start of the line is DD-MM-YYYY
    const dateMatch = line.match(/^(\d{2}-\d{2}-\d{4})\s+/);
    if (!dateMatch) return null;

    const fechaStr = dateMatch[1];
    const rest = line.slice(dateMatch[0].length).trim();

    // Find numbers (debito, credito, saldo) from the right
    // Format: ...text...  DEBITO_VAL  CREDITO_VAL  SALDO_VAL
    const numberPattern = /(-?[\d,]+\.\d{2})/g;
    const numbers: Array<{ value: string; start: number; end: number }> = [];
    let numMatch: RegExpExecArray | null;

    while ((numMatch = numberPattern.exec(rest)) !== null) {
      numbers.push({
        value: numMatch[1],
        start: numMatch.index,
        end: numMatch.index + numMatch[0].length,
      });
    }

    if (numbers.length < 2) return null;

    // We have 3 values: debito, credito, saldo — find from right
    const numCount = numbers.length;
    let debitoVal = 0;
    let creditoVal = 0;
    let saldoVal = 0;
    let descEndIndex = 0;

    if (numCount >= 3) {
      // All three present: debito, credito, saldo
      saldoVal = parseMonto(numbers[numCount - 1].value);
      creditoVal = parseMonto(numbers[numCount - 2].value);
      debitoVal = parseMonto(numbers[numCount - 3].value);
      descEndIndex = numbers[numCount - 3].start;
    } else {
      // Only 2 numbers: one of debito/credito is empty, and saldo
      saldoVal = parseMonto(numbers[numCount - 1].value);
      const midVal = parseMonto(numbers[numCount - 2].value);
      descEndIndex = numbers[numCount - 2].start;

      // Heuristic: determine if the single amount is debito or credito
      // based on spacing between description and the amount value.
      // In Bancoomeva PDF columns: DEBITO is left, CREDITO is right.
      // If the first number appears far from the description (empty DEBITO column),
      // it's a credito. If close, it's a debito.
      const descText = rest.slice(0, descEndIndex).trim();
      const gapText = rest.slice(0, numbers[numCount - 2].start).trimEnd();
      const gapChars = numbers[numCount - 2].start - gapText.length;

      if (gapChars >= 4) {
        // Large gap means empty DEBITO column → this is credito
        creditoVal = midVal;
      } else {
        debitoVal = midVal;
      }
    }

    const ofDesc = this.splitOficinaDescripcion(rest.slice(0, descEndIndex).trim());

    return {
      fecha: this.normalizeDate(fechaStr),
      descripcion: ofDesc.descripcion || ofDesc.oficina,
      debito: debitoVal > 0 ? debitoVal : undefined,
      credito: creditoVal > 0 ? creditoVal : undefined,
      saldo: saldoVal,
      moneda: 'COP',
      bancoOrigen: this.banco,
    };
  }
}
