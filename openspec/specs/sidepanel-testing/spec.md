# Sidepanel Component Tests — Specification

## Overview

Unit test spec for `components/Sidepanel.tsx` and data construction helpers in `components/Dashboard.tsx`. Tests verify form data transformations, sub-component rendering, selection/filtering UI, navigation stack behavior, and SidepanelData construction.

## Mock Setup

- **firestore mock**: `vi.mock('@/lib/firestore')` providing `vi.fn()` for `subscribeProjects`, `subscribeClients`, `subscribeBudgets`, `updateEjecucion`, `addEjecucion`
- **Snapshot callbacks**: subscribe fns capture `onData` callback; tests fire it with factory data to control component state
- **Factories** (test-scoped helpers): `makeBudget(overrides?)`, `makeEjecucion(overrides?)`, `makeProject(overrides?)`, `makeClient(overrides?)`, `makeActiveForm(mode, type, record?)` with sensible defaults per type

## Requirements

### R1: handleDateChange — Date-to-month extraction

Three scenarios: budget with valid date, budget with invalid month, and ejecucion (no month calc).

| # | GIVEN | WHEN `handleDateChange(date)` | THEN (fields) |
|---|-------|------|------|
| 1a | type=budget, empty fields | `'2026-07-15'` | `mesPresupuestado='Julio'`, `fechaPresupuestado='2026-07'` |
| 1b | type=budget, month index 13 → NaN | `'2026-13-01'` | `mesPresupuestado=''` (falsy), `fechaPresupuestado='2026-13'` |
| 1c | type=ejecucion | `'2026-07-15'` | `fechaEjecutado='2026-07-15'`, no extra fields set |

### R2: handleSubmit — Field normalization and stack pop

Four scenarios: budget monto conversion + fechaEjecutado deletion, ejecucion monto conversion, NaN→0 fallback, submit pops back.

| # | GIVEN fields | WHEN `handleSubmit` resolves | THEN `onSubmit` receives |
|---|-------|------|------|
| 2a | `{montoPresupuestado: '500000', fechaEjecutado: '2026-07-15'}`, type=budget | | `montoPresupuestado=500000`, `fechaEjecutado` absent |
| 2b | `{montoEjecutado: '250000'}`, type=ejecucion | | `montoEjecutado=250000` |
| 2c | `{montoPresupuestado: 'abc'}`, type=budget | | `montoPresupuestado=0` |
| 2d | form in nav stack (stack.length > 1) | successful submit | `onBack` is called (pops one screen), `onClose` is NOT called |

### R3: FormPanel conditional rendering

Three scenarios covering budget, ejecucion, and simple form types.

| # | GIVEN form type | WHEN rendered | THEN visible fields |
|---|-------|------|------|
| 3a | `type=budget` | | date picker + month indicator, NO budget linking select |
| 3b | `type=ejecucion` | | date input + budget SearchableSelect |
| 3c | `type=project / client / provider` | | delegates to `SimpleForm` with correct field set |

### R4: SearchableSelect — Filtering and interaction

Four scenarios: closed state, open + show all, text filtering, empty results.

| # | GIVEN | WHEN | THEN |
|---|-------|------|------|
| 4a | options=`['A','B','C']`, not focused | renders | dropdown closed, placeholder shown |
| 4b | onFocus | | dropdown opens, all options visible |
| 4c | search=`'B'`, options `['A','B','C']` | | only `'B'` option visible |
| 4d | search=`'Z'`, no match | | `'Sin resultados'` text shown |

### R5: SimpleForm — Fields per form type

Three scenarios: project (2 fields), client (1 field), provider (1 field).

| # | GIVEN form type | THEN renders inputs |
|---|-------|------|
| 5a | `type=project` | `name` + `clientName` |
| 5b | `type=client` | `name` only |
| 5c | `type=provider` | `name` only |

### R6: TipoSwitch — Toggle ingreso/egreso

Two scenarios: click toggles value, active state has visual highlight.

| # | GIVEN | WHEN | THEN |
|---|-------|------|------|
| 6a | `value='ingreso'` | click `'Egreso'` button | `onChange('egreso')` called |
| 6b | `value='ingreso'` | renders | Ingreso button has active styles, Egreso is muted |

### R7: BudgetView — Inline add ejecucion and forward navigation

BudgetView no longer holds `viewEj` internal state. Clicking an existing ejecucion row navigates forward via `onNavigate` instead of toggling an internal detail view.

| # | GIVEN | WHEN | THEN |
|---|-------|------|------|
| 7a | BudgetView renders | click `'Agregar'` | inline form appears with descripcion, monto, fecha inputs |
| 7b | inline form visible | click `'Guardar Ejecución'` | `onFormSubmit` called with budget-linked data, form closes |
| 7c | BudgetView renders list of ejecuciones | click an ejecucion row | `onNavigate` called with `{ type: 'ejecucion', ...ejecucion }`; previous budget remains in stack |
| 7d | BudgetView renders | click `'Agregar'` | inline form appears (same as 7a — no navigation occurs) |

### R8: EjecucionView — Budget linking/unlinking and forward navigation

EjecucionView no longer holds `viewBudget` internal state. Clicking a linked budget navigates forward via `onNavigate` instead of toggling an internal budget view.

