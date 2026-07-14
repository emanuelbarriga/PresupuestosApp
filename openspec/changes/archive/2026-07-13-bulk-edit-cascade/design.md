# Design: Bulk Edit & Cascade

## Technical Approach

Reuse the exact tercero bulk-edit pattern for Presupuestos and Ejecuciones: checkbox selection → `Set<string>` state → floating action bar → Sidepanel routing to a dedicated `BulkEdit*Panel` component → `Promise.allSettled` batch update → toast feedback.

Cascade uses a `WriteBatch`-based helper that queries budgets+ejecuciones by `entityId` and sets `entityName` in a single commit, called from `updateTercero` / `batchUpdateTerceros` when `name` is in the payload.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `updateTercero` signature: add `companyId` param | Breaking change to existing API; caller (page.tsx) already has companyId | **Accept**. Cascade cannot query per-company subcollections without it. |
| Cascade: collectionGroup vs per-company query | collectionGroup needs composite index + no companyId knowledge; per-company needs companyId param | **Per-company query**. Matches spec, no index setup, same pattern as all other budget/ejecucion reads. |
| Cascade tolerance when >500 docs | Limit 500 (WriteBatch cap) vs chunk into multiple batches | **Log warning + update first 500**. 500 linked docs exceeds any real-world usage for this app. |
| Budget single `tipo` schema: "ambos" not valid | Spec lists "ambos" as select option but `Budget.tipo` is `'ingreso' \| 'egreso'` only | **Omit "ambos"**. Validated by `partialBudgetSchema` — "ambos" would crash on write. Only offer ingreso/egreso. |

## Component Tree

```
Datos.tsx
├── (Presupuestos table — add checkbox column + floating bar)
│   └── Sidepanel
│       └── BulkEditPresupuestosPanel (new)
├── (Ejecuciones table — add checkbox column + floating bar)
│   └── Sidepanel
│       └── BulkEditEjecucionesPanel (new)
└── (Terceros table — existing)
    └── Sidepanel
        └── BulkEditTerceroPanel (existing — cascade logic only)
```

## Data Flow

```
Row checkbox click
  → toggle local Set<string> state (selectedBudgets | selectedEjecuciones)
  → floating bar appears (count + "Editar en lote")
  → "Editar en lote" → onNavigate({ type, selectedIds: [...set] })
  → Sidepanel.renderContent() matches type → mounts BulkEdit*Panel
  → User fills fields (all default "Sin cambios")
  → "Guardar" → buildPayload() → batchUpdate*(ids, data) → Promise.allSettled
  → toast success/failure → onClose(failedIds?) → Sidepanel closes → selection cleared

Cascade (name change):
  updateTercero(id, { name, ... }, companyId) or
  batchUpdateTerceros(ids, { name, ... }, companyId)
    → after each successful updateDoc where name in payload
      → cascadeTerceroName(companyId, terceroId, name)
        → query companies/{companyId}/budgets where entityId == terceroId
        → query companies/{companyId}/ejecuciones where entityId == terceroId
        → WriteBatch: update each match with { entityName: name }
        → batch.commit()
```

## NavScreen Types

Add two union variants to the existing `NavScreen` type (line 307 in `lib/types.ts`):

```typescript
export type NavScreen =
  | { type: 'entity'; entity: EntityType; mode: 'create' | 'edit' | 'view'; ... }
  | { type: 'entity-list'; data: SidepanelData }
  | { type: 'customize'; id?: string }
  | { id: string; type: 'view'; detail: { type: 'detalle-tercero'; ... } }
  | { type: 'bulk-edit-tercero'; selectedIds: string[] }
  | { type: 'bulk-edit-presupuesto'; selectedIds: string[] }      // NEW
  | { type: 'bulk-edit-ejecucion'; selectedIds: string[] };        // NEW
```

## Cascade Helper — Algorithm

```
function cascadeTerceroName(companyId, terceroId, newName):
  // 1. Query linked budgets
  budgetsQuery = query(
    collection(db, "companies", companyId, "budgets"),
    where("entityId", "==", terceroId)
  )
  budgetSnapshots = await getDocs(budgetsQuery)

  // 2. Query linked ejecuciones
  ejecucionesQuery = query(
    collection(db, "companies", companyId, "ejecuciones"),
    where("entityId", "==", terceroId)
  )
  ejecucionSnapshots = await getDocs(ejecucionesQuery)

  // 3. Build WriteBatch
  totalOps = budgetSnapshots.size + ejecucionSnapshots.size
  if totalOps > 500:
    console.warn(`cascadeTerceroName: ${totalOps} docs > 500, truncating to first 500`)

  batch = writeBatch(db)
  batchSize = min(totalOps, 500)
  allDocs = [...budgetSnapshots.docs, ...ejecucionSnapshots.docs].slice(0, batchSize)

  for docSnapshot of allDocs:
    batch.update(docSnapshot.ref, { entityName: newName })

  await batch.commit()
```

## Firestore Functions

