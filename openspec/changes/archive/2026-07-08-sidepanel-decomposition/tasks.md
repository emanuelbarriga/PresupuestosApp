# Tasks: Sidepanel Decomposition

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~3,500 (5 × <400) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR #1 Leaf → #2 Forms → #3 Views → #4 Router → #5 Cleanup |
| Delivery strategy | ask-always |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Leaf primitives, utils, shared + tests | PR #1 | base: feature branch; god file imports leaves |
| 2 | Forms + `parseForPreview` + hook fix | PR #2 | base: PR #1; parser + hook tests green |
| 3 | Views + upload bypass removal | PR #3 | base: PR #2; `comprobantes-ejecucion` gate |
| 4 | Panels + FormPanel + Sidepanel router | PR #4 | base: PR #3; 96-test suite green |
| 5 | Dead code, alert→toast, smoke sweep | PR #5 | base: PR #4; success criteria met |

## Phase 1: Leaf — primitives, widgets, utils (PR #1)

- [x] 1.1 RED: `components/utils/__tests__/groupByEntity.test.ts`; then create `components/utils/groupByEntity.ts` generic
- [x] 1.2 Create `components/forms/{FormInput,FormSelect}.tsx` primitives (move :2058-2170)
- [x] 1.3 Create `components/forms/{SearchableSelect,ColorSelect,TipoSwitch}.tsx`
- [x] 1.4 Create `components/shared/{EntityTypeBadge,PanelHeader,DF}.tsx`
- [x] 1.5 Add `*.smoke.test.tsx` per leaf; update god file to import new leaves; `npm test` green

## Phase 2: Forms — standalone forms, ExtractoAdd, hook fix (PR #2)

- [x] 2.1 `parseForPreview(buffer, banco)` in `parsePipeline.ts` + `parseForPreview.test.ts` (gate `bank-statement-parsing`)
- [x] 2.2 Create `components/forms/{Project,Tercero,Cuenta}Form.tsx` (typed state)
- [x] 2.3 Create `components/forms/EjecucionForm.tsx`
- [x] 2.4 Create `components/forms/ExtractoAddForm.tsx` (move :911; uses `parseForPreview`)
- [x] 2.5 `FormExtractoEdit.tsx` (move :1509-1700, unconditional hooks) + `FormExtractoEdit.hook-order.test.tsx` (4 tests pass)
- [x] 2.6 Create `BudgetForm.tsx`; smoke tests (8 module smoke tests pass); `npm test` green (42/43 → fixed to 100%)

## Phase 3: Views — views + upload bypass removal (PR #3)

- [x] 3.1 Create `components/views/{Project,Budget}View.tsx` (move :2350,:2516)
- [x] 3.2 Create `components/views/EjecucionView.tsx` (move :2914)
- [x] 3.3 Create `components/upload/ComprobanteUploader.tsx` (move :2682) — drop direct `updateEjecucion`, use `onSaveComprobantes`
- [x] 3.4 Create `components/upload/ComprobantesViewer.tsx` (move :2593)
- [x] 3.5 Wire `onSaveComprobantes(ejId, comps)` in `page.tsx`; smoke tests; `comprobantes-ejecucion` spec green

## Phase 4: Router — panels + FormPanel + Sidepanel router (PR #4)

- [x] 4.1 Create `components/panels/{ViewPanel,DataPanel,CustomizePanel,TerceroGroupPanel}.tsx`
- [x] 4.2 Create `components/panels/FormPanel.tsx` dispatcher (routes by `activeForm`; preserves global `subscribeSettings` — Q3 respected)
- [x] 4.3 Rewrite `components/Sidepanel.tsx` → **56-line router** (P11 swap; 3,418 → 56 lines)
- [x] 4.4 Update `ExtractoAddForm.test.tsx` import path; `Sidepanel.test.tsx` untouched (timeout pre-existente)

## Phase 5: Cleanup — dead code, alert→toast, smoke sweep (PR #5)

- [x] 5.1 Remove dead `expandedEj` state + hardcoded debug ID
- [x] 5.2 Replace `alert()`/`prompt()` with `react-hot-toast`; add `<Toaster />` to `app/layout.tsx`
- [x] 5.3 Smoke sweep: ≥1 test per extracted component
- [x] 5.4 Success criteria: `Sidepanel.tsx` < 100 lines; `npm test`, `npx tsc --noEmit`, `npm run lint` green; no direct Firestore writes from extracted components
