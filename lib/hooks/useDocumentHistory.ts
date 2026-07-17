'use client';

import { useReducer, useCallback, useRef } from 'react';

// ─── Public Types ───────────────────────────────────────────────────────────

/**
 * Full snapshot of the Documento sidepanel form.
 */
export interface DocumentFormState {
  tipoDocumento?: string;
  periodo?: string;
  fechaDocumento?: string;
  terceroId?: string;
  projectId?: string;
  ejecucionIds?: string[];
  nit?: string;
  proveedorTexto?: string;
  montoTotal?: number | null;
  descripcion?: string;
}

export interface UseHistoryOptions<T> {
  /** Maximum history entries (default: 50). */
  maxEntries?: number;
  /** Time-to-live in ms for persisted history (default: 24h). */
  ttlMs?: number;
  /** Callback invoked when history is cleared. */
  onClear?: () => void;
  /** Custom serializer for each entry. */
  serialize?: (entry: T) => string;
  /** Custom deserializer for each entry. */
  deserialize?: (data: string) => T;
}

export interface UseHistoryReturn<T> {
  /** All history entries (current snapshot + undo stack). */
  entries: T[];
  /** Current position in the history stack (-1 = empty). */
  pointer: number;
  /** Push a new entry onto the history stack (truncates redo). */
  push: (entry: T) => void;
  /** Move back one step. Returns the entry at the new pointer, or null at
   *  start. */
  undo: () => T | null;
  /** Move forward one step. Returns the entry at the new pointer, or null at
   *  end. */
  redo: () => T | null;
  /** True when undo is available (pointer > 0). */
  canUndo: boolean;
  /** True when redo is available (pointer < last index). */
  canRedo: boolean;
  /** Clear all history and remove from localStorage. */
  clear: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'doc-history-';
const DEFAULT_MAX_ENTRIES = 50;
const DEFAULT_TTL_MS = 86_400_000; // 24 hours

// ─── Persistence ────────────────────────────────────────────────────────────

interface PersistedHistory<T> {
  stack: T[];
  pointer: number;
  savedAt: number;
}

function storageKeyFor(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function loadFromStorage<T>(
  storageKey: string,
  ttlMs: number,
): { entries: T[]; pointer: number } {
  if (typeof window === 'undefined') {
    return { entries: [], pointer: -1 };
  }

  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return { entries: [], pointer: -1 };
  }

  try {
    const data: PersistedHistory<T> = JSON.parse(raw);
    if (Date.now() - data.savedAt > ttlMs) {
      localStorage.removeItem(storageKey);
      return { entries: [], pointer: -1 };
    }
    return { entries: data.stack, pointer: data.pointer };
  } catch {
    localStorage.removeItem(storageKey);
    return { entries: [], pointer: -1 };
  }
}

function persistToStorage<T>(
  storageKey: string,
  entries: T[],
  pointer: number,
): boolean {
  if (typeof window === 'undefined') return true;

  const data: PersistedHistory<T> = {
    stack: entries,
    pointer,
    savedAt: Date.now(),
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
    return true;
  } catch (err: unknown) {
    if (
      err instanceof DOMException &&
      err.name === 'QuotaExceededError'
    ) {
      if (entries.length > 20) {
        const pruned = entries.slice(20);
        const adjustedPointer = Math.max(-1, pointer - 20);
        try {
          const retryData: PersistedHistory<T> = {
            stack: pruned,
            pointer: adjustedPointer,
            savedAt: Date.now(),
          };
          localStorage.setItem(storageKey, JSON.stringify(retryData));
          return true;
        } catch {
          // Still failing — in-memory only
          return false;
        }
      }
    }
    return false;
  }
}

// ─── State machine ─────────────────────────────────────────────────────────

interface HistoryState<T> {
  entries: T[];
  pointer: number;
}

type HistoryAction<T> =
  | { type: 'PUSH'; entry: T; maxEntries: number }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR' }
  | { type: 'INIT'; entries: T[]; pointer: number };

function historyReducer<T>(
  state: HistoryState<T>,
  action: HistoryAction<T>,
): HistoryState<T> {
  switch (action.type) {
    case 'PUSH': {
      const truncated = state.entries.slice(0, state.pointer + 1);
      let newEntries = [...truncated, action.entry];
      if (newEntries.length > action.maxEntries) {
        newEntries = newEntries.slice(newEntries.length - action.maxEntries);
      }
      return { entries: newEntries, pointer: newEntries.length - 1 };
    }
    case 'UNDO': {
      if (state.pointer <= 0) return state;
      return { ...state, pointer: state.pointer - 1 };
    }
    case 'REDO': {
      if (state.pointer >= state.entries.length - 1) return state;
      return { ...state, pointer: state.pointer + 1 };
    }
    case 'CLEAR':
      return { entries: [], pointer: -1 };
    case 'INIT':
      return { entries: action.entries, pointer: action.pointer };
    default:
      return state;
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Generic undo/redo hook with stack+pointer pattern and localStorage
 * persistence.
 *
 * @param key  localStorage key suffix (e.g. `doc-abc123`).
 * @param options  Optional configuration.
 */
export function useHistory<T>(
  key: string,
  options?: UseHistoryOptions<T>,
): UseHistoryReturn<T> {
  const maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const onClear = options?.onClear;
  const storageKey = storageKeyFor(key);

  // Lazy-init state from localStorage.
  const [state, dispatch] = useReducer(
    historyReducer<T>,
    undefined,
    () => loadFromStorage<T>(storageKey, ttlMs),
  );

  // Refs for latest state — used for synchronous return values and persist.
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── push ────────────────────────────────────────────────────────────────
  // Persist synchronously (not via effect) so localStorage is always in sync
  // after a push. The transition is computed locally from the ref to avoid
  // stale closures in the reducer's async batch.

  const push = useCallback(
    (entry: T): void => {
      const prev = stateRef.current;
      const truncated = prev.entries.slice(0, prev.pointer + 1);
      let newEntries = [...truncated, entry];
      if (newEntries.length > maxEntries) {
        newEntries = newEntries.slice(newEntries.length - maxEntries);
      }
      const newPointer = newEntries.length - 1;

      persistToStorage(storageKey, newEntries, newPointer);
      dispatch({ type: 'PUSH', entry, maxEntries });
    },
    [maxEntries, storageKey],
  );

  // ── undo ────────────────────────────────────────────────────────────────

  const undo = useCallback((): T | null => {
    if (stateRef.current.pointer <= 0) return null;
    dispatch({ type: 'UNDO' });
    return stateRef.current.entries[stateRef.current.pointer - 1] ?? null;
  }, []);

  // ── redo ────────────────────────────────────────────────────────────────

  const redo = useCallback((): T | null => {
    const { entries, pointer } = stateRef.current;
    if (pointer >= entries.length - 1) return null;
    dispatch({ type: 'REDO' });
    return entries[pointer + 1] ?? null;
  }, []);

  // ── clear ───────────────────────────────────────────────────────────────

  const clear = useCallback((): void => {
    dispatch({ type: 'CLEAR' });
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
    }
    onClear?.();
  }, [storageKey, onClear]);

  // ── derived ─────────────────────────────────────────────────────────────

  const canUndo = state.pointer > 0;
  const canRedo = state.pointer < state.entries.length - 1;

  return {
    entries: state.entries,
    pointer: state.pointer,
    push,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
  };
}
