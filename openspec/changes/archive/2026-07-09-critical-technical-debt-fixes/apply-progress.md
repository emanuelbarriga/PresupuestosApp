# Apply Progress: Critical Technical Debt Fixes — Phase 1 (H4) + Phase 2 (H5) + Phase 3 (H6) ✅

## Status
✅ **Phase 1 complete** — 4/4 tasks done.
✅ **Phase 2 complete** — 7/7 tasks done.
✅ **Phase 3 complete** — 6/6 tasks done.
🎉 **All 17 tasks complete.** Ready for archive/verify.

## Mode
Standard (no Strict TDD — config.yaml has `strict_tdd: true` but applies to verify phase; standard apply workflow used as per skill instructions)

## Completed Tasks

### Phase 1 — H4: Cross-tenant subscription fix

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 1.1 | `FormPanel.tsx`: Replace `subscribeSettings` with `subscribeCompanySettings` | ✅ | Import changed to `subscribeCompanySettings`, call changed to `subscribeCompanySettings(companyId, setSettingsData)` |
| 1.2 | `FormPanel.smoke.test.tsx`: Add mock for `subscribeCompanySettings` | ✅ | Added `subscribeCompanySettings: vi.fn(() => vi.fn())` in firestore mock block |
| 1.3 | `ProjectView.tsx`: Replace `subscribeSettings` with `subscribeCompanySettings` | ✅ | Import changed, call changed to `subscribeCompanySettings(companyId, setSettingsCat)`, deps array updated to `[companyId]` |
| 1.4 | Verify: `npx tsc --noEmit` + `npm test` | ✅ | tsc: 0 new errors (pre-existing `ProjectForm` at line 764 unchanged). Tests: FormPanel.smoke ✅ 1/1, ProjectView.smoke ✅ 4/4 |

### Phase 2 — H5: Inline reduce → shared utility + EntityTypeBadge

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 2.1 | `DataPanel.tsx`: Import `groupByEntity` and `EntityTypeBadge` | ✅ | Added imports from `@/components/utils/groupByEntity` and `@/components/shared/EntityTypeBadge` |
| 2.2 | `DataPanel.tsx`: Replace 2 inline `.reduce()` blocks with `groupByEntity()` | ✅ | budgets reduce (L102→L103) and ejecuciones reduce (L173→L174) replaced with `groupByEntity(...).map(g => ({...g, total: g.items.reduce(...)}))` |
| 2.3 | `DataPanel.tsx`: Replace 2 manual entity-type `<span>` badges with `<EntityTypeBadge>` | ✅ | Both badges (budgets section and ejecuciones section) replaced with `<EntityTypeBadge type={group.entityType} />` |
| 2.4 | `ProjectView.tsx`: Import `groupByEntity` and `EntityTypeBadge` | ✅ | Added imports from `@/components/utils/groupByEntity` and `@/components/shared/EntityTypeBadge` |
| 2.5 | `ProjectView.tsx`: Replace 2 inline `.reduce()` blocks with `groupByEntity()` | ✅ | groupedBudgets (L109→L113) and groupedEjs (L143→L146) replaced with `groupByEntity(...).map(g => ({...g, total: ...}))` |
| 2.6 | `ProjectView.tsx`: Replace 2 manual badges with `<EntityTypeBadge>` | ✅ | Both badges (budgets section and ejecuciones section) replaced with `<EntityTypeBadge type={group.entityType} />` |
| 2.7 | Verify: `npx tsc --noEmit` + `npm test` | ✅ | tsc: 0 new errors (same 5 pre-existing). Tests: DataPanel.smoke ✅ 1/1, ProjectView.smoke ✅ 4/4, EntityTypeBadge.smoke ✅ 4/4, groupByEntity.test ✅ 7/7 |

