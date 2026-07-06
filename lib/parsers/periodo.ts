import { MONTHS, type Month } from '@/lib/types';

export interface PeriodoDerivado {
  mes: Month | '';
  anio: number | null;
}

/**
 * Derive `mes` (Spanish month name) and `anio` (year) from a `periodoDesde`
 * string in "YYYY-MM-DD" format, as returned by an `ExtractoParser`'s
 * `ParseContext`.
 *
 * Returns `{ mes: '', anio: null }` when the input is missing or malformed.
 */
export function derivarMesAnio(periodoDesde: string | undefined): PeriodoDerivado {
  if (!periodoDesde) return { mes: '', anio: null };

  const parts = periodoDesde.split('-');
  if (parts.length < 2) return { mes: '', anio: null };

  const anio = parseInt(parts[0], 10);
  const mesNum = parseInt(parts[1], 10);

  if (isNaN(anio) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
    return { mes: '', anio: null };
  }

  return { mes: MONTHS[mesNum - 1], anio };
}
