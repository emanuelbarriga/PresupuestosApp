# Sidepanel Entity Components — Specification

> Changes: `soportes-entidad` (2026-07-14) · Capability: `sidepanel-entity-components`

## Purpose

Per-entity component contract unifying create/edit/view modes for 10 entities (Budget, Ejecucion, Project, Tercero, Cuenta, Extracto, Settings, Invitacion, Colaborador, Compania). Replaces FormPanel/ViewPanel/DataPanel dispatch with `{ entity, mode }` routing. All existing features preserved — zero exclusion.

## Requirements

### R1: Mode contract — Render correct UI per mode

Each entity component MUST render `create | edit | view` modes. View mode is read-only (entity-specific inline actions allowed). Edit pre-fills record data. Create starts empty with defaults.

| # | GIVEN | WHEN | THEN |
|---|-------|------|------|
| 1a | mode=`view`, record present | component mounts | DF fields displayed; no form inputs |
| 1b | mode=`edit`, record present | component mounts | Form pre-filled with record data |
| 1c | mode=`create` | component mounts | Form inputs empty (defaults applied) |

### R2-R3: Navigation — entity+mode

Sidepanel router MUST accept `{ entity: EntityType, mode: 'create'|'edit'|'view', record?, defaults? }` instead of separate data/view/form NavScreen types.

| # | GIVEN | WHEN | THEN NavScreen |
|---|-------|------|---------------|
| 2a | User clicks budget row | navigate to view | `{ entity:'budget', mode:'view', record }` |
| 2b | Budget mini-form "Agregar" | navigate to create ejecucion | `{ entity:'ejecucion', mode:'create', defaults }` |

### R4-R6: Navigation — EntityType and preserved panels

- **EntityType** (R29): `'budget'|'ejecucion'|'project'|'tercero'|'cuenta'|'extracto'|'settings'|'invitacion'|'colaborador'|'compania'`
- **CustomizePanel** (R8): retained as-is (not an entity, ViewMode='filter')
- **DetalleTercero** (R9): retained as aggregate view (`TerceroGroupPanel`)
- Old NavScreen types (`data/view/form`) removed in cutover only (R28)

### R7, R31: Archiving via onFormSubmit

onFormSubmit handler MUST detect `actionType: 'archive'` and call `updateBudget`/`updateEjecucion` directly — no field validation, no batch writes.

| # | GIVEN | WHEN onFormSubmit receives | THEN |
|---|-------|------|------|
| 7a | Budget entity, any mode | `{ actionType:'archive', archivado:true }` | updateBudget called; validation skipped; stack pops |

### R10-R11: EntityList + Subscription cleanup

**EntityList** (R10-R13, R22-R26): MUST handle 5 dashboard entry points. Renders budgets/ejecuciones grouped by entity (groupByEntity). Group header = entity name + total. Each row = descripcion + monto + actions (Ver/Editar/Archivar with confirm/Ejecutar). Ejecuciones show ComprobantesViewer inline. Footer = presupuestado/ejecutado/diferencia.

**Subscription cleanup** (R11): ALL useEffect Firestore subscriptions MUST include `mode` in dependency array. Mode switches clean up old subscriptions.

### R12-R21: Per-entity feature preservation

