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

- [ ] 1.1 RED: `components/utils/__tests__/groupByEntity.test.ts`; then create `components/utils/groupByEntity.ts` generic
- [ ] 1.2 Create `components/forms/{FormInput,FormSelect}.tsx` primitives (move :2058-2170)
- [ ] 1.3 Create `components/forms/{SearchableSelect,ColorSelect,TipoSwitch}.tsx`
- [ ] 1.4 Create `components/shared/{EntityTypeBadge,PanelHeader,DF}.tsx`
- [ ] 1.5 Add `*.smoke.test.tsx` per leaf; update god file to import new leaves; `npm test` green

## Phase 2: Forms — standalone forms, ExtractoAdd, hook fix (PR #2)

- [ ] 2.1 RED: `lib/parsers/__tests__/parseForPreview.test.ts` (gate `bank-statement-parsing`); add `parseForPreview(buffer, banco)` to `parsePipeline.ts`
- [ ] 2.2 Create `components/forms/{Project,Tercero,Cuenta}Form.tsx` (typed state)
- [ ] 2.3 Create `components/forms/EjecucionForm.tsx`
- [ ] 2.4 Create `components/forms/ExtractoAddForm.tsx` (move :911; use `parseForPreview`)
- [ ] 2.5 RED: `FormExtractoEdit.hook-order.test.tsx` (add→edit→add); create `FormExtractoEdit.tsx` (move :1509-1700, unconditional hooks)
- [ ] 2.6 Create `BudgetForm.tsx`; update `FormExtracto.tsx` to `parseForPreview`; smoke tests; parser tests green

## Phase 3: Views — views + upload bypass removal (PR #3)

- [ ] 3.1 Create `components/views/{Project,Budget}View.tsx` (move :2350,:2516)
- [ ] 3.2 Create `components/views/EjecucionView.tsx` (move :2914)
- [ ] 3.3 Create `components/upload/ComprobanteUploader.tsx` (move :2682) — drop direct `updateEjecucion`, use `onSaveComprobantes`
- [ ] 3.4 Create `components/upload/ComprobantesViewer.tsx` (move :2593)
- [ ] 3.5 Wire `onSaveComprobantes(ejId, comps)` in `page.tsx`; smoke tests; `comprobantes-ejecucion` spec green

## Phase 4: Router — panels + FormPanel + Sidepanel router (PR #4)

- [ ] 4.1 Create `components/panels/{ViewPanel,DataPanel,CustomizePanel}.tsx`
- [ ] 4.2 Create `components/panels/FormPanel.tsx` dispatcher (routes by `activeForm`; preserve global `subscribeSettings` — Q3, do not fix)
- [ ] 4.3 Rewrite `components/Sidepanel.tsx` → ~80-line router (P11 swap)
- [ ] 4.4 Update `Sidepanel.test.tsx` import paths; full 96-test suite green

## Phase 5: Cleanup — dead code, alert→toast, smoke sweep (PR #5)

- [ ] 5.1 Remove dead `expandedEj` state + hardcoded debug ID
- [ ] 5.2 Replace `alert()`/`prompt()` with `react-hot-toast`; add `<Toaster />` to `app/layout.tsx`
- [ ] 5.3 Smoke sweep: ≥1 test per extracted component
- [ ] 5.4 Success criteria: `Sidepanel.tsx` < 100 lines; `npm test`, `npx tsc --noEmit`, `npm run lint` green; no direct Firestore writes from extracted components
