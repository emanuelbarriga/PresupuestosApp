# Delta for sidepanel-entity-components

**Change**: soportes-entidad — add SoportesTab component and entity view tabs

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: R12-R21 — Per-entity feature preservation

Tercero and Project View modes SHALL display a tab bar — "Detalle" (default) and "Soportes". Unchanged entities (Budget, Ejecucion, Cuenta, Extracto, Settings, Invitacion, Colaborador, Compania) keep their existing behavior.

| Entity | View (MUST display) — changed rows only | Create/Edit (unchanged) |
|--------|------------------------------------------|-------------------------|
| Project | **[Tab Detalle]** DF fields + estado inline save + inferidos flow + grouped lists + subscribeCompanySettings \| **[Tab Soportes]** `<SoportesTab projectId={record.id} />` | sigla + nombre + ColorSelect tipoProyectos + cantidad + ColorSelect unidades + SearchableSelect cliente + ColorSelect estado + soloEgresos |
| Tercero | **[Tab Detalle]** DF (nombre/apodo/naturaleza/documento/lugar/tipo badge) + "Editar" \| **[Tab Soportes]** `<SoportesTab terceroId={record.id} />` | nombre + apodo + select naturaleza + select documento + número + lugar + select tipo |

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
