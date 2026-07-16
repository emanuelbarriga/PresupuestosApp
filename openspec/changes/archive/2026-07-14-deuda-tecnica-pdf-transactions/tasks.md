# Tasks: deuda-tecnica-pdf-transactions

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 300–380 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (no overlap between atomicity + PDF) |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

**Why Medium**: Data atomicity is largely in-place rewrites (same logic, wrapped in `runTransaction`). PDF preview adds ~80 lines for the new component. Risk is from the extracto creation refactor (3 steps → 1 writeBatch) which may touch more lines than estimated.

## Phase 1: Data Atomicity — runTransaction

- [x] 1.1 `lib/firestore.ts` — `addBudgetLink`: replace `addDoc`+`updateDoc` with `runTransaction`. `txn.set(linkRef)` + `txn.update(budgetRef)`. Return `linkRef.id`.
- [x] 1.2 `lib/firestore.ts` — `removeBudgetLink`: replace `getDoc`+`deleteDoc`+`updateDoc` with `runTransaction`. Read via `txn.get`, `txn.delete`, conditional `txn.update`.
- [x] 1.3 `app/[company]/[[...segments]]/page.tsx` — Ejecucion creation + document linking: replace `writeBatch` with `runTransaction`. Inline DocumentoMedio `ejecucionIds: arrayUnion()` inside txn. `linkDocumentoToEntities` becomes cosmetic-only post-step.

## Phase 2: Data Atomicity — writeBatch extension & verification

- [x] 2.1 `app/[company]/[[...segments]]/page.tsx` — Movimiento conversion: move `updateMovimiento` inside existing `writeBatch`. Add `batch.update(movimientoRef, { convertido: true, _ejecucionId })` before `batch.commit()`.
- [x] 2.2 `lib/firestore.ts` + `app/[company]/[[...segments]]/page.tsx` — Extracto creation: pre-generate extracto doc ID, fold `addExtracto`+`batchAddMovimientos`+`updateExtractoStatus` into single `writeBatch`. Return `extractoRef.id`.
- [x] 2.3 `lib/firestore.ts` — `updateTercero`: verify existing `writeBatch` already meets atomicity guarantee. No code change.

## Phase 3: PDF Canvas Preview — Foundation

- [x] 3.1 `npm install react-pdf@^9` — install dependency. Verify worker exists at `/public/pdf.worker.min.mjs`.
- [x] 3.2 `components/shared/PdfViewer.tsx` — create component with `fileUrl`/`pageMode`/`className` props. Configure worker via `/pdf.worker.min.mjs`. Render `<Document>`+`<Page>` from react-pdf. Handle loading (spinner), error ("Abrir en nueva pestaña" link), empty ("Sin documento") states. Import `react-pdf/dist/Page/AnnotationLayer.css` + `TextLayer.css`.

## Phase 4: PDF Canvas Preview — Integrations

- [x] 4.1 `components/entities/documento/DocumentoSidepanel.tsx` — replace `<iframe>` at line 179 with `<PdfViewer fileUrl={documento.url} pageMode="single" />`. Keep fallback link and classification form.
- [x] 4.2 `components/upload/ComprobantesViewer.tsx` — replace `<iframe>` at line 93 with `<PdfViewer fileUrl={modal.url} pageMode="all" />`. Preserve modal layout.
- [x] 4.3 `components/bancos/ExtractoParseModal.tsx` — replace `<iframe>` at line 331 with `<PdfViewer fileUrl={previewUrl} pageMode="all" className="w-full h-full" />`. Preserve side-by-side layout.

## Phase 5: Tests

- [x] 5.1 Update `DocumentoSidepanel.test.tsx` — assert `<PdfViewer>` renders instead of `<iframe>`. Assert `pageMode="single"` prop passed.
- [x] 5.2 Update `ExtractoParseModal.test.tsx` — assert `<PdfViewer>` receives `fileUrl` prop. Assert `pageMode="all"` prop.
- [x] 5.3 Update `ComprobantesViewer.smoke.test.tsx` — assert `PdfViewer` renders iframe no longer present (if applicable).
