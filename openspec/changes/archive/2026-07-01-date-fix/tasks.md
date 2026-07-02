# Tasks: Fix Budget Date Handling — Add Year Support

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~85 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single-pr |
| Decision needed before apply | No |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Types + Sidepanel + Seed + Migration + Tests | single PR | All changes in one PR — well under 400 lines |

## Phase 1: Type & Test Fixtures (TDD cycle)

- [ ] 1.1 RED — Add `fechaPresupuestado: '2026-01'` to test fixture in `lib/__tests__/firestore.test.ts` (line 82, `addBudget` test data). Without the type field, this causes a TS error — confirms the test is checking the contract.
- [ ] 1.2 GREEN — Add `fechaPresupuestado: string` to `Budget` interface in `lib/types.ts` (after `mesPresupuestado`, line 43). Makes the fixture compile and pass.

## Phase 2: Sidepanel Date Handling

- [ ] 2.1 Add `set('fechaPresupuestado', parts[0] + '-' + parts[1])` in `handleDateChange` at `components/Sidepanel.tsx` line 77. Extracts YYYY-MM from the date picker alongside the existing `mesPresupuestado`.
- [ ] 2.2 Verify `handleSubmit` (line 85) keeps `fechaPresupuestado` — the existing `delete data.fechaEjecutado` only removes the full-date field, and `fechaPresupuestado` flows through the `{ ...fields }` spread untouched.

## Phase 3: Seed & Migration Scripts

- [ ] 3.1 Add `fechaPresupuestado` to each transaction in `scripts/seed.ts`. Derive year from ejecuciones' `fechaEjecutado` (YYYY), map `mesPresupuestado` (Spanish) to month number, format as YYYY-MM. Import `MONTHS` from `@/lib/types` for the month-index lookup.
- [ ] 3.2 Create `scripts/migrate-budget-dates.ts`: iterate all `companies/{companyId}/budgets` docs with pagination. If doc lacks `fechaPresupuestado`, derive YYYY-MM from `createdAt` Timestamp (fallback: assume current year + map `mesPresupuestado` to month number). Write with `docRef.set({ fechaPresupuestado }, { merge: true })`. Idempotent — skips already-populated docs on re-run.

## Phase 4: Verification

- [ ] 4.1 Run `npm test` — verify all tests pass (addBudget, addEjecucion, getCompanies, subscribeProviders).
- [ ] 4.2 Run `npx tsc --noEmit` — verify zero type errors.
- [ ] 4.3 Run `npm run lint` — verify no lint regressions.
