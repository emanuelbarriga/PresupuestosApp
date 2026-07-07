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

function extractSaldos(text: string): { saldoInicial: number; saldoFinal: number } | null {
  // RESUMEN block: "SALDO ANTERIOR  TOTAL ABONOS  TOTAL CARGOS  SALDO ACTUAL  $ $ $ $  V1 V2 V3 V4"
  // V1 = SALDO ANTERIOR (saldoInicial), V4 = SALDO ACTUAL (saldoFinal)
  const match = text.match(
    /SALDO ANTERIOR\s+TOTAL ABONOS\s+TOTAL CARGOS\s+SALDO ACTUAL\s+\$\s*\$\s*\$\s*\$\s*([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/,
  );
  if (!match) return null;
  return {
    saldoInicial: parseMonto(match[1]),
    saldoFinal: parseMonto(match[4]),
  };
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

    // Process the text: remove page headers and summaries
    const cleanedText = this.cleanText(texto);

    // Some pages have row-by-row layout (page 1), others have columnar layout
    // (pages 2+ where all dates cluster first, then descriptions, then amounts,
    // then saldos). Try row-by-row first, then fall back to columnar for any
    // remaining text after cleaning.
    const rowRows = this.extractRows(cleanedText, dateRange);

    // Check if the columnar extraction should also run — if the row-by-row
    // extractor left unconsumed dates in a columnar arrangement, we detect
    // by counting how many dates weren't matched to a valid segment
    if (!this.hasRemainingColumnar(cleanedText, rowRows.length > 0)) {
      return { movimientos: rowRows, context };
    }

    // Columnar extraction: split by page sections
    const sections = cleanedText.split('\n\n').filter(Boolean);
    const colRows: MovimientoBancarioInput[] = [];

    for (const section of sections) {
      if (this.isColumnarSection(section)) {
        colRows.push(...this.extractColumnarSection(section, dateRange));
      }
    }

    // Merge: row-by-row results + columnar results, renumbered
    const allRows = [...rowRows];
    let ordinal = allRows.length;
    for (const row of colRows) {
      // Skip rows where the amount is suspicious (value > 10M, likely a saldo
      // leaked into the amounts array at the page boundary).
      const valor = row.debito ?? row.credito ?? 0;
      if (valor > 10_000_000 && row.saldo > 10_000_000) continue;

      // Skip rows that are duplicate dates already captured by row-by-row
      const isDuplicate = allRows.some(
        r => r.fecha === row.fecha && r.saldo === row.saldo
          && Math.abs((r.debito ?? r.credito ?? 0) - (row.debito ?? row.credito ?? 0)) < 0.01
      );
      if (!isDuplicate) {
        ordinal++;
        allRows.push({ ...row, ordinal });
      }
    }

    return { movimientos: allRows, context };
  }

  /**
   * Check if the cleaned text has columnar sections that weren't processed.
   */
  private hasRemainingColumnar(texto: string, hasRowRows: boolean): boolean {
    // Columnar sections have 4+ consecutive dates with only whitespace between
    // them (no descriptions, amounts, or numbers between them)
    const colCluster = texto.match(/\b(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\b/);
    return colCluster !== null;
  }

  /**
   * Detect if a page section is columnar (all dates clustered, then descriptions,
   * then amounts, then saldos) vs. row-by-row (each row has date+desc+amounts).
   */
  private isColumnarSection(texto: string): boolean {
    // If 4+ consecutive dates with only whitespace between them → columnar
    const cluster = texto.match(/\b(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\b/);
    return cluster !== null;
  }

  /**
   * Extract rows from a columnar page section.
   * Format: "7/02 8/02 ... [dates] ... desc1 desc2 ... vals1 vals2 ... saldos1 saldos2 ..."
   */
  private extractColumnarSection(texto: string, dateRange: DateRange): MovimientoBancarioInput[] {
    // 1. Extract all dates
    const dateRegex = /\b(\d{1,2}\/\d{1,2})\b/g;
    const fechas: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = dateRegex.exec(texto)) !== null) {
      fechas.push(m[1]);
    }
    const n = fechas.length;
    if (n < 2) return [];

    // 2. Remove dates from the text
    const withoutDates = texto.replace(/\b\d{1,2}\/\d{1,2}\b/g, ' ').replace(/\s+/g, ' ').trim();

    // 3. Find ALL numbers (amounts + saldos) in order of appearance
    const numRegex = /(-?[\d,]*\.\d{2})/g;
    const allNumbers: number[] = [];
    while ((m = numRegex.exec(withoutDates)) !== null) {
      allNumbers.push(parseMonto(m[1]));
    }

    // If we have fewer than n numbers total, we can't make rows for all dates
    if (allNumbers.length < n) return [];

    // In the columnar layout: amounts come FIRST, then saldos LAST.
    // Con N fechas, esperamos 2×N números totales. Si hay menos (porque un
    // número salió sin decimales en la extracción), usamos posición secuencial:
    // primeros N = amounts, últimos N = saldos (pueden traslaparse cuando
    // numbers.length < 2×N; la fila traslapada recibe amount 0).
    const totalNums = allNumbers.length;
    let amounts: number[];
    let saldos: number[];
    if (totalNums >= n * 2) {
      amounts = allNumbers.slice(0, n);
      saldos = allNumbers.slice(totalNums - n);
    } else {
      // Menos de 2n números: el límite entre amounts y saldos no está claro.
      // Usamos magnitud como desempate: en Bancolombia los saldos son siempre
      // >= 5M, los montos (débitos/créditos) son menores a 2M.
      // El número en posición k = totalNums-n define de qué lado cae.
      const k = Math.max(0, totalNums - n);
      const overlapNum = k > 0 && k < allNumbers.length ? allNumbers[k] : 0;
      const isOverlapSaldo = overlapNum >= 5_000_000;

      if (isOverlapSaldo) {
        // El número k es un saldo → amounts son first k, saldos desde k
        amounts = allNumbers.slice(0, k);
        saldos = allNumbers.slice(k);
        while (amounts.length < n) amounts.push(0); // última fila sin amount
      } else {
        // El número k es un amount → amounts son first k+1, saldos desde k+1
        amounts = allNumbers.slice(0, k + 1);
        saldos = allNumbers.slice(k + 1);
        while (saldos.length < n) saldos.push(0); // última fila sin saldo
      }
    }

    // 4. Description text: everything before the first number in withoutDates
    const firstNumIdx = withoutDates.search(/(-?[\d,]*\.\d{2})/);
    let descText = '';
    if (firstNumIdx > -1) {
      descText = withoutDates.slice(0, firstNumIdx).trim();
    } else {
      descText = withoutDates;
    }

    // 5. Split descriptions usando palabras ancla.
    // Todas las descripciones de Bancolombia empiezan con una de estas
    // palabras clave: ABONO, AJUSTE, COBRO, COMPRA, CUOTA, IMPTO, PAGO,
    // SERVICIO, TRANSFERENCIA, o "0" (items de mantenimiento del banco).
    // pdfjs join(' ') aplana todo a espacios simples, así que no podemos
    // usar split(/\s{3,}/). Pero estas anclas marcan boundaries reales.
    const anchorRegex = /\b(ABONO|AJUSTE|COBRO|COMPRA|CUOTA|IMPTO|PAGO|SERVICIO|TRANSFERENCIA|INTERBANC|0)\b\s*/gi;
    const descParts: string[] = [];
    // split con capturing group: [before, capture1, between1, capture2, ...]
    const tokens = descText.split(anchorRegex);
    // Pair each anchor with its following text
    let i = 1; // Start at index 1 (first element is text before first anchor)
    while (i < tokens.length && descParts.length < n) {
      const anchor = tokens[i] ?? '';
      const rest = (tokens[i + 1] ?? '').trim();
      descParts.push((anchor + ' ' + rest).trim());
      i += 2;
    }
    // El split por anclas puede producir más de N partes cuando una palabra
    // clave aparece dentro de una descripción existente. Ej: "SERVICIO
    // TRANSFERENCIA VIRTUAL" → "SERVICIO" + "TRANSFERENCIA VIRTUAL" porque
    // TRANSFERENCIA es ancla. En vez de fusionar desde el final (que desfasa),
    // buscamos el par adyacente con MENOS palabras totales — es el candidato
    // más probable de falso split:
    //   "SERVICIO"(1) + "TRANSFERENCIA VIRTUAL"(2) = 3 palabras
    //   "TRANSFERENCIA VIRTUAL"(2) + "IMPTO..."(3) = 5 palabras
    // → fusionamos el par de 3 palabras = "SERVICIO TRANSFERENCIA VIRTUAL".
    while (descParts.length > n) {
      let bestIdx = 0;
      let bestLen = Infinity;
      for (let mi = 0; mi < descParts.length - 1; mi++) {
        const combined = descParts[mi].split(/\s+/).length + descParts[mi + 1].split(/\s+/).length;
        if (combined < bestLen) { bestLen = combined; bestIdx = mi; }
      }
      descParts[bestIdx] = (descParts[bestIdx] + ' ' + descParts[bestIdx + 1]).trim();
      descParts.splice(bestIdx + 1, 1);
    }
    // Rellenar si faltan partes
    while (descParts.length < n) descParts.push('');

    // 6. Zip into rows
    const rows: MovimientoBancarioInput[] = [];
    for (let i = 0; i < n; i++) {
      const valor = amounts[i] ?? 0;
      const saldo = saldos[i] ?? 0;
      rows.push({
        fecha: parseFechaBancolombia(fechas[i], dateRange),
        descripcion: (descParts[i] ?? `Mov. pág. col.`).trim(),
        debito: valor < 0 ? Math.abs(valor) : undefined,
        credito: valor > 0 ? valor : undefined,
        saldo,
        moneda: 'COP',
        bancoOrigen: this.banco,
        ordinal: i + 1,
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
    // pdfjs extrae cada página como UNA línea larga (todo unido con espacios),
    // NO como líneas separadas por \n. Por lo tanto no podemos split('\n') y
    // filtrar líneas — remueve TODO porque la página entera empieza con
    // "ESTADO DE CUENTA". Usamos regex sobre el texto completo en su lugar.
    let cleaned = texto;

    // Remove page headers: desde "ESTADO DE CUENTA" hasta la columna de datos
    // (VALOR SALDO). Esto cubre el encabezado de página, PÁGINA:, dirección,
    // RESUMEN summary, SALDO ANTERIOR, etc. — todo lo que está antes de los
    // datos tabulares.
    cleaned = cleaned.replace(/ESTADO DE CUENTA[\s\S]*?VALOR\s+SALDO\s*/g, '');

    // Remove "FIN ESTADO DE CUENTA + oficina" pero NO lo que sigue (montos/saldos).
    // En página 3, los montos y saldos aparecen DESPUÉS de "FIN ESTADO DE CUENTA
    // UNICENTRO CALI", no antes — usar $ al final los borraría.
    cleaned = cleaned.replace(/FIN\s+ESTADO[\s\S]*?(?=\s*-?\d[\d,]*(?:\.\d{2})|\s*$)/gi, '');

    // Remaining standalone "VIGILADO" references (no date nearby)
    cleaned = cleaned.replace(/VIGILADO/g, '');

    // Collapse excessive whitespace but keep minimal spacing between items
    cleaned = cleaned.replace(/[ \t]+/g, ' ').trim();

    return cleaned;
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
    const numberPattern = /(-?[\d,]*\.\d{2})/g;
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
