# Document History Specification

> Capability: `document-history` · Created: 2026-07-16 · Source: `undo-redo-documentos`

## Purpose

Persistent undo/redo history for DocumentoSidepanel's classification form. History is stored per-document in localStorage, auto-captured on manual edits and OCR pre-fill, and survives component re-mount and navigation between documents.

## Requirements

### Requirement: History Persistence — localStorage Per Document

The system MUST persist undo/redo history to localStorage under key `doc-history-${docId}`. Each entry SHALL be a full snapshot of all 10 editable form fields. History MUST survive component unmount and re-mount.

#### Scenario: Persists across navigation

- GIVEN a document with existing edit history
- WHEN navigating away and back to the same document
- THEN the full history stack and pointer position restore from localStorage

#### Scenario: Documents have independent histories

- GIVEN edits on documents A and B
- WHEN switching between them
- THEN each history is isolated under its own `doc-history-${docId}` key

### Requirement: Generic Hook with Size and TTL Limits

The hook `useHistory<T>(key, options?)` MUST accept `{ maxEntries?: number; ttlMs?: number }` with defaults maxEntries=50 and ttlMs=86,400,000 (24h). On init, entries older than ttlMs MUST be pruned. Returns `{ entries, pointer, push, undo, redo, canUndo, canRedo, clear }`.

#### Scenario: Max 50 entries enforced

- GIVEN history with 50 entries
- WHEN a 51st is pushed
- THEN the oldest entry is removed before pushing the new one

#### Scenario: Stale entries cleaned on init

- GIVEN history with entries older than 24h
- WHEN the hook initializes
- THEN stale entries are pruned; remaining entries are valid

### Requirement: Extended FormState — 10 Fields

The FormState type MUST capture tipoDocumento, periodo, fechaDocumento, terceroId, projectId, ejecucionIds, nit, proveedorTexto, montoTotal, and descripcion.

#### Scenario: Snapshot includes all fields

- GIVEN any form state
- WHEN a snapshot is captured
- THEN all 10 fields are present with current values

### Requirement: Auto-Capture on Change and Blur

The system MUST capture a history entry 800ms after the last change (debounced) AND on blur of any input. Captures MUST skip if state is identical to the last entry.

#### Scenario: Debounced capture after idle

- GIVEN a user typing in any field
- WHEN 800ms pass without further changes
- THEN a new entry is pushed to history

#### Scenario: Capture on blur

- GIVEN a focused input
- WHEN it loses focus
- THEN a history entry captures immediately (no debounce wait)

#### Scenario: No duplicate for unchanged state

- GIVEN a field changed and captured
- WHEN the same value triggers blur
- THEN only one entry exists for that change (no duplicate)

#### Scenario: Initial snapshot on mount

- GIVEN a document opens
- WHEN the component mounts
- THEN the initial form state is captured as the first history entry

### Requirement: Atomic Restore of ejecucionIds + montoTotal

When restoring a history entry, ejecucionIds and montoTotal MUST set synchronously in the same render cycle. The useEffect that derives montoTotal from ejecucionIds MUST NOT overwrite during restore.

#### Scenario: Undo restores both atomically

- GIVEN state where ejecucionIds has one value and montoTotal its match
- WHEN undo triggers
- THEN both fields restore together without the useEffect overwriting montoTotal

### Requirement: Keyboard Shortcuts

Ctrl+Z MUST trigger undo. Ctrl+Shift+Z MUST trigger redo. Shortcuts MUST only fire while the sidepanel is mounted.

#### Scenario: Ctrl+Z triggers undo

- GIVEN history with undoable entries
- WHEN Ctrl+Z is pressed
- THEN undo executes and form reverts

#### Scenario: Ctrl+Shift+Z triggers redo

- GIVEN a previous undo was performed
- WHEN Ctrl+Shift+Z is pressed
- THEN redo executes and form advances

### Requirement: localStorage Quota Handling

If `setItem` throws QuotaExceededError, the hook MUST prune oldest entries and retry. If still failing, fall back to in-memory-only mode for that session.

#### Scenario: Quota exceeded triggers prune

- GIVEN localStorage near capacity
- WHEN pushing a new entry
- THEN oldest entries prune until the write succeeds or falls back to in-memory

### Requirement: UI Button Integration

Undo/Redo buttons MUST render when history has more than 1 entry. Each MUST disable when its action cannot execute.

#### Scenario: Buttons hidden for single entry

- GIVEN only the initial snapshot exists
- THEN undo/redo buttons do not render

#### Scenario: Disabled state per direction

- GIVEN user has undone to the earliest entry
- THEN undo button is disabled, redo is enabled
- WHEN user redos to the latest entry
- THEN undo is enabled, redo is disabled
