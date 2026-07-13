# Design: Dashboard Math Refactor

## Technical Approach

Extract 183 lines of inline data aggregation from Matrix's `useMemo` into pure functions in a new `useBudgetMatrix` module, test each function in isolation, then compose them back via a custom hook — zero behavioral changes, pixel-identical output.

## Architecture Decisions

| Decision | Choice | Alternative | Rationale |
|----------|--------|-------------|-----------|
| Module location | `components/hooks/useBudgetMatrix.ts` | `lib/matrix-utils.ts` | Co-locates hook with extracted logic; mirrors existing `components/utils/` pattern |
| `resolveProjectName` in deps | Excluded inmemo deps (matched current behavior) | Include it (technically correct) | Current Matrix `useMemo` omits it; inclusion would re-run on every Dashboard render (new inline fn each time), causing unnecessary recomputation |
| `matrixData.colTotals` | Not exposed by hook | Expose it unused | Dead code in current `matrixData` — `filteredTotals.colTotals` is the one rendered |
| `buildTerceroGroups` | Moved to new file, re-exported | Stay in Dashboard as import | Keeps all matrix math in one module; Dashboard imports it back |

## Data Flow

```
BEFORE (Matrix component):
  Props ─→ matrixData useMemo ─→ visibleRows useMemo ─→ filteredTotals useMemo ─→ Render
              (183 lines)           (32 lines)              (16 lines)

AFTER (Matrix component):
  Props ─→ useBudgetMatrix hook ──────────────────────────────────────────────→ Render
              │
              ├── buildMatrixData(params) → { rows, allMatrixBudgets, allMatrixEjecuciones }
              ├── filterAndSortRows(rows, options) → ProjectRow[]
              └── computeFilteredTotals(rows, visibleMonths) → FilteredTotals
```

## Module Structure

```
components/hooks/useBudgetMatrix.ts
├── Pure exports:
│   ├── getMonthFromDateStr(dateString: string): Month
│   ├── getDiferencia(presupuestado: number, ejecutado: number): number
│   ├── buildMatrixData(params: MatrixDataParams): MatrixDataResult
│   ├── computeFilteredTotals(rows: ProjectRow[], visibleMonths: Month[]): FilteredTotals
│   ├── filterAndSortRows(rows: ProjectRow[], options: FilterOptions): ProjectRow[]
│   └── buildTerceroGroups(budgets: Budget[], ejecuciones: Ejecucion[], mode): TerceroProject[]
└── Default export:
    └── useBudgetMatrix(params: UseBudgetMatrixParams): UseBudgetMatrixResult
```

## Interfaces / Contracts

```typescript
// Re-define TerceroRowdata (currently inside Matrix) as exported type
type TerceroRowdata = {
  entityId: string;
  entityName: string;
  entityType: string;
  presupuestoPorMes: Record<Month, number>;
  ejecucionPorMes: Record<Month, number>;
  budgetsPorMes: Record<Month, Budget[]>;
  ejecucionesPorMes: Record<Month, Ejecucion[]>;
  allBudgets: Budget[];
  allEjecuciones: Ejecucion[];
  totalPresupuestado: number;
  totalEjecutado: number;
};

// ProjectRow: the flattened shape Matrix iterates over
type ProjectRow = {
  proyecto: string;
  cliente: string;
  projectId: string;
  estado: ProjectState;
  presupuestoPorMes: Record<Month, number>;
  ejecucionPorMes: Record<Month, number>;
  budgetsPorMes: Record<Month, Budget[]>;
  ejecucionesPorMes: Record<Month, Ejecucion[]>;
  allBudgets: Budget[];
  allEjecuciones: Ejecucion[];
  terceros: Map<string, TerceroRowdata>;
  totalPresupuestado: number;      // visibleMonths sum
  totalEjecutado: number;
  terceroRows: TerceroRowdata[];   // filtered + summed to visibleMonths
};

interface MatrixDataParams {
  tipo: TransactionType;
  visibleMonths: Month[];
  budgets: Budget[];
  ejecuciones: Ejecucion[];
  allProjects?: Project[];
  resolveProjectName: (projectId: string, snapshotName: string) => string;
}

interface MatrixDataResult {
  rows: ProjectRow[];
  allMatrixBudgets: Budget[];
  allMatrixEjecuciones: Ejecucion[];
}

// buildMatrixData also computes colTotals/grandTotals internally but
// they are unused by Matrix (filteredTotals replaces them).
// We still compute them inside buildMatrixData since they're needed
// implicitly — but the hook discards them.

interface FilterOptions {
  showNegociacion: boolean;
  selectedProjects: Set<string>;
}

interface FilteredTotals {
  colTotals: { presupuestado: Record<Month, number>; ejecutado: Record<Month, number> };
  grandTotalPresupuestado: number;
  grandTotalEjecutado: number;
}

interface UseBudgetMatrixParams {
  tipo: TransactionType;
  showNegociacion: boolean;
  visibleMonths: Month[];
  budgets: Budget[];
  ejecuciones: Ejecucion[];
  resolveProjectName: (projectId: string, snapshotName: string) => string;
  allProjects?: Project[];
  selectedProjects: Set<string>;
}

interface UseBudgetMatrixResult {
  rows: ProjectRow[];
  colTotals: { presupuestado: Record<Month, number>; ejecutado: Record<Month, number> };
  grandTotalPresupuestado: number;
  grandTotalEjecutado: number;
  allMatrixBudgets: Budget[];
  allMatrixEjecuciones: Ejecucion[];
}

// buildTerceroGroups return type (currently inferred inline — extract to named type)
type TerceroProject = {
  projectId: string;
  projectName: string;
  groups: DetalleTerceroGroup[];
  totalPresupuestado: number;
  totalEjecutado: number;
  diferencia: number;
};
```

