# Design: Sidepanel Decomposition

> Pure structural refactor · No behavior changes · Gates: `bank-statement-parsing`, `comprobantes-ejecucion`, `sidepanel-testing`

## Technical Approach

Bottom-up extraction of the 3,418-line `components/Sidepanel.tsx` into ~25 single-responsibility files under `components/{panels,forms,views,upload,shared,utils}/`. Reuses already-extracted `components/bancos/*` and `components/forms/FormExtracto.tsx`. Delivered as 5 chained PRs (Leaf → Forms → Views → Router → Cleanup), each < 400 lines. God file retained until P11 router swap green, then deleted. Direct Firestore writes route through `onFormSubmit` + one new sibling callback.

## Architecture Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Extraction order | **Bottom-up (leaf first)** — not top-down | Leaves have no deps; each slice mergeable/revertable; god file stays source of truth until last slice. |
| 2 | PDF consolidation | **Add `parseForPreview(buffer, banco)` to `parsePipeline.ts` (non-persisting); keep `runParsePipelineFromBuffer` as commit** — not inline/unified | Existing pipeline persists (`batchAddMovimientos`); ExtractoAddForm needs preview-only. Reuses `extractPdfTextFromBuffer`+`getParser`+`reconciliar`; gate on `bank-statement-parsing` tests. |
| 3 | Firestore bypass | **`addClient`/`addProject` (:1163,:1173) via `onFormSubmit`; new `onSaveComprobantes(ejId, comps)` sibling prop for ComprobanteUploader (:2773,:2798,:3173,:3390)** — not all-through-`onFormSubmit` | `onFormSubmit` already handles client/project add in page.tsx. Comprobantes need immediate persist (current UX); dedicated callback preserves write timing; parent owns all writes. |
| 4 | Hook order (Extracto edit) | **Extract :1509-1700 into `FormExtractoEdit`; hooks become unconditional** — not move-above-`if` | 5 hooks at :1517-1521 inside `if (ft==='extracto')` + early return at :1527 violate Rules of Hooks (count varies by type). Separate component is the only safe fix; enables hook-order test. |
| 5 | State typing | **Per-form typed interfaces; keep `Record<string,string>` inside dynamic-field leaves** — not strict/loose everywhere | Type safety at form boundary; avoids churn on 35 dynamic fields. |
| 6 | Chained PR slices | **5: Leaf\|Forms\|Views\|Router\|Cleanup** — not single/stacked | Each < 400 lines, autonomous, independently revertable. |
| 7 | God file retention | **Keep until P11 swap green; delete in P12** — not per-phase delete | Coverage protection mid-extraction; matches rollback plan. |
| 8 | Shared utils | **`groupByEntity<T>` in `utils/`; `EntityTypeBadge` in `shared/`** — not duplicate 4x | Eliminates 4x duplication; generic enables unit test. |
| 9 | `alert`/`prompt` → toast | **`react-hot-toast` (installed)** — `toast.error()`/`toast.success()`; `<Toaster />` in root layout | Minimal dep (4.8kB), zero deps, SSR-safe. API matches existing code patterns. |
| 10 | Tests | **Vitest smoke per component; keep `Sidepanel.test.tsx` (96 tests) green; gate PDF on `lib/parsers/__tests__/*`** — not E2E | Smoke catches breakage cheaply; parser tests guard consolidation; E2E out of scope. |

## Data Flow

```
app/[company]/[[...segments]]/page.tsx   (owns Firestore: addClient/addProject/updateEjecucion)
   │  onFormSubmit(form, data)          onSaveComprobantes(ejId, comps)  ◄ NEW sibling
   ▼
Sidepanel.tsx (~80 line router, P11) ─ routes by activeForm / recordDetail / data
   ├─► panels/{FormPanel,ViewPanel,DataPanel,CustomizePanel}.tsx
   │       ├─► forms/{Budget,Project,Ejecucion,Tercero,Cuenta,ExtractoAdd,ExtractoEdit,…}Form.tsx
   │       ├─► views/{Project,Budget,Ejecucion}View.tsx
   │       └─► shared/{EntityTypeBadge,PanelHeader}, utils/groupByEntity
   ├─► upload/{ComprobanteUploader,ComprobantesViewer}.tsx ──► onSaveComprobantes (no direct Firestore)
   └─► forms/ExtractoAddForm.tsx ─► lib/parsers/parsePipeline.ts (parseForPreview + runParsePipelineFromBuffer)
                                        ▼
                          lib/parsers/{pdfText,index,reconciliador}  (gate: bank-statement-parsing tests)
```

## File Changes

