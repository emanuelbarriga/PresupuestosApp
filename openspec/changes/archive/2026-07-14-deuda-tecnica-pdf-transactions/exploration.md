## Exploration: Deuda Técnica (PDF Preview + Two-Phase Commit)

### Current State

#### PDF Preview (iframe)
The project renders PDF previews using `<iframe>` tags in three components. Chrome blocks iframe-based PDF rendering on some origins (cross-origin restriction, mixed content, or certain security policies), leaving users with a blank viewer instead of a preview. The `DocumentoSidepanel` uses `#view=FitH` param which only works with native Chrome PDF viewer — unreliable.

The project already has `pdfjs-dist` ^4.10.38 in the main `package.json` (used for text extraction in the bank statement parsers at `lib/parsers/pdfText.ts`), so the core dependency is already installed. The worker file is configured at `/pdf.worker.min.mjs` on the client side.

#### Two-Phase Commit (Firestore Transactions)
Several write operations across the codebase create or modify documents in multiple Firestore writes without atomicity:

1. **EjecucionForm → addEjecucion → linkDocumentoToEntities** — KNOWN and self-documented (TODO in source). Creates the ejecucion via `onFormSubmit` (which calls `addEjecucion` in a `writeBatch`), then separately links uploaded documentos via `linkDocumentoToEntities` (which uses `runTransaction`). If the app crashes between steps, the ejecucion exists but linked documents remain `por_clasificar`.

2. **addBudgetLink** — Creates a budgetLink subcollection doc, then separately updates the parent budget's `totalEjecutado` and `linkedEjecuciones` fields. Not wrapped in a transaction.

3. **removeBudgetLink** — Reads the link, deletes it, then updates the parent budget. Also not transactional.

4. **page.tsx: movimiento → ejecucion conversion** — Uses `writeBatch` for ejecucion + budgetLinks (good), but then calls `updateMovimiento` in a separate `.catch()` chain to mark the movimiento as `convertido`. If that fails, the ejecucion exists but the movimiento isn't marked as converted.

5. **addExtracto + batchAddMovimientos + updateExtractoStatus** — Three separate Firestore operations not in a transaction. Could leave an extracto with a status mismatch vs its parsed movimientos.

6. **updateTercero + cascadeTerceroName** — Updates the tercero doc, then cascades name change to linked budgets/ejecuciones via `writeBatch`. These two steps are not atomic.

The `mediaLinking.ts` service already uses `runTransaction` correctly for linking/unlinking operations — it's a model of the right pattern.

### Affected Areas

#### Two-Phase Commit
- `components/entities/ejecucion/EjecucionForm.tsx` — Lines 286-289: self-documented TODO for wrapping ejecucion creation + doc linking in a transaction
- `lib/firestore.ts` — `addBudgetLink` (line 459), `removeBudgetLink` (line 479): budget link CRUD not atomic
- `app/[company]/[[...segments]]/page.tsx` — Lines 468-472: movimiento conversion not atomic after batch commit
- `lib/firestore.ts` — Lines 496-508: extracto + movimientos + status update not atomic
- `lib/firestore.ts` — `updateTercero` (line 639): tercero name change + cascade not atomic

#### PDF.js Preview (replace iframe)
- `components/entities/documento/DocumentoSidepanel.tsx` — Line 179: `<iframe>` for PDF preview (mimeType check)
- `components/upload/ComprobantesViewer.tsx` — Line 93: `<iframe>` for PDF in preview modal
- `components/bancos/ExtractoParseModal.tsx` — Line 331: `<iframe>` for PDF in split-pane preview
- `components/entities/documento/__tests__/DocumentoSidepanel.test.tsx` — Lines 69-88: tests checking iframe rendering
- `components/bancos/__tests__/ExtractoParseModal.test.tsx` — Line 117: test checking iframe rendering
- `public/` — May need `pdf.worker.min.mjs` file if not already present
- `lib/parsers/pdfText.ts` — Already uses pdfjs-dist, serves as reference for worker config

### Approaches — Two-Phase Commit

1. **Wrap each critical multi-write path in `runTransaction`** — Identify each two-phase gap and wrap both operations in a single `runTransaction`, using `transaction.get()` for reads and `transaction.set()` / `transaction.update()` for writes (max 10 docs per transaction).
   - Pros: Atomic, consistent (Firestore guarantees rollback on failure), aligns with existing `mediaLinking.ts` pattern
   - Cons: Max 10 document reads per transaction (some paths like `cascadeTerceroName` may exceed this)
   - Effort: Medium

