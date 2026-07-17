# Batch OCR Specification

> Capability: `batch-ocr` · Created: 2026-07-16 · Source: `batch-ocr`

## Purpose

Batch OCR enables multi-document AI extraction from the Inbox. Users select multiple documents via checkboxes, trigger parallel extraction with a single action, and monitor per-doc progress independently. Results pre-fill non-destructively via the DocumentoSidepanel, reusing the single-doc extraction pipeline.

## Requirements

### Constraint: Maximum Selection

The batch OCR SHALL limit selection to a maximum of 30 documents. When 30 are selected, additional checkboxes SHALL be disabled. The counter SHALL read "30/30 máximo" at the limit.

#### Scenario: Selection stops at 30

- GIVEN 50 visible documents in the Inbox
- WHEN the user selects 30 via individual checkboxes
- THEN remaining checkboxes are disabled
- AND the counter reads "30/30 máximo"
- AND "Extraer con IA (30)" is actionable

#### Scenario: Deselecting one re-enables checkboxes

- GIVEN 30 documents selected (limit reached)
- WHEN the user deselects one document
- THEN checkboxes re-enable
- AND the counter reads "29 seleccionados"

### Requirement: Multi-Selection in InboxTab

The InboxTab SHALL render a checkbox on each document card. A "Select All" toggle in the grid header SHALL select or deselect all currently visible cards (up to the max limit). A selection counter SHALL display the number of selected documents.

#### Scenario: Toggle checkbox selects one document

- GIVEN the Inbox displays 10 document cards, none selected
- WHEN the user taps the checkbox on card #3
- THEN card #3 is visually checked
- AND the selection counter reads "1 seleccionado"

#### Scenario: Select All selects then deselects all visible

- GIVEN the Inbox shows 10 document cards, none selected
- WHEN the user taps "Select All"
- THEN all 10 cards are checked
- AND the counter reads "10 seleccionados"
- WHEN the user taps "Select All" again
- THEN all cards are unchecked
- AND the counter disappears

### Requirement: Floating Action Bar — Batch OCR Trigger

The system SHALL display a floating action bar at the bottom of the Inbox when at least one document is selected. The bar SHALL contain an "Extraer con IA (N)" primary button where N is the selection count. Deselecting all documents SHALL hide the bar.

#### Scenario: Action bar shows and hides with selection

- GIVEN no documents selected
- WHEN the user selects 3 documents
- THEN a floating bar appears at the bottom with "Extraer con IA (3)"
- WHEN the user deselects all documents
- THEN the bar disappears

#### Scenario: Zero selection hides bar on batch completion

- GIVEN the user completes a batch OCR of 5 documents
- WHEN all documents are processed and the user clears selection
- THEN the action bar is no longer visible

### Requirement: Client-Orchestrated Parallel Extraction

The system SHALL iterate the selected documents and send each storagePath to `POST /api/ocr/extract` (existing single-doc endpoint) as individual requests with a concurrency cap of 3 parallel requests. Remaining documents SHALL queue and advance as each pending request completes. Per-document state SHALL be tracked in a `useReducer` with states: `pending` → `processing` → `done` | `error`. No new batch endpoint SHALL be created — the client orchestrates per-doc calls to the existing route.

#### Scenario: 10 documents processed in waves of 3

- GIVEN 10 documents selected
- WHEN "Extraer con IA (10)" is tapped
- THEN 3 requests start immediately (state: `processing`)
- AND 7 documents remain queued (state: `pending`)
- WHEN one processing request completes (`done`)
- THEN the next queued document transitions to `processing`
- AND this continues until all 10 have resolved

#### Scenario: Concurrency never exceeds 3

- GIVEN 20 documents selected for batch OCR
- WHEN extraction starts
- THEN at any point in time, no more than 3 requests are in-flight
- AND the remaining documents wait in the queue (state: `pending`)

#### Scenario: Cancel button aborts in-flight requests

