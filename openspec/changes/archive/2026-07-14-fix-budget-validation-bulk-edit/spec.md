# Delta for Bulk Edit & Cascade

## ADDED Requirements

### Requirement: BudgetForm validates estadoProyecto

BudgetFields MUST include `estadoProyecto: string`. In `handleSubmit`, the entry MUST set `entry.estadoProyecto = fields.estadoProyecto || 'Activo'` BEFORE `budgetSchema.parse()`.

#### Scenario: New budget saves with default

- GIVEN BudgetForm for a new budget
- WHEN the user submits after filling required fields
- THEN budgetSchema.parse() receives estadoProyecto="Activo"
- AND no "Invalid input" error

#### Scenario: Existing budget preserves its value

- GIVEN BudgetForm loads a budget with estadoProyecto="Finalizado"
- WHEN the user modifies monto and submits
- THEN entry.estadoProyecto is "Finalizado"
- AND parse succeeds

#### Scenario: Empty default

- GIVEN estadoProyecto is not set
- WHEN handleSubmit runs
- THEN entry.estadoProyecto defaults to "Activo"
- AND parse succeeds

## MODIFIED Requirements

### Requirement: BulkEditPresupuestosPanel fields

`BulkEditPresupuestosPanel` SHALL render: descripcion (text input), montoPresupuestado (formatted number using formatThousands/unformatThousands), projectId/projectName (SearchableSelect via subscribeProjects), tipo (TipoSwitch: ingreso/egreso, no "ambos"), archivado (tristate null/true/false). All fields start empty/default. `buildPayload()` MUST include a field ONLY when its value differs from the empty/default state.
(Previously: tipo (select: ingreso/egreso/ambos), descripcion, archivado only)

#### Scenario: Panel renders all new fields

- GIVEN 3 budgets selected and floating bar visible
- WHEN the user clicks "Editar en lote"
- THEN BulkEditPresupuestosPanel mounts with all 5 field inputs visible
- AND each field shows its empty/default value

#### Scenario: Payload excludes unmodified fields

- GIVEN the panel just loaded with no user changes
- WHEN the user clicks "Guardar"
- THEN buildPayload returns {}
- AND Firestore is NOT called ("No hay cambios para guardar")

#### Scenario: Monto formatted input round-trips correctly

- GIVEN the user types "50000" in montoPresupuestado
- WHEN they focus out
- THEN the field displays "50.000" (formatted)
- WHEN they click "Guardar"
- THEN buildPayload returns { montoPresupuestado: 50000 }
- AND descripcion is absent from payload

#### Scenario: Archivado tristate cycles null→true→false→null

- GIVEN archivado starts null
- WHEN the user clicks three times
- THEN it cycles through true, false, and back to null
- AND buildPayload excludes archivado when null

#### Scenario: TipoSwitch toggles ingreso/egreso

- GIVEN tipo starts empty
- WHEN the user clicks the switch
- THEN it toggles between "ingreso" and "egreso"

### Requirement: BulkEditEjecucionesPanel fields

Same pattern using ejecucionSchema field names: descripcion (text input), montoEjecutado (formatted number), projectId/projectName (SearchableSelect), tipo (TipoSwitch: ingreso/egreso), archivado (tristate). `buildPayload()` MUST omit fields with empty/default values.
(Previously: tipo, descripcion, archivado only)

#### Scenario: Ejecuciones panel renders new fields

- GIVEN 3 ejecuciones selected
- WHEN the user clicks "Editar en lote"
- THEN the panel renders descripcion, montoEjecutado, projectId, tipo, archivado

#### Scenario: Payload includes only changed fields

- GIVEN the user enters "100000" in montoEjecutado only
- WHEN they click "Guardar"
- THEN buildPayload returns { montoEjecutado: 100000 }
- AND descripcion, projectId, tipo, archivado are absent from payload

### Requirement: Batch functions (unchanged signature)

`batchUpdatePresupuestos` and `batchUpdateEjecuciones` MUST NOT change. `partialBudgetSchema` and `partialEjecucionSchema` already validate descripcion, montoPresupuestado/montoEjecutado, projectId, tipo, and archivado. BuildPayload validates at the UI layer — schemas in firestore.ts are untouched.
(Previously: archived spec mentions only entityId validation)

#### Scenario: Partial schema accepts all new fields

- GIVEN a payload with { descripcion: "nuevo", montoPresupuestado: 50000, projectId: "proj1", tipo: "ingreso", archivado: true }
- WHEN partialBudgetSchema.parse() runs
- THEN validation succeeds

#### Scenario: Partial schema rejects unknown fields

- GIVEN a payload with { invalidField: "value" }
- WHEN partialBudgetSchema.parse() runs
- THEN validation fails
- AND Firestore write is NOT attempted

## REMOVED Requirements

### Requirement: Tipo "ambos" option in Presupuestos bulk edit

The "ambos" option from the previous tipo select SHALL be removed. Tipo now uses TipoSwitch with only "ingreso" and "egreso".
(Reason: TipoSwitch component does not support "ambos" — ingreso/egreso toggles only, consistent with Ejecuciones panel.)
