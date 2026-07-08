import type { Comprobante } from './types';

type ComprobanteState = 'Completada' | 'Falta un comprobante' | 'Sin comprobantes';
type ComprobanteGranularity = 'falta_pago' | 'falta_cuenta_cobro' | null;

export interface ComprobanteStateResult {
  estado: ComprobanteState;
  faltante?: ComprobanteGranularity;
}

export const REQUIRED_COMPROBANTE_TYPES = [
  { name: 'Comprobante de pago', code: 'falta_pago' as const },
  { name: 'Cuenta de Cobro', code: 'falta_cuenta_cobro' as const },
];

export function derivarEstadoComprobantes(
  comprobantes: Comprobante[],
  requiredTypes: { name: string; code: string }[] = REQUIRED_COMPROBANTE_TYPES,
): ComprobanteStateResult {
  const present = new Set(comprobantes.map(c => c.tipo).filter(Boolean));
  const missing = requiredTypes.filter(r => !present.has(r.name));

  if (missing.length === 0) return { estado: 'Completada' };
  if (missing.length === requiredTypes.length) return { estado: 'Sin comprobantes' };
  if (missing.length === 1) {
    return { estado: 'Falta un comprobante', faltante: missing[0].code as ComprobanteGranularity };
  }
  // Edge case: 2+ missing (future-proofing)
  return { estado: 'Falta un comprobante' };
}
