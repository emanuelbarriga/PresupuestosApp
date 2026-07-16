# Data Atomicity Specification

> Change: `deuda-tecnica-pdf-transactions` · Date: 2026-07-14

## Purpose

Ensure all multi-step Firestore write paths execute atomically — every sub-write either commits or none do — preventing partial-write corruption on network failure, crash, or concurrent conflict.

## Requirements

### Requirement: EjecucionForm + linkDocumentoToEntities — Transaction

When `EjecucionForm.onFormSubmit` calls `linkDocumentoToEntities()`, both the form write (Ejecucion doc + `_estadoComprobantes`) AND the DocumentoMedio status transition MUST execute inside a single `runTransaction`.

#### Scenario: Form submit commits atomically

- GIVEN a filled EjecucionForm with comprobantes uploaded
- WHEN the user submits
- THEN the Ejecucion document AND `linkDocumentoToEntities()` status update (`por_clasificar` → `enlazado`) are written in the same Firestore transaction
- AND if either write fails, neither is applied

#### Scenario: Mid-transaction failure reverts

- GIVEN the Ejecucion doc write succeeds but DocumentoMedio update fails after retries
- WHEN the transaction exhausts its limit
- THEN the Ejecucion document is NOT persisted
- AND the DocumentoMedio remains `por_clasificar`

### Requirement: addBudgetLink — Transaction

`addBudgetLink` MUST execute its two writes (link document + budget update) inside `runTransaction`.

#### Scenario: Budget linked atomically

- GIVEN a document with `status: "por_clasificar"` and a target budget
- WHEN `addBudgetLink()` runs
- THEN the budget's link fields AND the document's `ejecucionIds` / `status` update commit in one transaction
- AND on failure, neither write commits

### Requirement: removeBudgetLink — Transaction

`removeBudgetLink` MUST execute both writes (remove link + budget update) inside `runTransaction`.

#### Scenario: Budget unlinked atomically

- GIVEN a budget with a linked document
- WHEN `removeBudgetLink()` runs
- THEN the budget link removal AND document state reversion commit in one transaction
- AND on failure, both revert

### Requirement: Movimiento Conversion — Extend WriteBatch

The page.tsx movimiento conversion MUST fold `updateMovimiento(status: "en_extracto")` into the existing `writeBatch` that creates the extracto document.

#### Scenario: Conversion writes batched

- GIVEN a user converts N movimientos into an extracto
- WHEN the conversion executes
- THEN the extracto creation AND each movimiento status update are added to the same `writeBatch`
- AND if the batch fails, no movimiento is marked `en_extracto`

### Requirement: Extracto Creation — Extend WriteBatch

Extracto creation MUST fold the extracto document write, all movimiento status updates, and derived state into the existing `batchAddMovimientos` write batch.

#### Scenario: Extracto created with all movimientos

- GIVEN an extracto with N movimientos
- WHEN `batchAddMovimientos` executes
- THEN the extracto doc, each movimiento's `status: "en_extracto"`, and any derived state commit as a single batch
- AND partial failure is impossible (writeBatch is all-or-nothing)

### Requirement: updateTercero — WriteBatch (Existing)

`updateTercero` SHALL retain its existing `writeBatch` pattern for cascade updates. This requirement documents the existing guarantee, not a behavioral change.

#### Scenario: Name cascade within batch limit

- GIVEN a tercero with ≤ 10 linked documents
- WHEN `updateTercero` runs
- THEN all `entityName` updates commit in a single `writeBatch`
- AND the 10-document batch limit is respected

#### Scenario: Cascade exceeds batch limit — documented constraint

- GIVEN a tercero with more than 10 linked documents
- WHEN `updateTercero` runs
- THEN up to 10 documents are updated in the `writeBatch`
- AND remaining documents are skipped (this is an intentional limitation — `cascadeTerceroName` stays as `writeBatch`)