- GIVEN 10 documents processing in waves of 3
- WHEN the user taps "Cancelar"
- THEN all in-flight requests are aborted via AbortController
- AND queued documents remain at `pending`
- AND processed documents keep their `done` or `error` state
- AND the action bar shows "Cancelado" state

### Requirement: Per-Document Progress Overlay

The system SHALL overlay each document card with a status indicator: a spinner for `processing`, a check mark for `done`, a warning icon for `error`. An overall counter SHALL read "N/M procesados" (e.g., "7/10 procesados").

#### Scenario: Mixed results shown per card

- GIVEN 5 documents processed (4 done, 1 error)
- WHEN the batch completes
- THEN each card shows its final icon (check or warning)
- AND the counter reads "5/5 procesados"

#### Scenario: Overlay has visual priority over Firestore state

- GIVEN a document that was processed by batch OCR (written to Firestore)
- WHEN the batch is not yet cleared (no "Limpiar" pressed)
- THEN the card shows the batch overlay (check/warning) instead of the normal Firestore card
- WHEN the user taps "Limpiar" or closes the action bar
- THEN the overlay is removed and the card renders the normal Firestore state

### Requirement: 30s Timeout Per Document

Each extraction request SHALL have a 30-second timeout via AbortController. If a document times out, it SHALL be marked as `error` with the message "Tiempo de espera agotado". A timeout on one document SHALL NOT cancel or affect other documents.

#### Scenario: Single doc times out, others complete

- GIVEN 3 concurrent requests
- WHEN one request exceeds 30 seconds without response
- THEN that doc shows timeout error
- AND the other 2 requests continue normally

### Requirement: Exponential Backoff on 429

When a request receives HTTP 429 (rate limited), the system SHALL retry with exponential backoff: 1s, 2s, 4s (3 attempts total). If all 3 attempts receive 429, the document SHALL be marked as `error` with "Demasiadas solicitudes. Intentá de nuevo."

#### Scenario: 429 on first attempt, retry succeeds

- GIVEN a document extraction request
- WHEN the first attempt returns 429
- AND the retry after 1s succeeds
- THEN the document state resolves to `done` with extracted data

#### Scenario: 429 on all 3 attempts

- GIVEN a document extraction request
- WHEN all 3 attempts (1s, 2s, 4s backoff) return 429
- THEN the document state resolves to `error`
- AND the error message indicates rate limiting

### Requirement: Individual Write on Doc Completion

When a single document extraction succeeds, the system SHALL immediately write the extracted fields to Firestore using `updateDocumentoMedio(companyId, docId, updates)`. The update SHALL be non-destructive: only fields that are currently empty or null on the document SHALL be populated. The system SHALL fetch the current document state from Firestore at write time to prevent race conditions with manual edits in DocumentoSidepanel.

#### Scenario: Successful extraction writes immediately

- GIVEN a batch OCR processing 5 documents
- WHEN document #2 completes extraction successfully
- THEN `updateDocumentoMedio` is called immediately for doc #2
- AND the remaining 4 docs continue processing independently

#### Scenario: Non-destructive merge uses fresh Firestore data

- GIVEN a document with `{ tipoDocumento: "factura_compra" }` already saved
- WHEN the OCR extraction returns `{ tipoDocumentoSugerido: "factura_venta", proveedorTexto: "Proveedor S.A.S." }`
- THEN `updateDocumentoMedio` only writes `proveedorTexto` (non-destructive)
- AND `tipoDocumento` is NOT overwritten

#### Scenario: Race condition prevented by fresh read

- GIVEN a document that was empty at batch start
- WHEN the user manually edits fields via DocumentoSidepanel during batch processing
- AND those edits are saved to Firestore before the OCR result writes
- THEN the OCR write reads the current doc state, sees the user's edits, and does NOT overwrite them

### Requirement: Individual Doc Error Handling with Retry

