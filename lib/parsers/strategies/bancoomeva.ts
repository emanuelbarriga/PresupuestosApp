import type { Banco, MovimientoBancarioInput } from '@/lib/types';
import type { ExtractoParser, ParseResult, ParseContext } from '@/lib/parsers/types';

function parseMonto(text: string): number {
  const cleaned = text.replace(/[$,\s]/g, '');
  return parseFloat(cleaned);
}

// Bancoomeva PDF text extraction (pdfjs) produces ONE line per page, not one
// line per transaction row — everything on a page is packed together with
// whitespace. So instead of splitting on '\n' and expecting one row per line,
// we strip the recurring noise blocks (repeated on every page: the running
// summary and the legal disclaimer) and then locate transaction rows by their
// "DD-MM-YYYY OFICINA" anchor, wherever it appears in the text.

// Repeats verbatim on every page — strip entirely (dotall so it spans the
// embedded newlines between page blocks in the extracted text).
const DISCLAIMER_PATTERN = /Nuestra línea de Atención.*?autónoma de Bancoomeva\./gs;

// Running summary block repeated at the top of every page after page 1.
const SUMMARY_PATTERN = /SALDO INICIAL\s+\$\s*[\d,]+\.\d{2}.*?SALDO FINAL\s+\$\s*[\d,]+\.\d{2}/gs;

// Anchor for a transaction row: a date followed by "OFICINA", capturing
// everything up to (but not including) the next such anchor or the end.
const ROW_PATTERN = /(\d{2}-\d{2}-\d{4})\s+(OFICINA\s+.*?)(?=\d{2}-\d{2}-\d{4}\s+OFICINA|$)/gs;

export class BancoomevaParser implements ExtractoParser {
  readonly banco: Banco = 'Bancoomeva';

  parse(texto: string): ParseResult {
    const context = this.extractContext(texto);

    // Strip recurring per-page noise (running summary + legal disclaimer)
    // before locating transaction rows — otherwise their embedded numbers
    // would be mistaken for a row's debito/credito/saldo.
    const cleaned = texto
      .replace(DISCLAIMER_PATTERN, ' ')
      .replace(SUMMARY_PATTERN, ' ');

    const movimientos: MovimientoBancarioInput[] = [];
    let ordinal = 0;

    const rowRegex = new RegExp(ROW_PATTERN);
    let match: RegExpExecArray | null;
    while ((match = rowRegex.exec(cleaned)) !== null) {
      const rowText = `${match[1]} ${match[2]}`.trim();
      const mov = this.parseRow(rowText);
      if (mov) {
        ordinal++;
        movimientos.push({ ...mov, ordinal });
      }
      if (match.index === rowRegex.lastIndex) rowRegex.lastIndex++;
    }

    return {
      movimientos,
      context,
    };
  }

  private extractContext(texto: string): ParseContext {
    const fullText = texto.replace(/\n/g, '  ');

    let periodoDesde: string | undefined;
    let periodoHasta: string | undefined;
    const periodMatch = fullText.match(/DEL:\s*(\d{2}-\d{2}-\d{4})\s+AL:\s*(\d{2}-\d{2}-\d{4})/i);
    if (periodMatch) {
      periodoDesde = this.normalizeDate(periodMatch[1]);
      periodoHasta = this.normalizeDate(periodMatch[2]);
    }

    const saldoInicialMatch = fullText.match(/SALDO INICIAL\s+\$\s*([\d,]+\.\d{2})/i);
    const saldoFinalMatch = fullText.match(/SALDO FINAL\s+\$\s*([\d,]+\.\d{2})/i);

    return {
      banco: this.banco,
      saldoInicial: saldoInicialMatch ? parseMonto(saldoInicialMatch[1]) : 0,
      saldoFinal: saldoFinalMatch ? parseMonto(saldoFinalMatch[1]) : 0,
      periodoDesde,
      periodoHasta,
    };
  }

  private normalizeDate(ddMmYyyy: string): string {
    const [day, month, year] = ddMmYyyy.split('-');
    return `${year}-${month}-${day}`;
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
      // Bancoomeva text extraction order is ALWAYS [CREDITO, SALDO, DEBITO].
      // The DEBITO column is the empty one ($0.00) and comes last.
      // Credit? No — we know from the real data that the order is consistent:
      // text order = [n1, n2, n3] where:
      //   n1 = CREDITO (or DEBITO if credit is empty — but debit is almost always the empty column)
      //   n2 = SALDO
      //   n3 = DEBITO (usually 0.00 for empty column)
      // We can determine DEBITO vs CREDITO from the description prefix:
      //   "N/C" = Nota Crédito → n1 is CREDITO, n3 is DEBITO(0)
      //   "N/D" or "N/DND" = Nota Débito → n1 is DEBITO, n3 is DEBITO(?)
      // For safety: saldo is ALWAYS the middle number (n2). For n1 and n3,
      // check description prefix.
      const descPrefix = rest.slice(descEndIndex, numbers[0].start);
      const isNotaCredito = /N\/C\b/i.test(rest);
      const isNotaDebito = /N\/D\b/i.test(rest);

      saldoVal = parseMonto(numbers[1].value);

      if (isNotaCredito && !isNotaDebito) {
        // N/C → this is a credit transaction
        creditoVal = parseMonto(numbers[0].value);
        debitoVal = parseMonto(numbers[2].value);
      } else {
        // N/D or no prefix → debit transaction (or fallback)
        debitoVal = parseMonto(numbers[0].value);
        creditoVal = parseMonto(numbers[2].value);
      }
      descEndIndex = numbers[0].start;
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
