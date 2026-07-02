# Proposal: Sidepanel Navigation Stack

## Intent

Sidepanel has 3 mutually-exclusive state vars (`sidepanelData`, `recordDetail`, `activeForm`) in page.tsx that only support one-way navigation (open → close). BudgetView/EjecucionView have disconnected internal toggles (`viewEj`, `viewBudget`) with custom back buttons. Replace with a unified nav stack so users can go back to previous panels instead of closing everything.

## Scope

### In Scope
1. Replace 3 state vars in page.tsx with `navStack: NavScreen[]`
2. Add `canGoBack`, `onBack`, `onNavigate` props to Sidepanel
3. Remove internal `viewEj`/`viewBudget` toggles — use `onNavigate` instead
4. Unified header: "← Volver" when stack > 1, "✕" always clears all
5. Form submit pops stack (doesn't close all)
6. Remove MiniEjecucionView — navigation uses stack

### Out of Scope
- Dashboard/Datos component changes
- New visual components
- Data layer or type changes

## Capabilities

### New Capabilities
- None — pure refactor of existing state management

### Modified Capabilities
- `sidepanel-testing`: AC #3 ("No production code modified") is no longer valid; delta spec updates Sidepanel props and removes MiniEjecucionView tests

## Approach

Replace 3 state vars with `NavScreen[]` stack in page.tsx. Sidepanel derives current screen from `stack[length-1]`. Back = pop. Close = clear. Push = navigate forward. BudgetView/EjecucionView call `onNavigate` instead of internal toggles.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/[company]/[[...segments]]/page.tsx` | Modified | Replace 3 states with navStack + push/pop/clear handlers |
| `components/Sidepanel.tsx` | Modified | Add nav stack props, unified header, remove MiniEjecucionView and internal toggles |
| `components/__tests__/Sidepanel.test.tsx` | Modified | Update mocks for new props, remove MiniEjecucionView tests |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| BudgetView/EjecucionView internal breaks | Low | onNavigate replaces setViewEj/setViewBudget with same effect |
| Tests fail from prop changes | Medium | Update test mocks first |
| Form submit pops wrong screen | Low | popScreen after successful submit |

## Rollback

`git revert` the commit. Both modified files are scoped — no data or migration needed.

## Dependencies

- None

## Success Criteria

- [ ] ← Volver in header when stack > 1 pops one screen and restores previous
- [ ] ✕ always clears entire stack
- [ ] BudgetView clicking ejecucion navigates forward via stack
- [ ] EjecucionView clicking linked budget navigates forward via stack
- [ ] Form submit pops back (doesn't clear all)
- [ ] All tests pass with updated mocks
