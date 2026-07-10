import type { Banco, MovimientoBancarioInput } from '@/lib/types';
import type { ExtractoParser, ParseResult, ParseContext } from '@/lib/parsers/types';

interface DateRange {
  desde: Date;
  hasta: Date;
  desdeYear: number;
  hastaYear: number;
}

export function parseMonto(text: string): number {
  const s = text.trim();
  // Strip non-numeric chars except commas, dots, and minus
  let cleaned = s.replace(/[^\d,.\-]/g, '');
  if (!cleaned || cleaned === '.' || cleaned === ',') return 0;

  const neg = cleaned.startsWith('-') ? -1 : 1;
  cleaned = cleaned.replace(/^-/, '');

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma > lastDot) {
    // es-CO format: dot=thousands, comma=decimal
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot >= 0) {
    // en-US format: comma=thousands, dot=decimal
    const after = cleaned.slice(lastDot + 1);
    if (after.length === 2 && /^\d{2}$/.test(after)) {
      cleaned = cleaned.replace(/,/g, '');
    } else {
      cleaned = cleaned.replace(/\./g, '');
    }
  } else {
    // No decimal separator — just remove commas
    cleaned = cleaned.replace(/,/g, '');
  }

  const result = parseFloat(cleaned) * neg;
  return Number.isFinite(result) ? result : 0;
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

// Combined number pattern matching both en-US ("1,478.29") and es-CO ("1.478,29") formats.
// Uses negative lookahead (?!\d) to prevent partial matches (e.g. matching "1.47" inside "1.478,29").
const NUM_PATTERN = "\\d[\\d,]*(?:\\.\\d{2}(?!\\d))|\\d[\\d.]*(?:,\\d{2}(?!\\d))";