### `batchUpdatePresupuestos(companyId, ids, data)` — NEW
- Validates via `partialBudgetSchema.parse(data)`
- Maps `ids` → `updateBudget(companyId, id, data)` in parallel
- Uses `Promise.allSettled`, returns `{ successCount, failedIds }`
- Pattern identical to `batchUpdateTerceros`

### `batchUpdateEjecuciones(companyId, ids, data)` — NEW
- Validates via `partialEjecucionSchema.parse(data)`
- Maps `ids` → `updateEjecucion(companyId, id, data)` in parallel
- Uses `Promise.allSettled`, returns `{ successCount, failedIds }`
- Pattern identical to `batchUpdateTerceros`

### `updateTercero(terceroId, data, companyId?)` — MODIFIED
- Add optional `companyId` param
- After `updateDoc` succeeds, if `data.name` exists and `companyId` is provided:
  `await cascadeTerceroName(companyId, terceroId, data.name)`

### `batchUpdateTerceros(ids, data, companyId?)` — MODIFIED
- Add optional `companyId` param
- Pass `companyId` to each `updateTercero` call (it's a no-op in the existing update, but used for cascade)
- After `Promise.allSettled`, if `data.name` exists and `companyId` is provided:
  - Collect successful IDs
  - `await Promise.allSettled(successfulIds.map(id => cascadeTerceroName(companyId, id, data.name)))`

### `cascadeTerceroName(companyId, terceroId, newName)` — NEW
- Pure function, no return value
- Algorithm per section above

## File Map

| File | Action | Description |
|------|--------|-------------|
| `components/entities/presupuesto/BulkEditPresupuestosPanel.tsx` | **Create** | Mirror `BulkEditTerceroPanel`. Fields: tipo (ingreso/egreso — no "ambos"), descripcion (text), archivado (tristate). Calls `batchUpdatePresupuestos` on save. |
| `components/entities/ejecucion/BulkEditEjecucionesPanel.tsx` | **Create** | Mirror `BulkEditTerceroPanel`. Fields: tipo (ingreso/egreso), descripcion (text), archivado (tristate). Calls `batchUpdateEjecuciones` on save. |
| `lib/firestore.ts` | **Modify** | Add `batchUpdatePresupuestos`, `batchUpdateEjecuciones`, `cascadeTerceroName`. Modify `updateTercero` (add companyId, cascade). Modify `batchUpdateTerceros` (add companyId, cascade). |
| `lib/types.ts` | **Modify** | Add two NavScreen variants: `bulk-edit-presupuesto` and `bulk-edit-ejecucion` |
| `components/Sidepanel.tsx` | **Modify** | Add two `if (screen.type === ...)` blocks before the default route, importing the new panels. |
| `components/Datos.tsx` | **Modify** | Add `selectedBudgets` and `selectedEjecuciones` state (`Set<string>`). Add toggle/handleSelectAll handlers per pattern. Add floating action bar per tab section. Add checkbox column to each table `<thead>` and `<tbody>`. Wire `onNavigate` for the two new screen types. |

## Existing Caller Impact

### `app/[company]/[[...segments]]/page.tsx` (line 535)
- Current: `await updateTercero(form.record.id, data);`
- Change: `await updateTercero(form.record.id, data, companyId);`
- CompanyId is already in scope (line 1 of the file via URL param).

## Fields Validation

- **BulkEditPresupuestosPanel**: `partialBudgetSchema` allows `descripcion`, `tipo` (`'ingreso'|'egreso'`), `archivado`. Text fields and tristate archivado pass through directly.
- **BulkEditEjecucionesPanel**: `partialEjecucionSchema` allows `descripcion`, `tipo` (`'ingreso'|'egreso'`), `archivado`. Same pattern.
- Both schemas use `.partial()` so any subset of fields is valid — the "Sin cambios" default (empty string / null) maps to omitting the field from `buildPayload()`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `batchUpdatePresupuestos`, `batchUpdateEjecuciones` | Mock `updateBudget`/`updateEjecucion`, test `Promise.allSettled` success/failure/partial, test schema validation rejects bad data. |
| Unit | `cascadeTerceroName` | Mock `getDocs` + `writeBatch`, verify query filters, verify batch.update calls, verify >500 warning log. |
| Unit | `updateTercero` (modified) | Mock `updateDoc` + `cascadeTerceroName`, confirm cascade called only when `name` in payload and `companyId` provided. |
| Unit | `batchUpdateTerceros` (modified) | Same — test cascade fires only for successful IDs when name in payload. |
| Integration | BulkEditPresupuestosPanel | Mock `batchUpdatePresupuestos`, test "Sin cambios" guard, save flow, toast messages, `onClose` call. |
| Integration | BulkEditEjecucionesPanel | Same pattern as above. |
| Integration | Datos checkbox + bar | Render with budgets/ejecuciones, click checkbox, verify bar appears, verify `onNavigate` called with correct type and IDs. |

## Migration / Rollout

No data migration. Cascade writes are plain `updateDoc` calls — no schema change. Adding `companyId` to function signatures is source-compatible (optional param with default undefined, no-op when absent).

## Open Questions

- [ ] **None.**
