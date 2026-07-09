# Proposal: Critical Technical Debt Fixes

## Intent

Eliminate three classes of known technical debt — cross-tenant data leaks, duplicated inline logic, and legacy browser dialogs — using infrastructure already present in the codebase.

## Scope

### In Scope
- **H4**: Replace `subscribeSettings()` calls with `subscribeCompanySettings(companyId)` in `FormPanel.tsx` and `ProjectView.tsx`
- **H5**: Replace 4 inline `.reduce()` group-by blocks with `groupByEntity` utility; replace manual entity badges with `EntityTypeBadge`
- **H6**: Replace 11 `alert()`/`confirm()`/`prompt()` calls with `react-hot-toast` equivalents in `Configuracion.tsx` and `Datos.tsx`

### Out of Scope
- Other cross-tenant data leaks in the codebase (separate change)
- Renaming or refactoring `subscribeSettings` itself (may be deleted later)
- Adding tests for the toast replacements (pure substitution)
- H5 test updates for `groupByEntity` (utility already has tests)

## Capabilities

### New Capabilities
None — pure refactoring, no new user-facing behavior.

### Modified Capabilities
None — no spec-level behavior changes.

## Approach

### H4 — Multi-tenancy in settings (CRITICAL)
1. In `FormPanel.tsx` (~L540), import `useCompany` from company context, pass `companyId` to `subscribeCompanySettings()`
2. In `ProjectView.tsx` (~L21), same pattern: get `companyId` from `useCompany()`, call `subscribeCompanySettings(companyId)`
3. Remove `subscribeSettings()` imports from both files

### H5 — groupByEntity utility not used (MEDIUM)
1. Import `groupByEntity` from `components/utils/groupByEntity.ts` in `DataPanel.tsx` and `ProjectView.tsx`
2. Import `EntityTypeBadge` from its module
3. Replace 4 inline `.reduce()` calls with `groupByEntity(data, key)`
4. Replace manual badge JSX with `<EntityTypeBadge />`
5. Delete unused inline reduce blocks

### H6 — Native dialogs still in use (LOW-MEDIUM)
1. Replace `alert('msg')` → `toast('msg')` or `toast.error('msg')`
2. Replace `confirm('msg')` with async pattern: `await new Promise(resolve => { toast(t => <ConfirmToast resolve={resolve} />) })` — or use `toast.promise` where applicable
3. Replace `prompt('msg')` with a custom modal component or `toast` input pattern
4. Handle return values: wrap in async functions where callers expect a boolean/string

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/Sidepanel/FormPanel.tsx` | Modified | Replace `subscribeSettings` with `subscribeCompanySettings` |
| `src/components/ProjectView.tsx` | Modified | Same as above + H5 (reduce → groupByEntity) |
| `src/components/Datos.tsx` | Modified | H6: native dialogs → toast |
| `src/components/Configuracion.tsx` | Modified | H6: native dialogs → toast |
| `src/components/DataPanel.tsx` | Modified | H5: reduce → groupByEntity |
| `components/utils/groupByEntity.ts` | Referenced | Already exists, no changes |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| H4: companyId not available in scope at call sites | Low | Both components likely have access via `useCompany()` hook (already used elsewhere) |
| H5: utility signature mismatch | Low | Verify `groupByEntity` accepts same args as inline reduce; check return type |
| H6: async confirm/prompt patterns need custom toast components | Medium | Create lightweight `<ToastConfirm>` in shared components; fallback to simple `toast.error` for alerts |

## Rollback Plan

Revert via git — each fix is a separate file. Revert `FormPanel.tsx` and `ProjectView.tsx` first (H4 is critical). If needed, individual files can be reverted independently since changes are isolated.

## Dependencies

None — the three fixes are independent and can be done in parallel.

## Success Criteria

- [ ] No calls to `subscribeSettings()` remain in components (only `subscribeCompanySettings(companyId)`)
- [ ] No inline `.reduce()` entity-grouping code duplicates `groupByEntity`
- [ ] Zero `alert()`/`confirm()`/`prompt()` calls in `Configuracion.tsx` and `Datos.tsx`
- [ ] All existing tests still pass (`npm test`)
- [ ] TypeScript compiles cleanly (`npx tsc --noEmit`)
