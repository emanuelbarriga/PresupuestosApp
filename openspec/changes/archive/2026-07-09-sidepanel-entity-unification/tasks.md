# Tasks: Sidepanel Entity Unification

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2500 (additions across 5 PRs) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2a → PR 2b → PR 3 → PR 4 → PR 5 |
| Delivery strategy | ask-always |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes — accepted: PR 2b (Ejecucion, ~588) and PR 4a (Extracto+Settings) exceed 400 lines; PR 4b (Invitacion+Colaborador+Compania) is borderline.
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium — oversized PRs accepted with size:exception

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Base types + EntityList + scaffolding | PR 1 | ~200 lines, clean stand-alone |
| 2a | BudgetEntity (form + view + entity) | PR 2a | ~440. Borderline — accepted. |
| 2b | EjecucionEntity (form + view + entity) | PR 2b | ~588. size:exception — comprobante pipeline, highest risk. |
| 3 | Project, Tercero, Cuenta entities | PR 3 | ~360 lines, under budget |
| 4a | Extracto + Settings entities | PR 4a | Extracto (add/edit/view ~470) + Settings (~40) = ~510. size:exception. |
| 4b | Invitacion + Colaborador + Compania entities | PR 4b | ~350 lines |
| 5 | Cutover: Sidepanel replacement + legacy deletion | PR 5 | ~60 additions + ~1800 deletions (diff large, new code minimal) |
| **Total** | **29 tasks** | **7 PRs** | |

## Phase 1: Foundation (PR 1 — Base)

- [x] 1.1 Extend `lib/types.ts` — Add `EntityType`, `NewNavScreen` union (`LegacyNavScreen | NewNavScreen`), `EntityProps` interface (R2, R27)
- [x] 1.2 Create `components/entities/index.ts` — Re-export `EntityType`, entity routing map (R4)
- [x] 1.3 Create `components/entities/EntityList.tsx` — Dashboard list views, 5 entry points, archive via onSubmit with mode='archive', groupByEntity (R10, R22-R26)
- [x] 1.4 Test: `components/entities/__tests__/EntityList.smoke.test.tsx` — mounts without crash, archive confirm flow (R35)

## Phase 2a: Budget (PR 2a — BudgetEntity)

- [x] 2a.1 Create `components/entities/budget/BudgetEntity.tsx` — mode switch create↔edit↔view, conditional subscription guard (R1, R11)
- [x] 2a.2 Create `components/entities/budget/BudgetView.tsx` — DF fields + subscribeEjecucionesByBudget + "Agregar" navigates to EjecucionEntity via onNavigate with defaults (R12, R14)
- [x] 2a.3 Create `components/entities/budget/BudgetForm.tsx` — Port from BudgetForm.tsx (313L). Preserve: TipoSwitch, SearchableSelect proyecto/cliente (inline "Nuevo"), Calc, fecha→mes, recurrencia (R14)
- [x] 2a.4 Test: `components/entities/budget/BudgetEntity.smoke.test.tsx` — Renders create/edit/view, features preserved per spec table (R32, R33)

## Phase 2b: Ejecucion (PR 2b — EjecucionEntity)

- [x] 2b.1 Create `components/entities/ejecucion/EjecucionEntity.tsx` — mode switch, subscription cleanup guard (R1, R11)
- [x] 2b.2 Create `components/entities/ejecucion/EjecucionView.tsx` — Port from EjecucionView.tsx (138L). DF + budgetLinks + derivarEstadoComprobantes + ComprobantesViewer delete (R13, R34)
- [x] 2b.3 Create `components/entities/ejecucion/EjecucionForm.tsx` — Port from EjecucionForm.tsx (410L). HIGHEST RISK: comprobante pipeline (preGeneratedId, upload, pending/saved), multi-budget linking + sum verify, cuenta bancaria, recurrencia (R13)
- [x] 2b.4 Test: `components/entities/ejecucion/EjecucionEntity.smoke.test.tsx` — Smoke per mode (R32)
- [x] 2b.5 Test: `components/entities/ejecucion/EjecucionForm.comprobantes.test.tsx` — Upload flow, preGeneratedId, pending/saved transition (R34)

## Phase 3: Infra (PR 3 — Project + Tercero + Cuenta)

