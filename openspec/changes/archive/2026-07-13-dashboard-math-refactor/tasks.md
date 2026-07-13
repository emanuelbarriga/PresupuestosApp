# Tasks: dashboard-math-refactor

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~530 (added: 430, removed: 100) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Extract math → hook + tests + wire | Single PR | Pure refactor, sequential tasks, single commit |

## Phase 1: Foundation

- [x] 1.1 Create `components/hooks/useBudgetMatrix.ts` with `getMonthFromDateStr` and `getDiferencia` pure leaf helpers
- [x] 1.2 Add exported type aliases (`TerceroRowdata`, `ProjectRow`, `MatrixDataParams`, `MatrixDataResult`, `FilterOptions`, `FilteredTotals`, `TerceroProject`, `UseBudgetMatrixParams`, `UseBudgetMatrixResult`) matching design.md interfaces

## Phase 2: Extract Pure Functions

- [x] 2.1 Extract `buildMatrixData(params: MatrixDataParams): MatrixDataResult` — move inline aggregation from Matrix's first `useMemo` (lines 325–508) into the module
- [x] 2.2 Extract `computeFilteredTotals(rows: ProjectRow[], visibleMonths: Month[]): FilteredTotals` — move the second `useMemo` (lines 581–597)
- [x] 2.3 Extract `filterAndSortRows(rows: ProjectRow[], options: FilterOptions): ProjectRow[]` — move the third `useMemo` (lines 520–552) with estado-order sorting and project filter
- [x] 2.4 Move `buildTerceroGroups` (lines 12–123) into the module and re-export it (no inline changes)

## Phase 3: Hook + Tests

- [x] 3.1 Create `useBudgetMatrix` hook composing `buildMatrixData` → `filterAndSortRows` → `computeFilteredTotals` with 3 `useMemo` calls matching current dep arrays (exclude `resolveProjectName`)
- [x] 3.2 Write `components/hooks/__tests__/useBudgetMatrix.test.ts` covering all 6 pure functions per testing strategy in design.md (vitest, zero mocking)

## Phase 4: Integration

- [x] 4.1 Refactor `Dashboard.tsx`: import `useBudgetMatrix` + `buildTerceroGroups`, replace 3 inline `useMemo`s with single hook call, remove inline `getMonthFromDateStr`, `getDiferencia`, internal `TerceroRowdata` type (~100 lines removed)
- [x] 4.2 Remove stale imports from Dashboard.tsx, run `npx tsc --noEmit` and `npm test` to confirm zero regressions

## Implementation Order

The tasks are strictly sequential — each depends on the previous. Phase 1 creates the module skeleton. Phase 2 populates it with pure functions (leaf to trunk order). Phase 3 wraps them in the hook and validates them. Phase 4 wires it into Dashboard.tsx and removes all dead code.

### State after each phase

| After phase | Compiles? | Tests pass? | UI identical? |
|------------|-----------|-------------|---------------|
| Phase 1 | ✅ (new module, unused) | ✅ (no tests yet) | ✅ (no changes to UI) |
| Phase 2 | ✅ (module complete) | ✅ (no tests yet) | ✅ (no changes to UI) |
| Phase 3 | ✅ | ✅ | ✅ |
| Phase 4 | ✅ | ✅ | ✅ — final confirmation |