| # | GIVEN | WHEN | THEN |
|---|-------|------|------|
| 8a | `ejecucion.budgetId` absent | renders | `'Sin presupuesto vinculado'` shown, `'Buscar presupuesto'` visible |
| 8b | `linking=true`, search text typed | | budget list filtered by description / project name |
| 8c | budget selected from list | `handleLink` called | `updateEjecucion(budgetId)` invoked |
| 8d | `ejecucion.budgetId` present | click linked budget name/row | `onNavigate` called with `{ type: 'budget', id: ejecucion.budgetId }`; previous ejecucion remains in stack |

### R9: ViewPanel — Sub-view dispatch per recordDetail.type

Four scenarios: budget, ejecucion, project, client.

| # | GIVEN `recordDetail.type` | THEN renders |
|---|-------|------|
| 9a | `'budget'` | `BudgetView` with budget + linked ejecuciones |
| 9b | `'ejecucion'` | `EjecucionView` |
| 9c | `'project'` | project fields + budget/ejecucion lists |
| 9d | `'client'` | client info + project list |

### R10: DataPanel — Budgets, ejecuciones, and totals footer

Two scenarios: data lists render, totals footer with difference highlight.

| # | GIVEN | THEN |
|---|-------|------|
| 10a | data with 2 budgets + 2 ejecuciones | budget list + ejecucion list rendered |
| 10b | `presupuestado=1_000_000`, `ejecutado=800_000`, `diferencia=200_000` | totals footer shows $1M, $800K, `+$200K` in green |

### R11: Sidepanel — Collapsed toolbar vs expanded panel (updated props)

Sidepanel no longer receives `onViewRecord`, `onEditCellRecord`, `onEditProject`, `onEditTercero`. Instead it receives `canGoBack`, `onBack`, `onNavigate`. The existing toolbar-only vs expanded-panel behavior is preserved.

| # | GIVEN props | THEN |
|---|-------|------|
| 11a | `data=null`, `recordDetail=null`, `activeForm=null` | toolbar with 4 icon buttons, `w-16`; props `canGoBack`, `onBack`, `onNavigate` accepted |
| 11b | data or recordDetail or activeForm truthy | `w-[360px]` with FormPanel / ViewPanel / DataPanel; header shows "← Volver" when `canGoBack=true`, always shows "✕" |

### R12: Dashboard data construction — Cell/Row/Col click handlers

Three scenarios: cell click builds SidepanelData, row total zero-value guard, column total zero-value guard.

| # | GIVEN | WHEN called | THEN `onCellClick` receives |
|---|-------|------|------|
| 12a | `handleCellClick(proyecto, mes, presup, ejec, budgets, ejecs)` | | `title='{proy} / {Mes}'`, budgets/ejecuciones match input |
| 12b | `handleRowTotalClick` with value=0, empty arrays | | **NOT called** (early return) |
| 12c | `handleColTotalClick(month, presup=0, ejec=0)` | | **NOT called** (early return) |

### R13: Header navigation — "← Volver" and "✕"

The Sidepanel header renders up to two navigation controls: "← Volver" and "✕". Their behavior depends on stack depth.

| # | GIVEN | WHEN rendered | THEN |
|---|-------|------|------|
| 13a | `canGoBack=false`, any sub-panel open | renders | "← Volver" is NOT shown, "✕" shown |
| 13b | `canGoBack=true`, DataPanel open | renders | "← Volver" shown on the left, "✕" on the right |
| 13c | `canGoBack=true`, ViewPanel open | renders | "← Volver" shown on the left, "✕" on the right |
| 13d | `canGoBack=true`, FormPanel open | renders | "← Volver" shown on the left, "✕" on the right |
| 13e | user clicks "← Volver" | | `onBack` is called (pops one screen) |
| 13f | user clicks "✕" | | `onClose` is called (clears entire stack) |

### R14: MiniEjecucionView removed

The `MiniEjecucionView` sub-component is removed. Navigation previously handled by MiniEjecucionView is now handled via the nav stack through `onNavigate`.

| # | GIVEN | WHEN | THEN |
|---|-------|------|------|
| 14a | Sidepanel imports are enumerated | module loads | `MiniEjecucionView` is not imported or defined |
| 14b | An ejecucion is clicked from a budget view | event fires | `onNavigate` is called (see R7c) — no MiniEjecucionView renders |

## Acceptance Criteria

| # | Criterion | Fail condition |
|---|-----------|----------------|
| 1 | `npx vitest run components/__tests__/Sidepanel.test.tsx` passes | Any assertion fails |
| 2 | All existing tests still pass | `vitest run` returns non-zero |
| 3 | Sidepanel accepts `canGoBack`, `onBack`, `onNavigate` props instead of `onViewRecord`, `onEditCellRecord`, `onEditProject`, `onEditTercero` | Component type-check or test assertion fails |
| 4 | "← Volver" appears in the header when `canGoBack=true` in DataPanel, ViewPanel, and FormPanel | Header renders without back control |
| 5 | "← Volver" calls `onBack` (pops one screen), "✕" calls `onClose` (clears stack) | Incorrect callback invoked |
| 6 | BudgetView clicking an ejecucion calls `onNavigate` (no internal `viewEj`) | Internal state toggle used |
| 7 | EjecucionView clicking linked budget calls `onNavigate` (no internal `viewBudget`) | Internal state toggle used |
| 8 | Form submit pops back to previous panel (does not call `onClose`) | Form submit clears entire stack |
| 9 | `MiniEjecucionView` is removed from the component tree | Component is imported or rendered |
