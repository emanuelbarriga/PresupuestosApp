# Tasks: Data Date Validation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~174 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full implementation | PR 1 | Single PR — under 400 lines, no chaining needed |

## Phase 1: Foundation

- [ ] 1.1 Run `npm install zod` to add the dependency to `package.json`
- [ ] 1.2 Create `lib/schemas.ts` with `yearMonthSchema` (regex `YYYY-MM`), `dateStringSchema` (regex `YYYY-MM-DD`), `budgetSchema`, and `ejecucionSchema` (using `.partial()` for updates)

## Phase 2: Testing

- [ ] 2.1 Create `lib/__tests__/schemas.test.ts` covering the full test matrix from the design doc: valid objects, empty strings, invalid months/days, malformed separators, truncated values, optional field omission, partial updates, null on optionals

## Phase 3: Core Validation Layer

- [ ] 3.1 Add `budgetSchema.parse(data)` / `ejecucionSchema.parse(data)` before writes in `lib/firestore.ts` — `addBudget` (~L330), `updateBudget` (~L389), `addEjecucion` (~L341), `updateEjecucion` (~L393). Catch and throw `ZodError` with context.

## Phase 4: Form Integration

- [ ] 4.1 In `BudgetForm.tsx` (~L212): import schemas, `.parse()` before `onFormSubmit(entry)`, catch `ZodError` → `toast.error()` with first error message
- [ ] 4.2 In `EjecucionForm.tsx` (~L245): same pattern — parse before `onFormSubmit`, catch ZodError → toast
- [ ] 4.3 In `ConvertirMovimientosEntity.tsx` (~L125): parse the constructed object with `ejecucionSchema` before calling `addEjecucion`, catch and re-throw with context

## Phase 5: Verification

- [ ] 5.1 Run `npx tsc --noEmit` — must pass with zero new errors
- [ ] 5.2 Run `npm test` — all existing + new tests pass (no regressions)
