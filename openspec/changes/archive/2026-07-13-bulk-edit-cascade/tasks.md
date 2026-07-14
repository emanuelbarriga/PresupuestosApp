# Tasks: Bulk Edit & Cascade

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~380–420 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Foundation (types + firestore), PR 2: UI + wiring + tests |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Base |
|------|------|-----------|------|
| 1 | Types + firestore changes (T-1–5) | PR 1 | main |
| 2 | UI components + wiring + tests (T-6–13) | PR 2 | main |

---

## Phase 1: Foundation — Types & Firestore

- **T-1** Add `bulk-edit-presupuesto` and `bulk-edit-ejecucion` NavScreen variants to `lib/types.ts`. Test: `npx tsc --noEmit`. Deps: none. Effort: Small.

- **T-2** Add `batchUpdatePresupuestos` and `batchUpdateEjecuciones` to `lib/firestore.ts`. Validate with `partialBudgetSchema`/`partialEjecucionSchema`, return `{ successCount, failedIds }`. Test: mock update functions, verify success/partial/no-changes guard. Deps: T-1. Effort: Small.

- **T-3** Add `cascadeTerceroName(companyId, terceroId, newName)` to `lib/firestore.ts`. Query budgets+ejecuciones by `entityId`, `WriteBatch` update `entityName`, warn if >500. Test: mock getDocs+batch, verify query/limit/warning. Deps: none. Effort: Small.

- **T-4** Modify `updateTercero` — add optional `companyId` param; after updateDoc, if `data.name`+`companyId`, call `cascadeTerceroName`. Test: cascade fires only for name updates with companyId. Deps: T-3. Effort: Small.

- **T-5** Modify `batchUpdateTerceros` — add optional `companyId`; pass to each `updateTercero`; after allSettled, cascade per successful ID if name in payload. Test: cascade per successful ID only when name present. Deps: T-4. Effort: Small.

## Phase 2: Bulk-Edit UI Components

- **T-6** Create `BulkEditPresupuestosPanel.tsx`. Mirror `BulkEditTerceroPanel`: tipo (ingreso/egreso, no "ambos"), descripcion, archivado. Calls `batchUpdatePresupuestos` on save. File: `components/entities/presupuesto/`. Deps: T-2. Effort: Medium.

- **T-7** Create `BulkEditEjecucionesPanel.tsx`. Same as T-6, calls `batchUpdateEjecuciones`. Tipo: ingreso/egreso. File: `components/entities/ejecucion/`. Deps: T-2. Effort: Medium.

## Phase 3: Integration / Wiring

- **T-8** In `Sidepanel.tsx`, add two routing blocks for `bulk-edit-presupuesto`/`bulk-edit-ejecucion`, import + mount corresponding panels. Deps: T-6, T-7. Effort: Small.

- **T-9** In `Datos.tsx`, add `selectedBudgets`/`selectedEjecuciones` state, checkbox handlers, floating action bar per tab, checkbox columns in both tables. Wire `onNavigate` to new screen types. Deps: T-8. Effort: Medium.

## Phase 4: Testing & Cleanup

- **T-10** Unit tests for `batchUpdatePresupuestos`/`batchUpdateEjecuciones`: success, partial failure, empty payload, schema rejection. Deps: T-2. Effort: Small.

- **T-11** Unit tests for `cascadeTerceroName`: 0 linked docs, >500 warning, deleted doc tolerance. Deps: T-3. Effort: Small.

- **T-12** Unit tests for modified `updateTercero`/`batchUpdateTerceros`: cascade fires only for name, no-op without companyId. Deps: T-4, T-5. Effort: Small.

- **T-13** Update `page.tsx`: pass `companyId` to `updateTercero(form.record.id, data, companyId)`. CompanyId already in scope. Deps: T-4. Effort: Small.

## Notes

- Cascade uses per-company subcollection queries (no composite index needed).
- Budget tipo excludes "ambos" per design decision.
- `companyId` param is optional everywhere — backward compatible.