2. **Use `writeBatch` with preconditions / retry** — Consolidate multi-step writes into larger batches (max 500 ops). For paths exceeding 10-doc transaction limit (e.g., `cascadeTerceroName`), `writeBatch` is the right tool — already used in some places but missing from others.
   - Pros: 500-op limit fits cascading paths; already used in `deleteEjecucion`
   - Cons: No automatic rollback; concurrent writes can create race conditions; requires manual retry logic
   - Effort: Medium

3. **Hybrid: `runTransaction` for small atomic operations + `writeBatch` for cascading paths** — Use `runTransaction` for the 3-4 doc two-phase gaps (addBudgetLink, removeBudgetLink, extracto creation, ejecucion conversion), and `writeBatch` for the cascade paths. This matches the existing architectural split.
   - Pros: Right tool for each job; minimal blast radius; addresses the most impactful gaps first
   - Cons: Two patterns to maintain; boundary judgment required
   - Effort: Medium

### Approaches — PDF.js Preview

1. **Custom `PdfViewer` component using `pdfjs-dist`** — Create a shared `components/shared/PdfViewer.tsx` that uses `pdfjs-dist`'s `getDocument` + `getPage` + `render` to render PDF pages to canvas. Handles: single-page mode for sidepanel, all-pages mode for full modal. Reuses the existing pdfjs-dist v4.10.38 dependency.
   - Pros: Zero additional dependencies; full control over rendering; works cross-origin; reuses existing pdfjs knowledge in the project
   - Cons: More implementation work (canvas rendering, page navigation, text layer); pdfjs-dist API is non-trivial; worker setup required
   - Effort: High

2. **Use `react-pdf` (wojtekmaj's wrapper)** — Install `react-pdf` (which wraps pdfjs-dist) for a declarative React API. Provides `<Document>` and `<Page>` components with built-in canvas rendering, page navigation, and loading states.
   - Pros: Declarative React API; built-in page navigation; active maintenance; good DX
   - Cons: Adds a ~8KB dependency; version must match the installed pdfjs-dist; some config needed for worker
   - Effort: Low

3. **Simple `PdfViewer` component using an `<object>` or `<embed>` tag** — Replace `<iframe>` with `<object>` or `<embed>` tags which some browsers handle more reliably for PDFs. This is the quickest fix.
   - Pros: Minimal code change; works in more cases than iframe
   - Cons: Still relies on browser PDF plugin; not a real fix; Chrome may still block it
   - Effort: Low (but incomplete fix)

### Recommendation

**Two-Phase Commit**: Approach 3 (Hybrid). Use `runTransaction` for the small atomic gaps:
- `EjecucionForm`: modify `onFormSubmit` to accept the pending documento IDs and include both ejecucion creation and document linking in a single `runTransaction`
- `addBudgetLink` / `removeBudgetLink`: refactor to use `runTransaction` instead of separate `addDoc` + `updateDoc`
- page.tsx movimiento conversion: include `updateMovimiento` inside the existing `writeBatch` instead of calling it separately
- extracto creation: combine `addExtracto` + `batchAddMovimientos` + `updateExtractoStatus` into one `writeBatch` (already uses batch for movimientos, just needs the extracto doc and status update in the same batch)
- `updateTercero` + `cascadeTerceroName`: keep as `writeBatch` (exceeds transaction limits) but improve consistency with two-phase commit pattern for the initial tercero update

**PDF.js Preview**: Approach 2 (`react-pdf` wrapper). The quickest path to a reliable cross-origin PDF viewer. The project already has `pdfjs-dist` installed, so `react-pdf` (which wraps it) is a natural fit with minimal additional weight. If bundle size is a concern, Approach 1 (custom component) is viable but adds significant implementation time.

### Risks

- **Transaction limits**: `runTransaction` maxes at 10 document reads. The `cascadeTerceroName` path can involve hundreds of docs — must use `writeBatch` there, which has no automatic rollback.
- **pdfjs-dist version compatibility**: `react-pdf` may lag behind `pdfjs-dist` ^4.0.379. Need to verify version compatibility before proceeding.
- **Worker file**: pdfjs-dist requires a worker file served from `/pdf.worker.min.mjs`. Verify it exists in `public/` or configure a CDN fallback.
- **Test coverage**: Existing tests check for `<iframe>` presence — these will need updates to check for canvas/pdfjs rendering instead.
- **ExtractoParseModal PDF preview**: This component uses `URL.createObjectURL(file)` for new uploads, which is already a blob URL — this one may still work with iframes on some browsers, but should be migrated for consistency.

### Ready for Proposal
Yes
