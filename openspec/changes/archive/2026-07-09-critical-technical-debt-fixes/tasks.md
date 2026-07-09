# Tasks: Critical Technical Debt Fixes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~130–160 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: H4 — Cross-tenant subscription fix

- [x] 1.1 `FormPanel.tsx`: Replace `subscribeSettings(setSettingsData)` import with `subscribeCompanySettings`; change call to `subscribeCompanySettings(companyId, setSettingsData)`
- [x] 1.2 `FormPanel.smoke.test.tsx`: Add `subscribeCompanySettings: vi.fn(() => vi.fn())` to the firestore mock
- [x] 1.3 `ProjectView.tsx`: Replace `subscribeSettings` import with `subscribeCompanySettings`; change call to `subscribeCompanySettings(companyId, setSettingsCat)` (companyId is already a prop)
- [x] 1.4 **Verify**: `npx tsc --noEmit` clean; `npm test` green (smoke tests cover both components)

## Phase 2: H5 — Inline reduce → shared utility + EntityTypeBadge

- [x] 2.1 `DataPanel.tsx`: Import `groupByEntity` from `@/components/utils/groupByEntity` and `EntityTypeBadge` from `@/components/shared/EntityTypeBadge`
- [x] 2.2 `DataPanel.tsx`: Replace 2 inline `.reduce()` blocks (budgets at ~L102, ejecuciones at ~L173) with `groupByEntity()` calls; compute `.total` per group after grouping
- [x] 2.3 `DataPanel.tsx`: Replace 2 manual entity-type `<span>` badges (at ~L115 and ~L186) with `<EntityTypeBadge type={...} />`
- [x] 2.4 `ProjectView.tsx`: Import `groupByEntity` and `EntityTypeBadge`
- [x] 2.5 `ProjectView.tsx`: Replace 2 inline `.reduce()` blocks (budgets at ~L109, ejecuciones at ~L143) with `groupByEntity()`; compute `.total` post-grouping
- [x] 2.6 `ProjectView.tsx`: Replace 2 manual badges (at ~L122 and ~L156) with `<EntityTypeBadge type={...} />`
- [x] 2.7 **Verify**: `npx tsc --noEmit` clean; `npm test` green (DataPanel + ProjectView smoke tests)

## Phase 3: H6 — Legacy browser dialogs → react-hot-toast

- [x] 3.1 `Configuracion.tsx`: Add `import toast from 'react-hot-toast'`
- [x] 3.2 `Configuracion.tsx`: Replace `confirm('msg')` + `alert('Error...')` patterns in `handleRemoveFromCompany`, `handleDeleteUserFromAll`, `handleBlockUser`, `handleDeleteInvitation` with `toast.error` for errors and a confirmation toast pattern for confirms
- [x] 3.3 `Datos.tsx`: Add `import toast from 'react-hot-toast'`
- [x] 3.4 `Datos.tsx`: Replace `confirm`/`alert` in `handleDeleteExtracto` (~L334) and inline budget delete (~L1066) with toast equivalents; replace bare `alert('Error...')` with `toast.error`
- [x] 3.5 `Datos.test.tsx`: Add `react-hot-toast` mock at top of test file (follow pattern from `FormPanel.smoke.test.tsx`)
- [x] 3.6 **Verify**: `npx tsc --noEmit` clean; `npm test` green; grep confirms zero `alert(`/`confirm(`/`prompt(` in `Configuracion.tsx` and `Datos.tsx`
