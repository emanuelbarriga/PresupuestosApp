# Proposal: Fix Budget Date Handling — Add Year Support

## Intent

Budget type stores only `mesPresupuestado: Month` ("Enero", "Febrero"…) with no year.
Budgets spanning multiple years become indistinguishable — "Enero 2026" and "Enero 2027"
merge in the Dashboard matrix, producing incorrect aggregations.
Ejecucion is unaffected (has `fechaEjecutado: string`).

## Scope

### In Scope
- Add `fechaPresupuestado: string` (YYYY-MM) to the Budget type
- Fix Sidepanel form to persist year-month instead of discarding the year
- One-shot data migration to backfill existing budget docs
- Update existing tests to include the new field

### Out of Scope
- Year-aware Dashboard filtering or year selector — deferred
- Year-aware Datos filtering — deferred
- Changing Ejecucion date handling — no change needed

## Capabilities

### New Capabilities
- `budget-date`: Budgets store a sortable year-month field alongside display-only `mesPresupuestado`

### Modified Capabilities
None

## Approach

1. **types.ts**: Add `fechaPresupuestado: string` to `Budget` (required — migration guarantees coverage)
2. **Sidepanel.tsx**: `handleDateChange` extracts YYYY-MM from the date picker and stores it as `fechaPresupuestado`; `handleSubmit` keeps it instead of deleting `fechaEjecutado`; `mesPresupuestado` remains auto-derived for Dashboard compat
3. **Migration script**: Node script using Admin SDK or app Firebase to iterate all `companies/{companyId}/budgets` docs and `setDoc` with extracted YYYY-MM from budget `createdAt` timestamp (fallback: ask user to pick year per month)
4. **Tests**: Add `fechaPresupuestado` to `addBudget` test fixture

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/types.ts` | Modified | Add `fechaPresupuestado: string` to Budget |
| `components/Sidepanel.tsx` | Modified | `handleDateChange` stores YYYY-MM; `handleSubmit` keeps it |
| `scripts/migrate-budget-dates.ts` | New | Backfill `fechaPresupuestado` for existing docs |
| `lib/__tests__/firestore.test.ts` | Modified | Add field to `addBudget` fixture data |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migration misses some budget subcollections | Low | Iterate all companies with pagination |
| Dashboard backward-compat break | Low | `mesPresupuestado` stays populated — Dashboard unchanged |
| Old docs without field at runtime | Low | Migration runs before deploy; field required contracts clear intent |

## Rollback Plan

- **Code**: Revert the commit — 4 files, minimal diff
- **Data**: Migration is additive — extra field doesn't break existing queries
- **If migration fails mid-way**: Idempotent — re-running `setDoc` with same data is safe

## Success Criteria

- [ ] New budgets save `fechaPresupuestado: "2026-02"` in Firestore
- [ ] Migration backfills all existing budgets with correct YYYY-MM
- [ ] Dashboard displays correctly (no regression)
- [ ] All existing tests pass; fixture data includes the new field
- [ ] Editing a budget preserves its `fechaPresupuestado`
