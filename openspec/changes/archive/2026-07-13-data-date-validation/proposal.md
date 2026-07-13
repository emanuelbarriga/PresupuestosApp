# Proposal: Data Date Validation

## Intent

Budget and Ejecucion date fields enter as raw strings from `<input type="date">` and get manually parsed with duplicated string-splitting logic. No runtime validation exists — empty strings, malformed dates, or wrong formats can reach Firestore undetected. This change adds Zod schemas at the write boundary to catch invalid data before it persists.

## Scope

### In Scope
1. `npm install zod`
2. `lib/schemas.ts` — Zod schemas: `dateString` (YYYY-MM-DD), `yearMonthString` (YYYY-MM), `budgetSchema`, `ejecucionSchema`
3. `firestore.ts` — `.parse()` before `addBudget`, `updateBudget`, `addEjecucion`, `updateEjecucion`. Throw `ZodError` on invalid.
4. `BudgetForm.tsx` — catch ZodError on submit, show error toast
5. `EjecucionForm.tsx` — same
6. `ConvertirMovimientosEntity.tsx` — parse before `addEjecucion` call
7. `lib/__tests__/schemas.test.ts` — tests for valid inputs, invalid dates, empty strings, edge cases

### Out of Scope
- Converting dates to Firestore Timestamps (they stay as strings)
- Zod on every form (only Budget + Ejecucion have date-sensitive fields)
- Zod on scripts (data from trusted sources)
- Removing existing manual date parsing (validation is additive)
- Other entity schemas (MovimientoBancario, Extracto, Comprobante)

## Capabilities

> Pure refactor — no spec-level behavior changes.

### New Capabilities
None

### Modified Capabilities
None

## Approach

Create focused Zod schemas and validate at the write boundary. Additive — existing manual parsing stays, Zod acts as a safety net.

```
lib/schemas.ts → dateString, yearMonthString, budgetSchema, ejecucionSchema
firestore.ts   → budgetSchema.parse() in add/updateBudget, ejecucionSchema.parse() in add/updateEjecucion
Forms          → try/catch ZodError → toast.error()
```

Schemas match existing formats exactly (`YYYY-MM` for `fechaPresupuestado`, `YYYY-MM-DD` for `fechaEjecutado`). Optional fields stay optional via `.optional()`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/schemas.ts` | New | Zod schemas for Budget, Ejecucion, date helpers |
| `lib/__tests__/schemas.test.ts` | New | Tests for all schemas |
| `lib/firestore.ts` | Modified | `.parse()` before write in 4 functions |
| `components/entities/budget/BudgetForm.tsx` | Modified | Catch ZodError → toast |
| `components/entities/ejecucion/EjecucionForm.tsx` | Modified | Same |
| `components/entities/convertir-movimientos/ConvertirMovimientosEntity.tsx` | Modified | Parse before addEjecucion |
| `package.json` | Modified | Add zod dependency |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| ZodError on existing valid data | Low | Schemas match current formats exactly |
| Breaking form submit flow | Low | Errors caught + shown as toast, same as other form errors |
| Scope creep | Medium | Locked to Budget + Ejecucion only |

## Rollback

```bash
git revert <commit-hash>
npm uninstall zod
```

## Dependencies

- `zod` (npm install)

## Success Criteria

- [ ] `npm test` passes (existing + new tests, no regressions)
- [ ] `budgetSchema` rejects empty `fechaPresupuestado`, `ejecucionSchema` rejects empty `fechaEjecutado`
- [ ] Forms show toast on invalid date submission
- [ ] Null/undefined optional fields pass validation
- [ ] `tsc --noEmit` passes with zero new errors
