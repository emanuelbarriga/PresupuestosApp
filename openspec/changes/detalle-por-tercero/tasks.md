# Tasks: Detalle por Tercero

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~225 (165 source + 60 tests) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Types & Data Layer

- [x] 1.1 Add `DetalleTerceroGroup` interface to `lib/types.ts` with `entityId`, `entityName`, `entityType`, `budgets`, `ejecuciones`, `totalPresupuestado`, `totalEjecutado`, `diferencia`
- [x] 1.2 Add `'detalle-tercero'` variant to `RecordDetail` union in `lib/types.ts` — projects array with nested groups + aggregate totals
- [x] 1.3 Export `buildTerceroGroups(budgets, ejecuciones, mode)` pure function in `components/Dashboard.tsx` — group by projectId, then by entityId; skip zero-activity groups; O(n)

## Phase 2: TerceroGroupPanel Component

- [x] 2.1 Create `TerceroGroupPanel({ projects, onCellClick, mode })` in `components/Sidepanel.tsx` — renders collapsible project headers with nested tercero rows (entityName, totalPresupuestado, totalEjecutado, diferencia in COP)
- [x] 2.2 Implement collapse/expand toggle on project header click
- [x] 2.3 Implement tercero row drill-down: construct `SidepanelData` filtered by projectId+entityId, call `onCellClick(data)`

## Phase 3: Integration & Wiring

- [x] 3.1 Add `onCellClick?: (data: SidepanelData) => void` prop to `SidepanelProps` and thread through to `ViewPanel`
- [x] 3.2 Add `'detalle-tercero'` dispatch case in `ViewPanel` that renders `TerceroGroupPanel`
- [x] 3.3 Add `onTerceroClick?: (detail: RecordDetail) => void` prop to `DashboardProps`; render "Detalle por Tercero" button in header between mode switch and Negociación toggle (hidden when both filtered arrays empty)
- [x] 3.4 Add `handleTerceroClick` in `page.tsx` — calls `buildTerceroGroups`, wraps result as `RecordDetail`, calls `setRecordDetail`; wire `onTerceroClick` to Dashboard and `onCellClick` to Sidepanel → `handleCellClick`

## Phase 4: Tests

- [x] 4.1 Unit test `buildTerceroGroups()`: verify correct project/tercero grouping, aggregate sums, zero-activity filtering, empty input handling
- [x] 4.2 Integration test `TerceroGroupPanel`: render with mock projects — verify project headers, nested rows, collapse/expand, COP formatting
- [x] 4.3 Integration test drill-down click: verify `onCellClick` receives `SidepanelData` filtered to matching projectId+entityId
- [x] 4.4 Integration test Dashboard button: hidden when both filteredBudgets/filteredEjecuciones empty; visible when data exists
