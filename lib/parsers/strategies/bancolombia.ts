import type { Banco, MovimientoBancarioInput } from '@/lib/types';
import type { ExtractoParser, ParseResult, ParseContext } from '@/lib/parsers/types';

interface DateRange {
  desde: Date;
  hasta: Date;
  desdeYear: number;
  hastaYear: number;
}

function parseMonto(text: string): number {
  // Remove $, commas, and any whitespace
  const cleaned = text.replace(/[$,\s]/g, '');
  return parseFloat(cleaned);
}

function inferirAnio(mes: number, range: DateRange): number {
  const mesDesde = range.desde.getMonth() + 1; // 1-based
  const desdeYear = range.desdeYear;
  const hastaYear = range.hastaYear;

  if (desdeYear === hastaYear) return desdeYear;

  // Cross-year scenario: DESDE is in December, HASTA in January
  // If month is January and DESDE month is December, use HASTA year
  if (mes === 1 && mesDesde === 12) return hastaYear;
  if (mes === 12 && mesDesde === 12) return desdeYear;

  // Default: if month >= DESDE month, use DESDE year, else HASTA year
  return mes >= mesDesde ? desdeYear : hastaYear;
}

function parseFechaBancolombia(fechaStr: string, range: DateRange): string {
  const [dia, mes] = fechaStr.split('/').map(Number);
  const anio = inferirAnio(mes, range);
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function extractDateRange(text: string): DateRange | null {
  const match = text.match(/DESDE:\s*(\d{4})\/(\d{2})\/(\d{2})\s+HASTA:\s*(\d{4})\/(\d{2})\/(\d{2})/);
  if (!match) return null;

  const desdeYear = parseInt(match[1], 10);
  const desdeMonth = parseInt(match[2], 10) - 1;
  const desdeDay = parseInt(match[3], 10);
  const hastaYear = parseInt(match[4], 10);
  const hastaMonth = parseInt(match[5], 10) - 1;
  const hastaDay = parseInt(match[6], 10);

  return {
    desde: new Date(desdeYear, desdeMonth, desdeDay),
    hasta: new Date(hastaYear, hastaMonth, hastaDay),
    desdeYear,
    hastaYear,
  };
}

// Pattern to match a transaction row: date D/M, then text, then VALOR, then SALDO
// The VALOR and SALDO are the last two number patterns in the row segment
// Pattern to match a date D/M or D/MM with single or double digit month

export class BancolombiaParser implements ExtractoParser {
  readonly banco: Banco = 'Bancolombia';

  parse(texto: string): ParseResult {
    const dateRange = extractDateRange(texto);
    const context: ParseContext = {
      banco: this.banco,
      saldoInicial: 0,
      saldoFinal: 0,
      periodoDesde: dateRange ? this.formatDate(dateRange.desde) : undefined,
      periodoHasta: dateRange ? this.formatDate(dateRange.hasta) : undefined,
    };

    if (!dateRange) {
      return { movimientos: [], context, errores: ['No se pudo extraer el rango de fechas del encabezado'] };
    }

    // Process the text: remove page headers and summaries
    const cleanedText = this.cleanText(texto);
    const movimientos = this.extractRows(cleanedText, dateRange);

    return { movimientos, context };
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private cleanText(texto: string): string {
    // Remove page header lines (lines starting with "ESTADO DE CUENTA")
    // Remove "VIGILADO" lines
    // Remove page summary blocks (lines with RESUMEN, SALDO ANTERIOR, TOTAL ABONOS, etc.)
    // Remove "FIN ESTADO DE CUENTA" lines
    const lines = texto.split('\n').filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return false;

      // Remove page headers
      if (/^ESTADO DE CUENTA/.test(trimmed)) return false;

      // Remove VIGILADO lines
      if (/VIGILADO/.test(trimmed) && !/\d{1,2}\/\d{2}/.test(trimmed)) return false;

      // Remove column header lines
      if (/^FECHA\s+DESCRIPCI/.test(trimmed)) return false;

      // Remove summary blocks
      if (/^(RESUMEN|SALDO ANTERIOR|TOTAL ABONOS|TOTAL CARGOS|SALDO ACTUAL|SALDO PROMEDIO|CUENTAS\s+X\s+COBRAR|VALOR INTERESES|RETEFUENTE)/.test(trimmed)) return false;

      // Remove "FIN ESTADO DE CUENTA" lines
      if (/^FIN\s+ESTADO/.test(trimmed)) return false;

      // Remove lines with only numbers and spaces (broken fragments)
      if (/^[\d\s,.$]+$/.test(trimmed) && !/\d{1,2}\/\d{2}/.test(trimmed)) return false;

      return true;
    });

    return lines.join('\n');
  }

  private extractRows(texto: string, dateRange: DateRange): MovimientoBancarioInput[] {
    const movimientos: MovimientoBancarioInput[] = [];
    let ordinal = 0;

    // Remove DCTO. column reference lines
    // The column header is already removed, but we need to process the data
    // Strategy: scan the text for date patterns and parse segments

    // Normalize multiple spaces to single space for easier parsing
    // But keep newlines to identify line breaks
    const normalized = texto.replace(/[ \t]+/g, ' ');

    // Find all date occurrences and extract segments between them
    // Date must be preceded by whitespace or start of string to avoid matching within year strings like "2026/01/01"
    const dateRegex = /(?:^|\s)(\d{1,2}\/\d{1,2})(?=\s|$)/g;
    const segments: Array<{ date: string; text: string }> = [];
    let lastIndex = 0;
    let lastDate = '';
    let match: RegExpExecArray | null;

    while ((match = dateRegex.exec(normalized)) !== null) {
      if (lastDate) {
        segments.push({
          date: lastDate,
          text: normalized.slice(lastIndex, match.index).trim(),
        });
      }
      lastDate = match[1];
      lastIndex = match.index + match[0].length;
    }
    // Last segment
    if (lastDate) {
      segments.push({
        date: lastDate,
        text: normalized.slice(lastIndex).trim(),
      });
    }

    for (const segment of segments) {
      const row = this.parseSegment(segment.date, segment.text, dateRange);
      if (row) {
        ordinal++;
        movimientos.push({ ...row, ordinal });
      }
    }

    return movimientos;
  }

  private parseSegment(
    dateStr: string,
    text: string,
    dateRange: DateRange
  ): Omit<MovimientoBancarioInput, 'ordinal'> | null {
    // Find numbers in the text, tracking positions to avoid matching
    // number substrings within other numbers (e.g., "0.00" inside "1,000.00")
    interface NumberMatch {
      value: string;
      start: number;
      end: number;
    }
    const numberPattern = /(-?[\d,]+\.\d{2})/g;
    const numbers: NumberMatch[] = [];
    let numMatch: RegExpExecArray | null;

    while ((numMatch = numberPattern.exec(text)) !== null) {
      numbers.push({
        value: numMatch[1],
        start: numMatch.index,
        end: numMatch.index + numMatch[0].length,
      });
    }

    if (numbers.length < 2) return null;

    // The last two numbers are VALOR and SALDO
    const valorMatch = numbers[numbers.length - 2];
    const saldoMatch = numbers[numbers.length - 1];
    const valor = parseMonto(valorMatch.value);
    const saldo = parseMonto(saldoMatch.value);

    // Description is everything before the VALOR number position
    const descripcion = text.slice(0, valorMatch.start).trim();

    // Skip rows with "0" description (bank bug), empty description, or all-digits
    if (!descripcion || descripcion === '0' || /^\d+$/.test(descripcion.replace(/[\s,.]+/g, ''))) return null;

    const fecha = parseFechaBancolombia(dateStr, dateRange);
    const debito = valor < 0 ? Math.abs(valor) : undefined;
    const credito = valor > 0 ? valor : undefined;

    return {
      fecha,
      descripcion: descripcion.replace(/\s+/g, ' ').trim(),
      debito,
      credito,
      saldo,
      moneda: 'COP',
      bancoOrigen: this.banco,
    };
  }
}
