# Design: Bugfix Budget Links

## Technical Approach

Four isolated single-file fixes + one reconciliation script. Each fix addresses a distinct failure in the N:M budget↔ejecucion relationship without refactoring the existing data model or touching unrelated code.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Bug 1 — deleteEjecucion decrement | Read links first, then batch all writes | Atomic transaction | writeBatch is already used; reads must happen before batch because batch operations can't depend on document reads. The proposal's approach is the only safe path. |
| Bug 2 — conversion flow budget link | `addBudgetLink()` after each `addEjecucion` | Pass `_budgetLinks` through page.tsx writeBatch | `addEjecucion` is a simple `addDoc` — no batch. Calling `addBudgetLink()` post-creation reuses the existing atomic denormalization pattern. Tradeoff: not atomic (two calls), but consistent with `removeBudgetLink` pattern. |
| Bug 3 — reactive budget view | `collectionGroup('budgetLinks')` onSnapshot + `fetchDocsByIds` | subscribe to each ejecucion individually | collectionGroup matches existing composite index (`companyId`, `budgetId`). Triggers on link changes. Individual ejecucion subscriptions would be N listeners — too heavy. |
| Bug 4 — tolerance validation | Guard clause in `handleSubmit` before loop | Prevent form submission at UI level | Catches mismatch client-side before any writes. Existing sum display (lines 346-357) is informational only — no enforcement. |
| Reconciliation script | One-shot, Firestore transactions per budget | N/A — data repair, not a feature | Transactions protect against concurrent edits during sum vs. update window. Idempotent — safe to re-run. |

## Data Flow

### Bug 1 — deleteEjecucion (current vs. fixed)

```
CURRENT:  linksSnap → batch.delete(links) + batch.delete(ejecucion) → commit
          [BUDGET denormalized fields NEVER updated — GHOST amounts remain]

FIXED:    linksSnap → read budgetId/monto from each link →
          batch.delete(links) + batch.delete(ejecucion) +
          batch.update(budget, { totalEjecutado: increment(-monto),
                                 linkedEjecuciones: arrayRemove({ejecucionId, monto}) })
          → commit
```

### Bug 2 — ConvertirMovimientosEntity

```
ConvertirMovimientosEntity
  └─ subscribeBudgets(companyId) → [Budget]
  └─ SearchableSelect "Presupuesto" → selectedBudgetId
  └─ handleConvertir()
       └─ loop movimientos:
            ├─ ejecucionId = addEjecucion(...)
            ├─ if selectedBudgetId:
            │    └─ addBudgetLink(companyId, ejecucionId, {companyId, selectedBudgetId, monto})
            └─ updateMovimiento(...)
```

### Bug 3 — subscribeEjecucionesByBudget

```
BEFORE:  onSnapshot(budgetRef) → fetchDocsByIds(ejecuciones)  [indirect, stale on ejecucion edits]

AFTER:   onSnapshot(collectionGroup('budgetLinks'),
                      where('budgetId','==',budgetId),
                      where('companyId','==',companyId))
           → extract ejecucionIds → fetchDocsByIds(ejecuciones) → onData()
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/firestore.ts:deleteEjecucion` | Modify | Read link docs, batch-update budget denormalized fields before deleting |
| `lib/firestore.ts:subscribeEjecucionesByBudget` | Modify | Replace budgetDoc onSnapshot with collectionGroup('budgetLinks') onSnapshot + isSubscribed guard |
| `components/entities/convertir-movimientos/ConvertirMovimientosEntity.tsx` | Modify | Add `subscribeBudgets`, `SearchableSelect` for budget, call `addBudgetLink` after each `addEjecucion` |
| `components/entities/ejecucion/EjecucionForm.tsx:handleSubmit` | Modify | Guard clause: if `\|montoEjecutado - sum(selectedBudgetLinks.monto)\| > 1`, toast.error + return |
| `scripts/reconciliar-budget-links.ts` | Create | One-shot: for each company+budget, collectionGroup sum → transaction update budget doc |

## Interfaces / Contracts

No new types or interfaces. `EjecucionBudgetLink` (line 113 in `types.ts`) is sufficient.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | budget sum validation logic | Extract as pure function: `validateBudgetLinkSum(montoEjecutado, links) → boolean` |
| Integration | `deleteEjecucion` denormalization | Create ejecucion with links, delete, verify budget `totalEjecutado` and `linkedEjecuciones` |
| Manual | Conversion flow budget linking | Convert movements with budget selected → verify budgetLink doc created + budget denormalized fields updated |
| Manual | Budget view reactivity | Add/remove budgetLink from another tab → budget view updates without page refresh |

## Migration / Rollout

1. Deploy reconciliation script first (safe, read-only sum check before write)
2. Run `scripts/reconciliar-budget-links.ts` against production to fix existing corrupted budgets
3. Deploy all 4 bugfixes together in a single PR (each is < 30 lines changed, low risk)
4. Rollback: revert the whole PR; reconciliation is re-runnable

## Open Questions

- [ ] For Bug 3: `fetchDocsByIds` inside `onSnapshot` is still a one-time `getDocs` per callback — do we also need ejecucion-level reactivity? Current tradeoff: link reactivity is solved, but an ejecucion's `montoEjecutado` changing wouldn't re-render until a link changes. Acceptable?
