# Sidepanel Navigation Stack — Delta Spec

> **Base spec**: `openspec/specs/sidepanel-testing/spec.md`  
> This delta spec documents acceptance criteria that CHANGE or are ADDED by the sidepanel-navigation-stack change. Requirements and scenarios NOT listed here remain as-is from the base spec.

## Modified Requirements

### R7: BudgetView — Inline add ejecucion (modified)

BudgetView no longer holds `viewEj` internal state. Clicking an existing ejecucion row navigates forward via `onNavigate` instead of toggling an internal detail view.

#### Scenario 7c: Click ejecucion row navigates forward

- GIVEN BudgetView renders a list of ejecuciones for the current budget
- WHEN the user clicks an ejecucion row
- THEN `onNavigate` is called with `{ type: 'ejecucion', ...ejecucion }`
- AND the previous budget view remains in the nav stack (back navigable)

#### Scenario 7d: "Agregar" inline form unchanged

- GIVEN BudgetView renders
- WHEN the user clicks "Agregar"
- THEN the inline form appears (same behavior as base spec 7a)
- — no navigation occurs

### R8: EjecucionView — Budget linking/unlinking (modified)

EjecucionView no longer holds `viewBudget` internal state. Clicking a linked budget navigates forward via `onNavigate` instead of toggling an internal budget view.

#### Scenario 8d: Click linked budget navigates forward

- GIVEN EjecucionView renders with `ejecucion.budgetId` present
- WHEN the user clicks the linked budget name/row
- THEN `onNavigate` is called with `{ type: 'budget', id: ejecucion.budgetId }`
- AND the previous ejecucion view remains in the nav stack (back navigable)

#### Scenario 8e: Unlinked state unchanged

- GIVEN `ejecucion.budgetId` absent
- WHEN EjecucionView renders
- THEN "Sin presupuesto vinculado" and "Buscar presupuesto" are shown (same as base spec 8a)
- — no navigation behavior change

### R11: Sidepanel — Collapsed toolbar vs expanded panel (modified)

Sidepanel no longer receives `onViewRecord`, `onEditCellRecord`, `onEditProject`, `onEditTercero`. Instead it receives `canGoBack`, `onBack`, `onNavigate`. The existing toolbar-only vs expanded-panel behavior is preserved.

#### Scenario 11a: Toolbar only — no data (updated props)

- GIVEN `data=null`, `recordDetail=null`, `activeForm=null`
- WHEN Sidepanel renders
- THEN toolbar with 4 icon buttons is shown at `w-16`
- AND props `canGoBack`, `onBack`, `onNavigate` are accepted (no `onViewRecord`, etc.)

#### Scenario 11b: Expanded panel — data present (updated props)

- GIVEN `data` or `recordDetail` or `activeForm` is truthy
- WHEN Sidepanel renders
- THEN the panel is shown at `w-[360px]` with the appropriate sub-panel
- AND the header includes "← Volver" when `canGoBack=true`
- AND the header always includes "✕" regardless of stack depth

### R2: handleSubmit — Form submit pops stack (modified)

After successful form submission, instead of closing everything (calling `onClose`), the form pops back one screen in the nav stack.

#### Scenario 2d: Successful submit pops back

- GIVEN the form is the active screen in the nav stack (stack.length > 1)
- WHEN `handleSubmit` resolves successfully (with type=budget or type=ejecucion)
- THEN `onNavigate` (or equivalent pop callback) is called
- AND the previous screen is restored
- AND the form fields are reset

## New Requirements

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

## Removed from Base Spec

The following are **removed** from the base spec:

### Requirements

- **MiniEjecucionView-related scenarios**: Any test or scenario in the base spec that references `MiniEjecucionView` by name is removed.

### Props

- **Old handler props**: References to `onViewRecord`, `onEditCellRecord`, `onEditProject`, `onEditTercero` as Sidepanel props are replaced by `canGoBack`, `onBack`, `onNavigate`.

## Acceptance Criteria

| # | Criterion | Fail condition |
|---|-----------|----------------|
| 1 | `npx vitest run components/__tests__/Sidepanel.test.tsx` passes | Any assertion fails |
| 2 | All existing tests still pass (delta scenarios added, removed scenarios deleted) | `vitest run` returns non-zero |
| 3 | Sidepanel accepts `canGoBack`, `onBack`, `onNavigate` props instead of `onViewRecord`, `onEditCellRecord`, `onEditProject`, `onEditTercero` | Component type-check or test assertion fails |
| 4 | "← Volver" appears in the header when `canGoBack=true` in DataPanel, ViewPanel, and FormPanel | Header renders without back control |
| 5 | "← Volver" calls `onBack` (pops one screen), "✕" calls `onClose` (clears stack) | Incorrect callback invoked |
| 6 | BudgetView clicking an ejecucion calls `onNavigate` (no internal `viewEj`) | Internal state toggle used |
| 7 | EjecucionView clicking linked budget calls `onNavigate` (no internal `viewBudget`) | Internal state toggle used |
| 8 | Form submit pops back to previous panel (does not call `onClose`) | Form submit clears entire stack |
| 9 | `MiniEjecucionView` is removed from the component tree | Component is imported or rendered |
