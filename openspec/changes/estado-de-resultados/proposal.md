# Proposal: Estado de Resultados (P&L)

## Intent

Add a Profit & Loss (P&L) view to the app so users can see their net income statement. Currently the Dashboard shows ingresos/egresos by month/project, but there's no cross-project P&L that follows accounting structure (gross revenue → net profit). This view closes that gap, using existing budget and ejecucion data.

## Scope

### In Scope
- New `EstadoResultados` view type with Presupuestado/Ejecutado toggle
- P&L table with 12 computed rows (F1–F12) per the accounting structure
- Year selector filtering via `fechaPresupuestado` / `fechaEjecutado`
- Editable manual fields for F2 (Devoluciones) and F7 (Gastos Financieros) — local state only
- COP currency formatting, consistent styling with Dashboard/Datos
- Sidebar menu entry with TrendingUp icon
- Route `/{company}/estado-resultados`

### Out of Scope
- Persistence of F2/F7 manual values (no Firestore writes)
- Export to PDF/Excel
- Monthly breakdown (annual view only)
- Drill-down into individual budget/ejecucion records from P&L rows

## Capabilities

### New Capabilities
- `estado-resultados`: P&L statement computing ingresos netos, utilidad bruta, utilidad neta from existing Budget/Ejecucion collections, with Admin project isolation and GMF/Impuesto SIMPLE tax calculations.

### Modified Capabilities
None. Existing specs are unchanged. Only `ViewType` union and routing are extended additively.

## Approach

1. **Types** (`lib/types.ts`): Add `'EstadoResultados'` to `ViewType` union.
2. **Router** (`page.tsx`): Map `estado-resultados` segment in `viewFromSegments` and `navigateTo`. Render `<EstadoResultados>` component.
3. **Sidebar** (`Sidebar.tsx`): Add menu item with `TrendingUp` icon, path to `estado-resultados`.
4. **Component** (`components/EstadoResultados.tsx`): New client component with:
   - Mode toggle (Presupuestado/Ejecutado) and year selector (reuse Dashboard patterns)
   - Compute F1/F4/F6 from filtered budgets/ejecuciones (case-insensitive "Admin" match)
   - Derive F3, F5, F8–F12 via the P&L formula chain
   - Editable inputs for F2/F7 with `useState`
   - `formatCurrency` for COP display, clsx + Tailwind for visual consistency

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/types.ts` L122 | Modified | Add `'EstadoResultados'` to ViewType |
| `app/[company]/[[...segments]]/page.tsx` L38-46, L157-163, L349-360 | Modified | Route parsing, navigation, render branch |
| `components/Sidebar.tsx` L5, L37-44 | Modified | Import TrendingUp, add menu item |
| `components/EstadoResultados.tsx` | New | P&L component (~200 LOC) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| "Admin" project name mismatch | Low | Case-insensitive match with trim; F6 defaults to 0 |
| missing fechaPresupuestado on legacy budgets | Low | Guard with empty-string fallback in startsWith filter |
| Large dataset performance | Low | useMemo for all derived calculations; annual aggregation avoids month loops |

## Rollback Plan

Revert the 4 modified/new files. No data mutations, no migration. ViewType union extension is additive — removing it has zero side effects on existing views.

## Dependencies

- Existing `Budget.fechaPresupuestado` and `Ejecucion.fechaEjecutado` fields (from budget-date spec)
- Existing `formatCurrency` pattern from Dashboard/Datos
- Existing year selector UI pattern from Dashboard

## Success Criteria

- [ ] P&L view renders with Presupuestado/Ejecutado toggle, year selector, and all 12 rows
- [ ] Admin project egresos classified as F6 (Gastos Administrativos), not F4 (Costos de Operación)
- [ ] F2 and F7 inputs accept manual values and recompute dependent rows immediately
- [ ] GMF (F8) computed as 0.4% of (F4+F6+F7), capped at Impuesto SIMPLE for tax credit (F11)
- [ ] Sidebar navigates to `/estado-resultados` and shows active state
- [ ] Existing views (Dashboard, Datos) unchanged
- [ ] COP formatting applied to all monetary values
