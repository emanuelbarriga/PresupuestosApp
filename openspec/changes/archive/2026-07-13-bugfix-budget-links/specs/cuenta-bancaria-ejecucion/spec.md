# Delta for cuenta-bancaria-ejecucion

> Change: `bugfix-budget-links` · Date: 2026-07-13

## ADDED Requirements

### Requirement: Budget-Ejecucion Link Consistency on Delete

The `deleteEjecucion` function MUST decrement the linked budget's `totalEjecutado` by the ejecucion's `monto` and remove the entry from `linkedEjecuciones` before deleting the link and ejecucion documents.

#### Scenario: Delete linked ejecucion decrements budget

- GIVEN an ejecucion linked to a budget with a $500k monto
- WHEN the user deletes that ejecucion
- THEN the budget's `totalEjecutado` decreases by $500k
- AND the `linkedEjecuciones` array no longer contains that entry

#### Scenario: Delete ejecucion without budget link

- GIVEN an ejecucion with no budgetLinks
- WHEN the user deletes that ejecucion
- THEN no budget document is modified

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

## Coverage

- **Happy paths**: delete linked ejecucion (decrements), convert with budget (creates links), reactive update (live), valid tolerance (submits)
- **Edge cases**: delete unlinked ejecucion (noop), convert without budget (no links), unsubscribe guard (no stale callback), tolerance exceeded (blocked)
- **Error states**: tolerance exceeded (toast + blocked submission)
