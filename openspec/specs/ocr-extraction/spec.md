# OCR Extraction Specification

> Capability: `ocr-extraction` · Created: 2026-07-16 · Source: `ocr-gemini-integration`

## Purpose

Server-side OCR extraction via Gemini 2.5 Flash (Paid Tier). The `POST /api/ocr/extract` route fetches a document from Firebase Storage, validates size and format, sends raw bytes to Gemini with `responseJsonSchema`, and returns structured data `{ proveedorTexto, nit, fechaDocumento, montoTotal }` — **no Firestore writes**. This is a pure extraction endpoint: the client decides whether to pre-fill and when to save.

## Requirements

### Requirement: Authentication — Header Only, No Body Token

The route MUST authenticate via `Authorization: Bearer <token>` header using `adminAuth.verifyIdToken()`. Auth tokens in the request body MUST be rejected — the body SHALL contain only `{ storagePath: string }`.

#### Scenario: Missing Authorization header

- GIVEN una request sin `Authorization` header
- WHEN el route handler verifica autenticación
- THEN responde `401` con `{ error: "No autorizado" }`

#### Scenario: Invalid or expired token

- GIVEN una request con token inválido o expirado en el header
- WHEN `adminAuth.verifyIdToken(token)` rechaza
- THEN responde `401` con `{ error: "No autorizado" }`

#### Scenario: Token in body is rejected

- GIVEN una request con body `{ storagePath: "/path/doc.pdf", authToken: "abc123" }`
- WHEN el route handler procesa autenticación
- THEN responde `401` — solo el header `Authorization` es válido

### Requirement: File Size Validation — 5MB Guard

The route MUST reject files whose decoded `buffer.length` exceeds 5,242,880 bytes (5 MB) BEFORE sending to Gemini, returning `413 Payload Too Large`.

#### Scenario: File exceeds 5MB

- GIVEN un archivo simulado de 5.1 MB descargado de Storage
- WHEN `buffer.length` se evalúa contra el límite
- THEN responde `413` con `{ error: "Payload Too Large" }`

### Requirement: Extension-to-MIME Mapping

The route SHALL infer MIME type from the file extension (NOT from Storage metadata). The extension MUST be extracted and compared in lowercase using `path.extname(storagePath).toLowerCase()` to handle mixed-case uploads (`.PDF`, `.Jpeg`). The explicit mapping is:

| Extension | MIME Type |
|-----------|-----------|
| `.pdf` | `application/pdf` |
| `.png` | `image/png` |
| `.jpg` / `.jpeg` | `image/jpeg` |

#### Scenario: Unsupported extension rejected

- GIVEN un archivo con extensión `.docx` o `.heic`
- WHEN se valida la extensión contra la tabla de MIME
- THEN responde `400` con `{ error: "Formato no soportado. Usá PDF, PNG o JPG." }`

#### Scenario: Supported extension maps correctly

- GIVEN un archivo `factura.pdf`
- WHEN se mapea la extensión a MIME
- THEN el MIME resultante es `application/pdf`

#### Scenario: Case-insensitive extension matching

- GIVEN un archivo `FACTURA.PDF` o `recibo.Jpeg`
- WHEN se extrae la extensión con `path.extname(storagePath).toLowerCase()`
- THEN el MIME resultante es `application/pdf` o `image/jpeg` respectivamente (sin error 400)

### Requirement: 429 Retry — Single Retry at 1s

The route MUST retry **once** after a 1-second delay when Gemini responds with HTTP 429 (rate limit). Non-429 errors SHALL propagate immediately.

#### Scenario: First 429, retry succeeds

- GIVEN el primer llamado a Gemini responde con 429
- WHEN se reintenta tras 1 segundo
- THEN el retorno es exitoso si el segundo intento es OK

#### Scenario: Both attempts 429

- GIVEN el primer llamado responde 429
- WHEN el reintento también falla con 429
- THEN responde `429` con `{ error: "Demasiadas solicitudes. Intentá de nuevo." }` — el código 429 se propaga al cliente para que sepa que es saturación temporal, no un fallo interno

#### Scenario: Non-429 error is not retried

- GIVEN el primer llamado a Gemini responde con error 500 (no 429)
- WHEN se evalúa el código de error
- THEN el error se propaga inmediatamente SIN reintento

### Requirement: Structured Response — Campos Nullables

The response MUST adhere to this JSON schema, where any field MAY be `null`:

```json
{
  "proveedorTexto": "string | null",
  "nit": "string | null",
  "fechaDocumento": "string | null",
  "montoTotal": "number | null"
}
```

#### Scenario: Legible invoice — all fields populated

- GIVEN una factura legible con todos los datos visibles
- WHEN Gemini extrae y devuelve datos estructurados
- THEN `proveedorTexto`, `nit`, `fechaDocumento` y `montoTotal` están poblados con valores no-null

#### Scenario: Illegible document — all fields null

- GIVEN un documento ilegible o sin datos relevantes
- WHEN Gemini no puede extraer ningún campo
- THEN los cuatro campos retornan como `null`

### Requirement: No Firestore Writes

The API route MUST NOT write to Firestore under any circumstance. It is a pure extraction proxy: read from Storage → send to Gemini → return JSON. The client (DocumentoSidepanel) decides when to persist.

#### Scenario: Extraction does not persist

- GIVEN una extracción exitosa con datos poblados
- WHEN el route handler termina de procesar
- THEN no se ejecuta ninguna operación de escritura en Firestore
- AND la respuesta JSON se retorna al cliente sin efectos secundarios

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes | Google AI API key for Gemini 2.5 Flash |
| Firebase SA | Yes | Existing Admin SDK credentials |

## Dependencies

- `@google/genai` — server-side Gemini SDK
- `firebase-admin/storage` — `getStorage()` / `getAdminStorage()`
