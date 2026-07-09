# Archive Report: Critical Technical Debt Fixes

| Field | Value |
|-------|-------|
| **Change ID** | `critical-technical-debt-fixes` |
| **Status** | ✅ **ARCHIVED** |
| **Archived At** | 2026-07-09 |
| **Archiver** | sdd-archive (automated) |
| **Mode** | hybrid (openspec + Engram) |

---

## Executive Summary

Three independent technical debt fixes implemented across 17 tasks (3 phases). All verified with zero regressions — `tsc --noEmit` clean (0 new errors), 25/25 targeted tests passing, grep-confirmed removal of legacy patterns.

- **H4 (CRITICAL)**: Cross-tenant subscription fixed — `subscribeSettings` replaced with `subscribeCompanySettings(companyId, callback)` in `FormPanel.tsx` and `ProjectView.tsx`
- **H5 (MEDIUM)**: 4 inline `.reduce()` entity-grouping blocks consolidated into shared `groupByEntity()` utility; 4 manual entity-type `<span>` badges replaced with `<EntityTypeBadge>`
- **H6 (LOW-MEDIUM)**: 5 `confirm()` + 6 `alert()` native browser dialogs replaced with async `react-hot-toast` patterns in `Configuracion.tsx` and `Datos.tsx`

---

## Success Criteria Verification

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| C1 | No `subscribeSettings()` calls in components | ✅ PASS | Grep-confirmed zero matches in `FormPanel.tsx`, `ProjectView.tsx` |
| C2 | No inline `.reduce()` entity-grouping duplicates `groupByEntity` | ✅ PASS | All 4 remaining `.reduce()` calls are post-grouping `.total` aggregation on `g.items` |
| C3 | Zero `alert()`/`confirm()`/`prompt()` in `Configuracion.tsx` and `Datos.tsx` | ✅ PASS | Grep-confirmed zero matches in both files |
| C4 | All existing tests pass | ✅ PASS | 25/25 tests pass across 6 targeted test files |
| C5 | TypeScript compiles cleanly | ✅ PASS | 0 new errors (5 pre-existing unchanged) |

---

## Files Changed

| File | Action | Phase | What Was Done |
|------|--------|-------|---------------|
| `components/panels/FormPanel.tsx` | Modified | H4 | `subscribeSettings` → `subscribeCompanySettings` import + call; added `companyId` param; added `ProjectForm` import (bugfix) |
| `components/panels/__tests__/FormPanel.smoke.test.tsx` | Modified | H4 | Mock: `subscribeSettings` → `subscribeCompanySettings` |
| `components/views/ProjectView.tsx` | Modified | H4+H5 | H4: subscription change. H5: added `groupByEntity` + `EntityTypeBadge` imports; replaced 2 reduces + 2 badges |
| `components/panels/DataPanel.tsx` | Modified | H5 | Added `groupByEntity` + `EntityTypeBadge` imports; replaced 2 reduces + 2 badges |
| `components/Configuracion.tsx` | Modified | H6 | Added `import toast`; replaced 3 `confirm()` + 4 `alert()` with react-hot-toast async patterns |
| `components/Datos.tsx` | Modified | H6 | Added `import toast`; replaced 2 `confirm()` + 2 `alert()` with react-hot-toast async patterns |
| `components/__tests__/Datos.test.tsx` | Modified | H6 | Added `vi.mock('react-hot-toast', ...)` |

### Additional Fixes (discovered during implementation)

| Issue | File | Description |
|-------|------|-------------|
| Missing `ProjectForm` import | `components/panels/FormPanel.tsx` | Pre-existing `tsc` error — import was missing; fixed during H4 implementation |
| `groupByEntity` using type label instead of entity name | `components/utils/groupByEntity.ts` | `entityName` was set to `entityTypes[item.entityType]` (human-readable type label) instead of the actual entity name from the data item; fixed to use `item.nombre \|\| item.name` |

