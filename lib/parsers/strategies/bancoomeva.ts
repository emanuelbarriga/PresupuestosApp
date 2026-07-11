import type { Banco, MovimientoBancarioInput } from '@/lib/types';
import type { ExtractoParser, ParseResult, ParseContext } from '@/lib/parsers/types';
import { parseMonto } from '@/lib/parsers/strategies/bancolombia';

// Bancoomeva PDF text extraction (pdfjs) produces ONE line per page, not one
// line per transaction row — everything on a page is packed together with
// whitespace. So instead of splitting on '\n' and expecting one row per line,
// we strip the recurring noise blocks (repeated on every page: the running
// summary and the legal disclaimer) and then locate transaction rows by their
// "DD-MM-YYYY" date anchor, wherever it appears in the text.
// The office/location varies ("OFICINA UNICENTRO BOGOTA", "LABORATORIO - CORE",
// etc.), so we split on any date boundary and filter by the presence of N/C or
// N/D (Nota Crédito / Nota Débito) which every transaction row contains.

// Combined number pattern matching en-US ("1,478.29"), es-CO ("1.478,29"),
// and bare decimals like ".83" (Bancoomeva omits the leading 0 for amounts < 1 peso).
const NUM = "\\d[\\d,]*(?:\\.\\d{2}(?!\\d))|\\d[\\d.]*(?:,\\d{2}(?!\\d))|\\.\\d{2}";

// Repeats verbatim on every page — strip entirely (dotall so it spans the
// embedded newlines between page blocks in the extracted text).
// Use [\\s\\S] instead of dotAll (/s) flag — target is ES2017
const DISCLAIMER_PATTERN = /Nuestra línea de Atención[\s\S]*?autónoma de Bancoomeva\./g;

// Running summary block repeated at the top of every page after page 1.
const SUMMARY_PATTERN = new RegExp(`SALDO INICIAL\\s+\\$\\s*(?:${NUM})[\\s\\S]*?SALDO FINAL\\s+\\$\\s*(?:${NUM})`, 'g');

// Split text at date boundaries to isolate each transaction row.
// Every row starts with DD-MM-YYYY followed by a location name.
// Non-row dates (e.g. header "DEL: 01-05-2026 AL: 29-05-2026") are filtered
// out by the N/C | N/D check below.
const ROW_SPLIT = /(?=\b\d{2}-\d{2}-\d{4}\s+)/;

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

    // Split by date boundaries — each transaction row starts with DD-MM-YYYY.
    // Non-row segments (header dates like "AL: DD-MM-YYYY", summary fragments)
    // are filtered out by checking for N/C or N/D (Nota Crédito / Nota Débito),
    // which every real Bancoomeva transaction row contains.
    const segments = cleaned.split(ROW_SPLIT);
    for (const segment of segments) {
      const trimmed = segment.trim();
      if (!trimmed) continue;
      // Skip segments that don't look like transaction rows
      if (!/N\/[CD]/i.test(trimmed)) continue;
      const mov = this.parseRow(trimmed);
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

  private extractContext(texto: string): ParseContext {
    const fullText = texto.replace(/\n/g, '  ');

    let periodoDesde: string | undefined;
    let periodoHasta: string | undefined;
    const periodMatch = fullText.match(/DEL:\s*(\d{2}-\d{2}-\d{4})\s+AL:\s*(\d{2}-\d{2}-\d{4})/i);
    if (periodMatch) {
      periodoDesde = this.normalizeDate(periodMatch[1]);
      periodoHasta = this.normalizeDate(periodMatch[2]);
    }

    // Find first SALDO INICIAL and last SALDO FINAL with their $values
    const siRe = new RegExp(`SALDO INICIAL[\\s\\S]*?\\$\\s*(${NUM})`, 'gi');
    const sfRe = new RegExp(`SALDO FINAL[\\s\\S]*?\\$\\s*(${NUM})`, 'gi');
    let saldoInicialMatch: RegExpExecArray | null = null;
    let saldoFinalMatch: RegExpExecArray | null = null;
    let mx: RegExpExecArray | null;
    while ((mx = siRe.exec(fullText)) !== null) { if (!saldoInicialMatch) saldoInicialMatch = mx; }
    while ((mx = sfRe.exec(fullText)) !== null) { saldoFinalMatch = mx; }

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
    const numberPattern = new RegExp(`(-?${NUM})`, 'g');
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

    // N/C y N/D pueden aparecer como N/C, N/CNC, N/D, N/DND.
    // En pdfjs flat mode, el orden de montos depende de qué columna
    // tiene valor distinto de cero (pdfjs omite $0.00 vacíos y los
    // reordena). Usamos el prefijo para determinar débito vs crédito.
    const isNotaCredito = /N\/C/i.test(rest);
    const isNotaDebito = /N\/D/i.test(rest);

    if (numCount >= 3) {
      // Flat (join(' ')) extraction order: [CREDITO, SALDO, DEBITO].
      // text order = [n1, n2, n3] where:
      //   n1 = CREDITO (or DEBITO if credit is empty)
      //   n2 = SALDO
      //   n3 = DEBITO (usually 0.00 for empty column)
      // Determine DEBITO vs CREDITO from the description prefix:
      //   "N/C" = Nota Crédito → n1 is CREDITO, n3 is DEBITO(0)
      //   "N/D" or "N/DND" = Nota Débito → n1 is DEBITO, n3 is DEBITO(?)

      saldoVal = parseMonto(numbers[1].value);

      if (isNotaCredito && !isNotaDebito) {
        // N/C → first is CREDITO, third is DEBITO(0)
        creditoVal = parseMonto(numbers[0].value);
        debitoVal = parseMonto(numbers[2].value);
      } else {
        // N/D or no prefix → first is DEBITO, third is CREDITO(0)
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
      const gapText = rest.slice(0, numbers[numCount - 2].start).trimEnd();
      const gapChars = numbers[numCount - 2].start - gapText.length;

      if (gapChars >= 4) {
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