- [x] 3.1 Create `components/entities/project/ProjectEntity.tsx` + `ProjectView.tsx` + `ProjectForm.tsx` — Port ProjectView (168L) + ProjectForm (191L). Preserve: estado inline save, inferidos flow, grouped lists, subscribeCompanySettings (R15)
- [x] 3.2 Create `components/entities/tercero/TerceroEntity.tsx` + `TerceroView.tsx` + `TerceroForm.tsx` — Port TerceroForm (112L). Preserve: naturaleza, documento, número, lugar, tipo badge (R16)
- [x] 3.3 Create `components/entities/cuenta/CuentaEntity.tsx` + `CuentaView.tsx` + `CuentaForm.tsx` — Port CuentaForm (95L). NEW view mode: DF rendering. saldoActual=saldoInicial on add (R17)
- [x] 3.4 Test: `components/entities/{project,tercero,cuenta}/*.smoke.test.tsx` — Create/edit/view renders per spec (R32, R33)

## Phase 4a: Extracto + Settings (PR 4a — ExtractoEntity + SettingsEntity)

- [x] 4a.1 Create `components/entities/extracto/ExtractoEntity.tsx` — dispatch to add/edit/view sub-components (R17)
- [x] 4a.2 Create `components/entities/extracto/ExtractoAddView.tsx` — Port ExtractoAddForm (208L). Drag-drop + parseForPreview + ExtractoParseModal + upload + batch save
- [x] 4a.3 Create `components/entities/extracto/ExtractoEditView.tsx` — Port FormExtractoEdit (259L). Manual fields + PDF replace + re-parse existing
- [x] 4a.4 Create `components/entities/extracto/ExtractoView.tsx` — NEW: DF mes/año/saldos/estado badge/archivo link/totalMovimientos
- [x] 4a.5 Create `components/entities/settings/SettingsEntity.tsx` — Wraps existing SettingsEditor (edit mode only) (R18)
- [x] 4a.6 Test: `components/entities/extracto/*.smoke.test.tsx` + `components/entities/settings/*.smoke.test.tsx` — create/edit/view renders (R32, R33)

## Phase 4b: Invitacion + Colaborador + Compania (PR 4b)

- [x] 4b.1 Create `components/entities/invitacion/{InvitacionEntity,InvitacionView,InvitacionCreateForm,InvitacionEditForm}.tsx` — Port InviteUserForm from FormPanel. NEW view: DF rendering (R19)
- [x] 4b.2 Create `components/entities/colaborador/{ColaboradorEntity,ColaboradorView,ColaboradorEditForm}.tsx` — Port EditUserRoleForm from FormPanel. NEW view: DF email + memberships (R20)
- [x] 4b.3 Create `components/entities/compania/{CompaniaEntity,CompaniaView,CompaniaCreateForm}.tsx` — Port CreateCompanyForm from FormPanel. NEW view: DF rendering (R21)
- [x] 4b.4 Test: Per-entity smoke tests for Invitacion, Colaborador, Compania — create/edit/view renders (R32, R33)

## Phase 5: Cutover (PR 5 — Sidepanel replacement + legacy deletion)

- [x] 5.1 Replace `components/Sidepanel.tsx` — Router switches on `entity + mode`, preserves CustomizePanel + TerceroGroupPanel. key={entity}-{mode}-{id} pattern. handleEntitySubmit with archive detection (R27-R30)
- [x] 5.2 Add `handleEntitySubmit` to `app/[company]/[[...segments]]/page.tsx` — New handler: archive calls updateBudget/updateEjecucion directly; create/edit route through existing dispatchers (R7, R31)
- [x] 5.3 Delete legacy files: `FormPanel.tsx`, `ViewPanel.tsx`, `DataPanel.tsx`, `components/forms/*`, `components/views/*`
- [x] 5.4 Clean `lib/types.ts` — Remove `LegacyNavScreen`, collapse `NavScreen` to `NewNavScreen` only (R28)
- [x] 5.5 Test: Update Sidepanel.test.tsx — Verify new entity+mode routing, archive via onSubmit (R35)
- [x] 5.6 Verify: `npx tsc --noEmit`, `npm test`, `npm run lint` all green
