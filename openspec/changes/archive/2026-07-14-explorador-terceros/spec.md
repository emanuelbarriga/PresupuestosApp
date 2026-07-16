# Explorador por Terceros — Specification

> Change: `explorador-terceros` (2026-07-14)

## Purpose

Add a "Por Tercero" tab in MediaPage that groups linked documents by tercero (vendor/client), enabling document exploration without leaving the media view. Uses the same entity navigation pattern (`{ entity: 'documento', mode: 'view' }`) defined in the sidepanel-entity-components spec.

## ADDED Requirements

### R1: MediaPage — three-tab bar

The `activeTab` type SHALL include `'explorador'`. The tabs array SHALL be `['inbox', 'archivador', 'explorador']`. Styling MUST match existing tabs (same container, active/inactive colors, indicator). Default active tab remains `'inbox'`.

| # | GIVEN | WHEN | THEN |
|---|-------|------|------|
| 1a | MediaPage renders | Tab bar displayed | "Por Tercero" appears as third tab after "Archivador" |
| 1b | "Inbox" tab active | User clicks "Por Tercero" | Inbox content hidden; `<ExploradorTercerosTab>` rendered |
| 1c | "Por Tercero" active | User clicks it again | No change (no-op) |

### R2: ExploradorTercerosTab — grouped document explorer

**Props**: `{ companyId: string; onNavigate: (screen: NavScreen) => void }`

The component SHALL:

| # | Behavior | Detail |
|---|----------|--------|
| 2a | Subscribe all linked docs | `subscribeDocumentos(companyId, { status: 'enlazado' }, onData)` — no entity filter |
| 2b | Subscribe terceros | `subscribeTerceros()` — resolves tercero name per `terceroId` |
| 2c | Group by terceroId | Map `<string, Documento[]>`; `terceroId` null/undefined → key `"__sintercero__"` |
| 2d | Group header | Tercero name (or "Sin tercero") + `(N)` count badge |
| 2e | Expand/collapse | Accordion list — collapsed by default; click header toggles expansion |
| 2f | Expanded cards | Document card per item: fileName, tipoDocumento badge, periodo, montoTotal (COP) |
| 2g | Card click | `onNavigate({ type: 'entity', entity: 'documento', mode: 'view', record: doc })` |
| 2h | Empty state | Show "No hay documentos enlazados" when subscription returns `[]` |
| 2i | Loading state | Show spinner while initial subscription has no data |

| # | GIVEN | WHEN | THEN |
|---|-------|------|------|
| 2j | 3 docs for t1, 2 docs for t2 | Grouping completes | "T1 (3)" and "T2 (2)" headers; both collapsed |
| 2k | Group collapsed | User clicks header | Cards visible for that group; other groups remain collapsed |
| 2l | Doc with null `terceroId` | Grouping completes | "Sin tercero (1)" header rendered |
| 2m | Subscription returns `[]` | Data arrives | "No hay documentos enlazados" displayed |
| 2n | Component mounts | No data yet | Spinner shown |
| 2o | Card visible | User clicks card | `onNavigate` called with entity:documento, mode:view |

## Acceptance Criteria

1. `npx tsc --noEmit` passes
2. `npm test` passes
3. Three tabs in MediaPage: Inbox, Archivador, Por Tercero
4. ExploradorTercerosTab groups docs correctly by terceroId, handles null terceroId
5. Expand/collapse accordion works; document card click navigates to view
6. Empty and loading states render correctly
