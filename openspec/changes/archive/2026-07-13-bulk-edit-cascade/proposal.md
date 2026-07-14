# Proposal: Bulk Edit & Cascade — Presupuestos, Ejecuciones, Tercero name propagation

## Intent

The app has bulk edit only for Terceros. Users managing Presupuestos and Ejecuciones lists need the same multi-select + batch field updates. Additionally, changing a tercero's name leaves stale `entityName` in linked budgets/ejecuciones — this cascade must be fixed to keep denormalized data consistent.

## Scope

### In Scope
- Checkboxes + floating action bar for Presupuestos table in Datos.tsx
- `BulkEditPresupuestosPanel` with editable fields: tipo, descripcion, archivado
- Checkboxes + floating action bar for Ejecuciones table in Datos.tsx
- `BulkEditEjecucionesPanel` with editable fields: tipo, descripcion, archivado
- `batchUpdatePresupuestos` and `batchUpdateEjecuciones` in firestore.ts
- NavScreen variants `bulk-edit-presupuesto` and `bulk-edit-ejecucion`
- Cascade: `updateTercero` / `batchUpdateTerceros` propagates `name` → `entityName` on budgets + ejecuciones with matching `entityId`
- Sidepanel routing for the two new types

### Out of Scope
- Batch edit of entityId, monto, projectId, date fields (too risky in bulk)
- Select-all / page-select toggle (deferred — matches tercero pattern)
- Undo for bulk edits
- Cascade on batch-delete or when Tercero is deleted entirely (separate concern)
- Cloud Function trigger for cascade (keeping logic client-side)

## Capabilities

### New Capabilities
- `presupuestos-bulk-edit`: multi-select rows in Presupuestos table, edit common fields via sidepanel, batch save
- `ejecuciones-bulk-edit`: multi-select rows in Ejecuciones table, edit common fields via sidepanel, batch save
- `tercero-name-cascade`: when a tercero name is updated, propagate new name to all budgets and ejecuciones that reference it via entityId

### Modified Capabilities
- `terceros-bulk-edit`: batch update now also triggers cascade for name field (behavioral change — existing spec needs a delta)

## Approach

1. **Pattern reuse**: Mirror `BulkEditTerceroPanel` — same Sidepanel contract, same `Promise.allSettled` batch approach, same "Sin cambios" default-per-field UX.
2. **NavScreen**: Add two new union variants following exact same shape as `bulk-edit-tercero` — no new generic machinery needed.
3. **Cascade**: Extract a `cascadeTerceroName(companyId, terceroId, newName)` helper in firestore.ts. Call it from `updateTercero` when `name` changes, and from `batchUpdateTerceros` after name updates. Use Firestore `WriteBatch` + `runTransaction` to atomically query + update all linked documents.
4. **Validation**: Reuse existing `partialBudgetSchema` / `partialEjecucionSchema` for the batch Firestore functions.
5. **Component isolation**: Each BulkEdit*Panel gets its own file under `components/entities/{entity}/`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/Datos.tsx` | Modified | Add checkbox state + action bar for Presupuestos and Ejecuciones tables |
| `components/entities/presupuesto/BulkEditPresupuestosPanel.tsx` | New | Sidepanel with tipo/descripcion/archivado fields |
| `components/entities/ejecucion/BulkEditEjecucionesPanel.tsx` | New | Sidepanel with tipo/descripcion/archivado fields |
| `components/Sidepanel.tsx` | Modified | Route two new NavScreen types |
| `lib/firestore.ts` | Modified | Add `batchUpdatePresupuestos`, `batchUpdateEjecuciones`, `cascadeTerceroName`; modify `updateTercero` and `batchUpdateTerceros` for cascade |
| `lib/types.ts` | Modified | Add two NavScreen union variants |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cascade query hits many docs (slow) | Low | Use `WriteBatch` (max 500 ops) + limit query; log warning if exceeded |
| Cascade on single `updateTercero` surprises user | Low | Cascade is silent + transparent — user already intended to change name |
| Sidepanel route collision | Low | Unique keys `bulk-edit-presupuesto` and `bulk-edit-ejecucion` — no collision |

## Rollback Plan

- Revert Datos.tsx changes (remove checkboxes, action bar, state)
- Delete `BulkEditPresupuestosPanel`, `BulkEditEjecucionesPanel`, `batchUpdatePresupuestos`, `batchUpdateEjecuciones`
- Remove cascade logic from `updateTercero` / `batchUpdateTerceros`
- No data migration needed — cascade writes are plain `updateDoc` calls

## Dependencies

- Existing `partialBudgetSchema` and `partialEjecucionSchema` for validation
- Existing Sidepanel routing infrastructure
- Existing `Promise.allSettled` batch pattern from `batchUpdateTerceros`

## Success Criteria

- [ ] User can select 1–N presupuestos, open bulk edit, change fields, save — all reflect in Firestore
- [ ] User can select 1–N ejecuciones, open bulk edit, change fields, save — all reflect in Firestore
- [ ] Changing a tercero name (single or batch) updates entityName on all linked budgets and ejecuciones within 2s
- [ ] `npm test` passes, `npx tsc --noEmit` passes
