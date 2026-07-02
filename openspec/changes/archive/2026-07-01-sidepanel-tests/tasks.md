# Tasks: Unit Tests for Sidepanel Component

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450–600 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (tests only, no production code changes) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

## Phase 1: Foundation — Test factories + mock setup

- [ ] 1.1 Create `components/__tests__/Sidepanel.test.tsx` with `vi.mock('@/lib/firestore')` providing `vi.fn()` for `subscribeProjects`, `subscribeClients`, `subscribeBudgets`, `updateEjecucion`, `addEjecucion` — follow snapshot-callback pattern from `lib/__tests__/firestore.test.ts` (lines 9–29)
- [ ] 1.2 Add test-scoped factory helpers: `makeBudget(overrides?)`, `makeEjecucion(overrides?)`, `makeProject(overrides?)`, `makeClient(overrides?)`, `makeActiveForm(mode, type, record?)` with sensible defaults matching `@/lib/types` interfaces

## Phase 2: Pure function tests

- [ ] 2.1 **R1 — handleDateChange**: test date→month extraction for budgets (valid YYYY-MM-DD → `mesPresupuestado` + `fechaPresupuestado`), invalid month (index 13 → falsy month), and ejecucion passthrough (no extra fields)
- [ ] 2.2 **R2 — handleSubmit**: test field conversions — `montoPresupuestado` string→number + `fechaEjecutado` deletion for budget, `montoEjecutado` string→number for ejecucion, NaN→0 fallback for invalid input
- [ ] 2.3 **R12 — Dashboard data construction**: test `handleCellClick` builds correct `SidepanelData` shape, `handleRowTotalClick`/`handleColTotalClick` early-return on zero values

## Phase 3: Leaf component tests (render + interact)

- [ ] 3.1 **R4 — SearchableSelect**: test dropdown open/close on focus, text filtering reduces options, selection calls `onChange` and closes, empty state shows "Sin resultados"
- [ ] 3.2 **R5 — SimpleForm**: test renders correct input fields per form type — project (name + clientName), client (name), provider (name)
- [ ] 3.3 **R6 — TipoSwitch**: test toggle switches value, active button has visual-active class, inactive button is muted

## Phase 4: Composite component tests

- [ ] 4.1 **R3 — FormPanel conditional rendering**: test budget shows date picker + month indicator + no budget linking; ejecucion shows date input + budget `SearchableSelect`; project/client/provider delegate to `SimpleForm`
- [ ] 4.2 **R7 — BudgetView inline add ejecucion**: test "Agregar" toggles inline form visibility, form submission calls `onFormSubmit` with budget-linked data
- [ ] 4.3 **R8 — EjecucionView budget linking**: test unlinked state shows "Sin presupuesto vinculado" + search toggle; search filters budget list; selection calls `updateEjecucion` with `budgetId`

## Phase 5: Top-level integration tests

- [ ] 5.1 **R9 — ViewPanel dispatch**: test `recordDetail.type` routes to correct sub-view (budget → BudgetView, ejecucion → EjecucionView, project/client → field lists)
- [ ] 5.2 **R10 — DataPanel lists + totals**: test budgets/ejecuciones list rendering, totals footer with `presupuestado`/`ejecutado`/`diferencia`, positive difference shows green
- [ ] 5.3 **R11 — Sidepanel collapsed vs expanded**: test toolbar-only mode (all null → 4 icons, `w-16`), any truthy prop expands to `w-[360px]` with sub-panel
