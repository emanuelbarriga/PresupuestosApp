# Firestore Security Rules — Documentos Collection

> Change: `sistema-medios-desacoplado` · Domain: `firestore-rules` · Date: 2026-07-14

## Purpose

Add security rules scoped to the `/companies/{companyId}/documentos/{docId}` path, enforcing multi-tenant isolation and status-based write permissions.

## Requirements

### Requirement: Multi-tenant Read/Write Isolation

All `documentos` rules SHALL use `isMember(companyId)` for access control, matching the existing `ejecuciones` and `presupuesto` rule pattern.

#### Scenario: Company member can read documentos

- GIVEN a user who is a member of company `abc`
- WHEN they query `/companies/abc/documentos`
- THEN the read is allowed

#### Scenario: Non-member denied read

- GIVEN a user who is NOT a member of company `abc`
- WHEN they query `/companies/abc/documentos`
- THEN the read is denied

### Requirement: Status-based Write Validation

Writes SHALL validate that `status` transitions follow the allowed path:

| From \ To | por_clasificar | enlazado |
|-----------|---------------|----------|
| por_clasificar | Allowed | Allowed |
| enlazado | Allowed * | Allowed |

`status` MUST be one of `"por_clasificar"` or `"enlazado"`.

*`enlazado → por_clasificar` is Allowed ONLY if `ejecucionId` is being set to `null` in the same write (document lifecycle when deleting linked ejecucion).

Rule pseudocode:
```
allow update: if isMember(companyId) && (
  resource.data.status != "enlazado" ||
  (request.resource.data.status == "por_clasificar" &&
   request.resource.data.ejecucionId == null)
);
```

#### Scenario: Status transition blocked (enlazado → por_clasificar without clearing ejecucionId)

- GIVEN a `DocumentoMedio` with `status: "enlazado"` and `ejecucionId: "abc123"`
- WHEN a write attempts to set `status: "por_clasificar"` keeping `ejecucionId: "abc123"`
- THEN the write is denied

#### Scenario: Status transition allowed (enlazado → por_clasificar with ejecucionId cleared)

- GIVEN a `DocumentoMedio` with `status: "enlazado"` and `ejecucionId: "abc123"`
- WHEN a write sets `status: "por_clasificar"` AND `ejecucionId: null`
- THEN the write is allowed

#### Scenario: Valid status transition allowed (por_clasificar → enlazado)

- GIVEN a `DocumentoMedio` with `status: "por_clasificar"`
- WHEN a write sets `status: "enlazado"`
- THEN the write is allowed

### Requirement: Field Validation on Create

Create operations SHALL require `fileName`, `storagePath`, `mimeType`, `size`, `status`, and `uploadedAt` to be present. `status` MUST default to `"por_clasificar"` and SHALL be within allowed values.

#### Scenario: Create missing required fields

- GIVEN a create operation on `/documentos/{docId}`
- WHEN `fileName` is omitted
- THEN the write is denied

### Requirement: No Deletes from Client

Client-side deletes on `/documentos/{docId}` SHALL be denied. Physical file cleanup is handled by server-side GC scripts only.

#### Scenario: Client delete denied

- GIVEN a `DocumentoMedio` record
- WHEN the client attempts `deleteDoc()`
- THEN the write is denied
