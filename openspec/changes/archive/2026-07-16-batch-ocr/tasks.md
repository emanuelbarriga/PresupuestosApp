# Tasks: Batch OCR

## Resolved Design Conflicts

After review and user feedback, all decisions are settled:

| Decision | Resolution |
|----------|-----------|
| Batch endpoint vs client-orchestrated | **Client-orchestrated** — reuse existing `POST /api/ocr/extract` per doc, 3-parallel |
| WriteBatch vs individual writes | **Individual writes** — `updateDocumentoMedio()` per doc on success, no final batch |
| NavScreen bulk-ocr | **Skip** — progress inline in grid, overlay has priority over Firestore |
| Cancel support | **Yes** — AbortController per request, "Cancelar" button in action bar |
| Max selection | **30 documents** — checkboxes disabled at limit |
| Non-destructive merge | **Fresh read from Firestore** at write time to prevent race conditions |
| Overlay priority | **useReducer state dominates** while batch active; cleared only on "Limpiar" |
| Error messages | **Mapped to friendly messages** — see spec for full mapping table |

---

## Task Breakdown

| # | Task | Files | Effort | Deps | Status |
|---|------|-------|--------|------|--------|
| 1 | Create `lib/ocr.ts` | `lib/ocr.ts` (new), `app/api/ocr/extract/route.ts` (refactor) | L | - | ✅ (PR 1) |
| 2 | Add `updateDocumentoMedio()` to firestore.ts | `lib/firestore.ts` (mod) | S | - | ✅ (PR 1) |
| 3 | Add multi-selection state + checkboxes to InboxTab | `components/media/InboxTab.tsx` (mod) | M | - | ✅ |
| 4 | Add floating action bar + cancel + progress | `components/media/InboxTab.tsx` (mod) | M | 3 | ✅ |
| 5 | Add batch OCR orchestration + per-doc writes + overlays | `components/media/InboxTab.tsx` (mod) | L | 1,2,4 | ✅ |
| 6 | Add retry-failed + dismiss-failed flow | `components/media/InboxTab.tsx` (mod) | S | 5 | ✅ |
| 7 | Tests | `lib/__tests__/ocr.test.ts`, `lib/__tests__/firestore.test.ts`, `components/media/__tests__/InboxTab.test.tsx` | L | 1-6 | ✅ |

---

### Task 1: Create `lib/ocr.ts` — shared Gemini module

**Description**: Extract all Gemini logic from route.ts into a new `lib/ocr.ts`. The route becomes a thin handler.

**Implementation details**:
- Move these as named exports: `buildPrompt()`, `callGeminiWithRetry` → `extractFromGemini()`, `getMimeFromExtension()`, `validateFileForOcr()`, `sleep()`, `isGoogleApiError()`
- Export `OcrExtractResponse` type and `OCR_JSON_SCHEMA`
- Add `getFriendlyErrorMessage(status: number, errorBody?: string): string` that maps API errors to user-friendly messages per the spec table
- Route keeps: auth → parse body → validateFileForOcr → download → size guard → extractFromGemini → respond
- Route imports from `@/lib/ocr`

**Tests**:
- `lib/__tests__/ocr.test.ts` (new): test `buildPrompt()` with/without context, `validateFileForOcr()` with valid/invalid extensions
- `app/api/ocr/extract/__tests__/route.test.ts` (mod): update mocks to point at new module, all existing tests pass

**Acceptance criteria**:
- All existing route tests pass unchanged
- `lib/ocr.ts` exports all shared functions
- `getFriendlyErrorMessage` returns correct messages for each error type

---

### Task 2: Add `updateDocumentoMedio()` to firestore.ts

**Description**: Single-doc update following existing patterns (`updateBudget`, `updateEjecucion`, `updateTercero`).

**Implementation details**:
```typescript
export async function updateDocumentoMedio(
  companyId: string,
  docId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await updateDoc(
    doc(db, COMPANIES_COLLECTION, companyId, 'documentos', docId),
    { ...data, updatedAt: serverTimestamp() },
  );
}
```

**Tests**:
- `lib/__tests__/firestore.test.ts` (mod): mock `updateDoc`, verify correct path + payload

---

### Task 3: Add multi-selection state + checkboxes to InboxTab

**Description**: Add `selectedIds: Set<string>` state, checkbox per card, Select All toggle, max 30 limit.

