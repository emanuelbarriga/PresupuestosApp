# Design: Fix Budget Date Handling — Add Year Support

## Technical Approach

Add `fechaPresupuestado: string` (YYYY-MM) to the `Budget` type and persist it from the Sidepanel date picker alongside the existing `mesPresupuestado`. Migration backfills existing docs. All existing tests stay green — no Dashboard/Datos regression because they never read the new field.

Referenced specs: `openspec/changes/date-fix/spec.md` — 4 requirements (Budget type, Sidepanel, migration, test fixtures).

## Architecture Decisions

### Decision: Make `fechaPresupuestado` required in the type contract

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **Required `string`** | TS strict catches omissions in new code; runtime `subscribeBudgets` cast may produce `undefined` for old docs, but nothing reads the field yet | ✅ Chosen |
| `string \| undefined` | Weakens the contract — every consumer would need null checks for a field that migration guarantees | ❌ Rejected |

**Rationale**: `subscribeBudgets` uses `as Budget` — a TS-level cast with zero runtime enforcement. Making it required communicates intent: all budgets SHOULD have this value. The migration guarantees coverage, and the spec already states "missing field SHALL NOT crash".

### Decision: `addBudget` and `updateBudget` need zero changes

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **No-op** | Both spread `Partial<Budget>` — new field flows through automatically | ✅ Chosen |
| Touch them | Adds diff noise, increases 400-line review budget | ❌ Rejected |

### Decision: Migration uses firebase-admin SDK (same pattern as `seed.ts`)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **firebase-admin `setDoc` merge** | Already a dependency, same pattern as seed, runs server-side | ✅ Chosen |
| App-level Firestore client | Requires auth, harder to run as one-shot script | ❌ Rejected |

## Data Flow

```
DatePicker (Sidepanel)
    │  value="2026-02-15" (HTML date input)
    ▼
handleDateChange(date)
    ├── set('fechaEjecutado', "2026-02-15")         ← unchanged (used by ejecuciones)
    ├── set('mesPresupuestado', "Febrero")           ← unchanged (Dashboard relies on it)
    └── set('fechaPresupuestado', "2026-02")         ← NEW: YYYY-MM from parts[0]+"-"+parts[1]
    │
    ▼
handleSubmit()
    ├── data = { ...fields }                         ← fechaPresupuestado inside
    ├── delete data.fechaEjecutado                   ← unchanged (budgets don't need full date)
    └── fechaPresupuestado survives deletion          ← KEY FIX: was being deleted indirectly
    │
    ▼
addBudget/updateBudget → spread into Firestore doc   ← no code changes needed
```

### Migration flow

```
migrate-budget-dates.ts
    │
    ├── companies.forEach(async) →
    │     │
    │     └── budgets.get() →
    │           │
    │           └── budget doc
    │                 ├── has fechaPresupuestado? → SKIP
    │                 ├── has createdAt? → extract YYYY-MM from Timestamp
    │                 └── no createdAt? → map mesPresupuestado to number, use current year
    │
    └── doc.ref.set({ fechaPresupuestado }, { merge: true })  ← idempotent
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/types.ts` | Modify | Add `fechaPresupuestado: string` to `Budget` interface (line 36) |
| `components/Sidepanel.tsx` | Modify | `handleDateChange` stores YYYY-MM (lines 73-78); `handleSubmit` keeps `fechaPresupuestado` (line 85) |
| `scripts/migrate-budget-dates.ts` | Create | One-shot migration: iterates all companies/budgets, backfills `fechaPresupuestado` |
| `lib/__tests__/firestore.test.ts` | Modify | Add `fechaPresupuestado: '2026-01'` to `addBudget` fixture (line 82) |
| `scripts/seed.ts` | Modify | Add `fechaPresupuestado` to each transaction in seed data (derived from month + ejecuciones year) |

## Interfaces / Contracts

```typescript
// lib/types.ts — Budget interface
export interface Budget {
  id: string;
  descripcion: string;
  proyectoAsignado: string;
  clienteOProveedor: string;
  tipo: TransactionType;
  montoPresupuestado: number;
  mesPresupuestado: Month;
  fechaPresupuestado: string;   // ← NEW: "YYYY-MM" format
  estadoProyecto: ProjectState;
}
```

No new interfaces or API contracts. Migration script uses existing firebase-admin patterns.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `addBudget` fixture includes `fechaPresupuestado` | Add field to test data, verify path construction still works |
| Integration | Migration script logic (dry-run) | Manual — Vitest mocks Firestore, so real migration runs against production or emulator |
| Regression | `npm test` passes | All existing tests (getCompanies, addEjecucion, subscribeProviders) must remain green |

The `handleDateChange` and `handleSubmit` Sidepanel changes are verified by the existing e2e flow — no unit tests exist for Sidepanel internals currently.

## Migration / Rollout

1. **Deploy code**: Merge PR with types, Sidepanel, seed, and test changes
2. **Run migration**: `npx tsx scripts/migrate-budget-dates.ts` against production Firestore
3. **Verify**: Spot-check a few budget docs in Firestore console for `fechaPresupuestado`
4. **Rollback**: Revert the commit (code) + migration is additive (data safe to keep)

## Open Questions

None.
