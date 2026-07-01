# Proposal: Company Selector in Sidebar

## Intent

The app has no concept of "company" — all transactions are global. The business manages two companies (Samán and Borondo), so users need to switch context between them. This introduces a company selector in the sidebar and a context layer for all components, preparing for per-company data filtering when Firestore arrives.

## Scope

### In Scope
- `Company` type + static company list (Samán, Borondo) in `lib/types.ts` / `lib/mockData.ts`
- Optional `companyId` field on `Transaction` type (no mock data tagging)
- `CompanyContext` + `useCompany` hook with localStorage persistence
- Company selector dropdown in sidebar header, replacing the static "B" logo
- `CompanyProvider` wraps the app in `app/page.tsx`

### Out of Scope
- Filtering transactions by `companyId` (deferred to Firestore integration)
- Modifying existing mock data to add company associations
- Company-specific UI beyond the selector itself
- Multi-company data architecture

## Capabilities

### New Capabilities
- `company-selection`: Company context, selector UI, and localStorage persistence for active company

### Modified Capabilities
None (no existing specs to modify)

## Approach

React Context + localStorage hook (Approach 1 from exploration). `CompanyProvider` wraps the app at `page.tsx`. `useCompany` exposes `selectedCompany`, `companies`, `setCompany`. Sidebar renders a dropdown in the header — company initial when collapsed, full name when expanded.

Future Firestore migration: swap context value source from localStorage+static to a Firestore listener; consuming components stay unchanged.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/types.ts` | Modified | Add `Company` interface; add optional `companyId` to `Transaction` |
| `lib/mockData.ts` | Modified | Add `COMPANIES` constant array (2 entries) |
| `context/CompanyContext.tsx` | New | Context provider + `useCompany` hook with localStorage sync |
| `components/Sidebar.tsx` | Modified | Replace static logo with company selector dropdown |
| `app/page.tsx` | Modified | Wrap children with `CompanyProvider` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Hydration mismatch (localStorage unavailable during SSR) | Low | App already uses `'use client'` everywhere; default to first company on server render |
| Sidebar layout breakage with dropdown | Low | Selector follows existing header flex layout; collapsed state shows only company initial |

## Rollback Plan

Remove `CompanyProvider` from `page.tsx`, revert `Sidebar.tsx` to static logo, delete `context/CompanyContext.tsx`. No data mutations — pure UI addition, safe to revert.

## Dependencies

None

## Success Criteria

- [ ] Company selector renders in sidebar header with both companies
- [ ] Selection persists across page reloads via localStorage
- [ ] Collapsed sidebar shows company initial; expanded shows dropdown with name
- [ ] `useCompany` hook accessible from any component without prop drilling
- [ ] No existing functionality broken (all views, transactions, sidepanel work as before)
