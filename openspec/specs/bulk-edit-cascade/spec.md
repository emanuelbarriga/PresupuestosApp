# Bulk Edit & Cascade — Specification

## 1. Presupuestos Bulk Edit

**Checkbox selection.** Each Presupuesto row MUST render a checkbox (CheckSquare/Square). Selection SHALL be a `Set<string>` local to Datos, persisted across pagination.

- GIVEN the budgets table renders
- WHEN the user clicks a row checkbox
- THEN that budget ID toggles in the selection set
- AND selection survives page changes

**Floating action bar.** When `selection.size >= 1`, a bar SHALL display below filters with "N seleccionados" and "Editar en lote".

- GIVEN no budgets selected
- WHEN the first is checked
- THEN the bar appears with count and button
- AND disappears when the last is unchecked

**Bulk edit sidepanel.** "Editar en lote" SHALL navigate `{ type: 'bulk-edit-presupuesto'; selectedIds }`. `BulkEditPresupuestosPanel` SHALL render: descripcion (text input), montoPresupuestado (formatted number using formatThousands/unformatThousands), projectId/projectName (SearchableSelect via subscribeProjects), tipo (TipoSwitch: ingreso/egreso, no "ambos"), archivado (tristate null/true/false). All fields start empty/default. `buildPayload()` MUST include a field ONLY when its value differs from the empty/default state.

- GIVEN 3 budgets selected and bar visible
- WHEN the user clicks "Editar en lote"
- THEN the Sidepanel mounts `BulkEditPresupuestosPanel` with empty fields

**Batch save.** On save, SHALL call `batchUpdatePresupuestos(ids, data)` validated by `partialBudgetSchema`. `buildPayload()` filters fields at the UI layer — each field is included ONLY when its value differs from default. `batchUpdatePresupuestos` and `partialBudgetSchema` MUST NOT change from previous spec. Uses `Promise.allSettled`.

- GIVEN 3 budgets selected and fields changed
- WHEN "Guardar" is clicked
- THEN all 3 update in Firestore
- AND a success toast shows the count
- AND selection is cleared

- GIVEN 3 budgets selected and no fields changed
- WHEN "Guardar" is clicked
- THEN the system MUST NOT call Firestore
- AND a toast shows "No hay cambios para guardar"

- GIVEN 3 budgets, 2 succeed and 1 fails
- WHEN the batch completes
- THEN a toast shows partial failure
- AND the failed ID stays selected

- GIVEN a payload with { descripcion: "nuevo", montoPresupuestado: 50000, projectId: "proj1", tipo: "ingreso", archivado: true }
- WHEN partialBudgetSchema.parse() runs
- THEN validation succeeds

- GIVEN a payload with { invalidField: "value" }
- WHEN partialBudgetSchema.parse() runs
- THEN validation fails
- AND Firestore write is NOT attempted

**Sidepanel routing.** The Sidepanel MUST route `{ type: 'bulk-edit-presupuesto'; selectedIds }` to `BulkEditPresupuestosPanel`.

- GIVEN the Sidepanel receives this NavScreen
- WHEN `renderContent()` executes
- THEN `BulkEditPresupuestosPanel` mounts with selectedIds

## 2. Ejecuciones Bulk Edit

Same checkbox, action bar, save, and routing pattern as Presupuestos (REQ-PBE-1–5) with these differences:

| Aspect | Value |
|--------|-------|
| NavScreen type | `bulk-edit-ejecucion` |
| Component | `BulkEditEjecucionesPanel` |
| Batch function | `batchUpdateEjecuciones` (validated by `partialEjecucionSchema`) |
| Tipo field | TipoSwitch: ingreso/egreso (no "ambos") |
| Panel fields | descripcion, montoEjecutado (formatted via formatThousands/unformatThousands), projectId/projectName (SearchableSelect via subscribeProjects), tipo (TipoSwitch), archivado (tristate null/true/false) |

## 3. Tercero Name Cascade

**Cascade on name change.** When `name` is updated via `updateTercero` or `batchUpdateTerceros`, the system SHALL propagate the new name to all budgets and ejecuciones where `entityId === terceroId`. Propagation SHALL be silent (no UI feedback).

- GIVEN a tercero "Old" linked to 2 budgets and 3 ejecuciones
- WHEN `updateTercero(id, { name: "New" })` completes
- THEN all 5 linked docs have entityName="New"

- GIVEN batchUpdateTerceros with payload `{ name: "New" }`
- WHEN the batch completes
- THEN cascade runs for each tercero whose name changed

- GIVEN updateTercero(id, { tipo: "cliente" }) with no name field
- WHEN the update completes
- THEN no cascade query or writes occur beyond the tercero doc

**Cascade helper.** `cascadeTerceroName(companyId, terceroId, newName)` SHALL query budgets and ejecuciones subcollections by `where('entityId', '==', terceroId)`, then update matches via a single `WriteBatch` (max 500 ops). If count > 500, a warning SHALL be logged.

- GIVEN a tercero with 0 linked documents
- WHEN cascadeTerceroName runs
- THEN no Firestore writes occur

- GIVEN 600 linked documents exceed the WriteBatch limit
- WHEN cascadeTerceroName runs
- THEN a console.warn SHALL log the overflow
- AND the first 500 SHALL be updated

- GIVEN a linked doc was deleted between query and write
- WHEN the WriteBatch commits
- THEN the batch SHALL succeed (Firestore tolerates missing docs)

## 4. Terceros Bulk Edit — Modified Behavior

`batchUpdateTerceros` SHALL additionally invoke `cascadeTerceroName(companyId, id, data.name)` per tercero when `name` is in the payload. Existing requirements remain unchanged.

- GIVEN 3 terceros selected with payload `{ name: "New" }`
- WHEN batchUpdateTerceros finishes
- THEN cascadeTerceroName runs once per tercero
- AND linked budgets/ejecuciones reflect "New"

- GIVEN 3 terceros selected with no `name` in payload
- WHEN batchUpdateTerceros finishes
- THEN no cascade runs
- AND existing batch behavior is unchanged
