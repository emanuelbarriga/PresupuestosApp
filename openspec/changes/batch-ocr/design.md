# Design: Batch OCR

## Technical Approach

Client-orchestrated batch extraction: InboxTab manages local selection state, calls the existing `/api/ocr/extract` per doc with a 3-parallel concurrency pool, and writes each result individually to Firestore on success. Progress tracked per-doc via `useReducer` — all inline, no sidepanel navigation needed. Each doc completes independently: extraction result → non-destructive merge → `updateDocumentoMedio()`.

Reuses the BulkEdit selection pattern (`Set<string>`, floating action bar) already established in Datos.tsx for terceros/presupuestos/ejecuciones.

## Architecture Decisions

### Decision 1: NavScreen not needed

| Option | Tradeoff |
|--------|----------|
| New `bulk-ocr` NavScreen + sidepanel | Adds routing overhead; results live in grid anyway |
| Inline in InboxTab | 0 new screens; follows upload progress pattern already in InboxTab |

**Choice**: Skip the NavScreen. The batch OCR progress renders as overlays on existing doc cards, matching the `UploadTask` progress pattern already in InboxTab. The grid auto-updates when individual writes hit Firestore.

### Decision 2: Reuse `/api/ocr/extract` vs new batch endpoint

| Option | Tradeoff |
|--------|----------|
| New `/api/ocr/batch-extract` route | Serverless timeout risk (60s App Hosting limit per request), duplicate code |
| Reuse existing `/api/ocr/extract` | Zero new API surface; per-doc progress trivial (each call is independent); timeout per doc is 30s, not aggregated |

**Choice**: Client-orchestrated, calling existing `/api/ocr/extract` per doc. The Gemini logic is extracted into `lib/ocr.ts` for shared reuse. No new route needed.

### Decision 3: Write strategy — individual per doc, not batch

| Option | Tradeoff |
|--------|----------|
| `batchUpdateDocumentos()` WriteBatch at end | Atomic, but race condition risk: user could edit docs mid-batch, final write uses stale data |
| Individual `updateDocumentoMedio()` per doc on success | No atomicity (acceptable — each doc is independent), eliminates race condition (writes happen immediately), tolerates page reload (completed docs survive) |

**Choice**: Individual writes per doc. Each successful extraction calls `updateDocumentoMedio()` immediately with non-destructive merge. The client fetches the current doc state from Firestore at write time to prevent race conditions. This is simpler, more robust, and eliminates the need for a complex `buildNonDestructiveUpdates` helper.

### Decision 4: Concurrency model

`chunkArray(docs, 3)` → process each chunk with `Promise.allSettled`. Simpler than a shared-pool pattern and avoids queue management. Per-item 30s `AbortController` timeout. Per-item 429 retry (already handled server-side in the route).

### Decision 5: Overlay priority over Firestore

The `useReducer` batch progress state has **absolute visual priority** while the batch is active. Cards render their batch overlay (spinner/check/warning) regardless of Firestore state. Only when the user taps "Limpiar" or dismisses the action bar are overlays removed and cards return to normal Firestore-backed rendering. This prevents flickering when `onSnapshot` updates arrive mid-batch.

### Decision 6: Cancel support

Each per-doc request uses an `AbortController` stored in a `useRef` map. A "Cancelar" button in the action bar calls `abort()` on all in-flight controllers. Aborted requests are marked as cancelled, not errors. Queued (pending) docs remain untouched.

## Data Flow

```
User checks docs → InboxTab.selectedIds = Set<string>  (max 30)
         ↓
Floating bar shows "Extraer con IA (N)"
         ↓ Click
useReducer sets per-doc status: 'pending' for all selected
         ↓
chunkArray(selectedDocs, 3)  ← max 3 concurrent
         ↓ per doc (processOneDoc):
  const controller = new AbortController()   ← stored for cancel
  setTimeout(() => controller.abort(), 30000) ← 30s timeout
  fetch('/api/ocr/extract', { storagePath, signal: controller.signal })
    → on success:
        fetch fresh doc from Firestore
        build non-destructive merge payload
        call updateDocumentoMedio()
        dispatch FINISH_DOC
    → on 429: retry with 1s backoff (x2 more)
    → on error: dispatch FAIL_DOC with friendly message
         ↓
All chunks complete → show toast summary
Action bar shows "Procesados: N/M" or "Reintentar (N)"
         ↓
"Cancelar" → abortController.abort() on in-flight requests
"Limpiar"  → clear overlay, reset useReducer, clear selection
```

## Overlay vs Firestore Priority Rule

```
render(doc):
  if batchOcrProgress[doc.id] exists:
    render progress overlay (ignoring Firestore state)
  else:
    render normal card from Firestore docs[]
```

The overlay persists until the user explicitly clears it via "Limpiar" or deselects individual cards. This prevents flickering when `onSnapshot` updates arrive.

## Component Changes

### InboxTab.tsx — Major changes