| Entity | View (MUST display) | Create/Edit (MUST preserve) |
|--------|---------------------|-----------------------------|
| Budget | DF fields + subscribeEjecucionesByBudget + inline mini-form (desc, monto, fecha + save) | TipoSwitch + SearchableSelect proyecto/cliente (inline "Nuevo") + Calc + fecha→mes + recurrencia (create only) |
| Ejecucion | DF fields + budgetLinks + desvincular + onSnapshot to doc + derivarEstadoComprobantes + ComprobantesViewer delete | TipoSwitch + proyecto/cliente + Calc + fecha + multi-budget linking + sum verify + ComprobanteUploader (preGeneratedId, generateFilePath, uploadFile, pending/saved) + cuenta + recurrencia (create only) |
| Project | **[Tab Detalle]** DF fields + estado inline save + inferidos flow + grouped lists + subscribeCompanySettings \| **[Tab Soportes]** `<SoportesTab projectId={record.id} />` | sigla + nombre + ColorSelect tipoProyectos (allowCustom) + cantidad + ColorSelect unidades (allowCustom) + SearchableSelect cliente + "Nuevo cliente rápido" + ColorSelect estado + soloEgresos checkbox |
| Tercero | **[Tab Detalle]** DF (nombre/apodo/naturaleza/documento/lugar/tipo badge) + "Editar" \| **[Tab Soportes]** `<SoportesTab terceroId={record.id} />` | nombre + apodo + select naturaleza + select documento + número + lugar + select tipo |
| Cuenta | **NEW**: DF nombre/banco/tipo/número/moneda/saldoInicial/saldoActual | nombre + banco + select tipo + número + select moneda + saldoInicial; add: saldoActual=saldoInicial |
| Extracto | **NEW**: DF mes/año/saldos/estado badge/archivo link/totalMovimientos | add: drag-drop PDF (max 10MB) + parseForPreview + ExtractoParseModal + upload + batch save; edit: manual fields + PDF replace + re-parse existing |
| Settings | n/a | edit only: list (name+color), add inline, delete, reorder up/down, save via updateSettings |
| Invitacion | **NEW**: DF empresas/email/rol/expiración/estado | create: empresas checkboxes + email + rol toggle + expiración (1d/3d/7d) + enviar; edit: empresa+email readonly |
| Colaborador | **NEW**: DF email + memberships list (company+role+status) | edit: email readonly + per-company toggle (blockMember) + "Agregar a otras empresas" + addMemberToCompany + updateMemberRole |
| Compania | **NEW**: DF nombre + created date | create: nombre + POST /api/companies/create + success redirect ("Ir a empresa") |

(Previously: Tercero and Project had no tabs — all content was directly visible. SoportesTab is new.)

Tab bar styling SHALL match MediaPage:
- Container: `border-b border-slate-200 px-6 flex gap-0`
- Active: `text-indigo-600` with bottom indicator `h-0.5 bg-indigo-600 rounded-full`
- Inactive: `text-slate-500 hover:text-slate-700`
- Tabs MUST be inside the scroll container (after PanelHeader), NOT in the entity header

#### Scenario: TerceroView — Detalle by default

- GIVEN user navigates to view a tercero
- WHEN TerceroView renders
- THEN "Detalle" is active — DF fields and Edit button visible; "Soportes" tab exists but not rendered

#### Scenario: TerceroView — switch to Soportes

- GIVEN TerceroView with "Detalle" active
- WHEN user clicks "Soportes"
- THEN DF fields hidden; `<SoportesTab terceroId={record.id} />` rendered

#### Scenario: ProjectView — Detalle includes accordions

- GIVEN user views a project
- WHEN ProjectView renders with "Detalle" active
- THEN DF fields, estado selector, and Presupuestos/Ejecuciones accordions are all visible

#### Scenario: ProjectView — switch to Soportes

- GIVEN ProjectView with "Detalle" active, accordions visible
- WHEN user clicks "Soportes"
- THEN DF fields, estado selector, and accordions hidden; `<SoportesTab projectId={record.id} />` rendered

#### Scenario: Re-click active tab is no-op

- GIVEN "Detalle" tab is active
- WHEN user clicks "Detalle" again
- THEN no change — same content stays rendered

### Requirement: SoportesTab component

The system SHALL provide a shared `SoportesTab` component with props: `{ companyId: string; terceroId?: string; projectId?: string; onNavigate: (screen: NavScreen) => void }`.

The component SHALL:
- Call `subscribeDocumentos(companyId, { terceroId | projectId, status: "enlazado" }, onData)` for real-time doc list
- Display each document as a card (`bg-white border border-slate-200 rounded-xl p-4`) with: fileName, tipoDocumento (badge), periodo, montoTotal (COP formatted), proveedorTexto
- Click → `onNavigate({ type: "entity", entity: "documento", mode: "view", record: doc })`
- Show "No hay documentos asociados" on empty subscription
- Show a spinner while initial subscription has no data yet

