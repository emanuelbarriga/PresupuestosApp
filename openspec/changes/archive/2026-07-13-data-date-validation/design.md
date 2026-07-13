# Design: Data Date Validation

## Technical Approach

Add Zod schemas as a validation boundary at the write layer. Schemas mirror existing TypeScript types exactly (`YYYY-MM` for `fechaPresupuestado`, `YYYY-MM-DD` for `fechaEjecutado`). Validation fires at two levels: (1) in `firestore.ts` before every write, and (2) in forms before calling `onFormSubmit`. This creates defense in depth — Firestore catches missed callers, forms provide instant feedback.

## Architecture Decisions

| Decision | Options | Tradeoff | Chosen |
|----------|---------|----------|--------|
| Date validation strategy | Zod regex vs date-fns/isValid vs manual | date-fns adds 4KB; regex captures format AND value in one rule | **Zod `.regex()`** — zero dependencies, validates shape + range in one pass |
| Update schema shape | `.partial()` vs `.pick()` | `partial()` allows any field; `pick()` is stricter but must be maintained | **`.partial()`** — matches `Partial<Budget>/Partial<Ejecucion>` type signature used by callers |
| Validation layer | Firestore-only vs form-only vs both | Firestore catches everything but errors are opaque (ZodError thrown). Forms catch early but miss callers | **Both** — forms for UX, Firestore as safety net |
| Error handling in forms | Try/catch inline vs wrapper helper | Inline is simpler; wrapper is DRYer but adds indirection for 2 forms | **Inline try/catch** — only 2 forms affected, keeps diff local |

## Data Flow

```
User Submit → BudgetForm/EjecucionForm
  │
  ├── budgetSchema.parse(data) ──→ ZodError? → toast.error() + return
  │
  └── onFormSubmit(data) → firestore.ts
                              │
                              ├── budgetSchema.parse(data) ──→ ZodError? → throws (last resort)
                              │
                              └── addDoc/updateDoc → Firestore
```

```
ConvertirMovimientosEntity
  │
  └── ejecucionSchema.parse({...}) ──→ ZodError? → catch, re-throw (not shown to user)
       │
       └── addEjecucion(companyId, {...})
```

## Edge Case Handling

| Case | Schema Behavior |
|------|----------------|
| `fechaPresupuestado: ""` | Fails `yearMonthSchema.regex()` — empty string doesn't match pattern |
| `fechaEjecutado: ""` | Same — fails `dateStringSchema.regex()` |
| `fechaPresupuestado: "2024-13"` | Fails — month group `(0[1-9]\|1[0-2])` only allows 01-12 |
| `fechaEjecutado: "2024-02-30"` | Fails — day group `(0[1-9]\|[12]\d\|3[01])` rejects 30 in Feb (no calendar awareness — acceptable tradeoff, see Open Questions) |
| `fechaEjecutado: "2024-00-01"` | Fails — month 00 not in valid range |
| `mesPresupuestado: "InvalidMes"` | Fails — `z.enum()` only allows the 12 Spanish month strings |
| `entityType: ""` | Passes — `z.enum(['client', 'provider', 'interno', ''])` explicitly includes empty string |
| Optional fields omitted (e.g. `archivado`) | Passes — all optional fields use `.optional()` |
| `extraFields` in `addEjecucion` | Not validated — passed outside the schema, appended to the doc |

## Test Matrix

| Test | Input | Expected |
|------|-------|----------|
| Valid budget | Full Budget object with `fechaPresupuestado: "2026-03"` | passes |
| Valid ejecucion | Full Ejecucion with `fechaEjecutado: "2026-03-15"` | passes |
| Empty fechaPresupuestado | `""` | fails |
| Empty fechaEjecutado | `""` | fails |
| Invalid month YYYY-MM | `"2026-13"` | fails |
| Invalid month zero | `"2026-00"` | fails |
| Invalid day | `"2026-01-32"` | fails |
| Day zero | `"2026-01-00"` | fails |
| Malformed separator | `"2026/03/15"` | fails |
| Truncated | `"2026-03"` for dateString | fails |
| Optional field omitted | No `archivado` | passes |
| Empty string in mesPresupuestado | `""` | fails (enum) |
| Partial update (valid) | `{ descripcion: "new" }` | passes `.partial()` |
| Partial update (invalid date) | `{ fechaEjecutado: "bad" }` | fails `.partial()` |
| Null on optional field | `{ archivado: null }` | passes (zod treats null as valid for optional without `.nullable()`) |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/schemas.ts` | Create | Zod schemas: `yearMonthSchema`, `dateStringSchema`, `budgetSchema`, `ejecucionSchema` |
| `lib/__tests__/schemas.test.ts` | Create | ~20 tests covering valid/invalid/edge cases |
| `lib/firestore.ts` | Modify | Add `.parse()` at top of `addBudget` (L330), `addEjecucion` (L341), `updateBudget` (L389), `updateEjecucion` (L393) |
| `components/entities/budget/BudgetForm.tsx` | Modify | Wrap `await onFormSubmit(entry)` at L212 in try/catch with ZodError → toast |
| `components/entities/ejecucion/EjecucionForm.tsx` | Modify | Same wrap around `await onFormSubmit(entry)` at L245 |
| `components/entities/convertir-movimientos/ConvertirMovimientosEntity.tsx` | Modify | Parse `ejecucionSchema` on the object at L125 before calling `addEjecucion` |
| `package.json` | Modify | Add `"zod": "^3.24.0"` to dependencies |

## Migration / Rollout

No migration required. Existing data is unchanged. Validation only rejects data that would have been rejected by manual parsing anyway (empty strings, malformed dates). The existing manual parsing code remains as-is — Zod is additive.

Rollback: `git revert <hash>` + `npm uninstall zod`.

## Open Questions

- [ ] **Feb 29 / calendar validity**: the regex `(0[1-9]|[12]\d|3[01])` allows Feb 30 and Feb 31. Full calendar-aware validation would require `date-fns` or similar. Acceptable for now since the app is human-entered data and the `<input type="date">` browser control already restricts valid calendar dates — this regex catches format-level issues and extreme cases (day 0, day 32).
