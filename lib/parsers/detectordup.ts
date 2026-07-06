import type { MovimientoBancarioInput } from '@/lib/types';

/**
 * Generate a SHA-256 fingerprint for a bank movement.
 *
 * The fingerprint is built from the core fields: fecha, descripcion, debito, credito, saldo.
 * It does NOT include ordinal, moneda, bancoOrigen, or other metadata — these are not
 * intrinsic to the transaction itself.
 *
 * @returns First 16 bytes of SHA-256 hash as a 32-char hex string
 */
export async function generarHuella(mov: MovimientoBancarioInput): Promise<string> {
  const input = [
    mov.fecha,
    mov.descripcion,
    mov.debito ?? '',
    mov.credito ?? '',
    mov.saldo,
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  const hashArray = new Uint8Array(hashBuffer);
  const first16 = hashArray.slice(0, 16);

  return Array.from(first16)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Detect duplicate movements by comparing their fingerprints against a set of
 * existing hashes (e.g., from previously parsed extractos).
 *
 * Each movement with a matching hash gets `posibleDuplicado = true`.
 *
 * @param movs Movements to check
 * @param hashesExistentes Known hashes from previous parsing
 * @returns Same array with `posibleDuplicado` flags set
 */
export async function detectarDuplicados(
  movs: MovimientoBancarioInput[],
  hashesExistentes: string[]
): Promise<MovimientoBancarioInput[]> {
  if (movs.length === 0) return [];

  const existingSet = new Set(hashesExistentes);
  const results: MovimientoBancarioInput[] = [];

  for (const mov of movs) {
    const huella = await generarHuella(mov);
    results.push({
      ...mov,
      posibleDuplicado: existingSet.has(huella) || undefined,
    });
  }

  return results;
}
