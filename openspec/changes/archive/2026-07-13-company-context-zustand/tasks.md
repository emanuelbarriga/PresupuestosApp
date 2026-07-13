# Tasks: Migrate CompanyContext from React Context to Zustand

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~80 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Foundation

- [x] 1.1 Install Zustand: `npm install zustand` in project root
- [x] 1.2 Create `stores/companyStore.ts` — typed state + actions matching `CompanyContextValue`; export `useCompanyStore` hook

## Phase 2: Dual-Write in Provider

- [x] 2.1 Import `useCompanyStore` in `context/CompanyContext.tsx`; after every `setXxx()` call in both render paths (company route + public route), sync to store via `useCompanyStore.getState().setXxx()`

## Phase 3: Consumer Migration

- [x] 3.1 **Sidebar.tsx**: Replace `const { selectedCompany, companies, setCompany, userRole } = useCompany()` with 4 individual `useCompanyStore(s => s.xxx)` selectors
- [x] 3.2 **InvitacionEntity.tsx**: Replace `const { companies, selectedCompany } = useCompany()` with `useCompanyStore(s => s.companies)` and `useCompanyStore(s => s.selectedCompany)`
- [x] 3.3 **ColaboradorEntity.tsx**: Replace `const { companies: allCompanies } = useCompany()` with `useCompanyStore(s => s.companies)`

## Phase 4: Verification

- [x] 4.1 Run `npx tsc --noEmit` — must pass with zero errors (all errors are pre-existing, 0 new)
- [x] 4.2 Run `npm test` — all existing tests pass (no mocks were changed, context still exists)
