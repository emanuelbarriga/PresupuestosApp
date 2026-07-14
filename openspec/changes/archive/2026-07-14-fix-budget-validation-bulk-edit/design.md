# Design: Fix Budget Validation & Bulk Edit

## Technical Approach

### Part 1 — BudgetForm validation fix

`BudgetFields` interface omits `estadoProyecto` but `budgetSchema.parse()` requires it. Fix: add `estadoProyecto: string` to the interface, initialize with `'Activo'` in both edit and add modes, and in `handleSubmit` set `entry.estadoProyecto = fields.estadoProyecto || 'Activo'` before calling `budgetSchema.parse()`.

### Part 2 — Extend BulkEditPresupuestosPanel

Add 5 editable fields alongside the existing `entityId`/`entityName`:
- `descripcion`: `<input type="text">` — reuses the same pattern as `FormInput` (label + input, no separate component import needed)
- `montoPresupuestado`: `<input type="text" inputMode="numeric">` with `formatThousands`/`unformatThousands` + `montoEditing` focus state (identical to BudgetForm)
- `projectId`/`projectName`: `SearchableSelect` loaded via `subscribeProjects(companyId, setProjects)` in a `useEffect` — returns `Unsubscribe` for cleanup
- `tipo`: `TipoSwitch` — starts with value `''` (neither selected, shown in default slate style); included in payload only when `!== ''`
- `archivado`: cycle button — cycles `null → true → false → null` on each click; included only when `!== null`

### Part 3 — Extend BulkEditEjecucionesPanel

Same pattern as Part 2, using `montoEjecutado` instead of `montoPresupuestado`.

## Architecture Decisions

| Option | Tradeoffs | Decision |
|--------|-----------|----------|
| Tristate as `<select>` vs. cycle button | Select is explicit but bulky in a 360px panel | Cycle button — compact, matches panel density |
| `subscribeProjects` vs. one-time `getProjects` | Subscription keeps data fresh but needs cleanup | Subscription via `useEffect` return — data may change while panel is open |
| Monto focus/blur formatting | User sees formatted display by default, raw number while editing | Reuse BudgetForm's `montoEditing` pattern exactly |
| TipoSwitch empty init | TipoSwitch has no neutral state; passing `''` renders both buttons unselected | Acceptable for "no change" — UI is clear, buildPayload omits it |

## Data Flow

```
BulkEditPresupuestosPanel
  │
  ├─ useEffect → subscribeProjects(companyId, setProjects)
  │               → returns Unsubscribe (cleanup on unmount)
  │
  ├─ User edits any field → local state updates
  │
  ├─ handleSave → buildPayload() filters out defaults
  │               → batchUpdatePresupuestos(companyId, ids, payload)
  │               → partialBudgetSchema.parse(payload) in firestore.ts
  │               → Promise.allSettled per doc
  │
  └─ onClose → parent refreshes list
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `components/entities/budget/BudgetForm.tsx` | Modify | Add `estadoProyecto` to BudgetFields + default in handleSubmit |
| `components/entities/presupuesto/BulkEditPresupuestosPanel.tsx` | Modify | Add 5 field states + inputs + project subscription + extend buildPayload |
| `components/entities/ejecucion/BulkEditEjecucionesPanel.tsx` | Modify | Same pattern with `montoEjecutado` field name |

## Interfaces / Contracts

`buildPayload()` contract (both panels):

```typescript
interface BulkEditPayload {
  entityId?: string;            // existing — included if !== ''
  entityName?: string;          // existing — paired with entityId
  descripcion?: string;         // new — included if !== ''
  montoPresupuestado?: number;  // new — converted from string, included if !== ''
  projectId?: string;           // new — included if projectId !== ''
  projectName?: string;         // new — paired with projectId
  tipo?: string;                // new — included if !== ''
  archivado?: boolean;          // new — included if !== null
}
```

`subscribeProjects` API (unchanged — already exists in `@/lib/firestore`):

```
subscribeProjects(companyId: string, onData: (Project[]) => void, onError?: (Error) => void): Unsubscribe
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `buildPayload()` default-omit per field | Manual verification for now (out of scope per proposal) |
| Integration | `batchUpdatePresupuestos` / `batchUpdateEjecuciones` with new fields | Already covered in `lib/__tests__/` — no changes needed |
| Regression | BudgetForm save path | `npm test` must pass — existing suite covers schema validation |

## Migration / Rollout

No migration required. Batch writes use `partialBudgetSchema`/`partialEjecucionSchema` (already accept all new fields via `.partial()`). Rollback: `git revert` per file.

## Open Questions

None — all decisions are mapped in the proposal and spec.
