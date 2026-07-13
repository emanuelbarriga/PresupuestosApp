# Proposal: dashboard-math-refactor

## Intent

Extract all data aggregation, grouping, and computation logic from `Dashboard.tsx` (848 lines, Matrix component has a 183-line `useMemo`) into pure testable functions and a custom hook. UI must remain pixel-identical — zero visual changes.

## Scope

### In Scope
- Extract `buildMatrixData`, `computeTotals`, `filterAndSortRows`, `getMonthFromDateStr`, `getDiferencia` as pure functions
- Create `useBudgetMatrix` hook composing them
- Move `buildTerceroGroups` into the same module
- Add unit tests for all extracted functions with vitest
- Dashboard.tsx imports `useBudgetMatrix` — Matrix component shrinks to render + events only

### Out of Scope
- NO UI changes, NO Firebase/Firestore changes, NO state management changes
- NO Zustand or new libraries, NO changes to `types.ts`
- NO changes to how data enters the component (props stay the same)

## Capabilities

### New Capabilities
None — refactor only, no new spec-level behavior.

### Modified Capabilities
None — existing behavior is preserved identically.

## Approach

1. Create `components/hooks/useBudgetMatrix.ts` with pure helpers + hook
2. Extract `buildMatrixData(params): MatrixDataResult` — the aggregation currently inside Matrix's first `useMemo`
3. Extract `computeTotals(rows, visibleMonths): FilteredTotals` — the second `useMemo`
4. Extract `filterAndSortRows(rows, options): ProjectRow[]`
5. Extract `getMonthFromDateStr` and `getDiferencia`
6. Move `buildTerceroGroups` into the same file
7. Write `components/hooks/__tests__/useBudgetMatrix.test.ts` covering each function
8. Refactor Dashboard.tsx: replace inline `useMemo`s with `useBudgetMatrix`, remove ~100 lines

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/hooks/useBudgetMatrix.ts` | **New** | Pure math functions + custom hook |
| `components/hooks/__tests__/useBudgetMatrix.test.ts` | **New** | Unit tests for extracted functions |
| `components/Dashboard.tsx` | **Modified** | Replace inline logic with hook, remove ~100 lines |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking cell click data structures | Low | Keep all handlers identical; only extract data computation |
| Breaking tercero sub-rows | Low | Extract last and diff output |
| Regression in filter/sort | Low | Extract as pure functions with tests |

## Rollback Plan

Single commit — revert with `git revert <sha>`. No data migration or schema changes.

## Success Criteria

- [ ] All extracted functions have passing vitest tests
- [ ] Matrix component has no inline aggregation logic
- [ ] UI is pixel-identical (no visual regression)
- [ ] `npx tsc --noEmit` passes, `npm test` passes
