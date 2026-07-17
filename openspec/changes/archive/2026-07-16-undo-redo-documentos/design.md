# Design: Undo/Redo para Documentos

## Technical Approach

Generic `useHistory<T>` hook with stack+pointer pattern + localStorage persistence, replacing the inline `FormState[]` + `historyIdx` in `DocumentoSidepanel`. Extend `FormState` to cover all 9 editable fields. Atomic restore for `ejecucionIds` + `montoTotal` via a ref flag that suppresses the auto-calculation `useEffect` during undo/redo.

## Architecture Decisions

### Decision: Generic vs document-specific hook

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `useHistory<T>` generic | Reusable, one lib file | **Chosen** — same pattern, zero extra cost, enables reuse |
| Inline in component | Zero abstraction | Rejected — would duplicate logic for any future undo/redo |

### Decision: localStorage serialization format

| Format | Tradeoff | Decision |
|--------|----------|----------|
| `{ stack: T[], pointer: number, timestamp: number }` | Full state, self-contained | **Chosen** — simple, debuggable, TTL verifiable |
| Append-only log | Replay-capable | Rejected — over-engineering for max 50 entries |
| Separate keys per index | Chunked writes | Rejected — atomic save per state |

### Decision: Atomic restore strategy

| Approach | Tradeoff | Decision |
|----------|----------|----------|
| Ref flag `isUndoingRef` | Minimal change, works with existing effect | **Chosen** — the effect checks the flag before writing montoTotal |
| Remove ejecucionIds effect | Would break auto-fill UX | Rejected — feature loss |
| Batch updates via `unstable_batchedUpdates` | React 18+, adds coupling | Rejected — ref flag is simpler and explicit |

### Decision: TTL default

| Option | Rationale |
|--------|-----------|
| **24h** (configurable) | Matches session-based browsing; proposal said 7d but 24h is safer for stale data and aligns with user re-entry pattern |
| 7d per proposal | Too long for draft state that must not conflict with Firestore writes |

## Data Flow

```
User input ──→ onChange ──→ setField()
                                │
                    ┌───────────┴───────────┐
                    │ debounce 800ms         │ onBlur (immediate)
                    │ timer fires            │
                    └───────┬───────────────┘
                            │
                    useHistory.pushState(fullFormState)
                            │
                    ┌───────┴───────┐
                    │ localStorage  │ setItem(`doc-history-${id}`, ...)
                    └───────────────┘

Undo click ──→ useHistory.undo() ──→ applyState(s) ──→ setField() × 9
                    │                    │
                    │              isUndoingRef = true
                    │                    │
                    │              Effect skips auto-calc
                    │                    │
                    │              isUndoingRef = false (microtask)

Mount ──→ useHistory init ──→ localStorage.getItem(`doc-history-${id}`)
                                    │
                              Check TTL → if stale → clear()
                                    │
                              Restore stack + pointer
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/hooks/useDocumentHistory.ts` | Create | Generic `useHistory<T>` hook (push, undo, redo, clear, canUndo, canRedo) with localStorage, TTL, maxSize |
| `components/entities/documento/DocumentoSidepanel.tsx` | Modify | Replace inline history with hook, extend FormState, add auto-capture + atomic restore |
| `components/entities/documento/__tests__/DocumentoSidepanel.test.tsx` | Modify | Update existing tests + add undo/redo test cases |
| `lib/hooks/__tests__/useDocumentHistory.test.ts` | Create | Unit tests for hook in isolation |

## Interfaces / Contracts

### useHistory hook

```typescript
// lib/hooks/useDocumentHistory.ts

export interface UseHistoryReturn<T> {
  pushState: (state: T) => void;
  undo: () => T | null;
  redo: () => T | null;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
}

export function useHistory<T>(
  key: string,            // localStorage key
  maxSize?: number,       // default 50
  ttlMs?: number,         // default 24h (86_400_000)
): UseHistoryReturn<T>;
```

### Extended FormState

```typescript
type FormState = {
  tipoDocumento: string;
  periodo: string;
  terceroId: string;
  projectId: string;
  ejecucionIds: string[];
  nit: string;
  proveedorTexto: string;
  montoTotal: string;
  fechaDocumento: string;
  descripcion: string;
};
```

### localStorage schema per document

```typescript
interface PersistedHistory<T> {
  stack: T[];
  pointer: number;   // -1 = no undo, last index = top
  savedAt: number;   // Date.now() for TTL check
}
// Key: `doc-history-${docId}`
```

