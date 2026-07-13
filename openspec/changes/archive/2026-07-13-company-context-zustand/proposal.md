# Proposal: Migrate CompanyContext from React Context to Zustand

## Intent

CompanyContext's React Context causes ALL consumers to re-render on every Firestore snapshot, even when the value they read hasn't changed. Migrating to Zustand with selector-based subscriptions eliminates unnecessary re-renders without changing the component tree. Pure performance refactor — zero behavior change.

## Scope

### In Scope
1. Install Zustand dependency
2. Create `stores/companyStore.ts` with selectors matching current context shape
3. Modify `CompanyProvider` to dual-write state to both context and store
4. Migrate `Sidebar.tsx` to store selectors (stops re-rendering on unrelated changes)
5. Migrate `InvitacionEntity.tsx` and `ColaboradorEntity.tsx`
6. Update test mocks to work with either approach
7. Run full test suite — all pass

### Out of Scope
- Removing CompanyContext entirely (Phase 3, deferred)
- Moving Firestore subscriptions into Zustand middleware
- Changing CompanyProviderWrapper or AuthContext
- Changes to `lib/types.ts`

## Capabilities

### New Capabilities
None — refactor only, no new spec-level behavior.

### Modified Capabilities
None — no requirements change at the spec level.

## Approach

Phase 1 (Additive — safe): `npm install zustand`, create `stores/companyStore.ts` with same shape as context value, modify `CompanyProvider` to sync state to the store after every update. No consumers change.

Phase 2 (Per-consumer): Each consumer migrates one-by-one from `useCompany()` to `useCompanyStore(s => s.xxx)` selectors. Selective subscription means components only re-render when their specific slice changes.

```
Firestore onSnapshot → CompanyProvider → React Context (backward compat)
                                        → Zustand Store (selective subs)
                                          → Sidebar, InvitacionEntity, ColaboradorEntity
```

Phase 3 (Future — out of scope): Remove CompanyContext, move subscription logic into the store.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | Add `zustand` dependency |
| `stores/companyStore.ts` | New | Zustand store with typed selectors |
| `context/CompanyContext.tsx` | Modified | Add sync to Zustand store after each state update |
| `components/Sidebar.tsx` | Modified | Use `useCompanyStore` selectors |
| `components/entities/invitacion/InvitacionEntity.tsx` | Modified | Use `useCompanyStore` selectors |
| `components/entities/colaborador/ColaboradorEntity.tsx` | Modified | Use `useCompanyStore` selectors |
| `context/__tests__/CompanyContext.test.tsx` | Modified | Test dual-write behavior |
| 3 smoke test files | Modified | Mock store alongside context |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Store out of sync with context | Low | Single update path in CompanyProvider writes both atomically |
| Broken test mocks | Medium | Dual-write lets existing mocks keep working; store tests added |
| npm install breakage | Low | Zustand 5.x is stable, no peer dep issues with React 19 |

## Rollback Plan

Phase 1 revert: `npm uninstall zustand`, revert `stores/` and `CompanyContext.tsx`.
Phase 2 revert: revert each consumer file individually.
All changes are additive — no rollback of data or schema.

## Dependencies

- `zustand` (npm)

## Success Criteria

- [ ] Zustand installed, store created with matching shape
- [ ] CompanyProvider syncs to store after every state update
- [ ] Sidebar reads from store with selector (no full re-render)
- [ ] All 587+ tests pass with no regressions
- [ ] `npm test` and `npx tsc --noEmit` pass cleanly