| What | How |
|------|-----|
| Selection state | `const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())` |
| Max selection | `if (selectedIds.size >= 30 && !checked) return` — disables checkboxes at limit |
| Checkbox per card | `<input type="checkbox">` inside each card, `e.stopPropagation()` on click |
| Disabled during processing | Checkbox disabled when `batchOcrProgress[id]?.status === 'processing'` |
| Select All | Header checkbox, toggles all visible up to 30 |
| Floating bar | Fixed bar at bottom when `selectedIds.size > 0`: count + "Extraer con IA (N)" + "Cancelar" + "Limpiar" |
| OCR progress | `useReducer` for `Record<string, BatchDocState>` |
| Status badges | Per-card overlay: spinner (`processing`), check (`done`), warning (`error`) |
| `handleBatchOcr` | Orchestrates: chunk → `processOneDoc` per doc → individual write per success |
| `processOneDoc` | `fetch('/api/ocr/extract')` → non-destructive merge → `updateDocumentoMedio()` → dispatch |
| Cancel | Stores `Map<string, AbortController>` in `useRef` |
| AbortController cleanup | Cleans up on unmount |

### New: `lib/ocr.ts` (extracted from route)

| Export | Purpose |
|--------|---------|
| `buildPrompt()` | Prompt construction |
| `extractFromGemini()` | Gemini call + retry + parse (pure logic, no route dependencies) |
| `validateFileForOcr()` | Extension + size validation |
| `OcrExtractResponse` | Shared type |
| `getFriendlyErrorMessage()` | Maps API errors to user-friendly messages |

The route becomes a thin handler that auths → validates → calls `extractFromGemini()` → responds.

### New: `lib/firestore.ts` — updateDocumentoMedio

```typescript
export async function updateDocumentoMedio(
  companyId: string,
  docId: string,
  data: Partial<DocumentoMedio>,
): Promise<void> {
  await updateDoc(
    doc(db, COMPANIES_COLLECTION, companyId, DOCUMENTOS_COLLECTION, docId),
    { ...data, updatedAt: serverTimestamp() },
  );
}
```

Folows the exact same pattern as `updateBudget`, `updateEjecucion`, `updateTercero`.

### AbortController handling

```typescript
const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

// On cancel:
abortControllersRef.current.forEach((c) => c.abort());
abortControllersRef.current.clear();

// On unmount: cleanup
useEffect(() => () => abortControllersRef.current.forEach((c) => c.abort()), []);
```

## Interfaces / Contracts

```typescript
// InboxTab internal state
type BatchDocStatus = 'pending' | 'processing' | 'done' | 'error' | 'cancelled';
type BatchOcrProgress = Record<string, {
  status: BatchDocStatus;
  error?: string;
}>;

// Non-destructive merge (inline in processOneDoc):
async function mergeOcrResultNonDestructive(
  companyId: string,
  docId: string,
  result: OcrExtractResponse
): Promise<void> {
  // 1. Fetch current doc from Firestore
  const docSnap = await getDoc(docRef);
  const current = docSnap.data() as DocumentoMedio;
  // 2. Build partial update: only empty fields
  const update: Record<string, unknown> = {};
  if (!current.tipoDocumento && result.tipoDocumentoSugerido)
    update.tipoDocumento = result.tipoDocumentoSugerido;
  if (!current.periodo && result.fechaDocumento)
    update.periodo = result.fechaDocumento.slice(0, 7); // "2026-07"
  // 3. Write
  await updateDocumentoMedio(companyId, docId, update);
}
```

## File Changes

| File | Action |
|------|--------|
| `components/media/InboxTab.tsx` | Modify — selection, progress, batch flow, overlays, cancel |
| `lib/ocr.ts` | Create — shared Gemini logic + error message mapping |
| `app/api/ocr/extract/route.ts` | Modify — thin wrapper around `lib/ocr.ts` |
| `lib/firestore.ts` | Modify — add `updateDocumentoMedio()` |
| `app/api/ocr/extract/__tests__/route.test.ts` | Modify — adjust for route refactor |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `lib/ocr.ts` extraction fn | Mock Gemini client, test prompt + retry + parse + error mapping |
| Unit | `updateDocumentoMedio()` | Mock updateDoc, verify correct path and payload |
| Unit | non-destructive merge logic | Pure function test: given doc + result, verify only empty fields included |
| Component | InboxTab selection | `render` + `fireEvent.click` on checkboxes, verify selectedIds, max 30 limit |
| Component | InboxTab batch flow | Mock fetch, select 3 docs → verify 3 calls → verify per-doc progress transitions |
| Component | Cancel | Mock fetch with delay, click "Cancelar", verify AbortController.abort() |
| Component | Overlay priority | Verify overlay shown while batch active regardless of prop changes |
| Integration | Full flow | Select 3 docs → process → verify `updateDocumentoMedio` called per success |

## Migration / Rollback

No migration required. Feature is additive: new checkboxes, no data changes. Rollback: remove selection state + batch button from InboxTab, revert firestore.ts, delete `lib/ocr.ts`.
