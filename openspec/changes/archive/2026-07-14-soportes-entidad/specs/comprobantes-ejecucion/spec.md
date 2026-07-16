# Delta for comprobantes-ejecucion

**Change**: soportes-entidad — extend `subscribeDocumentos` with entity filters

## ADDED Requirements

### Requirement: Entity filters for subscribeDocumentos

The system SHALL extend `subscribeDocumentos(companyId, filters, onData, onError?)` to accept two new optional properties in the `filters` parameter: `terceroId?: string` and `projectId?: string`.

When `terceroId` is present, the function MUST append `where('terceroId', '==', terceroId)` to the Firestore query constraints. When `projectId` is present, it MUST append `where('projectId', '==', projectId)`. Both MAY be present simultaneously.

Existing calls that omit these properties MUST continue to work unchanged — the new params are fully optional and additive.

#### Scenario: Filter by terceroId

- GIVEN a component calls `subscribeDocumentos("c1", { terceroId: "t1", status: "enlazado" }, onData)`
- WHEN the query is built
- THEN constraints include `where('terceroId', '==', 't1')` AND `where('status', '==', 'enlazado')`

#### Scenario: Filter by projectId

- GIVEN a component calls `subscribeDocumentos("c1", { projectId: "p1", status: "enlazado" }, onData)`
- WHEN the query is built
- THEN constraints include `where('projectId', '==', 'p1')` AND `where('status', '==', 'enlazado')`

#### Scenario: Both entity filters present

- GIVEN a call with `{ terceroId: "t1", projectId: "p1" }`
- WHEN the query is built
- THEN both `where('terceroId', '==', 't1')` and `where('projectId', '==', 'p1')` are included

#### Scenario: No entity filter — backward compatible

- GIVEN an existing call `subscribeDocumentos("c1", { status: "enlazado" }, onData)`
- WHEN the query is built
- THEN only `where('status', '==', 'enlazado')` is applied — no entity constraint

#### Scenario: No filters at all — backward compatible

- GIVEN a call with no filters object: `subscribeDocumentos("c1", {}, onData)`
- WHEN the query is built
- THEN no `where()` constraints are added — the query reads the full collection
