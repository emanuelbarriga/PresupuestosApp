# Design: Sidepanel Entity Unification

## Technical Approach

**Build new + cutover** — 10 entity components in `components/entities/{entity}/` handle `create|edit|view` modes, leaving legacy `FormPanel`/`ViewPanel`/`DataPanel` untouched during construction. PR 5 replaces `Sidepanel.tsx` router, deletes legacy code.

**Key insight**: each entity component IS the router for its modes. No shared dispatch — each `*Entity.tsx` renders sub-components (`*Form`, `*View`) directly.

## Architecture Decisions

### Decision: Entity component as self-contained router per entity

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Single `EntityRouter.tsx` with all 10 entities | Avoids 10 small files but requires the same dispatch logic that FormPanel/ViewPanel have | **Rejected** — 10 files each < 50 lines is cleaner |
| Each `*Entity.tsx` renders its own form/view | Duplicate boilerplate (PanelHeader + submit button) but clear per-entity responsibility | **Accepted** — each entity controls its own layout |
| Extract shared wrapper into `EntityLayout.tsx` | Wrapper handles PanelHeader + scroll + footer, entity provides content | **Not needed yet** — 5-entity PRs justify the small duplication |

### Decision: onFormSubmit carries actionType for archive

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Direct updateBudget/updateEjecucion in entity (like current DataPanel) | Bypasses the page.tsx handler — double dispatch paths | **Rejected** — page.tsx already has write logic |
| onFormSubmit with `{ actionType: 'archive', archivado: true }` | page.tsx detects actionType, calls appropriate update function | **Accepted** — single write path, no field validation |

### Decision: Subscription cleanup — conditional + mode dependency

Two-part rule:
1. **Guard**: cada useEffect que establezca una suscripción Firestore en vivo arranca con `if (mode !== 'view') return;`. En create/edit la suscripción NO existe — evita que cambios remotos pisoteen datos que el usuario está escribiendo.
2. **Cleanup**: `mode` está en el dependency array, así que al cambiar de view a edit (o viceversa) el useEffect se limpia y no deja fugas.

```typescript
useEffect(() => {
  if (mode !== 'view') return;  // ❌ No hay subscripción en edit/create
  const unsub = subscribeSomething(companyId, setData);
  return () => unsub();
}, [companyId, mode]);  // mode en deps → cleanup al cambiar
```

### Decision: Budget mini-form navigates to EjecucionEntity, does NOT create inline

Current `BudgetView` has an inline "Nueva ejecución vinculada" form. New code navigates to `{ entity: 'ejecucion', mode: 'create', defaults }` — the mini-form is replaced by the full EjecucionEntity component.

### Decision: Union type para NavScreen durante migración (R28)

Para que `npx tsc --noEmit` pase en TODOS los PRs intermedios, el tipo NavScreen se define como unión durante la migración:

```typescript
// lib/types.ts — durante PRs 1-4
export type LegacyNavScreen =
  | { id: string; type: 'data'; data: SidepanelData }
  | { id: string; type: 'view'; detail: RecordDetail }
  | { id: string; type: 'form'; form: ActiveForm };

export type NewNavScreen =
  | { entity: EntityType; mode: 'create' | 'edit' | 'view'; record?: any; defaults?: Record<string, string> }
  | { type: 'customize' };

export type NavScreen = LegacyNavScreen | NewNavScreen;  // ← unión convive
```

En PR 5 (cutover) se elimina `LegacyNavScreen` y `NavScreen` pasa a ser solo `NewNavScreen`.

### Decision: Contrato onFormSubmit para entity components (R7, R31)

Los entity components NO reusan el `onFormSubmit` legacy `(form: ActiveForm, data) => void`. Definen un prop propio:

```typescript
interface EntityProps {
  mode: 'create' | 'edit' | 'view';
  onSubmit: (action: {
    mode: 'create' | 'edit' | 'archive';
    entity: EntityType;
    record?: any;           // para edit/archive
    data: Record<string, any>;  // datos del form o { archivado: true }
  }) => Promise<void>;
  // ...
}
```

En PR 5 (cutover), el handler `handleEntitySubmit` en `page.tsx` recibe este action y hace:
- `action.mode === 'archive'` → `updateBudget` / `updateEjecucion` directo (sin validación ni batch)
- `action.mode === 'create'` → dispatcher add existente
- `action.mode === 'edit'` → dispatcher update existente

Durante PRs 1-4 el prop `onSubmit` no se usa (los entity components no están enrutados), así que no hay conflicto.

### Decision: key={mode}-{id} para evitar residuo de estado (R1)

React reusa instancias de componente si el key no cambia. Al saltar de view → edit del mismo registro, el estado local del formulario puede quedar contaminado. En el Sidepanel router (PR 5):

```typescript
<BudgetEntity
  key={`budget-${mode}-${record?.id || 'new'}`}
  mode={mode}
  ...
/>
```

