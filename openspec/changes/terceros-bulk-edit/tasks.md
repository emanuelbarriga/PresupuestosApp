# Tasks: Terceros Bulk Edit

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~390 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation + panel + Datos wiring + tests | Single PR | Self-contained feature; all test coverage included |

## Phase 1: Foundation

- [ ] 1.1 Add `{ type: 'bulk-edit-tercero'; selectedIds: string[] }` variant to `NavScreen` union in `lib/types.ts`
- [ ] 1.2 Add `batchUpdateTerceros(ids, data): Promise<{ successCount, failedIds }>` in `lib/firestore.ts` using `Promise.allSettled` over existing `updateTercero`
- [ ] 1.3 Add `screen.type === 'bulk-edit-tercero'` branch in `Sidepanel.tsx` renderContent to dispatch `BulkEditTerceroPanel`

## Phase 2: Core Components

- [ ] 2.1 Create `BulkEditTerceroPanel.tsx` with 4 optional fields (tipo select, naturaleza select, lugar text, archivado toggle), empty-payload guard ("No hay cambios"), save → `batchUpdateTerceros`, toast feedback
- [ ] 2.2 Add `selectedTerceros: Set<string>` state and checkbox column to the Terceros `<thead>`/`<tbody>` in `Datos.tsx` (line ~1254)
- [ ] 2.3 Add floating action bar in `Datos.tsx` with selection count ("N seleccionados") + "Editar en lote" button → fires `onNavigate({ type: 'bulk-edit-tercero', selectedIds })`

## Phase 3: Testing

- [ ] 3.1 Write tests for `batchUpdateTerceros`: all-succeed returns `{ successCount: N, failedIds: [] }`, partial-failure returns `{ successCount, failedIds }`
- [ ] 3.2 Write tests for `BulkEditTerceroPanel`: renders 4 fields empty, submit without changes blocked (toast), submit with changes calls `batchUpdateTerceros`
- [ ] 3.3 Write tests for `Datos.tsx`: checkbox toggles selection, action bar visibility on select/deselect, "Editar en lote" fires correct NavScreen
- [ ] 3.4 Run `npm test` + `npx tsc --noEmit`, fix regressions

## Decision Required

~390 estimated lines is at the 400-line review budget boundary. I recommend a **single PR** since each component is tightly coupled. Confirm before apply — if you prefer to chain, I'll split into 2 stacked PRs (foundation → UI).