### Keyboard event listener

```typescript
// Inside DocumentoSidepanel
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      handleRedo();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [handleUndo, handleRedo]);
```

## State Management Interaction

- **Hook owns the stack + pointer**: `useHistory` internally uses `useRef` for stack/pointer (no re-renders on push) + `useState` for `canUndo`/`canRedo` (re-render button state).
- **Component owns individual field state**: 9 separate `useState` calls remain. The hook returns `undo()`/`redo()` results that the component applies via `applyState()`.
- **No FormState-wide useState**: Not needed — the 9 field setters are the single source of truth. The hook only stores serializable snapshots.
- **On document change** (`documento.id`): Call `clear()` to reset history, re-init from localStorage for the new doc if available.

### Auto-capture strategy

- **Not** a `useEffect` on every field change (that would fire on every keystroke). Instead:
  - A shared `useRef<FormState>` tracks the last captured state
  - A `useEffect` runs on every field change, starts a debounce timer (800ms), on expiry calls `pushState(lastCapturedRef.current)`
  - `onBlur` on each input calls `captureImmediate()` which clears the debounce timer and pushes immediately
- Alternatively, since we have 9 individual setters, use a single `useEffect` watching all 9 fields (via a combined object) with debounce. This is simpler and leverages existing patterns.

**Simplest approach**: A single `useEffect` with debounce that watches all 9 fields. Every change queues a debounced capture; onBlur handlers invoke capture immediately.

## Atomic Restore Strategy

```typescript
const isUndoingRef = useRef(false);

// In undo/redo handler:
isUndoingRef.current = true;
applyState(restoredState);  // sets all 9 fields including ejecucionIds + montoTotal
// useEffect for ejecucionIds fires but checks the flag:

useEffect(() => {
  if (isUndoingRef.current) return; // skip during restore
  if (ejecucionIds.length > 0 && !isUndoingRef.current) {
    const firstEj = ejecucionOptions.find(...);
    if (firstEj?.montoEjecutado !== undefined) {
      setMontoTotal(firstEj.montoEjecutado.toString());
    }
  }
}, [ejecucionIds, ejecucionOptions]);

// Reset flag after render via microtask:
queueMicrotask(() => { isUndoingRef.current = false; });
```

## Quota & Error Handling

- `50 entries × ~500-800 bytes/FormState ≈ ~25-40KB per doc` — well within localStorage 5MB limit
- `setItem` wrapped in try/catch: on `QuotaExceededError`, fall back to in-memory-only (no persistence, but undo/redo still works for the session)
- TTL: `savedAt` checked on init; if `Date.now() - savedAt > ttlMs`, call `clear()` and remove from localStorage

## Test Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit (hook) | pushState, undo, redo, canUndo/canRedo, clear, maxSize cap, TTL expiry, localStorage read/write, quota fallback | Mock `localStorage` + direct `renderHook` |
| Unit (hook) | Boundary: single entry, empty, undo past start, redo after push | Edge case coverage |
| Integration | Undo button restores previous field values; redo re-applies | RTL `fireEvent` on inputs + click undo/redo |
| Integration | Atomic restore: ejecucionIds + montoTotal restored together, no auto-overwrite | RTL with mocked options |
| Integration | OCR capture: snapshot before pre-fill, undoable after mount | RTL sequence |
| Integration | Persistence: reload component, history restored | Mock localStorage |
| Integration | Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z | `fireEvent.keyDown` |
| Integration | Existing tests: all 13 pass without modification | Run suite |

## Migration / Rollout

No migration. The old `history`/`historyIdx` state and inline `captureState`/`applyState` are removed entirely — they were in-memory only, no persisted data to migrate. Old localStorage keys do not exist yet. On deploy, all users get the new hook from scratch (empty history per document).

## Open Questions

- [ ] Debounce timer scope: `useEffect` watching all 9 fields vs per-field `onChange` wrapper? The `useEffect` approach is cleaner if we can compare snapshots; per-field wrappers are more precise. Recommend the `useEffect` approach with a ref cache — implement and adjust if input feels laggy.
- [ ] Should undo/redo buttons be ALWAYS visible (as per proposal) or only when there's history (current behavior)? The proposal says always visible, which is a UX choice — confirm with stakeholder if disabled buttons with visible state is acceptable.