Esto fuerza un **desmontaje completo** al cambiar de modo o de registro. State siempre fresco, sin residuos. Durante PRs 1-4 el pattern se aplica igual aunque los componentes no estén enrutados aún (buena práctica desde el vamos).

## Data Flow

```
Sidepanel.tsx (PR 5) — con key={entity}-{mode}-{id} para evitar residuo
  │
  ├── NavScreen.entity+mode ──→ EntityRouter switch()
  │     ├── entity='budget', mode='view'  → <BudgetEntity key="budget-view-{id}" mode="view" ... />
  │     ├── entity='budget', mode='create' → <BudgetEntity key="budget-create-new" mode="create" ... />
  │     └── entity='ejecucion', mode='edit' → <EjecucionEntity key="ejecucion-edit-{id}" mode="edit" ... />
  │
  ├── customizeOpen → CustomizePanel (preserved)
  └── DetalleTercero → TerceroGroupPanel (preserved)

Entity Component
  ├── mode='view' → *View (DF + entity-specific lists + subscriptions SOLO si mode==='view')
  ├── mode='edit' → *Form (pre-filled, save → onSubmit → popScreen)
  └── mode='create' → *Form (empty + defaults, save → onSubmit → popScreen)

onSubmit (page.tsx PR 5 — handleEntitySubmit)
  ├── action.mode === 'archive' → updateBudget/updateEjecucion directo
  ├── action.mode === 'create' → existing add dispatcher
  └── action.mode === 'edit' → existing update dispatcher
```

## File Changes

### PR 1 — Base (types + EntityList + scaffolding)

| File | Action | Description |
|------|--------|-------------|
| `lib/types.ts` | Modify | Add `EntityType`, new `NavScreen { entity, mode }` union |
| `components/entities/index.ts` | Create | Re-export EntityType + entity routing map |
| `components/entities/EntityList.tsx` | Create | Dashboard list views (5 entry points), archive via onFormSubmit |

### PR 2 — Core (Budget + Ejecucion)

| File | Action | Description |
|------|--------|-------------|
| `components/entities/budget/BudgetEntity.tsx` | Create | mode switch: create↔edit↔view |
| `components/entities/budget/BudgetView.tsx` | Create | DF + linked ejecuciones + "Agregar" navigates to EjecucionEntity |
| `components/entities/budget/BudgetForm.tsx` | Create | From current `BudgetForm.tsx` — same logic, new container |
| `components/entities/ejecucion/EjecucionEntity.tsx` | Create | mode switch + subscription cleanup |
| `components/entities/ejecucion/EjecucionView.tsx` | Create | DF + budgetLinks + comprobantes state + ComprobantesViewer |
| `components/entities/ejecucion/EjecucionForm.tsx` | Create | From current `EjecucionForm.tsx` — comprobante pipeline, budget linking |

### PR 3 — Infra (Project + Tercero + Cuenta)

| File | Action | Description |
|------|--------|-------------|
| `components/entities/project/ProjectEntity.tsx` | Create | mode switch |
| `components/entities/project/ProjectView.tsx` | Create | DF + estado inline save + grouped lists |
| `components/entities/project/ProjectForm.tsx` | Create | From current `ProjectForm.tsx` |
| `components/entities/tercero/TerceroEntity.tsx` | Create | unifies client/provider/tercero modes |
| `components/entities/tercero/TerceroView.tsx` | Create | DF + badge + edit button |
| `components/entities/tercero/TerceroForm.tsx` | Create | From current `TerceroForm.tsx` |
| `components/entities/cuenta/CuentaEntity.tsx` | Create | mode switch |
| `components/entities/cuenta/CuentaView.tsx` | Create | **NEW** — DF rendering |
| `components/entities/cuenta/CuentaForm.tsx` | Create | From current `CuentaForm.tsx` |

### PR 4 — Admin (Extracto + Settings + Invitacion + Colaborador + Compania)

| File | Action | Description |
|------|--------|-------------|
| `components/entities/extracto/ExtractoEntity.tsx` | Create | dispatch to add/edit/view |
| `components/entities/extracto/ExtractoView.tsx` | Create | **NEW** — DF rendering |
| `components/entities/extracto/ExtractoAddView.tsx` | Create | From `ExtractoAddForm` |
| `components/entities/extracto/ExtractoEditView.tsx` | Create | From `FormExtractoEdit` |
| `components/entities/settings/SettingsEntity.tsx` | Create | edit mode only (wraps SettingsEditor) |
| `components/entities/invitacion/InvitacionEntity.tsx` | Create | mode switch |
| `components/entities/invitacion/InvitacionView.tsx` | Create | **NEW** — DF rendering |
| `components/entities/invitacion/InvitacionCreateForm.tsx` | Create | From InviteUserForm create path |
| `components/entities/invitacion/InvitacionEditForm.tsx` | Create | From InviteUserForm edit path |
| `components/entities/colaborador/ColaboradorEntity.tsx` | Create | edit mode only |
| `components/entities/colaborador/ColaboradorView.tsx` | Create | **NEW** — DF rendering |
| `components/entities/colaborador/ColaboradorEditForm.tsx` | Create | From EditUserRoleForm |
| `components/entities/compania/CompaniaEntity.tsx` | Create | create mode only |
| `components/entities/compania/CompaniaView.tsx` | Create | **NEW** — DF rendering |
| `components/entities/compania/CompaniaCreateForm.tsx` | Create | From CreateCompanyForm |

