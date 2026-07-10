# Proposal: Sidepanel Entity Unification

> **Change**: `sidepanel-entity-unification` · Architecture refactor + view-mode completion
> **Origin**: Engram `sdd/sidepanel-entity-unification/explore` (#216) · PR strategy: ask-always (C1)
> **Review budget**: 400 lines (D1)

## Intent

Sidepanel splits each entity across `FormPanel` (11 form types) + `ViewPanel` (8 detail types) + `DataPanel`, so one entity's create/edit/view logic lives in 2–3 files with duplicated routing. Unify into **one component per entity** handling `create | edit | view`, SUMMING all existing features (none excluded), deleting ~170 lines of dead legacy code, and routing archiving through `onFormSubmit` (currently bypassed in `DataPanel`).

## Scope

### In Scope
- 10 unified entity components (Budget, Ejecución, Project, Tercero, Cuenta, Extracto, SettingsEditor, Invitación, Colaborador, Compañía) with `create | edit | view`.
- Create missing view modes: Cuenta, Extracto, Invitación, Colaborador, Compañía.
- Dashboard `EntityList` (5 entry points: celda, total fila, total columna, columna-proyecto×tercero, columna-tercero) + archiving via `onFormSubmit`.
- `CustomizePanel` (ViewMode='filter') retained as utility panel.
- `DetalleTercero` (`TerceroGroupPanel`) retained as aggregate view.
- Delete `FormPanel` dead code (~lines 904–1075).
- `Sidepanel` router simplified to `entity + mode`.

### Out of Scope
- New entity fields or business rules (structural unification + view-mode completion only).
- Sidebar / `Datos.tsx` / `Dashboard.tsx` data-construction refactors.
- E2E tests.

## Capabilities

> Contract with sdd-spec. Investigated against `openspec/specs/`.

### New Capabilities
- `sidepanel-entity-components`: per-entity component contract (`create|edit|view` modes, navigation, archiving via `onFormSubmit`), including new view modes for Cuenta/Extracto/Invitación/Colaborador/Compañía.

### Modified Capabilities
- `sidepanel-testing`: routing requirements R3/R9 shift from `form type` / `recordDetail.type` dispatch to `entity + mode`; R10 archiving path changes to `onFormSubmit`.

## Approach

**Strategy**: Build new + cutover (no refactor in place). Legacy code stays untouched during construction.

1. **Build phase** (PRs 1-4): Todo nuevo código en `components/entities/{entity}/` — convive con el código existente sin tocarlo. Los componentes nuevos no se enrutan desde Sidepanel, solo existen como módulos independientes. Se prueban con tests unitarios.

2. **Cutover phase** (PR 5): Se reemplaza `Sidepanel.tsx` para que el router use los nuevos `entity + mode`. Se borran `FormPanel.tsx`, `ViewPanel.tsx`, `DataPanel.tsx`, `components/forms/*`, `components/views/*`, `components/panels/*`. Si algo sale mal, `git revert` del PR 5 restaura la app intacta.

### Decisiones de diseño

| Decisión | Detalle |
|----------|---------|
| **actionType: 'archive'** | Archiving pasa por `onFormSubmit` con `{ actionType: 'archive', archivado: true }`. El handler salta validación de campos cuando detecta archive. |
| **Extracto en sub-archivos** | `components/entities/extracto/ExtractoEntity.tsx` (router) + `ExtractoAddView.tsx` + `ExtractoEditView.tsx` + `ExtractoView.tsx`. No viola las 400 líneas. |
| **Ejecución en sub-archivos** | `EjecucionForm.tsx` (410) + `EjecucionView.tsx` (138) = 548. Similar split. |
| **Suscripciones con mode como dependency** | Todos los useEffect de Firebase subscriptions incluyen `mode` en el array de dependencias. Al cambiar view ↔ edit ↔ create se limpian y recrean. Sin fugas. |

## Entity Inventory

| Entity | create | edit | view | Preserve (key features — ALL must be summed) |
|--------|:------:|:----:|:----:|----------------------------------------------|
| Budget | ✅ | ✅ | ✅ | view: mini-form inline + live `subscribeEjecucionesByBudget`; form: TipoSwitch, inline new proyecto/cliente, Calc, fecha→mes auto, recurrencia (N meses) |
| Ejecución | ✅ | ✅ | ✅ | view: live `onSnapshot` + `budgetLinks` derivation + `ComprobantesViewer` delete; form: comprobante pipeline (`preGeneratedId`, upload, pending vs saved), multi-budget linking + sum verify, cuenta bancaria, recurrencia |
| Project | ✅ | ✅ | ✅ | view: estado inline save + "proyectos inferidos" flow + grouped lists + `subscribeCompanySettings`; form: sigla, `ColorSelect` tipos/unidades (allowCustom), soloEgresos |
| Tercero | ✅ | ✅ | ✅ | unifies client/provider/tercero; form: naturaleza, documento, número, lugar, tipo |
| Cuenta | ✅ | ✅ | ❌ NEW | view: DF nombre/banco/tipo/número/moneda/saldoInicial/saldoActual; form: `saldoActual=saldoInicial` on add |
| Extracto | ✅ | ✅ | ❌ NEW | view: DF mes/año/saldos/estado/archivo/totalMovimientos; add (PDF drag-drop + `parseForPreview` + `ExtractoParseModal` + upload + batch save) vs edit (manual fields + PDF replace + re-parse) converge on shared parse pipeline |
| SettingsEditor | n/a | ✅ | n/a | list editor: name+color, add inline, delete, reorder up/down, `updateSettings` |
| Invitación | ✅ | ✅ | ❌ NEW | view: DF empresas/email/rol/expiración; form: empresas checkboxes, email, rol toggle, expiración (1d/3d/7d); edit: empresa/email readonly |
| Colaborador | n/a | ✅ | ❌ NEW | view: DF email/memberships; edit (`EditUserRoleForm`): email readonly, per-company membership toggle, add to other companies |
| Compañía | ✅ | n/a | ❌ NEW | view: DF nombre; create (`CreateCompanyForm`): POST `/api/companies/create` + success redirect |

## Affected Areas

| Area | Impact | When | Description |
|------|--------|------|-------------|
| `components/entities/` | New | PRs 1-4 | 10 unified entity components (no toca legacy) |
| `components/panels/FormPanel.tsx` | Deleted | PR 5 (cutover) | Routing reemplazado por entity components; dead code (904–1075) eliminado |
| `components/panels/ViewPanel.tsx` | Deleted | PR 5 (cutover) | Dispatch moves to entity components |
| `components/panels/DataPanel.tsx` | Deleted | PR 5 (cutover) | Reemplazado por EntityList + archiving via `onFormSubmit` |
| `components/Sidepanel.tsx` | Replaced | PR 5 (cutover) | Router cambia a `entity + mode` |
| `components/forms/`, `components/views/` | Deleted | PR 5 (cutover) | Reemplazados por entity components |
| `lib/types.ts` | Extended | PR 1 | Nuevos tipos NavScreen `entity + mode`, EntityType |

## Risks

| Risk | Lk | Mitigation |
|------|----|-----------|
| Feature loss during merge (user mandate: SUM, not exclude) | High | Per-entity feature checklist in spec; smoke test per entity asserting every preserved feature |
| Ejecución comprobante pipeline regression | High | Gate on `comprobantes-ejecucion` + existing `FormExtracto` tests |
| Extracto add/edit divergence breaks convergence | Med | Keep shared parse pipeline; two render paths via sub-archivos |
| Cutover (PR 5) integration failure | Med | `git revert` del PR 5 restaura app intacta; legacy nunca se toca hasta ese PR |
| ~10 entities exceeds 400-line budget | High | Chained PRs en 5 bloques (4 build + 1 cutover) |
| 5 new view modes untested | Med | Smoke test each new view (DF rendering) |
| Subscription leaks on mode switch | High | Todos los useEffect incluyen `mode` como dependency; cleanup explícito |

## PR Chain

| PR | Bloque | Entrega | Toca legacy? |
|----|--------|---------|:------------:|
| 1 | **Base**: tipos NavScreen `entity+mode`, EntityList, scaffolding `components/entities/` | `lib/types.ts` extendido, `components/entities/EntityList.tsx`, `components/entities/index.ts` | ❌ |
| 2 | **Core financiero**: BudgetEntity + EjecucionEntity | `components/entities/budget/`, `components/entities/ejecucion/` | ❌ |
| 3 | **Infraestructura**: ProjectEntity + TerceroEntity + CuentaEntity | `components/entities/project/`, `components/entities/tercero/`, `components/entities/cuenta/` | ❌ |
| 4 | **Admin**: ExtractoEntity + SettingsEntity + InvitacionEntity + ColaboradorEntity + CompaniaEntity | `components/entities/extracto/`, `components/entities/settings/`, `components/entities/invitacion/`, `components/entities/colaborador/`, `components/entities/compania/` | ❌ |
| 5 | **CUTOVER**: nuevo Sidepanel.tsx + delete legacy | `Sidepanel.tsx` reemplazado, borrar `FormPanel.tsx`, `ViewPanel.tsx`, `DataPanel.tsx`, `components/forms/*`, `components/views/*`, `components/panels/*` | ✅ |

## Rollback Plan

- **PRs 1-4**: `git revert` del PR individual — no afecta la app porque el nuevo código nunca se enruta.
- **PR 5 (cutover)**: `git revert` del PR 5 restaura `Sidepanel.tsx`, `FormPanel`, `ViewPanel`, `DataPanel`, `forms/`, `views/` originales. App vuelve atrás en 1 commit.
- **Fallback total**: `git revert` a pre-change baseline.

## Dependencies

- `firebase`, `vitest`, `@testing-library/react` — installed.
- Specs `comprobantes-ejecucion`, `ejecucion-budget-link`, `cuenta-bancaria-ejecucion`, `bank-statement-parsing` = gates.

## Success Criteria

- [ ] 10 entity components under `components/entities/`, each handling `create|edit|view`.
- [ ] All preserved features present (per-entity checklist green).
- [ ] 5 new view modes (Cuenta, Extracto, Invitación, Colaborador, Compañía) render.
- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint` green en cada PR.
- [ ] PR 5 (cutover): legacy code reemplazado y borrado sin errores.
- [ ] Chained PRs, each < 400 lines.
- [ ] Rollback del PR 5 restaura funcionamiento completo (verificado).
