# Proposal: Fix Budget Validation & Bulk Edit

## Intent

`BudgetForm` crashes with "Invalid input" when saving because `BudgetFields` lacks `estadoProyecto` — a field required by `budgetSchema`. Meanwhile, both `BulkEditPresupuestosPanel` and `BulkEditEjecucionesPanel` only support changing the tercero (`entityId`), leaving users unable to batch-update description, amount, project, type, or archived status.

## Scope

### In Scope
- Fix "Invalid input" en BudgetForm: add `estadoProyecto` to `BudgetFields` + set default `'Activo'` before schema validation
- Add `descripcion`, `montoPresupuestado` (formatted), `projectId`/`projectName` (SearchableSelect with projects), `tipo` (TipoSwitch), `archivado` (tristate) to `BulkEditPresupuestosPanel`
- Add `descripcion`, `montoEjecutado` (formatted), `projectId`/`projectName` (SearchableSelect), `tipo` (TipoSwitch), `archivado` (tristate) to `BulkEditEjecucionesPanel`
- `buildPayload()` in both panels: include new fields only when they differ from default

### Out of Scope
- No changes to `lib/schemas.ts` or `lib/firestore.ts` (`partialBudgetSchema` already works)
- No changes to `BulkEditTerceroPanel` (already complete)
- No tests for BulkEdit panels (can be added separately)
- No `totalEjecutado` / linked ejecuciones fields

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `bulk-edit-cascade`: requirements expanded — `BulkEditPresupuestosPanel` and `BulkEditEjecucionesPanel` now support descripcion, monto, proyecto, tipo, archivado beyond entityId alone

## Approach

1. **BudgetForm**: add `estadoProyecto: string` to `BudgetFields`, initialize with `'Activo'`. In `handleSubmit`, set `entry.estadoProyecto = fields.estadoProyecto || 'Activo'` before `budgetSchema.parse()`.
2. **BulkEditPresupuestosPanel**: import `TipoSwitch`, `SearchableSelect` (projects), format helpers. Add state for each new field. `buildPayload()` includes non-default values only. Load projects via `subscribeProjects`.
3. **BulkEditEjecucionesPanel**: same pattern using `ejecucionSchema` field names. `batchUpdateEjecuciones` validated by `partialEjecucionSchema` — no schema changes needed.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/entities/budget/BudgetForm.tsx` | Modified | Add `estadoProyecto` to `BudgetFields` + default in handleSubmit |
| `components/entities/presupuesto/BulkEditPresupuestosPanel.tsx` | Modified | Add 5 new inputs to form + buildPayload |
| `components/entities/ejecucion/BulkEditEjecucionesPanel.tsx` | Modified | Add 5 new inputs to form + buildPayload |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Monto formateo inconsistente | Medium | Reuse `formatThousands`/`unformatThousands` from BudgetForm |
| SearchableSelect without project data | Low | Subscribe via existing `subscribeProjects` hook |
| TipoSwitch import breaks if moved | Low | Import from its known path — verify path exists |

## Rollback Plan

1. `git revert <BudgetForm-commit>` (fix validation)
2. `git revert <bulk-edit-commit>` (both panels)
3. If only one panel fails, revert that file individually

No data migration — batch writes are simple `updateDoc` calls.

## Dependencies

- Existing `partialBudgetSchema` / `partialEjecucionSchema` (no changes)
- Existing `TipoSwitch`, `SearchableSelect`, `formatThousands` components
- Existing `subscribeProjects` subscription

## Success Criteria

- [ ] BudgetForm saves without "Invalid input" error
- [ ] BulkEditPresupuestosPanel allows batch-editing descripcion, monto, proyecto, tipo, archivado
- [ ] BulkEditEjecucionesPanel allows batch-editing descripcion, monto, proyecto, tipo, archivado
- [ ] `partialBudgetSchema` / `batchUpdatePresupuestos` unchanged — existing behavior preserved
- [ ] `npm test` passes (no regressions)
