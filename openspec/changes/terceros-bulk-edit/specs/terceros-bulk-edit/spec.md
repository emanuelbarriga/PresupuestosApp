# Terceros Bulk Edit Specification

## Purpose

Allow users to multi-select Tercero rows in the Datos view and batch-update common fields (tipo, naturaleza, lugar, archivado) via a sidepanel, reducing repetitive per-item edits.

## Requirements

### Requirement: Row-level checkbox selection

Each Tercero row in Datos.tsx MUST render a checkbox. Selection state SHALL be managed as a `Set<string>` of selected IDs, local to the Datos component.

#### Scenario: Select individual terceros

- GIVEN the Datos view renders a list of terceros
- WHEN the user clicks the checkbox on a specific row
- THEN that tercero's ID is added to the selection set
- AND clicking the same checkbox again removes it

#### Scenario: Selection persists through scroll

- GIVEN the user has selected terceros across different pages
- WHEN the user scrolls or paginates
- THEN the selection set is preserved

### Requirement: Floating action bar

When `selection.size >= 1`, a floating action bar SHALL appear near the table header. The bar SHALL display the count of selected items ("N seleccionados") and an "Editar en lote" button.

#### Scenario: Action bar appears with selection

- GIVEN no terceros are selected
- WHEN the user selects the first tercero
- THEN the action bar renders with "1 seleccionados"
- AND a button labeled "Editar en lote"

#### Scenario: Action bar disappears when empty

- GIVEN 3 terceros are selected
- WHEN the user deselects the last tercero
- THEN the action bar is removed from the DOM

### Requirement: Bulk edit sidepanel

Clicking "Editar en lote" SHALL open the Sidepanel with `{ entity: 'bulk-edit-tercero', mode: 'edit' }`. The `BulkEditTerceroPanel` SHALL render four fields: tipo (select), naturaleza (select), lugar (text), archivado (toggle). Each field MUST default to an empty/unset value (not applied) and be optional.

#### Scenario: Open bulk edit panel with selection

- GIVEN 3 terceros are selected and the action bar is visible
- WHEN the user clicks "Editar en lote"
- THEN the Sidepanel opens with `BulkEditTerceroPanel`
- AND all fields render empty (no pre-filled values)

#### Scenario: Close panel without changes

- GIVEN the bulk edit panel is open
- WHEN the user clicks the close button
- THEN the panel closes
- AND selection state is preserved (not cleared)

### Requirement: Batch save

On save, the system SHALL call `batchUpdateTerceros(ids, partialData)` which issues `Promise.allSettled` on per-document `updateDoc` calls. A success toast SHALL indicate the count of successful updates. On partial failure, the toast SHALL indicate the failure count AND the selection set SHALL retain the failed IDs.

#### Scenario: All updates succeed

- GIVEN 3 terceros selected and the user sets `tipo: "Cliente"` and `archivado: true`
- WHEN the user clicks "Guardar"
- THEN all 3 terceros reflect the new values in Firestore
- AND a toast shows "3 terceros actualizados correctamente"
- AND the selection is cleared

#### Scenario: Partial write failure

- GIVEN 3 terceros selected
- WHEN 2 succeed and 1 fails (network error)
- THEN a toast shows "2 actualizados, 1 falló"
- AND the failed ID remains in the selection set
- AND the successful IDs are removed from the selection

#### Scenario: Empty payload rejected

- GIVEN 3 terceros selected and the bulk edit panel is open
- WHEN the user clicks "Guardar" without changing any field
- THEN the system SHALL NOT call Firestore
- AND a toast shows "No hay cambios para guardar"

### Requirement: Sidepanel route dispatch

The Sidepanel router MUST accept `{ entity: 'bulk-edit-tercero', mode: 'edit' }` as a valid NavScreen. This SHALL NOT conflict with existing entity routes.

#### Scenario: Route dispatches BulkEditTerceroPanel

- GIVEN the Sidepanel receives NavScreen `{ entity: 'bulk-edit-tercero', mode: 'edit' }`
- WHEN the Sidepanel renders
- THEN `BulkEditTerceroPanel` is mounted with the selected IDs available in context
