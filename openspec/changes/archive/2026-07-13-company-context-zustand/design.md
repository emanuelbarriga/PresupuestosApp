# Design: Migrate CompanyContext from React Context to Zustand

## Technical Approach

Additive dual-write: create a Zustand store alongside the existing React Context, sync state from `CompanyProvider` to the store after every update (Phase 1), then migrate consumers one-by-one to selector-based subscriptions (Phase 2). Context persists as source-of-truth — **Phase 3 (full removal)** is deferred. Pure refactor, zero behavior change.

## Architecture Decisions

### Dual-write vs Rewrite Provider

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Rewrite Provider to use store internally | Touches all 306 lines, high risk of breaking membership guard + routing | ❌ |
| Dual-write: context updates → sync to store | ~15 lines added, zero behavior change, context remains source of truth | ✅ |
| Replace context entirely | Requires moving Firestore subscriptions into the store — deferred to Phase 3 | ❌ out of scope |

**Rationale**: The 306-line provider has nested guards, route-based branching, and Firestore lifecycle — too risky to rewrite in one pass. Dual-write adds ~15 lines: `useCompanyStore.getState().setXxx(data)` after each `setXxx(data)`.

### Test mock strategy

| Option | Tradeoff | Decision |
|--------|----------|----------|
| A: `__mocks__/stores/companyStore.ts` | Need both store mock + context mock for non-migrated consumers | ❌ |
| B: Keep mocking `useCompany` from context | All 5 existing test files mock `@/context/CompanyContext`; context still exists, mocks keep working | ✅ |

## Data Flow

```
Firestore onSnapshot
        │
        ▼
  CompanyProvider
        │
        ├──→ React Context (backward compat — Phase 3 deferred)
        │
        └──→ Zustand Store (selective subscriptions)
                ├──→ Sidebar (4 selectors)
                ├──→ InvitacionEntity (2 selectors)
                └──→ ColaboradorEntity (1 selector)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `zustand` |
| `stores/companyStore.ts` | Create | Zustand store: typed state + actions matching context shape |
| `context/CompanyContext.tsx` | Modify | Import store; dual-write after every `setXxx` call (both render paths: company route + public route) |
| `components/Sidebar.tsx` | Modify | Replace `useCompany()` destructure with 4 individual store selectors |
| `components/entities/invitacion/InvitacionEntity.tsx` | Modify | Same — `useCompanyStore(s => s.companies)` and `useCompanyStore(s => s.selectedCompany)` |
| `components/entities/colaborador/ColaboradorEntity.tsx` | Modify | `const allCompanies = useCompanyStore(s => s.companies)` |
| `context/__tests__/CompanyContext.test.tsx` | Modify | Add assertion: after `emitData()`, store state matches context state |

**Not migrated**: `CompaniaEntity.tsx` (doesn't import `useCompany`), `Sidepanel.tsx` (indirect consumer via entities, mocks context).

## Store Contract (stores/companyStore.ts)

State: `selectedCompany`, `companies`, `userRole`, `mode`, `isConjunto`, `roleLoading`. Actions mirror context handlers: `setSelectedCompany`, `setCompanies`, `setUserRole`, `setMode`, `setRoleLoading`, `setCompany(id)`, `setModeWithFallback(mode)`.

**Dual-write**: every `useState` setter in `CompanyProvider` is followed by `useCompanyStore.getState().setXxx(...)`. Both return paths (company route and public route) synced.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Store actions | Plain assertions via `useCompanyStore.getState()` |
| Integration | Provider syncs to store | In `CompanyContext.test.tsx`, assert `useCompanyStore.getState().companies` after `emitData()` |
| Existing tests | No regressions | 5 existing test files mock `@/context/CompanyContext` — context still exists, mocks keep working |

**Mock changes**: After consumers migrate, the 3 entity smoke tests (`ColaboradorEntity`, `InvitacionEntity`, `CompaniaEntity`) will have dead `vi.mock('@/context/CompanyContext')` calls. These can be removed to validate the migration works.

## Migration / Rollout

No migration required. Store starts empty and populates on context sync. Rollback per proposal: revert individual consumer files (Phase 2) or all changes (Phase 1).

## Risk Assessment

| Phase | Risk | Likelihood | Mitigation |
|-------|------|------------|------------|
| 1 | Store out of sync with context | Low | Single update path writes both atomically |
| 1 | Missed dual-write on public-route path | Low | Both provider branches have context values — check both |
| 2 | Wrong selector causes stale read | Low | Selectors match exact context shape; diff review catches |
| 2 | Sidebar loses `userRole` for admin features | Low | Sidebar reads 4 values — all must be migrated together |
| 2 | Smoke tests fail after dead mock removal | Med | Remove mocks step-by-step, run tests after each removal |

## Open Questions

None.

## Per-Consumer Migration Plan

| Consumer | Current reads | New selectors |
|----------|--------------|---------------|
| `Sidebar` | `selectedCompany`, `companies`, `setCompany`, `userRole` | 4 individual `useCompanyStore(s => s.xxx)` calls |
| `InvitacionEntity` | `companies`, `selectedCompany` | 2 selectors |
| `ColaboradorEntity` | `companies` (aliased `allCompanies`) | `useCompanyStore(s => s.companies)` |

## Build Order

1. `npm install zustand`
2. Create `stores/companyStore.ts` — pure store, no context dependency
3. Modify `CompanyContext.tsx` — import store + dual-write in both render paths
4. Migrate `Sidebar.tsx` → store selectors
5. Migrate `InvitacionEntity.tsx` → store selectors
6. Migrate `ColaboradorEntity.tsx` → store selector
7. Remove dead context mocks from 3 smoke test files
8. `npm test` + `npx tsc --noEmit` — all pass
