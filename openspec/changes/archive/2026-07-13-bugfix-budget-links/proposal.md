# Proposal: Bugfix Budget Links

## Intent

Fix 4 bugs in the N:M budget-ejecucion relationship (budgetLinks): ghost amounts on delete, orphan ejecuciones in bank conversion flow, non-reactive budget view, missing tolerance validation. Add a one-shot reconciliation script for existing inflated budget data.

## Scope

### In Scope
- Fix `deleteEjecucion` to decrement `totalEjecutado` and remove `linkedEjecuciones` entry
- Add budget selector to `ConvertirMovimientosEntity` conversion flow
- Fix `subscribeEjecucionesByBudget` to use reactive collectionGroup query
- Add tolerance validation guard in `EjecucionForm.handleSubmit`
- Create `scripts/reconciliar-budget-links.ts` one-shot script

### Out of Scope
- Migration of old `budgetId` field (complete)
- Denormalized field staleness beyond delete (accepted tradeoff)

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `cuenta-bancaria-ejecucion`: Conversion flow (ConvertirMovimientosEntity) SHALL offer budget selection and create budgetLinks when auto-creating ejecuciones from bank movements

## Approach

Four isolated single-file fixes + one utility script.

**Bug 1** (`lib/firestore.ts:1109-1116`): In `deleteEjecucion`, iterate linksSnap docs, for each read budgetId/monto, add `batch.update(budgetRef, { totalEjecutado: increment(-monto), linkedEjecuciones: arrayRemove({...}) })` before deleting link + ejecucion docs.

**Bug 2** (`components/entities/convertir-movimientos/ConvertirMovimientosEntity.tsx`): Add `SearchableSelect` budget picker, store selected budgetId, call `addBudgetLink()` after each ejecucion creation. Needs budget list subscription.

**Bug 3** (`lib/firestore.ts:512-540`): Switch to `collectionGroup('budgetLinks').where('budgetId','==',budgetId).where('companyId','==',companyId)` — reactive and uses existing index. Add anti-race-condition guard.

**Bug 4** (`components/entities/ejecucion/EjecucionForm.tsx:167-248`): Guard clause in handleSubmit: early return with toast.error if `|montoEjecutado - sum(links.monto)| > 1`.

**Reconciliation** (`scripts/reconciliar-budget-links.ts`): For each company+budget, query `collectionGroup('budgetLinks')`, sum real montos, update budget doc via Firestore transaction.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/firestore.ts` | Modified | deleteEjecucion decrements denormalized fields; subscribeEjecucionesByBudget switches to reactive collectionGroup query |
| `components/entities/ejecucion/EjecucionForm.tsx` | Modified | handleSubmit validates budgetLinks sum against montoEjecutado |
| `components/entities/convertir-movimientos/ConvertirMovimientosEntity.tsx` | Modified | Adds budget selector + budgetLink creation after conversion |
| `scripts/reconciliar-budget-links.ts` | New | One-shot reconciliation for existing corrupted budget data |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Reconciliation script writes stale data during concurrent edits | Medium | Firestore transactions with retry |
| Bug 3 race condition: callback fires after unsubscribe | Low | isSubscribed flag guard in onSnapshot callback |

## Rollback Plan

Per-bug revert: each fix is a single-file change — revert the affected function. Bug 2: revert ConvertirMovimientosEntity if budget selection causes regression. Reconciliation script is idempotent and safe to re-run.

## Dependencies

None.

## Success Criteria

- [ ] Deleting an ejecucion decrements totalEjecutado and removes linkedEjecuciones entry
- [ ] Bank-to-ejecucion conversion creates budgetLinks via budget selector
- [ ] Budget view updates in real-time without page refresh
- [ ] Form rejects submit when |montoEjecutado - sum(links.monto)| > 1
- [ ] Reconciliation script leaves budgets matching actual link sums
