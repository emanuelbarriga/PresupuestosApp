# Design: Deuda Técnica — PDF Preview & Transaction Atomicity

## Technical Approach

Two independent fronts: (1) close 6 atomicity gaps — 3 paths migrate from sequential writes to `runTransaction`, 3 paths extend existing `writeBatch`; (2) replace 3 `<iframe>` PDF previews with shared `PdfViewer` canvas via `react-pdf`.

---

## 1. Hybrid Transaction Fix

### Transaction Boundaries

| Path | Current | Pattern | Ops | Error |
|------|---------|---------|-----|-------|
| `addBudgetLink` | `addDoc` → `updateDoc` | `runTransaction` | 2 writes | Auto rollback |
| `removeBudgetLink` | `getDoc` → `deleteDoc` → `updateDoc` | `runTransaction` | 1 read + 2 writes | Auto rollback; read inside txn |
| EjecucionForm + document linking | `writeBatch` → `runTransaction` (gap) | `runTransaction` | ~6-10 writes | Auto rollback; both steps atomic |
| Movimiento conversion | `writeBatch` → fire-and-forget `updateMovimiento` | Extend existing `writeBatch` | +1 update | Batch atomic |
| Extracto creation | `addExtracto` → `batchAddMovimientos` → `updateStatus` | Single `writeBatch` | up to 500 | Pre-gen extracto doc ID |
| `updateTercero` + cascade | `writeBatch` (current) | Keep `writeBatch` | up to 500 | Already correct |

### addBudgetLink / removeBudgetLink (firestore.ts)

`addBudgetLink`: replace `addDoc` + `updateDoc` with `runTransaction`. Create link doc ref via `doc(collection(...))`, then `txn.set(linkRef, data)` + `txn.update(budgetRef, { totalEjecutado: increment(monto), ... })`. Return `linkRef.id`.

`removeBudgetLink`: replace `getDoc` + `deleteDoc` + `updateDoc` with `runTransaction`. Read link inside txn via `txn.get(linkRef)`, `txn.delete(linkRef)`, conditionally `txn.update(budgetRef, { totalEjecutado: increment(-monto), ... })`.

### EjecucionForm: Creation + Document Linking (page.tsx)

**Gap**: `writeBatch` creates ejecucion + budgetLinks, then `linkDocumentoToEntities` runs after. Crash between leaves documents `por_clasificar`.

**Solution**: Replace `writeBatch` with `runTransaction`. Pass `_uploadedDocumentoIds` through entry data. Inside transaction: create ejecucion, budgetLinks, update budgets, AND update each DocumentoMedio with `ejecucionIds: arrayUnion(ejecucionId)`. `linkDocumentoToEntities` still runs after for `_linkedDocumentos`/`_estadoComprobantes` sync — but now it's cosmetic, not critical (document already has the reference).

### Movimiento Conversion (page.tsx line 470-472)

Move `updateMovimiento` call INSIDE the existing `writeBatch`. Resolve `movimientoRef` with fully qualified path, add `batch.update(movimientoRef, { convertido: true, _ejecucionId })`. Removes fire-and-forget pattern.

### Extracto Creation (page.tsx line 490-510)

Fold 3 steps into one `writeBatch`: pre-generate extracto ID via `doc(collection(...))`, batch-set extracto doc, batch-set each movimiento, batch-update extracto status. Return `extractoRef.id`.

### Test Strategy

| Layer | What | How |
|-------|------|-----|
| Unit (firestore.ts) | Transaction boundaries for addBudgetLink, removeBudgetLink | `vi.mock` on `runTransaction`. Assert callback writes correct docs/sets. Assert rollback on thrown error. |
| Unit (page.tsx) | Movimiento update inside batch; extracto single batch | Spy on `writeBatch`. Assert all writes added before single `commit()`. |
| Integration | Ejecucion + document linking | Emulator test: verify all docs created or none. |

---

## 2. PdfViewer Component

### Decision: react-pdf

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `react-pdf` v9.x | Requires `pdfjs-dist` >=4.x | **Chosen** — matches existing `pdfjs-dist@4.10.38` (resolved in lockfile) |
| `react-pdf` v7.x | Requires `pdfjs-dist` 3.x | Rejected — downgrade from existing |

Worker file at `/public/pdf.worker.min.mjs` already exists, used by `lib/parsers/pdfText.ts` — no copy needed.

### API

```typescript
// components/shared/PdfViewer.tsx
interface PdfViewerProps {
  fileUrl: string;
  pageMode: 'single' | 'all';
  className?: string;
}
// States: loading → skeleton; error → "No se pudo cargar" + Retry; empty → icon + text

import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
```

### Integration

| Component | Change | Detail |
|-----------|--------|--------|
| `DocumentoSidepanel` | Replace iframe (lines 178-184) | `<PdfViewer fileUrl={documento.url} pageMode="single" />` |
| `ComprobantesViewer` | Replace iframe in modal (line 93) | `<PdfViewer fileUrl={modal.url} pageMode="all" />` |
| `ExtractoParseModal` | Replace iframe in right pane (line 331) | `<PdfViewer fileUrl={previewUrl} pageMode="all" className="w-full h-full" />` |

### Test Strategy

Mock `react-pdf` `<Document>` and `<Page>` components. Test PDF states (loading skeleton, error fallback, empty fallback). Update existing DocumentoSidepanel test: assert `<PdfViewer>` instead of `iframe`. Update ExtractoParseModal test: assert PdfViewer receives `fileUrl` prop.

### Fallback

If worker config fails: `<object data={fileUrl} type="application/pdf" />` — keeps PDF visible while debugging.

---

## Dependencies

```
npm install react-pdf@^9
```

No `pdfjs-dist` install needed (already ^4.0.379 → 4.10.38). No worker copy needed.

---

## Open Questions

- [ ] Should `_linkedDocumentos` update be inlined inside the same transaction as ejecucion creation, or is DocumentoMedio-level `ejecucionIds` sufficient for the atomicity guarantee?
- [ ] Does `react-pdf/dist/*.css` import work with Next.js 15 without webpack config changes?