export function extractSaldos(text: string): { saldoInicial: number; saldoFinal: number } | null {
  // Extraer el bloque RESUMEN entre el encabezado y la tabla de datos.
  const resumen = text.match(/SALDO ANTERIOR[\s\S]*?FECHA\s+DESCRIPCI[ÓO]N/);
  if (!resumen) return null;
  const block = resumen[0];

  // Estrategia 1: Y-grouping — cada etiqueta tiene su $ en la misma línea
  const siY = block.match(new RegExp(`SALDO ANTERIOR[^$]*\\$\\s*(${NUM_PATTERN})`));
  const sfY = block.match(new RegExp(`SALDO ACTUAL[^$]*\\$\\s*(${NUM_PATTERN})`));
  if (siY && sfY) {
    return {
      saldoInicial: parseMonto(siY[1]),
      saldoFinal: parseMonto(sfY[1]),
    };
  }

  // Estrategia 2: flat mode — 4 $ juntos, luego 4 números: SI, TA, TC, SF
  const flat = block.match(
    new RegExp(
      `\\$\\s*\\$\\s*\\$\\s*\\$\\s*(${NUM_PATTERN})\\s+(${NUM_PATTERN})\\s+(${NUM_PATTERN})\\s+(${NUM_PATTERN})`,
    ),
  );
  if (flat) {
    return {
      saldoInicial: parseMonto(flat[1]),
      saldoFinal: parseMonto(flat[4]),
    };
  }

  return null;
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
    const saldos = extractSaldos(texto);
    const context: ParseContext = {
      banco: this.banco,
      saldoInicial: saldos?.saldoInicial ?? 0,
      saldoFinal: saldos?.saldoFinal ?? 0,
      periodoDesde: dateRange ? this.formatDate(dateRange.desde) : undefined,
      periodoHasta: dateRange ? this.formatDate(dateRange.hasta) : undefined,
    };

    if (!dateRange) {
      return { movimientos: [], context, errores: ['No se pudo extraer el rango de fechas del encabezado'] };
    }

    const cleanedText = this.cleanText(texto);
    const sections = cleanedText.split('\n\n');

    // Columnar detection: 4+ consecutive dates with only whitespace between them
    const columnarRegex = /\b(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\b/;

    const allRows: Omit<MovimientoBancarioInput, 'ordinal'>[] = [];
    const seen = new Set<string>();

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      const sectionRows = columnarRegex.test(trimmed)
        ? this.extractColumnar(trimmed, dateRange)
        : this.extractRows(trimmed, dateRange);

      for (const row of sectionRows) {
        const key = `${row.fecha}|${row.saldo}`;
        if (!seen.has(key)) {
          seen.add(key);
          allRows.push(row);
        }
      }
    }

    // Sort by fecha ascending
    allRows.sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Assign sequential ordinals
    const movimientos: MovimientoBancarioInput[] = allRows.map((row, index) => ({
      ...row,
      ordinal: index + 1,
    }));

    return { movimientos, context };
  }

  private extractColumnar(
    section: string,
    dateRange: DateRange,
  ): Omit<MovimientoBancarioInput, 'ordinal'>[] {
    // Extract all dates
    const dateRegex = /\b(\d{1,2}\/\d{1,2})\b/g;
    const dates: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = dateRegex.exec(section)) !== null) {
      dates.push(m[1]);
    }
    const n = dates.length;
    if (n < 2) return [];

    // Remove dates from the section text
    let withoutDates = section.replace(/\b\d{1,2}\/\d{1,2}\b/g, ' ');
    withoutDates = withoutDates.replace(/\s+/g, ' ').trim();

    // Extract all numbers (both en-US and es-CO) from the remaining text
    const numPattern = /(-?\d[\d,]*(?:\.\d{2}(?!\d))|-?\d[\d.]*(?:,\d{2}(?!\d)))/g;
    const allNumbers: number[] = [];
    let numMatch: RegExpExecArray | null;
    while ((numMatch = numPattern.exec(withoutDates)) !== null) {
      allNumbers.push(parseMonto(numMatch[1]));
    }
    if (allNumbers.length < n) return [];

    // Split into amounts (first N) and saldos (last N)
    let amounts: number[];
    let saldos: number[];
    if (allNumbers.length >= n * 2) {
      amounts = allNumbers.slice(0, n);
      saldos = allNumbers.slice(-n);
    } else {
      const k = Math.max(0, allNumbers.length - n);
      amounts = allNumbers.slice(0, k);
      saldos = allNumbers.slice(k);
      while (amounts.length < n) {
        amounts.push(0);
      }
    }

    // Extract description text: everything before the first number with decimal separator
    const firstNumberMatch = withoutDates.match(/-?[\d,.]+[.,]\d{2}(?!\d)/);
    const descText = firstNumberMatch
      ? withoutDates.slice(0, firstNumberMatch.index).trim()
      : withoutDates;

    // Split description text by anchor keywords
    const anchors = descText.split(
      /\b(ABONO|AJUSTE|COBRO|COMPRA|CUOTA|IMPTO|PAGO|SERVICIO|TRANSFERENCIA|INTERBANC)\b\s*/i,
    );

    const descParts: string[] = [];
    let i = 1;
    while (i < anchors.length && descParts.length < n) {
      const anchor = anchors[i] || '';
      const rest = (i + 1 < anchors.length ? anchors[i + 1] : '').trim();
      descParts.push((anchor + ' ' + rest).trim());
      i += 2;
    }

    // Expand descriptions that contain standalone "0" tokens (bank bug —
    // real transactions where the description shows as "0"). Each standalone
    // "0" represents a separate row that must be kept.
    const expanded: string[] = [];
    for (const part of descParts) {
      const tokens = part.match(/\b0\b/g);
      if (tokens && tokens.length > 0 && part.replace(/\b0\b/g, '').trim().length > 0) {
        // Split at zero boundaries: "IMPTO GOBIERNO 4X1000 0 0 0" →
        // ["IMPTO GOBIERNO 4X1000", "0", "0", "0"]
        const segments = part.split(/\b0\b/);
        for (let s = 0; s < segments.length; s++) {
          const seg = segments[s].trim();
          if (seg) expanded.push(seg);
          if (s < segments.length - 1) expanded.push('0'); // keep "0" as description
        }
      } else {
        expanded.push(part);
      }
    }
    descParts.length = 0;
    descParts.push(...expanded);

    // If too many descriptions, merge shortest adjacent pairs
    while (descParts.length > n) {
      let best = 0;
      let bestLen = Infinity;
      for (let j = 0; j < descParts.length - 1; j++) {
        const combined = descParts[j].split(/\s+/).length + descParts[j + 1].split(/\s+/).length;
        if (combined < bestLen) {
          bestLen = combined;
          best = j;
        }
      }
      descParts[best] = (descParts[best] + ' ' + descParts[best + 1]).trim();
      descParts.splice(best + 1, 1);
    }

    // Pad descriptions if fewer than expected
    while (descParts.length < n) {
      descParts.push('');
    }

    // Build rows
    const rows: Omit<MovimientoBancarioInput, 'ordinal'>[] = [];
    for (let j = 0; j < n; j++) {
      const fecha = parseFechaBancolombia(dates[j], dateRange);
      const valor = amounts[j] ?? 0;
      const saldo = saldos[j] ?? 0;
      const debito = valor < 0 ? Math.abs(valor) : undefined;
      const credito = valor > 0 ? valor : undefined;

      rows.push({
        fecha,
        descripcion: descParts[j].replace(/\s+/g, ' ').trim(),
        debito,
        credito,
        saldo,
        moneda: 'COP',
        bancoOrigen: this.banco,
      });
    }
    return rows;
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private cleanText(texto: string): string {
    // El texto llega con Y-grouping (row-layout mode): cada fila del PDF es
    // una línea separada por \n. Las páginas se separan por \n\n. Usamos
    // regex sobre el texto completo para remover encabezados y resúmenes.
    let cleaned = texto;

    // Remove page headers: desde "ESTADO DE CUENTA" hasta la columna de datos
    // (VALOR SALDO). Esto cubre el encabezado de página, PÁGINA:, dirección,
    // RESUMEN summary, SALDO ANTERIOR, etc. — todo lo que está antes de los
    // datos tabulares.
    cleaned = cleaned.replace(/ESTADO DE CUENTA[\s\S]*?VALOR\s+SALDO\s*/g, '');

    // Remove "FIN ESTADO DE CUENTA + oficina" pero NO lo que sigue (montos/saldos).
    // En página 3, los montos y saldos aparecen DESPUÉS de "FIN ESTADO DE CUENTA
    // UNICENTRO CALI", no antes — usar $ al final los borraría.
    cleaned = cleaned.replace(/FIN\s+ESTADO[\s\S]*?(?=\s*-?\d[\d,.]*(?:\.\d{2}|,\d{2})|\s*$)/gi, '');

    // Remaining standalone "VIGILADO" references (no date nearby)
    cleaned = cleaned.replace(/VIGILADO/g, '');

    // Collapse excessive whitespace but keep minimal spacing between items
    cleaned = cleaned.replace(/[ \t]+/g, ' ').trim();

    return cleaned;
  }

  private extractRows(texto: string, dateRange: DateRange): Omit<MovimientoBancarioInput, 'ordinal'>[] {
    const movimientos: Omit<MovimientoBancarioInput, 'ordinal'>[] = [];

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
        movimientos.push(row);
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
    const numberPattern = /(-?\d[\d,]*(?:\.\d{2}(?!\d))|-?\d[\d.]*(?:,\d{2}(?!\d)))/g;
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

    // Skip truly empty or all-digit descriptions.
    // Exception: bank-bug "0" description with non-zero valor IS a real transaction.
    if (!descripcion) return null;
    const isAllDigits = /^\d+$/.test(descripcion.replace(/[\s,.]+/g, ''));
    if (isAllDigits && (descripcion !== '0' || valor === 0)) return null;

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
