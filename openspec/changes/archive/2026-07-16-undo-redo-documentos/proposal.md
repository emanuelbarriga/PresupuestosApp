# Proposal: Undo/Redo para Documentos

## Intent

Undo/redo en DocumentoSidepanel hoy es in-memory, solo captura OCR pre-fill, y se pierde al navegar entre docs. Agregar undo/redo persistente para TODAS las ediciones manuales + OCR con auto-capture debounced, stack de 50 entradas en localStorage.

## Scope

### In Scope
- `lib/hooks/useDocumentHistory.ts` — hook genérico `useHistory<T>` con stack + pointer, localStorage, cap 50, TTL cleanup (7 días)
- FormState extendido a 10 campos: tipoDocumento, periodo, fechaDocumento, terceroId, projectId, ejecucionIds, nit, proveedorTexto, montoTotal, descripcion
- Auto-capture debounced (800ms idle + onBlur) en cambios manuales
- Snapshot en OCR pre-fill (existentes, ahora via hook)
- Undo/redo buttons siempre visibles (hoy solo si hay history)
- Restore atómico: ejecucionIds + montoTotal se restauran juntos (skipping el useEffect que auto-actualiza)
- Restore desde localStorage al montar componente

### Out of Scope
- InboxTab batch operations, otras entidades, sync multi-tab, undo a nivel Firestore

## Capabilities

### New Capabilities
- `document-history`: Undo/redo history para edición de documentos en DocumentoSidepanel. Persistente por documento vía localStorage, auto-capturado en edición, snapshotted en OCR pre-fill.

### Modified Capabilities
- None

## Approach

1. **Hook**: `useHistory<T>(key, maxSize)` — `pushState`, `undo`, `redo`, `canUndo`, `canRedo`. Persiste a `doc-history-${docId}`. Cap 50. TTL pruning >7 días en init.
2. **FormState**: Agregar `periodo`, `terceroId`, `projectId`, `ejecucionIds` al type existente.
3. **Integración**: Reemplazar `useState<FormState[]> + historyIdx` por `useHistory<FormState>()`.
4. **Auto-capture**: `useEffect` con debounce 800ms en cambios + `onBlur` en inputs.
5. **OCR**: `pushState()` antes del pre-fill (mismo patrón actual, ahora persistente).
6. **Restore atómico**: En `applyState`, setear ejecucionIds + montoTotal en el mismo render; flag ref saltea el useEffect de auto-update durante restore.
7. **Mount**: Leer `doc-history-${doc.id}` de localStorage al montar.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/hooks/useDocumentHistory.ts` | New | Hook genérico undo/redo con localStorage |
| `DocumentoSidepanel.tsx` | Modified | FormState extendido, integración hook, auto-capture, restore atómico |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| localStorage quota | Low | 50 × ~1KB = ~50KB/doc; TTL cleanup |
| Race con useEffect en restore | Medium | Ref flag + seteo sincrónico en applyState |
| Quota exceeded en docs con mucha data | Low | catch + fallback a in-memory only |

## Rollback Plan

Revert `DocumentoSidepanel.tsx`, delete `useDocumentHistory.ts`. Keys `doc-history-*` en localStorage quedan huérfanas sin impacto.

## Dependencies

- None

## Success Criteria

- [ ] Undo revierte cambio manual (cualquier campo)
- [ ] Redo re-aplica el cambio revertido
- [ ] OCR pre-fill es undoable (persiste tras navegación)
- [ ] History sobrevive re-mount del componente
- [ ] ejecucionIds + montoTotal se restauran atómicamente
- [ ] Tests existentes pasan
