# Delta for ejecucion-form

> Change: `sistema-medios-desacoplado` · Capability: `ejecucion-form` · Date: 2026-07-14
> Source spec: `openspec/specs/comprobantes-ejecucion/spec.md`

## MODIFIED Requirements

### Requirement: Derived State from Comprobantes

The system SHALL store a denormalized `_estadoComprobantes` field on `Ejecucion` to avoid N+1 queries. This field SHALL be updated atomically whenever documents are linked or unlinked, using the same pure function `derivarEstadoComprobantes(documentos: DocumentoMedio[], tiposComprobanteSettings)`.

The field values match the existing state table:

| Field | Values |
|-------|--------|
| `_estadoComprobantes` | `"Completada"` \| `"Falta un comprobante"` \| `"Sin comprobantes"` \| `""` |

The dashboard SHALL read `_estadoComprobantes` directly from the `Ejecucion` document — no queries to `/documentos` collection for list views. The `derivarEstadoComprobantes()` function is called only on the write path (when linking/unlinking documents) and the result is persisted via `updateDoc`.

(Previously: function read from embedded `Ejecucion.comprobantes` array at read time)

| State | Condition | Granularity |
|-------|-----------|-------------|
| `Completada` | Both required types present | N/A |
| `Falta un comprobante` | Exactly 1 of 2 required types present | `"falta_pago"` or `"falta_cuenta_cobro"` |
| `Sin comprobantes` | 0 of 2 required types present | N/A |

(Previously: function read from embedded `Ejecucion.comprobantes` array)

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

## ADDED Requirements

### Requirement: Delete Ejecucion — Document Lifecycle

Deleting an ejecucion SHALL NOT cascade-delete its linked `DocumentoMedio` records. Instead, it SHALL set `ejecucionId` to `null` and revert `status` to `"por_clasificar"`. Physical Storage files are NOT deleted. The firestore rules carve-out allows this specific transition: `enlazado → por_clasificar` is permitted ONLY when `ejecucionId` is set to `null` in the same write.

#### Scenario: Ejecucion deleted, documents revert via rules carve-out

- GIVEN an ejecucion with 3 linked DocumentoMedio records (`status: "enlazado"`, `ejecucionId: "ej-123"`)
- WHEN `deleteEjecucion()` is called and the client executes `updateDoc(docRef, { status: "por_clasificar", ejecucionId: null })`
- THEN the firestore rules allow the write (status transition + ejecucionId cleared)
- AND each DocumentoMedio has `ejecucionId: null` and `status: "por_clasificar"`
- AND Storage files still exist at their original paths
