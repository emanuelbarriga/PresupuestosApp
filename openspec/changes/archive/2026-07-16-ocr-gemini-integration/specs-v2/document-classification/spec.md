# Document Classification Specification — V2 (Client-Side)

> Capability: `document-classification` · Change: `ocr-gemini-integration` · Version: 2 · Date: 2026-07-16

## Purpose

Client-side integration of OCR extraction in the DocumentoSidepanel. Replaces the disabled OCR stub with a functional "Extraer con IA" button that calls `POST /api/ocr/extract`, handles loading/timeout/error states, and pre-fills metadata fields without overwriting manual input.

## Requirements

### Requirement: "Extraer con IA" Button

The DocumentoSidepanel MUST display an "Extraer con IA" button for documents with `status: "por_clasificar"`. On click, it SHALL call `POST /api/ocr/extract` with the document's `storagePath` and the user's Firebase auth token in the `Authorization` header.

#### Scenario: Button trigger shows loading state

- GIVEN DocumentoSidepanel abierto con un documento por clasificar
- WHEN el usuario hace click en "Extraer con IA"
- THEN se muestra un spinner de carga (Loader2) con texto "Extrayendo..."
- AND el botón se deshabilita mientras la request está en vuelo
- AND los demás campos del formulario permanecen interactivos

### Requirement: Non-Destructive Pre-fill

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

The client MUST use `AbortSignal.timeout(30000)` on the fetch call. If the API does not respond within 30 seconds, a user-facing error SHALL appear. The button SHALL return to idle state.

#### Scenario: API unresponsive for 30s

- GIVEN el usuario hace click en "Extraer con IA"
- WHEN la API no responde antes de 30 segundos
- THEN se muestra: "El servicio tardó demasiado. Intentá de nuevo."
- AND el botón retorna a estado idle

### Requirement: Error States — Specific Messages

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
