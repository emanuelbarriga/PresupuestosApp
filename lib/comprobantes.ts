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

/**
 * Default mapping from tipoDocumento values to required comprobante type names.
 *
 * - `comprobante_egreso` → "Comprobante de pago"
 * - `comprobante_ingreso` → "Cuenta de Cobro"
 * - Legacy identity entries so that old `Comprobante.tipo` values pass through.
 */
export const DEFAULT_TIPO_MEDIO_MAPPING: Record<string, string> = {
  comprobante_egreso: 'Comprobante de pago',
  comprobante_ingreso: 'Cuenta de Cobro',
  'Comprobante de pago': 'Comprobante de pago',
  'Cuenta de Cobro': 'Cuenta de Cobro',
};

/** Extract the effective tipo value from a doc that may have either `tipo` or `tipoDocumento`. */
function extractTipo(doc: { tipo?: string; tipoDocumento?: string }): string | undefined {
  return doc.tipoDocumento ?? doc.tipo;
}

/**
 * Derive the comprobante state for an Ejecucion based on its linked documents.
 *
 * Accepts `Comprobante[]` (legacy), `DocumentoMedio[]`, or `_linkedDocumentos`-style arrays.
 * Uses `tipoMapping` to convert raw tipo values to required-type names.
 */
export function derivarEstadoComprobantes(
  documentos: Array<{ tipo?: string; tipoDocumento?: string }>,
  requiredTypes: { name: string; code: string }[] = REQUIRED_COMPROBANTE_TYPES,
  tipoMapping: Record<string, string> = DEFAULT_TIPO_MEDIO_MAPPING,
): ComprobanteStateResult {
  const presentTypes = new Set(
    documentos
      .map(d => {
        const rawTipo = extractTipo(d);
        return rawTipo ? tipoMapping[rawTipo] : undefined;
      })
      .filter((t): t is string => t !== undefined),
  );
  const missing = requiredTypes.filter(r => !presentTypes.has(r.name));

  if (missing.length === 0) return { estado: 'Completada' };
  if (missing.length === requiredTypes.length) return { estado: 'Sin comprobantes' };
  if (missing.length === 1) {
    return { estado: 'Falta un comprobante', faltante: missing[0].code as ComprobanteGranularity };
  }
  // Edge case: 2+ missing (future-proofing)
  return { estado: 'Falta un comprobante' };
}
