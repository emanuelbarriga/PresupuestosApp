# Ejecucion Budget Link Specification

> Change: `mejorar-ejecutados` · Capability: `ejecucion-budget-link` · Date: 2026-07-05

## Purpose

Replace the 1:1 relationship between Ejecucion and Budget (via `Ejecucion.budgetId`) with an N:M relationship via a junction subcollection. One ejecucion can pay N budgets, and one budget can be paid by N ejecuciones. Each link carries a partial `monto` representing the actual amount allocated from that budget to that payment.

## Requirements

### Requirement: Junction Subcollection Replaces budgetId

The system SHALL replace `Ejecucion.budgetId?: string` with a junction subcollection at `companies/{companyId}/ejecuciones/{ejecucionId}/budgetLinks/{id}`. Each link document SHALL contain:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `budgetId` | `string` | yes | References `companies/{companyId}/budgets/{budgetId}` |
| `monto` | `number` | yes | Amount from this budget that this ejecucion covers (≥ 0) |
| `createdAt` | `Timestamp` | yes | Server timestamp when the link was created |

Existing ejecuciones using the old `budgetId` field SHALL be deleted (no migration). The `budgetId` field SHALL be removed from the `Ejecucion` type and all related code paths.

#### Scenario: New ejecucion linked to multiple budgets

- GIVEN the user creates an ejecucion of $600k total (`montoEjecutado`)
- WHEN the form assigns $200k to Budget A and $400k to Budget B
- THEN two `budgetLinks` documents are created (one per budget) with the respective `monto` values
- AND `max(execution.montoEjecutado) - sum(links.monto)` does not exceed a small rounding tolerance

#### Scenario: Query ejecuciones of a budget

- GIVEN three ejecuciones linked to Budget X via `budgetLinks`
- WHEN an admin views Budget X in the BudgetView
- THEN the system queries `collectionGroup('budgetLinks').where('budgetId', '==', budgetId)` across the company scope
- AND returns the three parent ejecuciones identified by the document path segments

#### Scenario: Query budgets of an ejecucion

- GIVEN an ejecucion linked to Budget A and Budget B
- WHEN the user opens the ejecucion detail in the Sidepanel
- THEN the system reads the `budgetLinks` subcollection of that ejecucion
- AND fetches the referenced budget documents to display budget names and amounts

#### Scenario: Rounding tolerance for monto sum

- GIVEN an ejecucion with `montoEjecutado = 100000` and budgetLinks summing to `99999`
- WHEN the difference is ≤ 1 (integer rounding)
- THEN the system SHOULD accept the sum as valid
- WHEN the difference is > 1
- THEN the system SHALL reject the write with a validation error

### Requirement: Bidirectional Query Support

The system SHALL support real-time queries from both sides of the relationship.

- Query A: Given a `budgetId`, subscribe to all linked ejecuciones via `collectionGroup('budgetLinks').where('budgetId', '==', budgetId)` scoped to the current company.
- Query B: Given an `ejecucionId`, read its `budgetLinks` subcollection to list linked budgets.

#### Scenario: Datos shows linked budgets per ejecucion

- GIVEN the user is on the "Datos" view showing a table of ejecuciones
- WHEN an ejecucion has 2 budgetLinks
- THEN the UI renders the linked budget names as a comma-separated list or chips below the ejecucion row

#### Scenario: Budget detail shows linked ejecuciones

- GIVEN the user opens the BudgetView for a budget
- WHEN that budget has linked ejecuciones
- THEN the system lists all linked ejecuciones with their description, monto (from the link), and date

### Requirement: No Migration of Existing Data

The system SHALL NOT migrate existing ejecuciones with the old `budgetId` field. All existing ejecuciones SHALL be deleted as part of this change. The user explicitly confirmed this.

#### Scenario: Existing ejecuciones are removed

- GIVEN the codebase has ejecuciones with `budgetId` prior to this change
- WHEN the change is deployed
- THEN those ejecuciones no longer exist in Firestore
- AND the `budgetId` field is absent from the `Ejecucion` type

## Security Rules

The `budgetLinks` subcollection SHALL be protected by the same membership check as its parent:

```javascript
match /companies/{companyId}/ejecuciones/{ejecucionId}/budgetLinks/{linkId} {
  allow read, write: if isMember(companyId);
}
```

No additional validation is required in security rules for the junction data itself. Data integrity checks (monto sum consistency) are handled on the client.

## Indexes

A collection group index on `budgetId` for the `budgetLinks` collection group SHALL be added:

```json
{
  "collectionGroup": "budgetLinks",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "budgetId", "order": "ASCENDING" }
  ]
}
```

If querying within a specific company scope (filtering additionally by company path), a single-field ascending index on `budgetId` for `budgetLinks` in the default scope may suffice. However, the collection group index is preferred for maximum query flexibility.

## Query Patterns

| Pattern | Method | Scope |
|---------|--------|-------|
| "Budgets of an ejecucion" | `firestore.collection('companies', companyId, 'ejecuciones', ejecucionId, 'budgetLinks')` | Subcollection read |
| "Ejecuciones of a budget" | `firestore.collectionGroup('budgetLinks').where('budgetId', '==', budgetId)` | Collection group |
| Real-time subscription for "ejecuciones of budget" | `onSnapshot` on collection group query | Collection group |

## UI Behavior

- **Nueva ejecución form**: replaces the single "Vincular presupuesto" `SearchableSelect` with a multi-budget selector. Each selected budget has a `monto` input for the partial amount. Auto-sums display showing remaining amount to allocate.
- **BudgetView (Budget detail)**: the "Ejecuciones" section lists all linked ejecuciones with their link `monto` (not the full `ejecucion.montoEjecutado`).
- **EjecucionView (Ejecucion detail)**: the "Presupuesto vinculado" section becomes a list of linked budgets, each showing its link amount.
- **Datos.tsx**: budget link displayed as chips or a comma-separated list. "Sin presupuesto" shown when no links exist.

## Stories / Scenarios

### Story: Pago dividido entre varios presupuestos

Tres presupuestos: P1 ($300k), P2 ($500k), P3 ($200k). El usuario registra un pago (ejecución) de $150k que cubre parcialmente P1.

- Crea ejecución con `montoEjecutado = 150000`
- Vincenta a P1 con `monto = 150000`
- Luego crea otra ejecución de $850k que cubre saldo de P1 ($150k) + P2 completo ($500k) + P3 completo ($200k)
- La ejecución tiene 3 budgetLinks: P1 ($150k), P2 ($500k), P3 ($200k)
- Σ = $850k, coincide con `montoEjecutado = 850000`
- Al consultar P1, se ven 2 ejecuciones (la de $150k y la de $850k)
- Al consultar P2, se ve 1 ejecución (la de $850k)
- Al consultar la ejecución de $850k, se ven 3 presupuestos vinculados

## Out of Scope

- Migration of existing ejecuciones (they are deleted)
- Automatic reconciliation between budget totals and link sums
- Transaction-based enforcement of monto consistency in Firestore rules (client-side only)
- Hidden indexes: collection group indexes require manual setup in `firestore.indexes.json`
