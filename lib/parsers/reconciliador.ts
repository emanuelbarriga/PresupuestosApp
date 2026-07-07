import type { MovimientoBancarioInput } from '@/lib/types';

/**
 * Reconcile bank movements by verifying that each row's saldo is consistent
 * with the previous row's saldo + the current row's movements.
 *
 * The formula is universal across banks:
 *   expectedSaldo = previousSaldo - (debito || 0) + (credito || 0)
 *
 * @param movs Movements to reconcile (must be in chronological order)
 * @param saldoInicial Opening balance for the period
 * @param tolerancia Allowed rounding difference (default 0.01)
 * @param onProgress optional callback invoked after each row is reconciled, as (current, total)
 * @returns Same array with `requiereRevision` flags set
 */
export function reconciliar(
  movs: MovimientoBancarioInput[],
  saldoInicial: number,
  tolerancia: number = 0.01,
  onProgress?: (current: number, total: number) => void,
): MovimientoBancarioInput[] {
  let saldoAnterior = saldoInicial;
  const total = movs.length;

  return movs.map((mov, idx) => {
    const expectedSaldo = saldoAnterior - (mov.debito ?? 0) + (mov.credito ?? 0);
    const diff = Math.abs(expectedSaldo - mov.saldo);

    let requiereRevision = false;
    let revisionMotivo: string | undefined;

    if (diff > tolerancia) {
      requiereRevision = true;
      // Check for specific issues
      if (mov.debito == null && mov.credito == null) {
        revisionMotivo = `Sin débito ni crédito — saldo esperado ${expectedSaldo.toFixed(2)}, obtenido ${mov.saldo.toFixed(2)}`;
      } else if (mov.debito === 0 && mov.credito === 0) {
        revisionMotivo = `Monto 0 — saldo esperado ${expectedSaldo.toFixed(2)}, obtenido ${mov.saldo.toFixed(2)}`;
      } else if (diff > 1000000) {
        revisionMotivo = `Diferencia grande (${diff.toFixed(2)}) — monto o saldo posiblemente incorrecto`;
      } else {
        revisionMotivo = `Saldo esperado ${expectedSaldo.toFixed(2)}, obtenido ${mov.saldo.toFixed(2)} (dif: ${diff.toFixed(2)})`;
      }
    }

    // ALWAYS use the bank's own reported saldo (not our calculated expectation)
    // as the base for the next row. The reported saldo is ground truth from the
    // bank, so a single bad row doesn't cascade — the next row is checked
    // against reality, not against our (possibly wrong) running calculation.
    saldoAnterior = mov.saldo;

    onProgress?.(idx + 1, total);

    return {
      ...mov,
      requiereRevision: requiereRevision || undefined,
      revisionMotivo,
    };
  });
}
