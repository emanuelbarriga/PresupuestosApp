import type { Banco } from '@/lib/types';
import type { ExtractoParser } from '@/lib/parsers/types';
import { BancolombiaParser } from '@/lib/parsers/strategies/bancolombia';
import { BancoomevaParser } from '@/lib/parsers/strategies/bancoomeva';
import { Global66Parser } from '@/lib/parsers/strategies/global66';

const BANCOLOMBIA_PATTERN = /bancolombia\.com/i;
const BANCOOMEVA_PATTERN = /Bancoomeva/i;
const GLOBAL66_PATTERN = /Movimientos de cuenta/i;
const GLOBAL66_COLUMNS = /Fecha.*Descripción.*Movimiento.*Tarjeta.*Débito.*Abono.*Saldo/i;

/**
 * Detect the bank from extracted PDF text by searching for known signatures.
 *
 * Priority order: Bancolombia > Bancoomeva > Global66
 * (Bancolombia first because its URL pattern is most specific.)
 */
export function detectarBanco(texto: string): Banco {
  if (BANCOLOMBIA_PATTERN.test(texto)) return 'Bancolombia';
  if (BANCOOMEVA_PATTERN.test(texto)) return 'Bancoomeva';
  // Global66: "Movimientos de cuenta" ya es suficientemente específico.
  // El patrón de columnas headers fallaba en algunos PDFs (enero, marzo, abril).
  if (GLOBAL66_PATTERN.test(texto)) return 'Global66';

  return 'No detectado';
}

/**
 * Get the appropriate parser for a given bank.
 *
 * @throws Error if the bank is not supported
 */
export function getParser(banco: Banco): ExtractoParser {
  switch (banco) {
    case 'Bancolombia':
      return new BancolombiaParser();
    case 'Bancoomeva':
      return new BancoomevaParser();
    case 'Global66':
      return new Global66Parser();
    default:
      throw new Error(`No hay un parser disponible para el banco: ${banco}`);
  }
}
