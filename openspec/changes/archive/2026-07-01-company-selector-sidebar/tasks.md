# Tasks: Company Selector in Sidebar Header

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150 (130–180) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation (types + COMPANIES) | Same PR | No chain needed — change is under 400 lines |

## Phase 1: Foundation — Types & Data

- [x] 1.1 Add `Company` interface and optional `companyId?: string` to `Transaction` in `lib/types.ts`
- [x] 1.2 Export `COMPANIES` constant (`[{id:"pacora",name:"Pácora"},{id:"saman",name:"Samán"}]`) from `lib/mockData.ts`

## Phase 2: Context Layer

- [x] 2.1 Create `context/CompanyContext.tsx` — `CompanyProvider` + `useCompany` hook with localStorage sync and fallback to COMPANIES[0]

## Phase 3: Sidebar Integration

- [x] 3.1 Replace static "B" logo in `components/Sidebar.tsx` with company selector using `useCompany()`: expanded shows name + dropdown, collapsed shows initial letter

## Phase 4: Provider Wiring

- [x] 4.1 Import `CompanyProvider` in `app/page.tsx` and wrap the top-level JSX div

## Phase 5: Testing

- [ ] 5.1 Verify `useCompany` defaults to Pácora when localStorage is empty (manual or after test setup)
- [ ] 5.2 Verify `setCompany("saman")` persists to localStorage and updates context
- [ ] 5.3 Verify invalid stored ID falls back to Pácora
- [ ] 5.4 Verify sidebar renders initial when collapsed, dropdown + name when expanded
- [ ] 5.5 Verify existing sidebar nav and collapse toggle still work