| File / Group | Action | Notes |
|------|--------|-------------|
| `components/Sidepanel.tsx` | Modify P11 → Delete P12 | 3,418 → ~80 router; deleted after swap green |
| `components/panels/{FormPanel,ViewPanel,DataPanel,CustomizePanel}.tsx` | Create | Panel routers |
| `components/forms/*Form.tsx` (Budget, Project, Ejecucion, Tercero, Cuenta, InviteUser, EditUserRole, CreateCompany) | Create | One per type; moves from :234,:567,:780 |
| `components/forms/ExtractoAddForm.tsx` | Create (move :911) | Add-flow PDF drop |
| `components/forms/FormExtractoEdit.tsx` | Create (move :1509-1700) | Edit-flow; **fixes hook order** |
| `components/views/{Project,Budget,Ejecucion}View.tsx` | Create (move :2350,:2516,:2914) | View components |
| `components/upload/{ComprobanteUploader,ComprobantesViewer}.tsx` | Create (move :2682,:2593) | Remove direct `updateEjecucion` |
| `components/forms/{FormInput,FormSelect,SearchableSelect,ColorSelect,TipoSwitch}.tsx` | Create (Leaf, :2058-2170) | Form primitives |
| `components/shared/{EntityTypeBadge,PanelHeader,DF}.tsx`; `components/utils/groupByEntity.ts` | Create | Primitives + generic dedup |
| `lib/parsers/parsePipeline.ts` | Modify | Add `parseForPreview` export |
| `components/forms/FormExtracto.tsx` | Modify | Replace inline pdfjs with `parseForPreview` |
| `app/[company]/[[...segments]]/page.tsx` | Modify | Wire `onSaveComprobantes` |
| `components/__tests__/Sidepanel.test.tsx` | Modify | Update import paths (regression) |
| `components/**/__tests__/*.smoke.test.tsx` | Create | 1 smoke per extracted component |
| `components/bancos/*`, `components/forms/FormExtracto.tsx` | Reuse | Already extracted — do NOT re-extract |

## Interfaces / Contracts

```ts
// lib/parsers/parsePipeline.ts — NEW preview adapter (non-persisting)
export interface ParsePreviewResult {
  movimientos: MovimientoBancarioInput[];
  header: { mes: Month; anio: number; banco: Banco; saldoInicial: number; saldoFinal: number };
  detectedBanco: Banco;
}
export async function parseForPreview(buffer: ArrayBuffer, bancoConfirmado?: Banco | null): Promise<ParsePreviewResult>;
// runParsePipelineFromBuffer(...) unchanged — remains the commit path.

// onFormSubmit contract — UNCHANGED shape (96-test suite depends on 2-arg)
type OnFormSubmit = (form: ActiveForm, data: Record<string, any>) => Promise<void>;
// NEW sibling callback for immediate comprobante persist (preserves write timing)
type OnSaveComprobantes = (ejecucionId: string, comprobantes: Comprobante[]) => Promise<void>;

// components/utils/groupByEntity.ts — generic dedup of 4x entity-grouping
export function groupByEntity<T extends { entityId: string; entityType: 'client'|'provider'|'interno'|'' }>(
  items: T[],
): Array<{ entityId: string; entityName: string; entityType: T['entityType']; items: T[] }>;

// components/shared/EntityTypeBadge.tsx — presentational ({ type, name }) => badge
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `groupByEntity`; `parseForPreview` | Vitest; gate against `lib/parsers/__tests__/*` (bancolombia/bancoomeva/global66) |
| Smoke | Each extracted component | `@testing-library/react` render + prop contract; 1 test/file |
| Hook-order | `FormExtractoEdit` | Render add→edit→add transitions; assert no React hook error |
| Regression | `Sidepanel.test.tsx` (96 tests) | Keep green; import-path updates only |
| Integration | `comprobantes-ejecucion` spec | Verify `onSaveComprobantes` writes via parent, not component |

## Migration / Rollout

5 chained PRs < 400 lines each, target branch `feature/sidepanel-decomposition`:

| Slice | PR | Content | Verify gate |
|-------|----|---------|-------------|
| Leaf | #1 | Form primitives, `shared/*`, `groupByEntity` + tests | `npm test` green; god file imports new leaves |
| Forms | #2 | `{Budget,Project,Ejecucion,Tercero,Cuenta}Form`, `ExtractoAddForm`, `FormExtractoEdit` (hook fix), `parseForPreview` | parser tests green; hook-order test passes |
| Views | #3 | `{Project,Budget,Ejecucion}View`, `upload/*` (bypass removed) | `comprobantes-ejecucion` spec green |
| Router | #4 | `panels/*`; `Sidepanel.tsx` → ~80 line router (P11 swap) | full `Sidepanel.test.tsx` green |
| Cleanup | #5 | Delete god file; remove `expandedEj` + debug ID; alert→toast (after Q1); smoke sweep | `Sidepanel.tsx` < 100 lines; success criteria met |

Rollback: `git revert` per PR; god file intact through P11.

## Open Questions

- [x] **Q1 (RESOLVED)**: `react-hot-toast` installed. Slice 5 proceeds with `toast.error()`/`toast.success()` + `<Toaster />` in root layout.
- [ ] **Q2**: `components/bancos/*` came from active `openspec/changes/bancos` — confirm it's stable before Slices 2-3 depend on its layout.
- [ ] **Q3**: `subscribeSettings` uses GLOBAL settings doc (:1148, no `companyId`) — out of scope; extracted `FormPanel` must preserve this exact call (don't "fix" mid-refactor).