**Implementation details**:
- `const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())`
- Checkbox: `<input type="checkbox">` inside each card button
  - `e.stopPropagation()` to prevent card navigation
  - Disabled when `batchOcrProgress[doc.id]?.status === 'processing'`
  - Disabled when `selectedIds.size >= 30 AND doc not already selected`
- `toggleSelection(id)`: set `new Set(prev)` and add/delete
- Select All: header checkbox, selects up to 30
- Selection counter: "N seleccionado(s)" (or "30/30 máximo" at limit)
- Card click behavior:
  - If `batchOcrProgress[doc.id]?.status === 'processing'`: disabled, no navigation
  - If `batchOcrProgress[doc.id]?.status === 'error'`: disabled (retry from bar)
  - If `batchOcrProgress[doc.id]?.status === 'done'`: card navigates to DocumentoSidepanel normally
  - Otherwise: normal navigation

**Tests**:
- Component test: click checkbox → selectedIds updates
- Component test: second click → deselect
- Component test: Select All toggles all (up to 30)
- Component test: at 30, additional checkboxes disabled

---

### Task 4: Add floating action bar + cancel + progress counter

**Description**: Fixed bar at bottom when `selectedIds.size > 0` with buttons and progress.

**Implementation details**:
- `const [batchActive, setBatchActive] = useState(false)` (or derive from batchOcrProgress)
- Bar renders conditionally when `selectedIds.size > 0 OR batchActive`
- States:
  - **Idle**: "Extraer con IA (N)" + "Limpiar"
  - **Processing**: "N/M procesados" + "Cancelar" (primary/secondary styled)
  - **Done (all ok)**: "Procesados: N/M" + "Limpiar" (success state)
  - **Done (with errors)**: "Procesados: N/M — N errores" + "Reintentar (N)" + "Limpiar"
  - **Cancelled**: "Cancelado — M procesados" + "Limpiar"
- Cancel button calls `abortControllersRef.current.forEach(c => c.abort())`
- Style: fixed bottom bar, white bg, border-top, shadow

**Tests**:
- 0 selected → bar not rendered
- 3 selected → bar shows "Extraer con IA (3)"
- "Limpiar" clears selection + hides bar
- Processing state shows progress counter + Cancel button
- Click Cancel → in-flight requests aborted

---

### Task 5: Batch OCR orchestration + per-doc writes + overlays

**Description**: Implement `handleBatchOcr` with chunked processing, per-doc writes, overlay rendering with priority.

**Implementation details**:

**State** (new `useReducer`):
```typescript
type BatchDocStatus = 'pending' | 'processing' | 'done' | 'error' | 'cancelled';
type BatchOcrProgress = Record<string, { status: BatchDocStatus; error?: string }>;
```
Actions: `START_BATCH`, `START_DOC`, `FINISH_DOC`, `FAIL_DOC`, `CANCEL_BATCH`, `CLEAR_PROGRESS`, `DISMISS_DOC`

**AbortController ref**:
```typescript
const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

// Cleanup on unmount
useEffect(() => () => abortControllersRef.current.forEach(c => c.abort()), []);
```

**`processOneDoc(doc, companyId)`**:
1. Create `AbortController`, store in `abortControllersRef`
2. `setTimeout(() => controller.abort(), 30000)`
3. `fetch('/api/ocr/extract', { method: 'POST', headers: { Authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ storagePath: doc.storagePath }), signal: controller.signal })`
4. On success (200):
   a. Parse response JSON
   b. Fetch current doc from Firestore (`getDoc`)
   c. Build non-destructive update: only set fields that are currently null/empty
      - `tipoDocumento` from `tipoDocumentoSugerido` if doc's is empty
      - `periodo` from `fechaDocumento.slice(0, 7)` if doc's is empty
      - `metadata.descripcion` from `descripcion` if doc's is empty
      - `metadata._extractedAt` always set
   d. If any fields to update: `updateDocumentoMedio(companyId, doc.id, update)`
   e. Dispatch `FINISH_DOC`
5. On 429: retry with 1s sleep (max 3 attempts total including first), then error
6. On abort: dispatch `CANCEL_BATCH` (error message: "Cancelado")
7. On error: dispatch `FAIL_DOC` with mapped friendly message

**`handleBatchOcr`**:
1. Validate selected docs ≤ 30
2. Dispatch `START_BATCH` with all doc IDs → status: `pending`
3. `chunkArray(selectedDocs, 3)` 
4. For each chunk: `await Promise.allSettled(chunk.map(doc => processOneDoc(doc, companyId)))`
5. After all chunks: update action bar state (done/errors)

