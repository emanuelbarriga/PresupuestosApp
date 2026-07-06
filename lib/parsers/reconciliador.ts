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
 * @returns Same array with `requiereRevision` flags set
 */
export function reconciliar(
  movs: MovimientoBancarioInput[],
  saldoInicial: number,
  tolerancia: number = 0.01
): MovimientoBancarioInput[] {
  let saldoAnterior = saldoInicial;

  return movs.map(mov => {
    const expectedSaldo = saldoAnterior - (mov.debito ?? 0) + (mov.credito ?? 0);
    const diff = Math.abs(expectedSaldo - mov.saldo);

    const requiereRevision = diff > tolerancia;

    // When a row fails, use the EXPECTED saldo (not the reported one) as base
    // for the next row. This prevents cascading failures — only the truly
    // problematic row gets flagged.
    saldoAnterior = requiereRevision ? expectedSaldo : mov.saldo;

    return {
      ...mov,
      requiereRevision: requiereRevision || undefined,
    };
  });
}
