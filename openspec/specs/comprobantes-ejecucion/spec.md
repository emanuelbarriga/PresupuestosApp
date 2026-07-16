# Comprobantes de Ejecucion Specification

> Changes: `mejorar-ejecutados` (2026-07-05), `sistema-medios-desacoplado` (2026-07-14), `soportes-entidad` (2026-07-14) · Capability: `comprobantes-ejecucion`

## Purpose

Add mandatory comprobante types to ejecuciones with derived states (Completada, Falta un comprobante, Sin comprobantes) and granularity showing which specific type is missing. The two required comprobante types ("Comprobante de pago" and "Cuenta de Cobro") already exist in `settings.tipoComprobante` (orders 3 and 4 respectively).

## Requirements

### Requirement: Two Required Comprobante Types

The system SHALL require ejecuciones to track two mandatory comprobante types from `settings.tipoComprobante`:

| Order | Name | Code |
|-------|------|------|
| 3 | Comprobante de pago | `falta_pago` |
| 4 | Cuenta de Cobro | `falta_cuenta_cobro` |

Additional comprobantes MAY be uploaded (they are optional and complementary). Only comprobantes whose `tipo` matches one of the required types are considered for state derivation.

#### Scenario: Settings already contain both required types

- GIVEN a company's `settings/tipoComprobante` array
- WHEN the system reads it
- THEN the array contains items with `name: "Comprobante de pago"` (order 3) and `name: "Cuenta de Cobro"` (order 4)

#### Scenario: Optional comprobante does not affect state

- GIVEN an ejecucion with a "Comprobante de pago", a "Cuenta de Cobro", and an additional "Factura" comprobante
- WHEN the state is derived
- THEN the state is "Completada" — the extra comprobante does not change the result

### Requirement: Derived State from Comprobantes

The system SHALL store a denormalized `_estadoComprobantes` field on `Ejecucion` to avoid N+1 queries. This field SHALL be updated atomically whenever documents are linked or unlinked, using the same pure function `derivarEstadoComprobantes(documentos: DocumentoMedio[], tiposComprobanteSettings)`.

The field values match the existing state table:

| Field | Values |
|-------|--------|
| `_estadoComprobantes` | `"Completada"` \| `"Falta un comprobante"` \| `"Sin comprobantes"` \| `""` |

The dashboard SHALL read `_estadoComprobantes` directly from the `Ejecucion` document — no queries to `/documentos` collection for list views. The `derivarEstadoComprobantes()` function is called only on the write path (when linking/unlinking documents) and the result is persisted via `updateDoc`.

| State | Condition | Granularity |
|-------|-----------|-------------|
| `Completada` | Both required types present | N/A |
| `Falta un comprobante` | Exactly 1 of 2 required types present | `"falta_pago"` or `"falta_cuenta_cobro"` |
| `Sin comprobantes` | 0 of 2 required types present | N/A |

(Previously: function read from embedded `Ejecucion.comprobantes` array at read time)

#### Scenario: Completada — state persisted atomically on link

- GIVEN an ejecucion with 2 DocumentoMedio linked: `[{ tipoDocumento: "Comprobante de pago" }, { tipoDocumento: "Cuenta de Cobro" }]`
- WHEN `linkDocumentoToEntities()` executes
- THEN `_estadoComprobantes` on the Ejecucion document is set to `"Completada"` in the same write
- AND the dashboard reads `ejecucion._estadoComprobantes` directly (0 extra queries)

#### Scenario: Sin comprobantes — default on creation

- GIVEN a new ejecucion is created
- WHEN the creation write completes
- THEN `_estadoComprobantes` defaults to `"Sin comprobantes"`
- AND no query to `/documentos` is needed to display this

### Requirement: State Display and Filtering

The UI SHALL display the comprobante state for each ejecucion in the Datos list view with color-coded badges:

| State | Color | Badge text |
|-------|-------|------------|
| Completada | Green | "Completada" |
| Falta un comprobante | Amber | "Falta {faltante}" |
| Sin comprobantes | Gray | "Sin comprobantes" |

When state is "Falta un comprobante", the badge SHALL surface the granularity: "Falta pago" or "Falta cuenta de cobro".

A filter dropdown in Datos SHALL allow filtering by comprobante state with options: Todos, Sin comprobantes, Falta un comprobante, Completada.

#### Scenario: Filter by "Falta un comprobante"

- GIVEN the Datos view displays 10 ejecuciones (3 Completadas, 4 Falta un comprobante, 3 Sin comprobantes)
- WHEN the user selects "Falta un comprobante" in the filter
- THEN only 4 ejecuciones are shown, each with the amber badge showing which comprobante is missing

### Requirement: ComprobanteUploader Support for Required Types

The existing `ComprobanteUploader` component SHALL be extended to accept an optional `requiredTypes` prop. When provided, the component SHALL:
- Mark which types are mandatory (e.g., with a visual indicator like `*`)
- Validate that at least one comprobante exists for each required type
- Show an inline validation error if required types are missing on submit

Comprobantes are NOT mandatory at upload time — the ejecucion can be saved with missing comprobantes. The validation is guidance, not a block.

#### Scenario: Uploader shows required type markers

- GIVEN the user is creating a new ejecucion
- WHEN the ComprobanteUploader renders with `requiredTypes: ["Comprobante de pago", "Cuenta de Cobro"]`
- THEN these two types are visually marked as required in the tipo chips

### Requirement: ComprobanteUploader — New Upload Destination

The `ComprobanteUploader` SHALL upload files to Storage path `companies/{cId}/documentos/{uuid}-{fileName}` (flat, not nested under ejecucionId) and create `DocumentoMedio` records with `status: "por_clasificar"`. Only after the EjecucionForm Firestore write confirms, `linkDocumentoToEntities()` transitions them to `"enlazado"`. If the Firestore write fails, documents remain `"por_clasificar"`.

