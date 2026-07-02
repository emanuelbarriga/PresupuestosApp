# Entity References Specification

## Purpose

Budget and Ejecucion records use plain-text names for entity relations. Renames orphan linked records — Dashboard grouping, Datos filtering, click handlers break. ID references with immutable snapshots fix this.

## Requirements

### Requirement: Budget and Ejecucion Type Fields

`Budget` and `Ejecucion` SHALL include `projectId`, `entityId`, `entityType`. Rename `proyectoAsignado` → `projectName`, `clienteOProveedor` → `entityName` (required snapshots). `Ejecucion` SHALL include `entityType: 'client' | 'provider' | 'interno'`.

#### Scenario: New budget stored with ID fields

- GIVEN a new budget is created via the Sidepanel
- WHEN written to Firestore
- THEN it contains `projectId`, `entityId`, `entityType`, `projectName`, `entityName`

#### Scenario: Pre-migration document tolerated

- GIVEN a document with `proyectoAsignado` but no `projectId`
- WHEN read into a `Budget` object
- THEN app SHALL NOT crash; `projectId` MAY default to `""`

### Requirement: Snapshot Fields Are Immutable

`projectName` and `entityName` SHALL be set at creation and MUST NOT update when the referenced entity is renamed. `projectId` and `entityId` persist regardless.

#### Scenario: Renamed project keeps old snapshot

- GIVEN a budget with `projectId: "abc123"` and `projectName: "ABC"`
- WHEN project renames to `"DEF"`
- THEN budget's `projectName` stays `"ABC"`; new budgets use `"DEF"`

#### Scenario: Orphaned ID uses snapshot fallback

- GIVEN a budget with `projectId: "abc123"` and `projectName: "ABC"`
- WHEN the project document no longer exists
- THEN the system displays `"ABC"` from the snapshot

### Requirement: ID-Based Resolution

Dashboard SHALL group budgets by `projectId`, resolve `projectName` for display. Datos SHALL filter by `projectId`. `handleProjectClick` SHALL match by `projectId`.

#### Scenario: Grouping survives rename

- GIVEN budgets with `projectId: "abc123"` under old and new names
- WHEN Dashboard builds `matrixData`
- THEN all budgets with that ID appear in one group

#### Scenario: Click matches by ID

- GIVEN the user clicks a project group in Dashboard
- WHEN `handleProjectClick` fires
- THEN it matches by `projectId`, not by name

### Requirement: Entity Type Resolution

System SHALL resolve display names from the correct collection per `entityType`. `'interno'` SHALL display `"Interno"` without document lookup. SHOULD fall back to `entityName` if entity doc is missing.

#### Scenario: Client resolved from clients collection

- GIVEN a budget with `entityId: "cli456"`, `entityType: "client"`
- WHEN displayed
- THEN name reads from the clients subcollection

#### Scenario: Interno skips document lookup

- GIVEN a budget with `entityType: "interno"`
- WHEN displayed
- THEN it shows `"Interno"` with no collection query

#### Scenario: Missing doc falls back to snapshot

- GIVEN a budget with `entityId: "cli456"` and `entityName: "Acme"`
- WHEN the client doc no longer exists
- THEN `entityName: "Acme"` is displayed

### Requirement: Sidepanel Form Resolves IDs on Submit

Sidepanel SHALL store selected entity's document ID as `entityId`, type as `entityType`, and selected project's ID as `projectId` when creating/editing Budget or Ejecucion.

#### Scenario: Entity resolved to document ID

- GIVEN the user selects `"Proveedor X"` in the Sidepanel
- WHEN the form submits
- THEN `entityId` is the document ID and `entityType` is `"provider"`

#### Scenario: Interno stored without entity ID

- GIVEN the user selects `"Interno"` as entity type
- WHEN the form submits
- THEN `entityType` is `"interno"`; `entityId` MAY be `""`

### Requirement: Data Migration

One-shot script SHALL backfill `projectId`, `entityId`, `entityType` for existing Budget and Ejecucion docs by matching names against project/client/provider docs. MUST be idempotent. Unmatched names SHALL leave IDs as `""`, retain existing snapshots.

#### Scenario: Name matched to project ID

- GIVEN a budget with `proyectoAsignado: "Alfa"` and project `"Alfa"` exists with ID `"p789"`
- WHEN migration runs
- THEN `projectId: "p789"`, `projectName: "Alfa"`

#### Scenario: Migration is idempotent

- GIVEN a document already has `projectId: "p789"`
- WHEN migration runs again
- THEN the document is unchanged

#### Scenario: Unmatched entity leaves fields empty

- GIVEN a budget with `clienteOProveedor: "Unknown"` and no matching doc
- WHEN migration runs
- THEN `entityId` is `""`, `entityType` is `""`, `entityName` retains `"Unknown"`
