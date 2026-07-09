# Proposal: Sidepanel Decomposition

> **Change**: `sidepanel-decomposition` · Pure refactor (no behavior changes)
> **Origin**: Engram `sdd/sidepanel-decomposition/explore` (#188) · PR strategy: chained (required)
> **Recovery**: commit `852eb74` on `main`.

## Intent

`components/Sidepanel.tsx` is a 3,418-line god component with 40+ responsibilities — untestable in isolation and blocking every downstream feature. Decompose it into ~25 single-responsibility files without altering observable behavior.

## Scope

### In Scope
- Extract 13 phases into `components/{panels,forms,views,upload,shared,utils}/` (~25 files).
- Slim `Sidepanel.tsx` to ~80-line router; type `FormPanel`'s 35 state vars into per-form components.
- Consolidate dual PDF parsing into one path (`lib/parsers/`).
- Route `addClient`/`addProject`/`updateEjecucion` via `onFormSubmit` (remove Firestore bypass).
- Replace `alert()`/`prompt()` with toasts; remove dead state (`expandedEj`) + debug ID.
- Smoke test each extracted component.

### Out of Scope
- New features / behavior changes; `subscribeSettings` per-company fix (deferred).
- E2E tests; Sidebar / `Datos.tsx` refactors.

## Capabilities

> Contract with sdd-spec. Investigated against `openspec/specs/`.

### New Capabilities
- None.

### Modified Capabilities
- None. Pure structural refactor; behavior unchanged. `sidepanel-testing` stays valid (only import paths move).

## Approach

Bottom-up phased extraction; each phase independently mergeable:

| Group | Phases | Content |
|-------|--------|---------|
| Leaf | P1–P3 | Primitives, widgets, utils |
| Forms | P4–P5 | Standalone forms + upload |
| Views | P6–P8 | Views, sub-forms, `BudgetForm` |
| Router | P9–P11 | Panels → `FormPanel` → `Sidepanel` router |
| Cleanup | P12–P13 | alert→toast, a11y, debug/dead-code + smoke tests |

~30h total.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/Sidepanel.tsx` | Modified | 3,418 → ~80 lines |
| `components/{panels,forms,views,upload,shared,utils}/` | New | ~25 extracted files |
| `lib/parsers/` | Modified | Consolidate dual PDF parsing |
| `components/__tests__/` | Modified | Smoke tests + import updates |

## Risks

| Risk | Lk | Mitigation |
|------|----|-----------|
| PDF consolidation diverges behavior | High | Single adapter; gate on `bank-statement-parsing` tests. |
| Firestore bypass alters write timing | High | Preserve payload via `onFormSubmit`; verify vs `comprobantes-ejecucion`. |
| Extracto hooks before early return | Med | Move returns below hooks; add hook-order test. |
| ~25 files / ~30h exceeds 400-line budget | High | **Chained PRs mandatory** — one per group (5 slices), each < 400 lines. |
| Coverage regression mid-extraction | Med | Smoke test on extraction; keep god file until P11 swap green. |

## Rollback Plan

- **Primary**: `git revert` to `852eb74` — baseline.
- **Per-phase**: each chained PR reverts independently; leaf extractions stay safe.
- **God file**: kept until P11 router swap green; deleted after suite passes.

## Dependencies

- `firebase`, `vitest`, `@testing-library/react` — installed.
- Specs `bank-statement-parsing`, `comprobantes-ejecucion` = gates.

## Success Criteria

- [ ] `Sidepanel.tsx` < 100 lines.
- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint` green.
- [ ] No `alert()`/`prompt()`; debug ID + `expandedEj` removed.
- [ ] Single PDF path; no direct Firestore writes from extracted components.
- [ ] Each extracted component has ≥1 smoke test.
- [ ] Chained PRs, each < 400 lines.
