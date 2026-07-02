# Archive Report: date-fix

**Archived**: 2026-07-01
**Change**: date-fix — Fix Budget Date Handling / Add Year Support

## Summary

The `date-fix` change added year support to Budget documents so budgets spanning multiple years ("Enero 2026" vs "Enero 2027") are distinguishable. Previously, `mesPresupuestado: Month` stored only a Spanish month name with no year context.

## What Was Done

| File | Action | Description |
|------|--------|-------------|
| `lib/types.ts` | Modified | Added `fechaPresupuestado: string` to `Budget` interface (required, YYYY-MM format) |
| `components/Sidepanel.tsx` | Modified | `handleDateChange` extracts YYYY-MM from date picker; `handleSubmit` preserves `fechaPresupuestado` (only deletes `fechaEjecutado` for budgets) |
| `scripts/seed.ts` | Modified | All 8 seed transactions include `fechaPresupuestado` derived from month + year |
| `scripts/migrate-budget-dates.ts` | Created | One-shot migration: iterates all `companies/{cid}/budgets` docs, derives YYYY-MM from `createdAt` (fallback: current year), idempotent via `{merge: true}` |
| `lib/__tests__/firestore.test.ts` | Modified | Added `fechaPresupuestado: '2026-01'` to `addBudget` test fixture |

## Design Decisions Followed

| Decision | Outcome |
|----------|---------|
| `fechaPresupuestado` required in type contract | ✅ Implemented as `string` (not optional) |
| Zero changes to `addBudget`/`updateBudget` | ✅ New field flows through `Partial<Budget>` spread |
| Migration uses firebase-admin SDK | ✅ Same pattern as `seed.ts` |
| Sidepanel deletes only `fechaEjecutado` for budgets | ✅ `fechaPresupuestado` survives submit |

## Backward Compatibility

`mesPresupuestado` is kept fully populated — Dashboard and Datos views continue working unchanged. No regression in existing views.

## Verification Result

**PASS WITH WARNINGS** — All 9 tasks complete. All 13 tests pass. TypeScript compiles with zero errors. No new lint regressions.

### Spec Compliance

- **2/9 scenarios**: ✅ Test-covered (test fixture + full suite pass)
- **7/9 scenarios**: ⚠️ Verified via source inspection (no covering tests for Sidepanel date handling or migration logic)

### Warnings (Pre-existing / Out of Scope)
1. Seed writes to `transactions` collection instead of `budgets` — seed data is not usable for dev budget testing
2. No unit tests for Sidepanel `handleDateChange` or form submit
3. No unit tests for migration `deriveFechaPresupuestado` function
4. Lint: 14 pre-existing errors in `Datos.tsx` / `use-mobile.ts`

## Engram Artifact References

| Artifact | Observation ID |
|----------|---------------|
| Proposal | #48 |
| Spec | #49 |
| Design | #50 |
| Tasks | #51 |
| Apply Progress | #52 |
| Verify Report | #54 |
| Archive Report (this) | #55 |

## Main Spec Updated

- **Created**: `openspec/specs/budget-date/spec.md` — new main spec for Budget Date domain, derived from delta spec

## Remaining Work (Out of Scope for This Change)

| # | Item | Priority | Notes |
|---|------|----------|-------|
| 1 | Year-aware Dashboard filtering / year selector | Medium | Deferred at proposal time. Dashboard currently lumps all months together across years |
| 2 | Year-aware Datos filtering | Low | Deferred at proposal time |
| 3 | Add `fechaPresupuestado` to BudgetView display (Sidepanel) | Low | Currently only shows `mesPresupuestado`; adding year display gives users visibility |
| 4 | Fix seed collection name (`transactions` → `budgets`) | Medium | Pre-existing bug; seed doesn't produce usable budget data for development |
| 5 | Unit tests for Sidepanel date handling | Medium | Extract `handleDateChange` to pure function for independent testing |
| 6 | Unit tests for `deriveFechaPresupuestado` in migration | Low | Pure function, easily testable without Firestore mocks |
