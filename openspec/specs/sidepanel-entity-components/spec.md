# Sidepanel Entity Components — Specification

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
| Project | DF fields + estado inline save + inferidos flow (+ "Crear proyecto") + grouped lists (groupByEntity) + subscribeCompanySettings | sigla + nombre + ColorSelect tipoProyectos (allowCustom) + cantidad + ColorSelect unidades (allowCustom) + SearchableSelect cliente + "Nuevo cliente rápido" + ColorSelect estado + soloEgresos checkbox |
| Tercero | DF (nombre/apodo/naturaleza/documento/lugar/tipo badge) + "Editar" → edit mode | nombre + apodo + select naturaleza + select documento + número + lugar + select tipo |
| Cuenta | **NEW**: DF nombre/banco/tipo/número/moneda/saldoInicial/saldoActual | nombre + banco + select tipo + número + select moneda + saldoInicial; add: saldoActual=saldoInicial |
| Extracto | **NEW**: DF mes/año/saldos/estado badge/archivo link/totalMovimientos | add: drag-drop PDF (max 10MB) + parseForPreview + ExtractoParseModal + upload + batch save; edit: manual fields + PDF replace + re-parse existing |
| Settings | n/a | edit only: list (name+color), add inline, delete, reorder up/down, save via updateSettings |
| Invitacion | **NEW**: DF empresas/email/rol/expiración/estado | create: empresas checkboxes + email + rol toggle + expiración (1d/3d/7d) + enviar; edit: empresa+email readonly |
| Colaborador | **NEW**: DF email + memberships list (company+role+status) | edit: email readonly + per-company toggle (blockMember) + "Agregar a otras empresas" + addMemberToCompany + updateMemberRole |
| Compania | **NEW**: DF nombre + created date | create: nombre + POST /api/companies/create + success redirect ("Ir a empresa") |

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
