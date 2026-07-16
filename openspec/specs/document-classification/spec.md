# Document Classification Specification

> Capability: `document-classification` · Last updated: 2026-07-16 · Sources: `sistema-medios-desacoplado`, `ocr-gemini-integration`

## Purpose

Classify uploaded documents via DocumentoSidepanel: assign tipo, periodo, link to entities, and optional metadata. Transition from `por_clasificar` to `enlazado`. OCR extraction via Gemini pre-fills metadata fields (proveedor, NIT, fecha, monto) with human-in-the-loop review before save.

## Requirements

### Requirement: Sidepanel Preview

DocumentoSidepanel SHALL show a PDF preview using the shared `PdfViewer` component with an "Abrir en nueva pestaña" fallback link.

<!-- MODIFIED: 2026-07-14 (deuda-tecnica-pdf-transactions) -->
## Old
DocumentoSidepanel SHALL show an iframe preview of the document with an "Abrir en nueva pestaña" fallback link.

## New
DocumentoSidepanel SHALL show a PDF preview using the shared `PdfViewer` component with an "Abrir en nueva pestaña" fallback link.

#### Scenario: PDF preview renders

- GIVEN the user clicks a PDF document in the inbox
- WHEN DocumentoSidepanel opens
- THEN the top section renders a PDF preview via `<PdfViewer pageMode="single" />` (canvas, not iframe)
- AND a link "Abrir en nueva pestaña" opens the raw Storage URL

### Requirement: Classification Form — Required Fields

The form SHALL require `tipoDocumento` (one of 8) and `periodo` (YYYY-MM).

| Field | Type | Required | Options |
|-------|------|----------|---------|
| tipoDocumento | Radio / Chips | Yes | factura_venta, factura_compra, extracto_bancario, comprobante_egreso, comprobante_ingreso, planilla, contrato, otro |
| periodo | Text (YYYY-MM) | Yes | — |

#### Scenario: Missing required fields

- GIVEN the sidepanel is open for an unclassified document
- WHEN the user clicks "Guardar y Enlazar" without a `tipoDocumento`
- THEN validation shows: "Debe seleccionar un tipo de documento"
- AND no Firestore write occurs

### Requirement: Entity Linking via SearchableSelect

The system SHALL provide searchable selects for `terceroId` (required), `projectId` (optional), and `ejecucionIds` (optional, multi-select). Each SHALL fetch from its Firestore collection with debounced search (>3 chars).

| Select | Source Collection | Required | Cardinality |
|--------|-----------------|----------|-------------|
| Tercero | `/companies/{cId}/terceros` | Yes | 1 |
| Proyecto | `/companies/{cId}/presupuesto` | No | 1 |
| Ejecución(es) | `/companies/{cId}/ejecuciones` | No | Many (array) |

`ejecucionIds` is an array of strings (`string[]`) on the `DocumentoMedio` type, allowing a single document (e.g. an annual contract) to back multiple recurring ejecuciones without duplicating the file in Storage.

#### Scenario: Searchable tercero select

- GIVEN the user types "Carl" in the tercero field
- WHEN debounce fires
- THEN filtered results from `/terceros` (name prefix match) are shown
- AND the user selects one, populating `terceroId`

### Requirement: Manual Metadata (Optional)

The form MAY accept NIT, proveedor nombre, fecha documento (YYYY-MM-DD), and monto total (COP) — all saved in `DocumentoMedio.metadata`. OCR extraction MAY pre-fill these fields; manual entry always takes precedence over pre-fill.

#### Scenario: Metadata persisted

- GIVEN the user fills NIT "123456789", proveedor "Distribuidora ABC", fecha "2026-06-15", monto "1500000"
- WHEN the user clicks "Guardar y Enlazar"
- THEN `metadata` contains all four fields
- AND status transitions to `"enlazado"`

### Requirement: Guardar y Enlazar — Atomic Transition

`linkDocumentoToEntities()` SHALL set `status: "enlazado"` and populate entity IDs in a single Firestore write. When linking to ejecuciones, `ejecucionIds` is stored as an array — a single document MAY link to multiple ejecuciones (e.g. one contract backing 12 recurring months).

#### Scenario: Full classification succeeds

- GIVEN all required and optional fields are filled
- WHEN the user clicks "Guardar y Enlazar"
- THEN `status` is `"enlazado"`
- AND `tipoDocumento`, `periodo`, `terceroId`, `ejecucionIds`, `metadata` are persisted
- AND the inbox grid removes this document

#### Scenario: Single document linked to multiple recurring ejecuciones

