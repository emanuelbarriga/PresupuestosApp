# Proposal: batch-ocr

## Intent

Inbox users OCR docs one at a time via DocumentoSidepanel — repetitive for 10+ items. Batch OCR lets them select N docs and process in parallel with per-doc progress, reusing the same extraction pipeline.

## Scope

- **In**: Multi-select (checkboxes + Select All) in `InboxTab`; floating action bar with "Extraer con IA (N)"; client-orchestrated 3-parallel concurrency; per-doc status tracking (queued → processing → done/error); `POST /api/ocr/batch-extract`; `batchUpdateDocumentos()` in `firestore.ts`; `bulk-ocr` NavScreen type
- **Out**: Server-side orchestration (SSE/queue); automatic entity linking after batch; migration of existing docs; Gemini async batch API

## Capabilities

- **New** `batch-ocr`: Multi-select OCR — grid checkboxes, parallel extraction, per-doc progress, batch Firestore write
- **Modified** `ocr-extraction`: New `/api/ocr/batch-extract` endpoint reusing existing auth, validation, 429 retry per item

## Approach

Client-orchestrated: selects docs → "Extraer con IA (N)" → client calls `/api/ocr/batch-extract` per doc (3 concurrent, rest queued) → reuses Gemini schema + 429 retry → pre-fills via `batchUpdateDocumentos()`. Per-doc state in `useReducer`. Grid updates independently (spinner, check, warning). Reuses BulkEdit pattern.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `InboxTab.tsx` | Major | Checkboxes, selection, floating bar, progress |
| `api/ocr/batch-extract/route.ts` | New | Accepts `{ storagePath }`, reuses extract logic |
| `lib/firestore.ts` | Modified | `batchUpdateDocumentos()` — same pattern as existing batch updates |
| `lib/types.ts` | Minor | `bulk-ocr` added to NavScreen |
| `InboxBulkOcrPanel.tsx` | New | Floating action bar component |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Gemini 429 on parallel calls | Med | Cap of 3 concurrent + per-item exponential backoff (1s, 2s, 4s) |
| 30s timeout cascading | Low | Parallel ceiling limits concurrent timeouts; UI stays responsive |
| Selection vs real-time sub conflict | Med | Selection stored as local `Set<string>`, decoupled from Firestore |
| Firestore WriteBatch limits | Low | Max 500 per batch — realistic inbox batches are smaller |

## Rollback Plan

Revert `NavScreen` `bulk-ocr` addition, remove batch UI from `InboxTab`, delete `/api/ocr/batch-extract` route. No spec-level revert needed — `batch-ocr` is new, nothing existing breaks.

## Dependencies

`@google/genai` and Firebase Admin SDK (both already installed from Phase 1).

## Success Criteria

- [ ] Select 10+ docs → batch OCR → each doc shows individual progress (queued → processing → done/error)
- [ ] 3 concurrent; remaining queue after each completes
- [ ] 429 retries exponentially up to 3 attempts per doc, errors isolated
- [ ] Each success pre-fills DocumentoSidepanel non-destructively
- [ ] `batchUpdateDocumentos()` writes in single `WriteBatch`
- [ ] tsc: zero new errors; existing tests: 100% pass
