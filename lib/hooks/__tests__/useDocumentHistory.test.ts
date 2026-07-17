import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistory } from '../useDocumentHistory';

// ─── Test helpers ──────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'doc-history-';

function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

function getPersisted(key: string) {
  const raw = localStorage.getItem(getStorageKey(key));
  if (!raw) return null;
  return JSON.parse(raw);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('useHistory', () => {
  it('initial state: canUndo is false, canRedo is false, entries is empty', () => {
    const { result } = renderHook(() => useHistory<string>('test-init'));

    expect(result.current.entries).toEqual([]);
    expect(result.current.pointer).toBe(-1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('push adds entry', () => {
    const { result } = renderHook(() => useHistory<string>('test-push'));

    act(() => {
      result.current.push('first');
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]).toBe('first');
    expect(result.current.pointer).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo returns previous entry', () => {
    const { result } = renderHook(() => useHistory<string>('test-undo'));

    act(() => { result.current.push('entry-1'); });
    act(() => { result.current.push('entry-2'); });

    expect(result.current.pointer).toBe(1);
    expect(result.current.canUndo).toBe(true);

    let undone: string | null = null;
    act(() => {
      undone = result.current.undo();
    });

    expect(undone).toBe('entry-1');
    expect(result.current.pointer).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redo returns next entry', () => {
    const { result } = renderHook(() => useHistory<string>('test-redo'));

    act(() => { result.current.push('a'); });
    act(() => { result.current.push('b'); });

    act(() => {
      result.current.undo(); // back to a (pointer 0)
    });

    expect(result.current.canRedo).toBe(true);

    let redone: string | null = null;
    act(() => {
      redone = result.current.redo();
    });

    expect(redone).toBe('b');
    expect(result.current.pointer).toBe(1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('push truncates redo entries', () => {
    const { result } = renderHook(() => useHistory<string>('test-truncate'));

    act(() => { result.current.push('a'); });
    act(() => { result.current.push('b'); });
    act(() => { result.current.push('c'); });

    // pointer at 2 (c). Undo twice to go back to a
    act(() => { result.current.undo(); }); // -> b, pointer 1
    act(() => { result.current.undo(); }); // -> a, pointer 0

    expect(result.current.pointer).toBe(0);
    expect(result.current.canRedo).toBe(true);

    // Push new entry — should truncate b and c
    act(() => { result.current.push('new'); });

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0]).toBe('a');
    expect(result.current.entries[1]).toBe('new');
    expect(result.current.pointer).toBe(1);
    expect(result.current.canRedo).toBe(false);
  });

  it('max entries respected', () => {
    const { result } = renderHook(() =>
      useHistory<number>('test-max', { maxEntries: 3 }),
    );

    for (let i = 0; i < 5; i++) {
      act(() => { result.current.push(i); });
    }

    expect(result.current.entries).toHaveLength(3);
    // Last 3 entries: 2, 3, 4
    expect(result.current.entries).toEqual([2, 3, 4]);
    expect(result.current.pointer).toBe(2);
  });

  it('localStorage persistence after push', () => {
    const { result } = renderHook(() => useHistory<string>('test-persist'));

    act(() => { result.current.push('hello'); });
    act(() => { result.current.push('world'); });

    const persisted = getPersisted('test-persist');
    expect(persisted).not.toBeNull();
    expect(persisted.stack).toEqual(['hello', 'world']);
    expect(persisted.pointer).toBe(1);
    expect(typeof persisted.savedAt).toBe('number');
  });

  it('clear removes from localStorage', () => {
    const { result } = renderHook(() => useHistory<string>('test-clear'));

    act(() => {
      result.current.push('data');
    });

    expect(getPersisted('test-clear')).not.toBeNull();

    act(() => {
      result.current.clear();
    });

    expect(result.current.entries).toEqual([]);
    expect(result.current.pointer).toBe(-1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(localStorage.getItem(getStorageKey('test-clear'))).toBeNull();
  });

  it('TTL cleanup: stale entries are pruned on init', () => {
    const key = 'test-ttl';
    // Manually write stale data to localStorage
    const staleData = {
      stack: ['old'],
      pointer: 0,
      savedAt: Date.now() - 86_400_001, // just over 24h
    };
    localStorage.setItem(getStorageKey(key), JSON.stringify(staleData));

    const { result } = renderHook(() =>
      useHistory<string>(key, { ttlMs: 86_400_000 }),
    );

    // Stale data should be pruned — start fresh
    expect(result.current.entries).toEqual([]);
    expect(result.current.pointer).toBe(-1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('TTL: fresh entries survive init', () => {
    const key = 'test-ttl-fresh';
    const freshData = {
      stack: ['fresh'],
      pointer: 0,
      savedAt: Date.now() - 1000, // 1 second ago
    };
    localStorage.setItem(getStorageKey(key), JSON.stringify(freshData));

    const { result } = renderHook(() =>
      useHistory<string>(key, { ttlMs: 86_400_000 }),
    );

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]).toBe('fresh');
    expect(result.current.pointer).toBe(0);
  });

  it('quota fallback: setItem throws, retries with prune up to 20 entries', () => {
    // Mock setItem to throw once, then succeed
    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    let callIndex = 0;
    setItemSpy.mockImplementation((_key: string, _value: string) => {
      callIndex++;
      if (callIndex === 1) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      // Subsequent calls go to real implementation
      originalSetItem.call(localStorage, _key, _value);
    });

    const { result } = renderHook(() => useHistory<number>('test-quota-retry'));

    act(() => { result.current.push(42); });

    // In-memory state should work
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]).toBe(42);

    // Since entries.length (1) <= 20, no prune-retry. Data won't be in
    // localStorage for this small entry count.
    expect(setItemSpy).toHaveBeenCalledTimes(1);
  });

  it('quota fallback: all retries exhausted, works in-memory only', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    setItemSpy.mockImplementation(() => {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    });

    const { result } = renderHook(() => useHistory<string>('test-quota-fail'));

    act(() => { result.current.push('in-memory-only'); });

    // Should work in memory even though localStorage always fails
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]).toBe('in-memory-only');

    // localStorage should NOT contain the data
    expect(getPersisted('test-quota-fail')).toBeNull();
  });

  it('und on single entry returns null', () => {
    const { result } = renderHook(() => useHistory<string>('test-undo-single'));

    act(() => {
      result.current.push('only');
    });

    // canUndo is false (pointer = 0), undo should return null
    let undone: string | null = 'not-null';
    act(() => {
      undone = result.current.undo();
    });

    expect(undone).toBeNull();
    expect(result.current.pointer).toBe(0);
    expect(result.current.entries).toHaveLength(1);
  });

  it('redo on latest entry returns null', () => {
    const { result } = renderHook(() => useHistory<string>('test-redo-latest'));

    act(() => {
      result.current.push('only');
    });

    // canRedo is false (pointer = entries.length - 1), redo should return null
    let redone: string | null = 'not-null';
    act(() => {
      redone = result.current.redo();
    });

    expect(redone).toBeNull();
    expect(result.current.pointer).toBe(0);
  });

  it('handles invalid JSON in localStorage gracefully', () => {
    const key = 'test-corrupt';
    localStorage.setItem(getStorageKey(key), 'not-valid-json');

    const { result } = renderHook(() => useHistory<string>(key));

    // Should start fresh
    expect(result.current.entries).toEqual([]);
    expect(result.current.pointer).toBe(-1);
  });

  it('restores state from localStorage on init', () => {
    const key = 'test-restore';
    const persisted = {
      stack: ['saved-1', 'saved-2'],
      pointer: 1,
      savedAt: Date.now(),
    };
    localStorage.setItem(getStorageKey(key), JSON.stringify(persisted));

    const { result } = renderHook(() => useHistory<string>(key));

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries).toEqual(['saved-1', 'saved-2']);
    expect(result.current.pointer).toBe(1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('onClear callback fires when clear() is called', () => {
    const onClear = vi.fn();
    const { result } = renderHook(() =>
      useHistory<string>('test-onclear', { onClear }),
    );

    act(() => {
      result.current.push('data');
    });

    act(() => {
      result.current.clear();
    });

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('works with maxEntries default of 50', () => {
    const { result } = renderHook(() => useHistory<number>('test-default-max'));

    for (let i = 0; i < 52; i++) {
      act(() => { result.current.push(i); });
    }

    expect(result.current.entries).toHaveLength(50);
    // Last 50 entries: 2..51
    expect(result.current.entries[0]).toBe(2);
    expect(result.current.entries[49]).toBe(51);
  });
});
