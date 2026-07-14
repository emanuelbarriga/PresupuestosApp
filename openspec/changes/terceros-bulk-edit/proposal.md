# Proposal: Terceros Bulk Edit

## Intent

Users manage large lists of terceros (50+) in the Datos tab. Changing fields like `tipo`, `naturaleza`, `lugar`, or `archivado` on each tercero individually is slow and error-prone. We need multi-select + batch update to save time and reduce mistakes.

## Scope

### In Scope
- Row-level checkboxes in the Terceros table
- "Bulk Edit" action bar when ≥1 tercero is selected
- Sidepanel with editable fields: tipo, naturaleza, lugar, archivado
- Batch save: updates all selected terceros in parallel
- Count indicator on the action bar ("3 seleccionados")

### Out of Scope
- Bulk delete/archive (separate workflow already exists per-item)
- Batch edit of name, apodo, documento, numeroDocumento (sensitive, low value in bulk)
- Select-all / page-select toggle (deferred — start with per-row only)
- Undo for bulk edits (too complex; confirmation step mitigates)

## Capabilities

### New Capabilities
- `terceros-bulk-edit`: multi-select rows in the Terceros table, edit common fields via sidepanel, apply changes to all selected records atomically

### Modified Capabilities
- None — existing specs (tercero-archiving, sidepanel-entity-components) are orthogonal

## Approach

1. Add a `selectedTerceros: Set<string>` state in `Datos.tsx`. Each row gets a checkbox. Toggle on click, shift-click for range not required (scope says no select-all).
2. When `selectedTerceros.size >= 1`, show a floating action bar above or below the table header with "Editar en lote (N)" button.
3. Click opens the existing Sidepanel with a new `BulkEditTerceroPanel` component. The panel renders only the 4 agreed fields: tipo (select), naturaleza (select), lugar (text), archivado (toggle). Each field has an "inherit" default (undefined/unchanged).
4. On submit, call `updateTercero(id, partial)` for each selected ID in parallel (`Promise.allSettled`). Show toast with success/failure count.
5. Clear selection on success. On partial failure, keep selected items that failed.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/Datos.tsx` | Modified | Add checkbox column + selection state + action bar |
| `lib/firestore.ts` | New | `batchUpdateTerceros(ids, data)` — wraps `Promise.allSettled` |
| `components/entities/tercero/BulkEditTerceroPanel.tsx` | New | Sidepanel component with bulk-edit fields |
| `components/Sidepanel.tsx` | Modified | Route `bulk-edit-tercero` entity/mode |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| User accidentally selects wrong terceros | Low | Confirm dialog before save; show item count always |
| Partial write failure (network split) | Low | `Promise.allSettled` + per-item toast; selection persists on failed items |
| Sidepanel overrides existing entity routing | Low | Use unique entity key `bulk-edit-tercero` — no collision |

## Rollback Plan

- Revert the Datos.tsx changes to remove checkboxes and action bar
- Delete the `BulkEditTerceroPanel` component and `batchUpdateTerceros`
- If shipped, no data migration needed — batch writes are just regular `updateDoc` calls

## Dependencies

- Existing `updateTercero(id, data)` in `firestore.ts`
- Existing Sidepanel routing infrastructure
- Existing Tercero type with all 4 bulk-edit fields

## Success Criteria

- [ ] User can select 1–N terceros, open bulk edit panel, change fields, save
- [ ] All selected terceros reflect the changes in Firestore within 1s
- [ ] Partial failures show per-item toast with which IDs failed
- [ ] `npm test` passes, `npx tsc --noEmit` passes