Failed extractions (network error, 429 exhaustion, server error, timeout) SHALL be scoped to the individual document. The user SHALL be able to retry failed documents after the batch completes. A "Reintentar (N)" button SHALL appear in the floating bar when one or more documents have errors. The user SHALL also be able to deselect individual failed documents, removing them from the retry queue.

#### Scenario: Retry only failed documents

- GIVEN a batch of 10 documents with 3 errors
- WHEN the user taps "Reintentar (3)"
- THEN only the 3 failed documents re-enter the queue
- AND the 7 successful documents are NOT re-processed

#### Scenario: Deselect failed doc removes from retry

- GIVEN a batch with 3 errors and 7 successes
- WHEN the user unchecks one failed document
- AND taps "Reintentar (2)"
- THEN only the 2 remaining failed docs are retried
- AND the unchecked doc's error overlay is cleared

#### Scenario: Retry with zero errors hidden

- GIVEN a batch where all 5 documents succeed
- WHEN extraction completes
- THEN the floating bar reads "Procesados: 5/5"
- AND no retry action is offered

### Requirement: Checkbox Behavior During Batch Lifecycle

While a document is in `processing` state, its checkbox SHALL be disabled to prevent double-clicks. Cards in `done` or `error` state SHALL have their checkbox re-enabled. Unchecking a `done` document clears its overlay and restores its normal card rendering. Unchecking an `error` document removes it from the retry queue.

#### Scenario: Processing documents have disabled controls

- GIVEN 5 documents in `processing` state
- WHEN the user attempts to click the checkbox or card
- THEN no action occurs (disabled)
- AND the card shows a non-interactive state

#### Scenario: Done document can be unchecked to clear overlay

- GIVEN a document showing green check overlay
- WHEN the user unchecks it
- THEN the overlay is removed
- AND the card renders the normal Firestore-backed state

### Requirement: Error Message Mapping

Error responses from the API SHALL be mapped to user-friendly messages displayed in the per-doc overlay tooltip:

| API Error | User-Friendly Message |
|-----------|----------------------|
| `Formato no soportado` | "Formato no soportado. Usá PDF, PNG o JPG." |
| `El archivo excede el límite de 5MB` | "El archivo es muy pesado (máx 5MB)" |
| HTTP 429 (rate limit) | "Demasiadas solicitudes. Esperá unos segundos y reintentá." |
| HTTP 502 (Gemini error) | "No se pudo leer el documento. Puede estar borroso o ilegible." |
| 30s timeout (AbortController) | "Tiempo de espera agotado. El documento es muy grande o complejo." |
| Network error (fetch failed) | "Error de conexión. Verificá tu internet y reintentá." |
| Unknown/server error | "Error al procesar el documento. Reintentá más tarde." |

#### Scenario: Friendly message shown in error tooltip

- GIVEN a document extraction fails with HTTP 502
- THEN the error overlay shows a warning icon
- AND the tooltip reads "No se pudo leer el documento. Puede estar borroso o ilegible."

### Requirement: updateDocumentoMedio in firestore.ts

The system SHALL provide a `updateDocumentoMedio(companyId: string, docId: string, data: Partial<DocumentoMedio>): Promise<void>` function following the existing pattern from `updateBudget`, `updateEjecucion`, and `updateTercero`. It SHALL use `updateDoc` with `serverTimestamp()` for `updatedAt` and `_extractedAt`.

#### Scenario: Single document updated in Firestore

- GIVEN a document ID and extracted fields `{ tipoDocumento, periodo, metadata }`
- WHEN `updateDocumentoMedio` is called
- THEN `updateDoc` is called on the correct document path
- AND `updatedAt` and `_extractedAt` are set to `serverTimestamp()`

## Environment

No new environment variables. Reuses `GEMINI_API_KEY` and Firebase Admin SDK from the existing ocr-extraction capability.

## Dependencies

- `@google/genai` — server-side Gemini SDK (existing)
- `firebase-admin/storage` — storage downloads (existing)
- `firebase/firestore` — `WriteBatch` for batch updates (existing)
