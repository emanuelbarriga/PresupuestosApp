# Data Integrity Specification

> Change: `broken-references-prevention` · Date: 2026-07-17

## Purpose

Ensure soft references between Firestore collections remain consistent at write boundaries. No cascades, no migrations — only prevention.

## Requirements

### Requirement: subscribeEjecuciones Hydration

`subscribeEjecuciones`, `subscribeEjecucionesWithFilter`, and `subscribeEjecucionesByBudget` MUST hydrate `_linkedDocumentos` and `_estadoComprobantes` in delivered snapshots.

#### Scenario: Fields present in Firestore

- GIVEN an ejecución with `_linkedDocumentos: [{documentoId: "doc1", tipoDocumento: "factura_compra"}]` and `_estadoComprobantes: "Completada"` stored in Firestore
- WHEN `subscribeEjecuciones` delivers the snapshot
- THEN the callback receives the ejecución with both fields matching stored values

#### Scenario: Missing fields default gracefully

- GIVEN an ejecución without `_linkedDocumentos` or `_estadoComprobantes` in Firestore
- WHEN `subscribeEjecuciones` delivers the snapshot
- THEN the callback receives `_linkedDocumentos: []` and `_estadoComprobantes: ""`

### Requirement: Audit Script (Read-Only)

`scripts/audit-broken-references.ts` MUST detect broken soft references across collections without modifying data.

#### Scenario: Budget with archived tercero

- GIVEN a budget whose `entityId` references an archived or nonexistent tercero
- WHEN the audit script runs
- THEN output includes that budget and the broken reference type

#### Scenario: Proyecto with archived client

- GIVEN a proyecto whose `clientId` references an archived or nonexistent tercero
- WHEN the audit script runs
- THEN output includes that proyecto and the broken reference type

#### Scenario: Dry-run guarantee

- GIVEN the audit script runs on any dataset
- WHEN processing completes
- THEN no Firestore writes are executed
- AND exit code is 0 regardless of findings

### Requirement: Archivar Tercero Full Guard

When archiving a tercero, the system MUST check and display counts for all four reference types: budgets, ejecuciones, documentos, and proyectos.

#### Scenario: Tercero with all reference types

- GIVEN a tercero linked to 3 budgets, 5 ejecuciones, 2 documentos, and 1 proyecto
- WHEN the user attempts to archive it
- THEN the guard displays: budgets (3), ejecuciones (5), documentos (2), proyectos (1)
- AND archiving requires explicit confirmation

#### Scenario: Tercero with zero references

- GIVEN a tercero with no references in any of the four categories
- WHEN the user attempts to archive it
- THEN the guard confirms zero references and allows archiving without extra confirmation

### Requirement: deleteBudget Atomic Batch

`deleteBudget` MUST delete the budget document and all linked budgetLinks in a single `writeBatch`.

#### Scenario: Budget with linked documents

- GIVEN a budget with 3 budgetLink documents
- WHEN `deleteBudget(budgetDocId)` executes
- THEN the budget doc AND all budgetLinks are deleted atomically in one `writeBatch`
- AND on failure, neither the budget nor any budgetLink is deleted

#### Scenario: Budget with zero links

- GIVEN a budget with no budgetLinks
- WHEN `deleteBudget(budgetDocId)` executes
- THEN the budget is deleted via `writeBatch` with a single operation