### PR 5 — Cutover (Sidepanel replacement + legacy deletion)

| File | Action | Description |
|------|--------|-------------|
| `components/Sidepanel.tsx` | Replace | Router checks `entity+mode` first, falls back to customize/detalle-tercero |
| `components/panels/FormPanel.tsx` | Delete | Replaced by entity components |
| `components/panels/ViewPanel.tsx` | Delete | Replaced by entity components (except TerceroGroupPanel) |
| `components/panels/DataPanel.tsx` | Delete | Replaced by EntityList |
| `components/panels/CustomizePanel.tsx` | Keep | Preserved utility panel |
| `components/panels/TerceroGroupPanel.tsx` | Keep | Preserved aggregate view |
| `components/forms/*` | Delete | All form components replaced by entity forms |
| `components/views/*` | Delete | All view components replaced by entity views |

## Interfaces / Contracts

```typescript
// lib/types.ts — additions

export type EntityType =
  | 'budget' | 'ejecucion' | 'project' | 'tercero'
  | 'cuenta' | 'extracto' | 'settings' | 'invitacion'
  | 'colaborador' | 'compania';

// New NavScreen — entity+mode replaces data/view/form
type NavScreen =
  | { entity: EntityType; mode: 'create' | 'edit' | 'view'; record?: any; defaults?: Record<string, string> }
  | { type: 'customize' }
  // DetalleTercero preserved as-is
  | { id: string; type: 'view'; detail: { type: 'detalle-tercero'; projects: ...; totalPresupuestado: number; totalEjecutado: number; diferencia: number } };
```

```typescript
// Entity component contract
interface EntityProps {
  mode: 'create' | 'edit' | 'view';
  companyId: string;
  record?: any;  // provided for edit/view
  defaults?: Record<string, string>;  // for create
  onFormSubmit: (action: { type: string; record?: any; data: Record<string, any> }) => Promise<void>;
  onNavigate: (screen: NavScreen) => void;
  onClose: () => void;
  onBack: () => void;
  canGoBack: boolean;
}
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Smoke | Each entity component renders create/edit/view | `*.smoke.test.tsx` — mount with mode prop, assert no crash |
| Feature | Preserved features per entity | Assert DF fields, inline actions, form fields match spec table |
| Pipeline | Ejecucion comprobante flow | Mock uploadFile, assert preGeneratedId + pending/saved transition |
| Archive | onFormSubmit with actionType | Mock page.tsx handler, assert updateBudget/updateEjecucion called |

## Migration / Rollout

No data migration. Phase rollout via 5 stacked PRs:
- PRs 1-4: new code coexists with legacy (never routed)
- PR 5: single atomic cutover — `Sidepanel.tsx` replaced, legacy deleted
- Rollback: `git revert PR-5` restores previous router + all legacy code

## Open Questions

- [ ] None — resolved during exploration + proposal phase

## Design Decisions Summary

| Decision | Choice |
|----------|--------|
| Build strategy | Build new + cutover (no refactor in place) |
| Entity/NavScreen type | `{ entity: EntityType; mode: 'create'/'edit'/'view' }` |
| Union type durante migración | `NavScreen = LegacyNavScreen \| NewNavScreen` (PR 5 elimina Legacy) |
| Archive path | `handleEntitySubmit` en page.tsx recibe `{ mode: 'archive', entity, record }` |
| Subscription cleanup | Guard `if (mode !== 'view') return;` + `mode` en dependency array |
| State residue prevention | `key={`${entity}-${mode}-${record?.id \|\| 'new'}`}` en Sidepanel router |
| Budget mini-form | Navigates to `EjecucionEntity` with defaults (no inline create) |
| Entity submit contract | `onSubmit({ mode: 'create'\|'edit'\|'archive', entity, record?, data })` — propio, no reusa legacy |
| Extracto structure | Sub-archivos: Entity + AddView + EditView + View |
| Ejecucion structure | Sub-archivos: Entity + Form + View |
| SettingsEditor | Reused as-is (edit mode only) |
| CustomizePanel | Preserved as-is (not an entity) |
| TerceroGroupPanel | Preserved as-is (aggregate view) |
