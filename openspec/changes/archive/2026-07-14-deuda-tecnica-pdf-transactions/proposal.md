# Proposal: deuda-tecnica-pdf-transactions

## Intent

Fix two sources of brittleness: 6 multi-step Firestore write paths that lack atomicity (risking partial writes on crash), and 3 PDF preview components using `<iframe>` (unreliable across browsers, blocked by Chrome on CORS-restricted origins). Both degrade data integrity and UX confidence.

## Scope

- **IN**: 6 atomicity gaps in `firestore.ts`, `EjecucionForm.tsx`, `page.tsx` — wrap each in `runTransaction` or extend existing `writeBatch`
- **IN**: Replace `<iframe>` PDF preview in `DocumentoSidepanel`, `ComprobantesViewer`, `ExtractoParseModal` with `react-pdf` canvas rendering
- **IN**: Update `document-classification` spec + tests that assert iframe rendering
- **OUT**: Migrating `cascadeTerceroName` to transactions (exceeds 10-doc limit — stays as `writeBatch`)
- **OUT**: Adding new tests for atomicity (covered by existing test suites)
- **OUT**: Bundle optimization for `react-pdf` beyond standard import

## Approach

### 1. Hybrid Transaction Fix (6 paths, 2 patterns)

| Path | Pattern | Why |
|------|---------|-----|
| `EjecucionForm.onFormSubmit` + `linkDocumentoToEntities` | `runTransaction` | 2-3 docs, small atomic gap already TODO-documented |
| `addBudgetLink` | `runTransaction` | 2 writes (link doc + budget update); existing `mediaLinking.ts` pattern |
| `removeBudgetLink` | `runTransaction` | Same cadence |
| page.tsx movimiento conversion | Extend existing `writeBatch` | Batch already exists; add `updateMovimiento` inside it |
| extracto creation (add + batch + status) | Extend existing `writeBatch` | `batchAddMovimientos` already uses batch; fold in extracto doc + status |
| `updateTercero` | Keep `writeBatch` | Cascade exceeds 10-doc transaction limit |

Files: `lib/firestore.ts`, `components/entities/ejecucion/EjecucionForm.tsx`, `app/[company]/[[...segments]]/page.tsx`

### 2. PDF.js Canvas Preview (3 components, 1 shared wrapper)

Install `react-pdf` (wraps existing `pdfjs-dist` ^4.10.38 dep). Create `components/shared/PdfViewer.tsx` with:
- `<Document>` + `<Page>` from `react-pdf`, single-page mode for sidepanel, paginated for modals
- Worker config via existing `/pdf.worker.min.mjs` path
- Loading/error/empty states matching existing UI patterns

| Component | Mode | Change |
|-----------|------|--------|
| `DocumentoSidepanel` | Single page | `<iframe>` → `<PdfViewer pageMode="single" />` |
| `ComprobantesViewer` | Paginated | `<iframe>` → `<PdfViewer pageMode="all" />` |
| `ExtractoParseModal` | Side-by-side | `<iframe>` → `<PdfViewer pageMode="all" />` |

## Delivery Strategy

Single PR. Both changes are self-contained, don't overlap files (transaction fix touches database layer, PDF change touches UI layer), and neither depends on the other. Merging together avoids two release cycles for technical debt.

**Success criteria**:
- [ ] All 6 two-phase gaps closed — each path either in `runTransaction` or within a single `writeBatch`
- [ ] 3 PDF preview components render via `<canvas>` instead of `<iframe>`
- [ ] Existing 812+ tests pass, updated tests assert canvas rendering not iframe

## Rollback Plan

- Revert the PR. Both changes are backward-compatible rollbacks (transaction wrappers don't change data shape; canvas vs iframe is pure UI rendering).
- If `react-pdf` worker config is problematic mid-deploy, switch standalone `PdfViewer` to `<object>` tag as immediate fallback — keeps PDFs visible while debugging worker path.
- Transaction changes are invisible to users (data shape unchanged) — safe to deploy/revert at any time.

---

**Status**: success
**Summary**: Proposal for deuda-tecnica-pdf-transactions: 6 atomicity gaps → hybrid `runTransaction`/`writeBatch` fix; 3 iframe PDF previews → `react-pdf` canvas. Single PR, clean rollback.
**Artifacts**: `openspec/changes/deuda-tecnica-pdf-transactions/proposal.md`
**Next**: sdd-spec
**Risks**: `react-pdf` / `pdfjs-dist` version mismatch; worker file path may need CDN fallback
**Skill Resolution**: fallback-path — loaded sdd-propose SKILL.md from orchestrator
