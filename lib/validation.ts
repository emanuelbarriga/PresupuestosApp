/**
 * Validates that the sum of budget link amounts is within tolerance (≤1 COP) of the ejecucion amount.
 * This prevents drift between the ejecucion's montoEjecutado and its linked budget totals.
 *
 * @param montoEjecutado - The total amount of the ejecucion
 * @param links - Array of budget links with monto values
 * @returns true if the difference is within tolerance (≤ 1), false otherwise
 */
export function validateBudgetLinkSum(
  montoEjecutado: number,
  links: Array<{ monto: number | string | null | undefined }>,
): boolean {
  if (links.length === 0) return true;
  const totalLinks = links.reduce((s, l) => s + (Number(l.monto) || 0), 0);
  return Math.abs(montoEjecutado - totalLinks) <= 1;
}