## Hook Internals (Composition)

```typescript
function useBudgetMatrix(params: UseBudgetMatrixParams): UseBudgetMatrixResult {
  // Deps: [tipo, visibleMonths, budgets, ejecuciones, allProjects]
  // NOTE: resolveProjectName excluded intentionally (matches current behavior)
  const { rows: rawRows, allMatrixBudgets, allMatrixEjecuciones } = useMemo(
    () => buildMatrixData({ ... }),
    [tipo, visibleMonths, budgets, ejecuciones, allProjects],
  );

  // Deps: [rawRows, showNegociacion, selectedProjects]
  const rows = useMemo(
    () => filterAndSortRows(rawRows, { showNegociacion, selectedProjects }),
    [rawRows, showNegociacion, selectedProjects],
  );

  // Deps: [rows, visibleMonths]
  const totals = useMemo(
    () => computeFilteredTotals(rows, visibleMonths),
    [rows, visibleMonths],
  );

  return { rows, colTotals: totals.colTotals, grandTotalPresupuestado: totals.grandTotalPresupuestado, grandTotalEjecutado: totals.grandTotalEjecutado, allMatrixBudgets, allMatrixEjecuciones };
}
```

## Testing Strategy

All functions are pure — zero mocking required. Use vitest `describe/it/expect`.

| Function | Test Cases |
|----------|------------|
| `getMonthFromDateStr` | Standard date (`2026-07-15` → `Julio`), edge dates (`2026-01-01` → `Enero`, `2026-12-31` → `Diciembre`) |
| `getDiferencia` | Positive (100, 50 → 50), negative (50, 100 → -50), zero (100, 100 → 0) |
| `buildMatrixData` | Empty budgets/ejecuciones → empty rows; single budget mapped correctly; ejecucion month extracted from date; budget+ejecucion combo; tercero data nested; multiple projects; soloEgresos/soloIngresos filtering; tipo filtering (ingreso vs egreso) |
| `computeFilteredTotals` | Empty rows → zero totals; single row; multiple rows summing correctly |
| `filterAndSortRows` | Filters out `Cancelado`; filters `Negociación` when flag is false; keeps it when true; filters by `selectedProjects`; sort order (En ejecución < Aprobado < Finalizado < Negociación < other); alphabetical tiebreak; empty input |
| `buildTerceroGroups` | Groups budgets by projectId; groups ejecuciones by projectId; tercero grouping within project; zero-activity filtering; mixed entity types |

## File Changes

| File | Action | Lines Δ |
|------|--------|---------|
| `components/hooks/useBudgetMatrix.ts` | Create | +280 (est.) |
| `components/hooks/__tests__/useBudgetMatrix.test.ts` | Create | +250 (est.) |
| `components/Dashboard.tsx` | Modify | -100 lines (remove `getMonthFromDateStr`, `getDiferencia`, internal types, 3× useMemo, `buildTerceroGroups`; add `useBudgetMatrix` import, `buildTerceroGroups` import, single hook call) |

Total delta: ~430 lines added, ~100 removed, ~530 churn.

## Migration / Rollout

No migration required. Single commit. Revert via `git revert <sha>`.

## Behavioral Preservation Notes

- `buildMatrixData` preserves current dependency gap (`resolveProjectName` excluded from deps) — this is intentional.
- `matrixData.colTotals` and `grandTotal*` from `buildMatrixData` are dead code in current Matrix but computed anyway; the hook discards them in favor of `computeFilteredTotals` output.
- Matrix component retains ALL event handlers, rendering logic, KpiCard, and state — unchanged.
