# Tasks: Undo/Redo para Documentos

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~505 (110 hook + 150 unit tests + 115 component diff + 130 integration tests) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 — Hook + Unit Tests (260 lines) → PR 2 — Component + Integration Tests (245 lines) |
| Delivery strategy | ask-always |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Hook + Unit Tests | PR 1 | `useDocumentHistory.ts` + `useDocumentHistory.test.ts` — standalone, no component deps |
| 2 | Component + Integration Tests | PR 2 | Modified `DocumentoSidepanel.tsx` + new integration tests — depends on PR 1 hook |

---

## Phase 1: Hook — RED → GREEN → REFACTOR

- [x] 1.1 RED: Write `lib/hooks/__tests__/useDocumentHistory.test.ts` — 18 tests for push, undo, redo, canUndo/canRedo, clear, maxSize 50 cap, TTL 24h pruning, localStorage read/write, quota fallback, edge cases (empty, single entry, undo past start, redo after push)
- [x] 1.2 GREEN: Create `lib/hooks/useDocumentHistory.ts` with generic `useHistory<T>(key, options?)` — stack+pointer pattern via useReducer, `{ push, undo, redo, clear, canUndo, canRedo, entries, pointer }`, localStorage persistence under `doc-history-${key}`, maxSize enforcement (default 50), TTL cleanup on init (default 24h), quota error handling (prune → retry → in-memory fallback)
- [x] 1.3 REFACTOR: Verified TypeScript strict mode (0 tsc errors), exported `UseHistoryOptions`, `UseHistoryReturn<T>`, and `DocumentFormState` types, full suite 903/903 passing

## Phase 2: Component — Integrate Hook + New Behavior

- [ ] 2.1 Extend `FormState` to 10 fields: add `periodo`, `terceroId`, `projectId`, `ejecucionIds` alongside existing 6. Update `captureState()` and `applyState()` accordingly
- [ ] 2.2 Replace inline `useState<FormState[]> history` / `historyIdx` with `useHistory<FormState>(docId)`. Remove old capture/apply helpers. Wire `undo()`/`redo()` return values into `applyState()`
- [ ] 2.3 Add auto-capture: shared debounce timer ref (800ms) + `useEffect` watching all 10 fields, `onBlur` handlers on all inputs for immediate capture, skip duplicate identical states via `JSON.stringify` comparison, initial snapshot on mount, OCR pre-fill snapshot via `pushState()`
- [ ] 2.4 Add atomic restore: `isUndoingRef` flag suppresses the `ejecucionIds` → `montoTotal` auto-calc `useEffect` during restore; reset via `queueMicrotask`
- [ ] 2.5 Add keyboard shortcuts: `useEffect` with `keydown` listener, `Ctrl+Z` undo / `Ctrl+Shift+Z` redo, `preventDefault`, cleanup on unmount
- [ ] 2.6 Update UI buttons: render condition `entries.length > 1` (not on single initial snapshot), `disabled` per `canUndo`/`canRedo`, remove old conditional `(canUndo || canRedo)` wrapper
- [ ] 2.7 Handle document change: in existing `useEffect([documento.id])`, call `clear()` then re-init history from localStorage for the new doc

## Phase 3: Integration Tests — RED → GREEN → REFACTOR

- [ ] 3.1 RED: Write integration test: undo restores previous field values, redo re-applies them
- [ ] 3.2 GREEN: Wire component handlers to pass test 3.1
- [ ] 3.3 RED: Write integration test: atomic restore — `ejecucionIds` + `montoTotal` restore together without auto-overwrite
- [ ] 3.4 GREEN: Wire atomic restore to pass test 3.3
- [ ] 3.5 RED: Write integration tests: `Ctrl+Z` triggers undo, `Ctrl+Shift+Z` triggers redo, OCR pre-fill is undoable after re-mount, history restores from localStorage on mount
- [ ] 3.6 GREEN: Wire remaining features to pass test 3.5
- [ ] 3.7 REFACTOR: Run full suite (`npm test`), verify 0 regressions, remove all dead code (old inline history), confirm tsc zero errors