#### Scenario: Cards rendered from documents

- GIVEN SoportesTab mounts with `terceroId: "t1"` and subscription returns 3 documents
- WHEN data arrives
- THEN 3 cards show fileName, tipoDocumento badge, periodo, monto COP, proveedorTexto

#### Scenario: Empty state

- GIVEN SoportesTab mounts with `projectId: "p1"`
- WHEN subscription returns empty array
- THEN "No hay documentos asociados" is displayed

#### Scenario: Loading spinner

- GIVEN SoportesTab mounts
- WHEN subscription has not yet fired
- THEN a spinner is shown

#### Scenario: Card click navigation

- GIVEN a document card is visible
- WHEN user clicks it
- THEN onNavigate is called with `{ type: "entity", entity: "documento", mode: "view", record: doc }`

### Requirement: ExploradorTercerosTab component

The system SHALL provide an `ExploradorTercerosTab` component with props `{ companyId: string; onNavigate: (screen: NavScreen) => void }`. Unlike `SoportesTab`, it loads ALL linked documents (no entity filter) and groups them by `terceroId`.

SHALL:
- `subscribeDocumentos(companyId, { status: 'enlazado' })` — all linked docs
- `subscribeTerceros()` — resolve tercero names
- Group by `terceroId` via Map; docs with no `terceroId` → "Sin tercero" group
- Accordion list: group header = tercero name + count badge; collapsed by default
- Expanded: document cards match SoportesTab card pattern (fileName, tipoDocumento badge, periodo, montoTotal COP)
- Click card → `onNavigate({ type: 'entity', entity: 'documento', mode: 'view', record: doc })`
- "No hay documentos enlazados" on empty; spinner while loading

#### Scenario: Groups rendered from docs

- GIVEN subscription returns 3 docs for t1, 2 for t2
- WHEN grouping completes
- THEN 2 group headers with count badges; all collapsed

#### Scenario: Expand group shows cards

- GIVEN collapsed group header "T1 (3)"
- WHEN user clicks header
- THEN 3 document cards visible under that group

#### Scenario: Documents without terceroId

- GIVEN a doc has `terceroId: null`
- WHEN grouping completes
- THEN "Sin tercero (1)" header rendered

#### Scenario: Empty and loading states

- GIVEN subscription returns `[]` / has not fired yet
- WHEN data arrives / mount
- THEN "No hay documentos enlazados" / spinner

#### Scenario: Card navigates to view

- GIVEN a document card is visible inside an expanded group
- WHEN user clicks it
- THEN onNavigate called with `{ type: 'entity', entity: 'documento', mode: 'view', record: doc }`

### R27-R30: Sidepanel Router

The NEW NavScreen type SHALL be:
```typescript
{ entity: EntityType; mode: 'create' | 'edit' | 'view'; record?: any; defaults?: Record<string, string> }
```

- CustomizePanel and DetalleTercero retain current NavScreen types (R30)
- Old types removed in cutover only (R28)

### R32-R35: Testing

| # | Requirement | What MUST pass |
|---|-------------|----------------|
| R32 | Smoke per entity | Each entity component renders create/edit/view without crash |
| R33 | Feature preservation | Each preserved feature (from table above) renders in expected mode |
| R34 | Comprobante pipeline | Upload flow, pending vs saved, preGeneratedId work in Ejecucion |
| R35 | Archive via onFormSubmit | actionType:'archive' calls updateBudget/updateEjecucion directly |

## Acceptance Criteria

1. `npx tsc --noEmit` passes
2. `npm test` passes (existing tests + new entity tests)
3. 10 entity components under `components/entities/` handling create/edit/view
4. 5 new view modes (Cuenta, Extracto, Invitacion, Colaborador, Compania) render DF
5. All preserved features verified by per-entity smoke tests
6. Archiving routes through onFormSubmit (not direct calls in DataPanel)
