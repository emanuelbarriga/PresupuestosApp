import type { Banco, MovimientoBancarioInput } from '@/lib/types';

export interface ParseContext {
  banco: Banco;
  saldoInicial: number;
  saldoFinal: number;
  periodoDesde?: string;
  periodoHasta?: string;
}

export interface ParseResult {
  movimientos: MovimientoBancarioInput[];
  context: ParseContext;
  errores?: string[];
}

export interface ExtractoParser {
  banco: Banco;
  parse(texto: string): ParseResult;
}
