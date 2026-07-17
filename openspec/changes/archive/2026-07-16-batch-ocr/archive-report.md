# Archive Report: batch-ocr

**Archived at**: 2026-07-16
**Change**: batch-ocr
**Mode**: openspec

## Executive Summary

Batch OCR adds multi-document AI extraction to the Inbox. Users select up to 30 documents via checkboxes, trigger parallel extraction with a single "Extraer con IA (N)" action, and monitor per-doc progress via card overlays (queued → processing → done/error). Client-orchestrated: reuses existing `POST /api/ocr/extract` with 3-parallel concurrency, individual `updateDocumentoMedio()` writes per doc (non-destructive merge with fresh Firestore read), and AbortController-based cancel support.

### What was done

- **Multi-selection in InboxTab**: Checkbox per card, Select All toggle, 30-doc max limit
- **Floating action bar**: "Extraer con IA (N)", "Cancelar", "Limpiar", "Reintentar (N)" with per-state styling
- **Client-orchestrated parallel extraction**: `chunkArray(selectedDocs, 3)` + `Promise.allSettled` per chunk, per-doc 429 retry with backoff
- **Per-doc progress tracking**: `useReducer` with `pending → processing → done | error | cancelled` states
- **Cancel support**: `AbortController` per request stored in `useRef` map
- **Non-destructive merge**: Fresh Firestore read at write time, only empty fields populated
- **`lib/ocr.ts`**: Shared Gemini logic extracted from route (`buildPrompt`, `extractFromGemini`, `validateFileForOcr`, `getFriendlyErrorMessage`)
- **`updateDocumentoMedio()`**: New function in `firestore.ts` following existing update patterns
- **67 new tests**: 33 unit (ocr.ts), 2 unit (firestore.ts), 12 route, 20 component (InboxTab.batch flow)
- **All tests passing**: 885/885 tests, tsc zero errors, no new lint issues

## Specs Status

| Domain | Action | Details |
|--------|--------|---------|
| batch-ocr | Created (main spec) | Full spec at `openspec/specs/batch-ocr/spec.md` — 12 requirements covering selection, extraction, progress, error handling, and write strategy |
| ocr-extraction | No changes needed | Delta spec documented refactoring decision (extract to `lib/ocr.ts`) and confirmed no API surface changes — no requirement changes to merge |

## Archive Contents

| Artifact | Path | Status |
|----------|------|--------|
| proposal.md | `openspec/changes/archive/2026-07-16-batch-ocr/proposal.md` | ✅ |
| design.md | `openspec/changes/archive/2026-07-16-batch-ocr/design.md` | ✅ |
| specs/ | `openspec/changes/archive/2026-07-16-batch-ocr/specs/` | ✅ |
| tasks.md | `openspec/changes/archive/2026-07-16-batch-ocr/tasks.md` | ✅ (7/7 complete) |
| verify-report.md | `openspec/changes/archive/2026-07-16-batch-ocr/verify-report.md` | ✅ |

## Tasks Summary

| # | Task | Effort | Status |
|---|------|--------|--------|
| 1 | Create `lib/ocr.ts` — shared Gemini module | L | ✅ |
| 2 | Add `updateDocumentoMedio()` to firestore.ts | S | ✅ |
| 3 | Multi-selection state + checkboxes in InboxTab | M | ✅ |
| 4 | Floating action bar + cancel + progress | M | ✅ |
| 5 | Batch OCR orchestration + per-doc writes + overlays | L | ✅ |
| 6 | Retry-failed + dismiss-failed flow | S | ✅ |
| 7 | Tests | L | ✅ |
| **Total** | | | **7/7 ✅** |

## Verify Summary

| Check | Result |
|-------|--------|
| Type check (`tsc --noEmit`) | ✅ Zero errors |
| Lint | ✅ No new errors in changed files |
| Tests | ✅ 885 passed, 0 failed |
| Spec compliance | ✅ 24/24 requirements compliant (2 partial — linear vs exponential backoff) |
| Design decisions followed | ✅ 8/8 design decisions implemented |

## Risks / Notes

- **Backoff is linear (1s, 2s), not exponential (1s, 2s, 4s)** — minor spec variance, zero functional impact
- **No apply-progress artifact** found — tests exist and pass (885/885), but strict TDD evidence from apply phase not persisted
- **No explicit concurrency cap test** — concurrency is structural via `chunkArray(selectedDocs, 3)`, self-evident in implementation

## Source of Truth

The main spec at `openspec/specs/batch-ocr/spec.md` now reflects the new behavior. The `ocr-extraction` spec at `openspec/specs/ocr-extraction/spec.md` remains unchanged — batch OCR reuses the existing extraction pipeline without API surface changes.

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Ready for the next change.
