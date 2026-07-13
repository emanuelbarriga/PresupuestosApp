# Cuenta Bancaria de Ejecucion Specification

> Changes: `mejorar-ejecutados` (2026-07-05), `bugfix-budget-links` (2026-07-13), `integridad-datos-financieros` (2026-07-13) · Capability: `cuenta-bancaria-ejecucion`

## Purpose

Associate each ejecucion (both ingresos and egresos) with a bank account via `cuentaId` and denormalized `cuentaName`. The bank account selector in the form is populated from the existing `cuentasBancarias` subcollection. This enables users to track which bank account was used for each operation.

## Requirements

### Requirement: CuentaId and CuentaName Fields

The `Ejecucion` type SHALL gain two optional fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cuentaId` | `string` | no | References `companies/{companyId}/cuentasBancarias/{cuentaId}` |
| `cuentaName` | `string` | no | Denormalized bank account name for display without join |

The field SHALL be optional — an ejecucion can be created without selecting a bank account.

Both fields apply to ALL ejecuciones, regardless of `tipo` (ingreso or egreso).

#### Scenario: New ejecucion with bank account

- GIVEN the user creates an ejecucion of $300k as an egreso
- WHEN the user selects "Banco de Bogotá - Corriente 1234" in the form
- THEN the document is written with `cuentaId: "abc123"` and `cuentaName: "Banco de Bogotá - Corriente 1234"`

#### Scenario: New ejecucion without bank account

- GIVEN the user creates an ejecucion of $200k as an ingreso
- WHEN the user does NOT select a bank account in the form
- THEN the document is written without `cuentaId` or `cuentaName` fields
- AND the UI displays "Sin cuenta bancaria" for this ejecucion

#### Scenario: Ingreso ejecucion with bank account

- GIVEN the user creates an ejecucion of $500k as an ingreso (e.g., client payment received)
- WHEN the user selects "Bancolombia - Ahorros 5678" in the form
- THEN the document is written with `cuentaId` and `cuentaName`
- AND the Datos list view shows the bank account name

### Requirement: Bank Account Selector in Form

The "Nueva ejecución" form SHALL include a `SearchableSelect` dropdown populated from `subscribeCuentasBancarias(companyId)`. The dropdown SHALL display the bank account `nombre` and `banco` for each option. The `search` function SHALL filter by both `nombre` and `banco` fields.

#### Scenario: Bank dropdown populated from existing accounts

- GIVEN the company has 5 bank accounts (3 cuentas corrientes, 2 ahorros)
- WHEN the user opens the nueva ejecución form
- THEN the bank account dropdown shows 5 options with format "{banco} - {nombre} ({tipo})"
- AND the user can search by account name or bank name

#### Scenario: No bank accounts available

- GIVEN the company has no bank accounts registered
- WHEN the user opens the nueva ejecución form
- THEN the bank account dropdown shows "Sin cuentas bancarias" or is hidden entirely
- AND the ejecucion can still be created without a bank account

### Requirement: Denormalized Display Name

The `cuentaName` field SHALL be set at write time from the selected bank account's `nombre` (and optionally `banco` + `tipo` for clarity). This field is denormalized to avoid a join in list views.

Updating the bank account's name in `cuentasBancarias` SHALL NOT automatically update existing ejecucion documents that reference it. If a bank account name changes, the `cuentaName` in ejecuciones SHALL remain stale until explicitly updated via a script or manual edit.

#### Scenario: Bank account renamed, ejecucion not updated

- GIVEN a bank account was renamed from "Corriente Principal" to "Corriente Operativa"
- WHEN the user views an ejecucion created before the rename
- THEN the ejecucion still displays "Corriente Principal" as `cuentaName`
- AND the user can edit the ejecucion to refresh the name by re-selecting the account

### Requirement: Display in List and Detail Views

The Datos ejecucion list SHALL show the bank account name (or "Sin cuenta bancaria") for each ejecucion. The EjecucionView detail SHALL show the bank account name as a non-editable field.

#### Scenario: Bank account visible in Datos list

- GIVEN an ejecucion with `cuentaName: "Banco de Bogotá - Corriente 1234"`
- WHEN the Datos list renders
- THEN the row shows a small bank/building icon followed by "Banco de Bogotá - Corriente 1234"
- AND it is visually distinct from the comprobante state badge

#### Scenario: Bank account visible in EjecucionView

- GIVEN the user opens the detail of an ejecucion with a bank account
- WHEN the EjecucionView renders
- THEN a field "Cuenta bancaria" displays the `cuentaName`
- AND clicking the field navigates to the bank account detail if available

### Requirement: Movimiento Reset on Ejecucion Delete

Al borrar una ejecución que tiene `_movimientoId`, el sistema DEBE resetear el `MovimientoBancario` correspondiente a `convertido: false` y `_ejecucionId: ''`.

#### Scenario: Movimiento reset on delete

- GIVEN una ejecución con `_movimientoId: "mov456"`, sin budgetLinks
- WHEN `deleteEjecucion` es llamada
- THEN el documento `MovimientoBancario` "mov456" se actualiza con `{ convertido: false, _ejecucionId: '' }`
- AND la ejecución es borrada

#### Scenario: Movimiento reset with budgetLinks

- GIVEN una ejecución con `_movimientoId: "mov789"` Y un budgetLink a Budget A por $500k
- WHEN `deleteEjecucion` es llamada
- THEN el budget es reintegrado (writeBatch)
- AND el movimiento es reseteado
- AND ambas operaciones se completan (cada una en su propio mecanismo atómico)

#### Scenario: Delete ejecucion without movimiento

- GIVEN una ejecución sin `_movimientoId`
- WHEN `deleteEjecucion` es llamada
- THEN ningún documento de `MovimientoBancario` es modificado
- AND la ejecución es borrada normalmente

### Requirement: Budget Selection in Conversion Flow

The "Convertir movimientos a ejecuciones" flow (ConvertirMovimientosEntity) SHALL include a `SearchableSelect` budget picker populated from the company's budgets. When a budget is selected, each auto-created ejecucion SHALL receive a budgetLink to the selected budget via `addBudgetLink()`.

#### Scenario: Convert with budget selected

- GIVEN the user is converting 3 bank movements to ejecuciones
- WHEN the user selects "Proyecto Q1 2026" from the budget picker
- THEN each of the 3 ejecuciones gets a budgetLink to that budget
- AND the budget's `totalEjecutado` increments by the sum of all 3 montos

#### Scenario: Convert without budget

- GIVEN the user is converting bank movements to ejecuciones
- WHEN the user leaves the budget picker empty
- THEN ejecuciones are created without budgetLinks
- AND the conversion succeeds without errors

### Requirement: Reactive Budget-Ejecucion Subscription

The `subscribeEjecucionesByBudget` function MUST use a reactive `collectionGroup('budgetLinks')` query filtering by `budgetId` and `companyId`. The onSnapshot callback MUST guard against stale invocations after unsubscribe via an `isSubscribed` flag.

#### Scenario: Budget view updates in real-time

- GIVEN the user is viewing a budget's linked ejecuciones
- WHEN another user creates a new ejecucion linked to this budget
- THEN the budget view updates within 500ms without manual refresh

#### Scenario: Unsubscribe prevents stale callback

- GIVEN the component using `subscribeEjecucionesByBudget` has unmounted
- WHEN a budgetLink change occurs
- THEN the onSnapshot callback is NOT invoked

### Requirement: Tolerance Validation on EjecucionForm Submit

The `EjecucionForm.handleSubmit` SHALL compute `|montoEjecutado - sum(links.monto)|` and reject submission with a toast error if the difference exceeds 1 COP. This prevents drift between the ejecucion's amount and its budgetLink total.

#### Scenario: Valid tolerance allows submission

- GIVEN an ejecucion with montoEjecutado = $500k and budgetLinks summing to $499,999.50
- WHEN the user submits the form
- THEN the submission proceeds
- AND the budget's totalEjecutado is updated

#### Scenario: Tolerance exceeded blocks submission

- GIVEN an ejecucion with montoEjecutado = $500k and budgetLinks summing to $498k
- WHEN the user submits the form
- THEN the submission is blocked
- AND a toast error displays: "La diferencia entre el monto ejecutado y la suma de los vínculos presupuestales supera el límite permitido"

### Requirement: CuentaName Resolution via Global Subscription

La UI SHALL resolver `cuentaName` a través de la suscripción global `subscribeCuentasBancarias(companyId)` usando el `cuentaId` como key para buscar el nombre actualizado. El campo denormalizado `cuentaName` del snapshot SHALL usarse solo como fallback si la cuenta fue eliminada (ya no existe en la subcolección).

#### Scenario: CuentaName resolved from live subscription

- GIVEN una ejecución con `cuentaId: "bcol-123"` y `cuentaName: "Bancolombia - Ahorros 5678"` (snapshot anterior)
- WHEN el `nombre` de la cuenta bancaria fue cambiado a "Bancolombia - Ahorros Operativa"
- THEN la UI resuelve el nombre desde `subscribeCuentasBancarias` lookup por ID
- AND muestra "Bancolombia - Ahorros Operativa" (nombre actualizado)

#### Scenario: Fallback to snapshot when cuenta deleted

- GIVEN una ejecución con `cuentaId: "eliminada-123"` y `cuentaName: "Banco Viejo"` en el snapshot
- WHEN la cuenta bancaria fue eliminada de la subcolección
- THEN la UI usa `ejecucion.cuentaName` como fallback
- AND muestra "Banco Viejo" con un indicador visual de "Cuenta eliminada"

#### Scenario: Ejecucion without cuentaId

- GIVEN una ejecución sin `cuentaId` ni `cuentaName`
- WHEN la UI renderiza la fila
- THEN muestra "Sin cuenta bancaria"
- AND no realiza ningún lookup

## Security Rules

The `cuentaId` field references a document in a subcollection that already has access rules. No new rules are needed. The existing rule for `ejecuciones` covers the new fields:

```javascript
match /companies/{companyId}/ejecuciones/{doc} {
  allow read, write: if isMember(companyId);
}
```

Optional validation: the `cuentaId` SHOULD reference an existing document. This validation is performed at the application level (client-side), not in security rules.

## Indexes

No new indexes are required. Bank account filtering and display work on existing data patterns.

## Query Patterns

| Pattern | Method | Scope |
|---------|--------|-------|
| Populate bank account dropdown | `subscribeCuentasBancarias(companyId)` | `cuentasBancarias` subcollection |
| Display cuentaName in list | Direct field access on `ejecucion.cuentaName` | In-memory |
| Filter ejecuciones by bank account | Client-side filter on subscribed `ejecuciones` array (future) | In-memory |

## UI Behavior

- **Nueva ejecución form**: after the "Comprobantes" section, a `SearchableSelect` labeled "Cuenta bancaria (opcional)" with options from `cuentasBancarias`. Search by bank name or account name.
- **EjecucionView detail**: read-only field showing bank account name with an icon.
- **Datos.tsx**: optional indicator column or inline text showing bank account name. Matches the existing "show detail on hover" pattern.

## Stories / Scenarios

### Story: Egreso con banco de origen

Usuario paga $2M a un proveedor desde la cuenta de Bancolombia.

- Crea una ejecución de tipo egreso.
- Selecciona "Bancolombia - Ahorros 5678" en el selector de cuenta bancaria.
- Guarda. La ejecución se persiste con `cuentaId: "bcol-ahorros-5678"` y `cuentaName: "Bancolombia - Ahorros 5678"`.
- En Datos, ve el badge azul/banco en la fila de la ejecución.
- En el detalle, ve "Cuenta bancaria: Bancolombia - Ahorros 5678".

### Story: Ingreso con banco receptor

Usuario registra un pago de cliente por $800k que llegó a la cuenta de Davivienda.

- Crea una ejecución de tipo ingreso.
- Selecciona "Davivienda - Corriente 9999" en el selector.
- Guarda. Funciona igual que egreso — el campo aplica a ambos tipos.

### Story: Ejecución sin cuenta bancaria

Usuario registra un gasto menor de $50k en efectivo.

- NO selecciona cuenta bancaria en el formulario.
- Guarda. La ejecución se persiste sin `cuentaId` ni `cuentaName`.
- En Datos, no muestra indicador bancario o muestra "Sin cuenta".

## Out of Scope

- Automatic sync when a bank account name changes (denormalization staleness accepted)
- Bank account detail navigation from ejecucion view
- Filtering ejecuciones by bank account in Datos (client-side future enhancement)
- Reconciliation between ejecuciones and bank statements (conciliación automática)
- Validation in Firestore rules that `cuentaId` exists (client-side only)
- Multi-currency support for bank accounts (already exists in CuentaBancaria model)