(Previously: files uploaded to `{cId}/ejecuciones/{ejecucionId}/{uuid}-{name}` and saved as embedded `Comprobante[]` array on `Ejecucion.comprobantes`)

#### Scenario: Ejecucion created successfully

- GIVEN the user fills EjecucionForm and uploads 2 comprobantes
- WHEN the form submits
- THEN files upload to Storage at flat `/documentos/` path
- AND 2 DocumentoMedio records are created (`status: "por_clasificar"`)
- AND after Firestore write succeeds, `linkDocumentoToEntities()` sets `status: "enlazado"`
- AND `ejecucionId` is populated on each DocumentoMedio

#### Scenario: Firestore write fails after upload

- GIVEN the user submits the form and files upload successfully
- WHEN the Firestore `addDoc` / `setDoc` call fails
- THEN the 2 DocumentoMedio records remain with `status: "por_clasificar"`
- AND `ejecucionId` is NOT set on them
- AND the user sees an error toast
- AND the documents appear in the inbox for manual classification

### Requirement: Legacy Comprobante Array — Deprecated

The `Ejecucion.comprobantes` field is DEPRECATED. `derivarEstadoComprobantes()` SHALL read from `/documentos` collection. A migration script SHALL transfer legacy comprobantes to `/documentos` records. Reading code SHALL check both sources during migration window, preferring `/documentos`.

(Previously: `comprobantes` was the single source of truth on `Ejecucion`)

#### Scenario: Legacy ejecucion with embedded comprobantes

- GIVEN an ejecucion created before migration with `comprobantes: [{...}]`
- WHEN `derivarEstadoComprobantes` is called
- THEN it reads from `/documentos` collection — migration has populated it
- AND if `/documentos` is empty, it falls back to embedded array
- AND the display still shows the correct derived state

### Requirement: Delete Ejecucion — Document Lifecycle

Deleting an ejecucion SHALL NOT cascade-delete its linked `DocumentoMedio` records. Instead, it SHALL unlink documents: remove `ejecucionId` from the array, revert `status` to `"por_clasificar"` if no remaining links, and recompute `_estadoComprobantes` for the affected ejecucion. Physical Storage files are NOT deleted. The firestore rules carve-out allows `enlazado → por_clasificar` when the last `ejecucionId` is removed.

#### Scenario: Ejecucion deleted, documents revert via rules carve-out

- GIVEN an ejecucion with 3 linked DocumentoMedio records (`status: "enlazado"`, each with `ejecucionIds: ["ej-123"]`)
- WHEN `deleteEjecucion()` is called and the client executes `arrayRemove("ej-123")` on each linked DocumentoMedio
- THEN if `ejecucionIds` becomes empty, `status` is set to `"por_clasificar"`
- AND Storage files still exist at their original paths

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

## Security Rules

The `comprobantes` array is embedded in the `Ejecucion` document. No new security rules are needed for the array itself. Security rules SHALL continue to use:

```javascript
match /companies/{companyId}/ejecuciones/{doc} {
  allow read, write: if isMember(companyId);
}
```

The state derivation function lives entirely on the client — no rules changes needed for state computation.

## Indexes

No new indexes are required. Comprobante state filtering is performed client-side on the already-subscribed `ejecuciones` array. If future requirements add server-side filtering by comprobante state, a composite index on the comprobante array or derived field would be needed — but that is out of scope.

## Query Patterns

| Pattern | Method | Location |
|---------|--------|----------|
| Read ejecuciones with state | `onSnapshot` on `ejecuciones` collection | Client subscribes normally |
| Filter by state | Array filter on subscribed data | `Datos.tsx` — client-side |
| Derive state | `derivarEstadoComprobantes()` pure function | Any component that needs it |

## UI Behavior

- **Badge in Datos.tsx**: each ejecucion row gets a colored badge next to the description showing state + granularity
- **Filter dropdown**: above the ejecuciones table in Datos, a dropdown with 4 options
- **EjecucionView detail**: state shown in the comprobantes section header with granularity text
- **ComprobanteUploader**: visual markers for required types; validation feedback but not blocking
- **Color coding**: green (#22c55e) for Completada, amber (#f59e0b) for Falta, gray (#94a3b8) for Sin comprobantes

## Stories / Scenarios

### Story: Receipt uploaded but invoice missing

Usuario registra un pago de $500k. Sube el "Comprobante de pago" bancario pero no tiene la "Cuenta de Cobro" del proveedor.

- Guarda la ejecución. El badge muestra "Falta cuenta de cobro" en ámbar.
- Una semana después, el proveedor envía la cuenta de cobro.
- Usuario abre la ejecución en el detalle, sube el PDF con tipo "Cuenta de Cobro".
- El badge cambia automáticamente a "Completada" en verde.

### Story: Datos filter finds missing comprobantes

Usuario necesita auditar qué pagos del mes no tienen comprobantes completos.

- En Datos, selecciona filtro "Falta un comprobante".
- Ve 7 ejecuciones con badge ámbar.
- Para cada una, ve exactamente qué falta ("Falta pago" o "Falta cuenta de cobro").
- Puede abrir cada ejecución y subir el comprobante faltante.

## Out of Scope

- Auto-validation at Firestore rules level (state is derived, not stored)
- Sending notifications when comprobantes are missing
- Comprobantes on Budget documents (they live only on Ejecucion)
- Creating the required tipos (they already exist in settings)
- Making comprobantes blocking for ejecucion creation (they remain optional but tracked)
