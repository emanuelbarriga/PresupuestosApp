# Tasks: Bugfix Budget Links

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~120–180 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR (all 4 bugfixes + script, each < 30 lines) |
| Delivery strategy | ask-always |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Foundation

- [x] 1.1 Extract `validateBudgetLinkSum(montoEjecutado, links) → boolean` as pure function in `lib/validation.ts`
- [x] 1.2 [RED] Skipped per user instruction (NO TDD mode)
- [x] 1.3 [GREEN] Import and use `validateBudgetLinkSum` in `EjecucionForm.handleSubmit`: guard clause with `toast.error` + early return if diff > 1

## Phase 2: Bug 1 — deleteEjecucion denormalization

- [x] 2.1 [RED] Skipped per user instruction (NO TDD mode)
- [x] 2.2 [GREEN] Modify `deleteEjecucion` in `lib/firestore.ts`: read link docs → batch-update budget (`increment(-monto)` + `arrayRemove`) → delete link + ejecucion docs

## Phase 3: Bug 2 — Conversion flow budget selector

- [x] 3.1 [RED] Skipped per user instruction (NO TDD mode)
- [x] 3.2 [GREEN] Add `subscribeBudgets` subscription + `SearchableSelect` budget picker in `ConvertirMovimientosEntity.tsx`
- [x] 3.3 [GREEN] Call `addBudgetLink(companyId, ejecucionId, {companyId, budgetId, monto})` after each `addEjecucion` in `handleConvertir`

## Phase 4: Bug 3 — Reactive budget view

- [x] 4.1 [RED] Skipped per user instruction (NO TDD mode)
- [x] 4.2 [GREEN] Replace budgetDoc `onSnapshot` with `collectionGroup('budgetLinks').where('budgetId','==',budgetId).where('companyId','==',companyId)` in `subscribeEjecucionesByBudget`
- [x] 4.3 [GREEN] Add `isSubscribed` flag guard in `onSnapshot` callback to prevent stale invocations after unsubscribe

## Phase 5: Reconciliation script

- [x] 5.1 Create `scripts/reconciliar-budget-links.ts`: iterate companies→budgets, `collectionGroup('budgetLinks')` sum per budget, Firestore transaction to update `totalEjecutado` + `linkedEjecuciones`

## Phase 6: Verification

- [x] 6.1 Run `npx vitest` — 531/531 tests pass (51 test files)
- [x] 6.2 Run `npx tsc --noEmit` — no new type errors (5 pre-existing errors unchanged)
- [x] 6.3 Run `npm run lint` — no new lint errors (all pre-existing, no-console in scripts is expected)