---

## Task Completion

| Phase | Tasks | Status |
|-------|-------|--------|
| H4 — Cross-tenant subscription fix | 4/4 | ✅ Complete |
| H5 — Inline reduce → shared utility + EntityTypeBadge | 7/7 | ✅ Complete |
| H6 — Legacy browser dialogs → react-hot-toast | 6/6 | ✅ Complete |
| **Total** | **17/17** | ✅ **All complete** |

---

## Test Results

| Test file | Tests | Result |
|-----------|-------|--------|
| `Datos.test.tsx` | 8/8 | ✅ All passed |
| `DataPanel.smoke.test.tsx` | 1/1 | ✅ Passed |
| `FormPanel.smoke.test.tsx` | 1/1 | ✅ Passed |
| `ProjectView.smoke.test.tsx` | 4/4 | ✅ All passed |
| `groupByEntity.test.ts` | 7/7 | ✅ All passed |
| `EntityTypeBadge.smoke.test.tsx` | 4/4 | ✅ All passed |
| **Targeted total** | **25/25** | ✅ **All passed** |

Pre-existing failures (unchanged, excluded from scope):
- `CompanyContext.test.tsx` — 1 flaky failure
- `FormExtracto.test.tsx` — 4 failures (bank confirm modal timeout)
- `ComprobanteUploader.smoke.test.tsx` — 2 failures (timeout)
- `parsePipeline.test.ts` — 3 failures (`fetchMovimientoHashes` undefined)

---

## Risks and Mitigations

| Risk | Status | Notes |
|------|--------|-------|
| H4: `companyId` not in scope at call sites | ✅ Mitigated | Available via props/context in both components |
| H5: `groupByEntity` signature mismatch | ✅ Mitigated | Returns shape matching expected `.map(g => ({...g, total: ...}))` |
| H6: Async confirm with inline JSX toast | ✅ Accepted | Works with react-hot-toast render function; not testable via testing-library queries but acceptable per scope |
| Toast confirm buttons untestable | ✅ Accepted | Tests only mock `toast.error/toast.success` |

---

## Archived Artifacts

| Artifact | Path |
|----------|------|
| Proposal | `openspec/changes/archive/2026-07-09-critical-technical-debt-fixes/proposal.md` |
| Tasks | `openspec/changes/archive/2026-07-09-critical-technical-debt-fixes/tasks.md` |
| Apply Progress | `openspec/changes/archive/2026-07-09-critical-technical-debt-fixes/apply-progress.md` |
| Verify Report | `openspec/changes/archive/2026-07-09-critical-technical-debt-fixes/verify-report.md` |
| **Archive Report** | `openspec/changes/archive/2026-07-09-critical-technical-debt-fixes/archive-report.md` |

---

## Engram Artifacts (for traceability)

All artifacts for this change are stored in Engram under topic keys prefixed `sdd/critical-technical-debt-fixes/`:
- `sdd/critical-technical-debt-fixes/proposal`
- `sdd/critical-technical-debt-fixes/spec`
- `sdd/critical-technical-debt-fixes/design`
- `sdd/critical-technical-debt-fixes/tasks`
- `sdd/critical-technical-debt-fixes/verify-report`
- `sdd/critical-technical-debt-fixes/archive-report` (this report)

---

## Follow-up Recommendations

1. **Extract `ConfirmToast` shared component** — async confirm pattern `await new Promise<boolean>(resolve => toast(t => <button .../>))` repeated ~5 times across `Configuracion.tsx` and `Datos.tsx`
2. **Remove `subscribeSettings` export** from `lib/firestore.ts` — old export still exists; remove after confirming zero remaining callers
3. **Fix pre-existing `tsc` errors** — 5 pre-existing errors across 3 files remain unchanged

---

## Final Status

✅ **SDD cycle complete.** Change `critical-technical-debt-fixes` has been fully planned, implemented, verified, and archived.
