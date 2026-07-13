import { ErConfig } from '@/lib/types';

export const DEFAULT_ER_CONFIG: ErConfig = {
  taxRegime: 'simple',
  lineItems: {
    // Empty arrays = fallback to "all projects of matching tipo"
    // (see computePnL for fallback logic)
    ingresos: { projectIds: [] },
    otrosIngresos: { projectIds: [] },
    costos: { projectIds: [] },
    gastosAdmin: { projectIds: [] },
    gastosFinancieros: { projectIds: [] },
  },
};
