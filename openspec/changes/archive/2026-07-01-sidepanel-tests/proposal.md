# Proposal: Unit Tests for Sidepanel Component

## Intent

The Sidepanel (8 sub-components, 474 LoC) is the most complex UI component with zero test coverage. No tests verify `handleDateChange` date→month extraction, `handleSubmit` field conversion, SearchableSelect filtering, ViewPanel rendering per record type, or the SidepanelData construction pipeline from Dashboard. This makes refactoring risky and blocks confidence in form-related changes under strict TDD.

## Scope

### In Scope
- Unit tests for `FormPanel.handleDateChange` — date string → `mesPresupuestado` (Spanish month) + `fechaPresupuestado` (YYYY-MM)
- Unit tests for `FormPanel.handleSubmit` — field conversions (monto to number, fechaEjecutado deletion for budgets)
- Unit tests for `SearchableSelect` — open/close, text filtering, "Sin resultados" empty state, selection closes dropdown
- Unit tests for `SimpleForm` — renders correct fields per form type (project: name+clientName, client/provider: name)
- Unit tests for `TipoSwitch` — toggle between ingreso/egreso, visual state per selection
- Unit tests for form rendering — date picker visible only for budget, budget linking only for ejecucion
- Unit tests for `BudgetView` — inline add ejecucion form toggle, form submission wiring
- Unit tests for `EjecucionView` — budget linking/unlinking, search filter for budgets
- Unit tests for `ViewPanel` — dispatches to correct sub-view per `recordDetail.type`
- Unit tests for `DataPanel` — budgets list, ejecuciones list, totals footer (presupuestado/ejecutado/diferencia)
- Unit tests for Sidepanel state — collapsed toolbar vs expanded panel logic
- Unit tests for `handleCellClick`, `handleRowTotalClick`, `handleColTotalClick` data construction (Dashboard.tsx → SidepanelData shape)
- Shared test factories: `makeBudget()`, `makeEjecucion()`, `makeProject()`, `makeClient()`, `makeActiveForm()`

### Out of Scope
- E2E or integration tests with live Firestore
- Snapshot / visual regression tests
- Tests for parent page.tsx or Dashboard orchestration beyond data construction
- New component features or refactoring

## Capabilities

### New Capabilities
None — testing only, no feature changes.

### Modified Capabilities
None — verifying existing behavior; no requirement changes.

## Approach

1. **Mock Firestore layer** — `vi.mock('@/lib/firestore')` providing `vi.fn()` for `subscribeProjects`, `subscribeClients`, `subscribeBudgets`, `updateEjecucion`, `addEjecucion`. Follow pattern from `lib/__tests__/firestore.test.ts` (factory-style snapshot callbacks).
2. **Render + interact** — `@testing-library/react` with `render`, `screen`, `fireEvent`. Wrap state updates in `act()` per `CompanyContext.test.tsx` pattern.
3. **Sub-component via props** — instantiate each sub-component directly (FormPanel, SearchableSelect, etc.) by passing required props; test Sidepanel routing by passing `activeForm`/`recordDetail`/`data`/`null`.
4. **Data construction pure** — test `handleCellClick`, `handleRowTotalClick`, `handleColTotalClick` by calling with known arguments and asserting the returned `SidepanelData` shape.
5. **Factory helpers** — extract `makeBudget`, `makeEjecucion`, `makeProject` at top of test file (in `vi.hoisted` or test-scoped).
6. **Test file location** — `components/__tests__/Sidepanel.test.tsx` matching existing pattern (`lib/__tests__/`, `context/__tests__/`).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/__tests__/Sidepanel.test.tsx` | **New** | Main test file (~400–600 LoC expected) |
| `components/Dashboard.tsx` | Test | handleCellClick/handleRowTotalClick/handleColTotalClick data construction |
| `components/Sidepanel.tsx` | Test only | All 8 sub-components exercised |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `'use client'` directive causes issues in jsdom | Low | Already configured and working in CompanyContext tests |
| Async state flakiness (useEffect + subscriptions) | Low | Use `act()` + `waitFor` patterns from existing tests |
| Component tightly coupled to firestore subscriptions | Medium | Mock early in module scope before any imports — follow established `vi.hoisted` pattern |

## Rollback Plan

- Delete `components/__tests__/Sidepanel.test.tsx`
- Run `npm test` to confirm all existing tests still pass

## Dependencies

- None beyond existing devDependencies (@testing-library/react, vitest, jsdom already configured)

## Success Criteria

- [ ] All existing tests pass with `npm test`
- [ ] Sidepanel test file covers all 8 sub-components + data construction
- [ ] No production code is modified (tests only)
