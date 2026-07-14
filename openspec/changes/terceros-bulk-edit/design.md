# Design: Terceros Bulk Edit

## Technical Approach

Add a `Set<string>` selection state in `Datos.tsx` for the Terceros table. Each row gets a checkbox column; when ≥1 row is selected, a floating action bar appears with an "Editar en lote" button. Clicking it opens the Sidepanel with a new `BulkEditTerceroPanel` component via a dedicated `NavScreen` variant. On submit, `batchUpdateTerceros(ids, partialData)` runs `Promise.allSettled` against Firestore. Toast shows success/failure counts; failed IDs remain selected.

## Architecture Decisions

### Decision: NavScreen variant vs. EntityType extension

| Option | Tradeoff |
|--------|----------|
| Add `'bulk-edit-tercero'` to `EntityType` | Payload contract (`EntityProps`) expects a single `record` — wrong shape |
| New NavScreen variant `{ type: 'bulk-edit-tercero', selectedIds }` | **Chosen** — clean separation, no type gymnastics, matches proposal spec |

**Rationale**: Bulk edit carries a `Set<string>` of IDs, not a single record. Forcing it into the `EntityType` pipeline would require optional fields or type narrowing. A dedicated variant in the `NavScreen` union (same pattern as `'customize'` and `'entity-list'`) keeps the contract explicit and the routing trivial.

### Decision: Partial field model with "inherit" defaults

**Choice**: Each form field starts as `undefined` / empty string. Only fields the user explicitly changes are included in the Firestore update payload.
**Alternatives considered**: Pre-fill with current values from the first selected tercero (misleading — users assume all have that value). Pre-fill with common values across all selected (complex, edge-case heavy). Submit-or-skip tri-state per field (UX overhead).
**Rationale**: "Inherit" (unchanged) is the safest default for batch operations. Fields are independent: changing `tipo` does not reset `lugar`. The empty-payload check (`No hay cambios`) prevents useless writes.

### Decision: `batchUpdateTerceros` returns summary, not raw promises

**Choice**: `batchUpdateTerceros(ids, data)` returns `{ successCount: number, failedIds: string[] }`.
**Alternatives considered**: Return raw `PromiseSettledResult[]`. Throw on any failure.
**Rationale**: The caller (BulkEditTerceroPanel) needs concrete numbers for the toast and a filtered list of IDs to retain in selection. Raw promise results require mapping; throwing loses partial success info. This contract is designed for the single use case and avoids over-engineering.

### Decision: Action bar is a DOM sibling, not an overlay

**Choice**: Render the action bar between the filter bar and the table when selection is non-empty, inside the same card container.
**Rationale**: Matches the existing layout hierarchy (filter bar → action bar → table → pagination). Avoids z-index issues with sticky overlays. The bar uses fixed positioning relative to the table card, not `position: fixed` viewport overlay.

## Data Flow

```
Datos.tsx (activeTab === 'Terceros')
  │
  ├── Checkbox column: toggle t.id in Set<string>
  │
  ├── Action bar: appears if set.size >= 1
  │     └── "Editar en lote" → navigate({ type: 'bulk-edit-tercero', selectedIds: [...set] })
  │
  └── Sidepanel receives NavScreen
        └── renderContent() → screen.type === 'bulk-edit-tercero'
              └── BulkEditTerceroPanel
                    ├── Renders 4 fields (tipo, naturaleza, lugar, archivado)
                    │   └── All start undefined/"inherit"
                    ├── "Guardar" →
                    │     batchUpdateTerceros(selectedIds, partialData)
                    │     └── Promise.allSettled(selectedIds.map(id => updateTercero(id, data)))
                    │
                    ├── Toast: "N actualizados" | "X actualizados, Y fallaron"
                    └── onClose(clearIds?: string[]) → Datos removes successful IDs from selection
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/types.ts` | Modify | Add `{ type: 'bulk-edit-tercero'; selectedIds: string[] }` to `NavScreen` union |
| `lib/firestore.ts` | Modify | Add `batchUpdateTerceros(ids, data): Promise<{ successCount, failedIds }>` |
| `components/Datos.tsx` | Modify | Add `selectedTerceros` state, checkbox column in Terceros table (line ~1254), action bar rendering, `navigate` call on "Editar en lote" |
| `components/Sidepanel.tsx` | Modify | Add `screen.type === 'bulk-edit-tercero'` branch in `renderContent()` |
| `components/entities/tercero/BulkEditTerceroPanel.tsx` | Create | Sidepanel form with 4 optional fields, save button, toast feedback |
| `components/__tests__/Datos.test.tsx` | Modify | Add test coverage for selection, action bar rendering |
| `components/entities/tercero/BulkEditTerceroPanel.test.tsx` | Create | Unit tests for form rendering, empty-payload guard, save success/failure |

## Interfaces / Contracts

```typescript
// lib/types.ts — new NavScreen variant
export type NavScreen =
  // ... existing variants ...
  | { type: 'bulk-edit-tercero'; selectedIds: string[] };

// lib/firestore.ts — new batch update function
export async function batchUpdateTerceros(
  ids: string[],
  data: Record<string, any>,  // only explicitly-set fields
): Promise<{ successCount: number; failedIds: string[] }>;

// components/entities/tercero/BulkEditTerceroPanel.tsx
interface BulkEditTerceroPanelProps {
  selectedIds: string[];
  onClose: (failedIds?: string[]) => void;
  companyId: string;
}
```

The `bulk-edit-tercero` route never needs `onBack` or `canGoBack` — it's a modal action that returns directly to the Datos view. The `onClose` callback optionally receives failed IDs so Datos can update its selection state (keep failures, remove successes).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `batchUpdateTerceros` | Mock `updateDoc`, test all-succeed and partial-failure (mock rejects). Verify returned `{ successCount, failedIds }` |
| Unit | `BulkEditTerceroPanel` form | Render all 4 fields, verify empty value defaults. Submit without changes → toast "No hay cambios". Submit with changes → calls `batchUpdateTerceros` with filtered payload |
| Unit | Datos checkbox+action bar | Render Datos with terceros, click checkbox → action bar appears. Deselect → bar disappears. Click "Editar en lote" → verifies `onNavigate` called with correct NavScreen |
| Unit | Empty payload guard | Submit with all fields at default → no Firestore call, toast shown |
| Integration | Sidepanel routing | Send NavScreen `{ type: 'bulk-edit-tercero', selectedIds: ['a','b'] }` → BulkEditTerceroPanel mounts |

## Migration / Rollout

No migration required. Ad-hoc Firestore `updateDoc` calls — no schema change, no data migration.

## Open Questions

None.
