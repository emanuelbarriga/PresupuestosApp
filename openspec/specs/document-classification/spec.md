# Document Classification Specification

> Capability: `document-classification` · Date: 2026-07-14

## Purpose

Classify uploaded documents via DocumentoSidepanel: assign tipo, periodo, link to entities, and optional metadata. Transition from `por_clasificar` to `enlazado`.

## Requirements

### Requirement: Sidepanel Preview

DocumentoSidepanel SHALL show an iframe preview of the document with an "Abrir en nueva pestaña" fallback link.

#### Scenario: PDF preview renders

- GIVEN the user clicks a PDF document in the inbox
- WHEN DocumentoSidepanel opens
- THEN the top section renders a PDF preview in an iframe
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

The form MAY accept NIT, proveedor nombre, fecha documento (YYYY-MM-DD), and monto total (COP) — all saved in `DocumentoMedio.metadata`.

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

### Requirement: OCR Stub

The form SHALL display a disabled OCR placeholder for Phase 3. No OCR logic runs in MVP.

#### Scenario: OCR placeholder visible

- GIVEN DocumentoSidepanel is open
- WHEN the form renders
- THEN a banner reads: "OCR disponible en futura versión"