### Phase 3 — H6: Legacy browser dialogs → react-hot-toast

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 3.1 | `Configuracion.tsx`: Add `import toast from 'react-hot-toast'` | ✅ | Import added after lucide-react imports |
| 3.2 | `Configuracion.tsx`: Replace `confirm`/`alert` patterns in 4 handlers | ✅ | `handleRemoveFromCompany`, `handleDeleteUserFromAll`, `handleBlockUser`, `handleDeleteInvitation` — 3 confirms→async toast buttons, 4 alerts→toast.error |
| 3.3 | `Datos.tsx`: Add `import toast from 'react-hot-toast'` | ✅ | Import added after clsx import |
| 3.4 | `Datos.tsx`: Replace `confirm`/`alert` in 3 locations | ✅ | `handleDeleteExtracto`: confirm→async toast buttons + alert→toast.error; inline budget delete: confirm→async toast buttons; `handleViewSave`: alert→toast.error |
| 3.5 | `Datos.test.tsx`: Add `react-hot-toast` mock | ✅ | Added `vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() }, Toaster: () => null }))` |
| 3.6 | **Verify**: tsc + tests + grep | ✅ | tsc: 0 new errors (5 pre-existing). Tests: Datos ✅ 8/8, DataPanel.smoke ✅ 1/1, FormPanel.smoke ✅ 1/1, ProjectView.smoke ✅ 4/4. Grep: zero `alert(`/`confirm(`/`prompt(` in both files |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `components/panels/FormPanel.tsx` | Modified | Import: `subscribeSettings` → `subscribeCompanySettings`. Call: `subscribeSettings(setSettingsData)` → `subscribeCompanySettings(companyId, setSettingsData)` |
| `components/panels/__tests__/FormPanel.smoke.test.tsx` | Modified | Mock: `subscribeSettings: vi.fn(() => vi.fn())` → `subscribeCompanySettings: vi.fn(() => vi.fn())` |
| `components/views/ProjectView.tsx` | Modified | Phase 1: `subscribeSettings` → `subscribeCompanySettings`. Phase 2: Added `groupByEntity` + `EntityTypeBadge` imports; replaced 2 reduces + 2 badges |
| `components/panels/DataPanel.tsx` | Modified | Added `groupByEntity` + `EntityTypeBadge` imports; replaced 2 inline `.reduce()` blocks with `groupByEntity()` + post-hoc `.total` computation; replaced 2 manual badges with `<EntityTypeBadge>` |
| `components/Configuracion.tsx` | Modified | Added `import toast`; replaced 3 `confirm()` with async toast button patterns; replaced 4 `alert()` with `toast.error()` |
| `components/Datos.tsx` | Modified | Added `import toast`; replaced 2 `confirm()` (`window.confirm` in handleDeleteExtracto + inline budget delete) with async toast button patterns; replaced 2 `alert()` with `toast.error()` |
| `components/__tests__/Datos.test.tsx` | Modified | Added `vi.mock('react-hot-toast', ...)` at top, after firestore mock |

## Deviations from Design
None — implementation matches design.

## Verification Results
- **tsc**: `npx tsc --noEmit` — 5 pre-existing errors only (0 new)
- **Tests** (14/14 passing):
  - `Datos.test.tsx` → 8 tests passed ✅
  - `DataPanel.smoke.test.tsx` → 1 test passed ✅
  - `FormPanel.smoke.test.tsx` → 1 test passed ✅
  - `ProjectView.smoke.test.tsx` → 4 tests passed ✅
- **Grep**: `grep -n 'alert(\|confirm(\|prompt(' components/Configuracion.tsx components/Datos.tsx` → clean (no matches)

## Remaining Tasks
None — all 17 tasks complete. Ready for archive/review.

## Risks
- Toast confirm buttons use styled JSX inside toast — works with react-hot-toast's render function but won't match exact testing-library queries. This is acceptable since the toast confirm replaces a blocking `confirm()` and the test file only mocks `toast.error`/`toast.success` without testing the toast UI directly.
- All previously documented pre-existing tsc errors and test failures remain unchanged.