**Overlay rendering** (card priority rule):
```tsx
// Inside the card map:
const progress = batchOcrProgress[doc.id];
const showOverlay = progress && !batchCleared;

// Card class logic:
const cardDisabled = progress?.status === 'processing' || progress?.status === 'error';
const cardClasses = `... ${cardDisabled ? 'opacity-60 pointer-events-none' : ''} ...`;

// Overlay inside card:
{showOverlay && (
  <div className="absolute inset-0 ...">
    {progress.status === 'processing' && <Loader2 className="animate-spin" />}
    {progress.status === 'done' && <CheckCircle className="text-emerald-500" />}
    {progress.status === 'error' && <AlertCircle className="text-red-500" title={progress.error} />}
  </div>
)}
```

**Non-destructive merge helper** (inline, not a separate file):
```typescript
async function mergeOcrResultNonDestructive(
  companyId: string, docId: string, result: OcrExtractResponse
): Promise<void> {
  const snap = await getDoc(doc(db, COMPANIES_COLLECTION, companyId, 'documentos', docId));
  if (!snap.exists()) return;
  const current = snap.data();
  const update: Record<string, unknown> = {};
  if (!current.tipoDocumento && result.tipoDocumentoSugerido)
    update.tipoDocumento = result.tipoDocumentoSugerido;
  if (!current.periodo && result.fechaDocumento)
    update.periodo = result.fechaDocumento.slice(0, 7);
  if (!current.metadata?.descripcion && result.descripcion)
    update['metadata.descripcion'] = result.descripcion;
  update['metadata._extractedAt'] = serverTimestamp();
  if (Object.keys(update).length > 1) // more than just _extractedAt
    await updateDocumentoMedio(companyId, docId, update);
}
```

**Tests**:
- Component test: 3 docs → verify 3 fetch calls → verify per-doc state transitions
- Component test: 10 docs → verify max 3 concurrent
- Component test: one fetch error → that doc shows error, others complete
- Component test: verify `updateDocumentoMedio` called per successful doc
- Component test: verify progress counter updates
- Component test: overlay shown while batch active, regardless of Firestore prop changes
- Component test: overlay cleared on "Limpiar"
- Component test: non-destructive merge — only empty fields written (unit test)

---

### Task 6: Retry-failed + dismiss-failed flow

**Description**: After batch completes with errors, "Reintentar (N)" re-queues only failed docs. User can deselect individual failed docs to exclude them.

**Implementation details**:
- After batch completes, if `errors.length > 0`:
  - Action bar shows "Reintentar (N)" button
  - If all succeeded: "Procesados: N/N" with check icon
- `handleRetry`: filters `batchOcrProgress` to `error` docs, resets them to `pending`, re-runs orchestration
- Deselecting a failed doc: dispatch `DISMISS_DOC(id)` — removes from progress, card returns to normal
- After retry: each success calls `updateDocumentoMedio` individually (same as initial run)
- After retry with remaining errors: keep "Reintentar (N)" with remaining count

**Tests**:
- 3 errors, 7 done → "Reintentar (3)" visible
- Click "Reintentar (3)" → only 3 docs process
- Deselect a failed doc → retry count drops
- All done → "Procesados: N/N"

---

### Task 7: Tests

**Description**: Write and update all tests for the new functionality.

| File | What | Scenarios |
|------|------|-----------|
| `lib/__tests__/ocr.test.ts` (new) | `buildPrompt`, `validateFileForOcr`, `getFriendlyErrorMessage` | Valid/invalid extensions, prompt with/without context, all error mappings |
| `app/api/ocr/extract/__tests__/route.test.ts` (mod) | Route refactor | All existing tests pass unchanged |
| `lib/__tests__/firestore.test.ts` (mod) | `updateDocumentoMedio` | Mock updateDoc, verify path + payload, serverTimestamp |
| `components/media/__tests__/InboxTab.test.tsx` (new) | Full InboxTab batch flow | Selection, Select All, max 30, action bar show/hide, 3-parallel concurrency, per-doc progress, overlay priority, cancel, retry, dismiss failed |

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450 (180 + 15 + 90 + 40 + 80 + 20 + 25 tests) |
| 400-line budget risk | **Medium** — simplified from ~580 by removing batch endpoint + WriteBatch |
| Chained PRs recommended | Yes (if > 400) |
| Decision needed before apply | **Chain strategy** (stacked-to-main, feature-branch-chain, or size:exception) |