- GIVEN an annual contract PDF and 12 monthly ejecuciones
- WHEN the user selects all 12 ejecuciones in the multi-select
- AND clicks "Guardar y Enlazar"
- THEN `ejecucionIds` contains 12 IDs
- AND `status` is `"enlazado"`
- AND the file exists ONCE in Storage (no duplication)

### Requirement: "Extraer con IA" Button

<!-- ADDED: 2026-07-16 (ocr-gemini-integration) -->

The DocumentoSidepanel MUST display an "Extraer con IA" button for documents with `status: "por_clasificar"`. On click, it SHALL call `POST /api/ocr/extract` with the document's `storagePath` and the user's Firebase auth token in the `Authorization` header.

#### Scenario: Button trigger shows loading state

- GIVEN DocumentoSidepanel abierto con un documento por clasificar
- WHEN el usuario hace click en "Extraer con IA"
- THEN se muestra un spinner de carga (Loader2) con texto "Extrayendo..."
- AND el botón se deshabilita mientras la request está en vuelo
- AND los demás campos del formulario permanecen interactivos

### Requirement: Non-Destructive Pre-fill

<!-- ADDED: 2026-07-16 (ocr-gemini-integration) -->

The client MUST NOT overwrite fields that the user has already filled manually. Only empty fields SHALL receive values from the OCR response.

#### Scenario: Partially filled form preserves manual entry

- GIVEN el formulario tiene `montoTotal: 150000` ingresado manualmente
- AND la respuesta IA es `{ montoTotal: 180000, proveedorTexto: "Proveedor S.A.S.", nit: null, fechaDocumento: null }`
- WHEN se aplica el pre-fill
- THEN `montoTotal` conserva el valor manual de 150000
- AND `proveedorTexto` se llena con "Proveedor S.A.S."

#### Scenario: All fields empty — full pre-fill

- GIVEN el formulario con todos los campos vacíos
- WHEN se aplica el pre-fill con datos completos de IA
- THEN todos los campos del formulario se llenan con los valores de la respuesta

### Requirement: Client Timeout — 30 Seconds

<!-- ADDED: 2026-07-16 (ocr-gemini-integration) -->

The client MUST use `AbortSignal.timeout(30000)` on the fetch call. If the API does not respond within 30 seconds, a user-facing error SHALL appear. The button SHALL return to idle state.

#### Scenario: API unresponsive for 30s

- GIVEN el usuario hace click en "Extraer con IA"
- WHEN la API no responde antes de 30 segundos
- THEN se muestra: "El servicio tardó demasiado. Intentá de nuevo."
- AND el botón retorna a estado idle

### Requirement: Error States — Specific Messages

<!-- ADDED: 2026-07-16 (ocr-gemini-integration) -->

The client SHALL map HTTP error codes to user-facing messages as follows:

| HTTP Code | User-Facing Message |
|-----------|---------------------|
| 401 | "Sesión expirada" |
| 413 | "El archivo excede el límite de 5MB" |
| 400 | "Formato no soportado. Usá PDF, PNG o JPG." |
| 429 | "Demasiadas solicitudes. Esperá un momento e intentá de nuevo." |

#### Scenario: 401 — Sesión expirada

- GIVEN el usuario hace click en "Extraer con IA"
- WHEN la API responde con `401 No autorizado`
- THEN se muestra: "Sesión expirada"
- AND el botón retorna a estado idle
- AND los campos del formulario NO se modifican

#### Scenario: 413 — Archivo demasiado grande

- GIVEN el usuario hace click en "Extraer con IA"
- WHEN la API responde con `413 Payload Too Large`
- THEN se muestra: "El archivo excede el límite de 5MB"
- AND el botón retorna a estado idle

#### Scenario: 400 — Formato no soportado

- GIVEN el usuario hace click en "Extraer con IA"
- WHEN la API responde con `400 Formato no soportado`
- THEN se muestra: "Formato no soportado. Usá PDF, PNG o JPG."
- AND el botón retorna a estado idle

#### Scenario: 429 — Demasiadas solicitudes

- GIVEN el usuario hace click en "Extraer con IA"
- WHEN la API responde con `429 Too Many Requests`
- THEN se muestra: "Demasiadas solicitudes. Esperá un momento e intentá de nuevo."
- AND el botón retorna a estado idle
- AND los campos del formulario NO se modifican

#### Scenario: Generic error (fallback)

- GIVEN el usuario hace click en "Extraer con IA"
- WHEN la API responde con un código 5xx no mapeado (502, 504, 500)
- THEN se muestra: "Error al extraer datos. Intentá de nuevo."
- AND el botón retorna a estado idle
- AND los campos del formulario NO se modifican
