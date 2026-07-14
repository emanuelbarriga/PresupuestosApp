# Tasks: Fix Budget Validation & Bulk Edit

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~200 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | BudgetForm validation fix + both bulk-edit panels | Single PR | ~200 lines, self-contained, no schema/firestore changes |

## Phase 1: Fix BudgetForm validation

- [x] 1.1 Add `estadoProyecto: string` to `BudgetFields` interface in `BudgetForm.tsx` (line 33)
- [x] 1.2 Init `estadoProyecto` to `'Activo'` in both branches of `useState<BudgetFields>` (lines 68–96)
- [x] 1.3 In `handleSubmit`, set `entry.estadoProyecto = fields.estadoProyecto || 'Activo'` before `budgetSchema.parse(entry)` (around line 215)

## Phase 2: Extend BulkEditPresupuestosPanel

- [x] 2.1 Import `TipoSwitch` from `@/components/forms/TipoSwitch`, `formatThousands`/`unformatThousands` from `@/lib/utils`, and `subscribeProjects` from `@/lib/firestore`
- [x] 2.2 Add state: `descripcion` (`''`), `montoPresupuestado` (`''`), `montoEditing` (`false`), `projects` (`Project[]`), `projectId`/`projectName` (`''`), `tipo` (`''`), `archivado` (`null` as `boolean | null`)
- [x] 2.3 Add `useEffect` calling `subscribeProjects(companyId, setProjects)` with cleanup via returned `Unsubscribe`
- [x] 2.4 Build `projectOptions` via `useMemo` mapping `projects` to `{ value, label }`
- [x] 2.5 Update `hasChanges` to check all fields against defaults (`''` for text, `null` for archivado)
- [x] 2.6 Extend `buildPayload()` to include each field only when !== default (`descripcion !== ''`, `montoPresupuestado !== ''` → parsed number, `projectId !== ''`, `tipo !== ''`, `archivado !== null`)
- [x] 2.7 Render: input text for `descripcion`, formatted monto input with `montoEditing` focus/blur for `montoPresupuestado`, `SearchableSelect` for projects, `TipoSwitch` (ingreso/egreso only) for `tipo`, tristate cycle button for `archivado`

## Phase 3: Extend BulkEditEjecucionesPanel

- [x] 3.1 Import `TipoSwitch`, `formatThousands`/`unformatThousands`, and `subscribeProjects`
- [x] 3.2 Add state: `descripcion` (`''`), `montoEjecutado` (`''`), `montoEditing` (`false`), `projects` (`Project[]`), `projectId`/`projectName` (`''`), `tipo` (`''`), `archivado` (`null`)
- [x] 3.3 Add `useEffect` calling `subscribeProjects(companyId, setProjects)` with cleanup
- [x] 3.4 Update `hasChanges` and `buildPayload()` with same default-omit logic as Phase 2, using `montoEjecutado` field name
- [x] 3.5 Render same 5 fields with `montoEjecutado` label instead of `montoPresupuestado`
