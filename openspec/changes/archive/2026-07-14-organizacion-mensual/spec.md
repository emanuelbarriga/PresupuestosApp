# Delta Spec: Organización Mensual (Archivador Contable)

> Change: `organizacion-mensual` · Proposal: `openspec/changes/organizacion-mensual/proposal.md`

## ADDED Capability: archivador-mensual

### Requirement: Media Page Tabs

The system SHALL display two tabs in `MediaPage`: **Inbox** (default, active on mount) and **Archivador**. Tab switch uses React conditional render (`{activeTab === 'inbox' ? <InboxTab /> : <ArchivadorTab />}`) — the inactive component unmounts, canceling its Firestore subscriptions. The tab bar SHALL use `border-b border-slate-200` with `text-indigo-600` for the active tab.

**State preservation**: `selectedPeriod` and `activeCategory` SHALL live in `MediaPage` state and be passed as props to `ArchivadorTab`. When the user switches from Archivador to Inbox and back, the preserved state restores the exact view (same month + same category tab) without reaching for the current date default.

| State | Active Tab | Rendered Component | State Persistence |
|-------|------------|-------------------|-------------------|
| On mount | Inbox | InboxTab | — |
| User clicks Archivador | Archivador | ArchivadorTab (receives `selectedPeriod`, `activeCategory` props from MediaPage) | MediaPage holds the state |
| User returns to Archivador after visiting Inbox | Archivador | ArchivadorTab re-mounts with preserved `selectedPeriod` and `activeCategory` | Same month + category as before |

#### Scenario: Tab switch preserves archivador state

- GIVEN the user is on the Archivador tab viewing "2026-03" → factura_compra
- WHEN the user clicks "Inbox" and then clicks "Archivador" again
- THEN ArchivadorTab re-mounts with `selectedPeriod: '2026-03'` and `activeCategory: 'factura_compra'`
- AND the query runs for `periodo == '2026-03'`
- AND the factura_compra tab is pre-selected

#### Scenario: Tab switch unmounts previous component

- GIVEN the user is on the Inbox tab with a live Firestore listener
- WHEN the user clicks "Archivador"
- THEN InboxTab unmounts, the Archivador listener activates
- AND no Firestore listener for `por_clasificar` is active while ArchivadorTab is rendered

### Requirement: Year-Month Selector (Custom)

The Archivador SHALL provide a custom year-month selector using two separate `<select>` elements (year + month), NOT `<input type="month">`. This is required because the selector MUST support the special value `'sin_periodo'` which is not a valid HTML date.

The month `<select>` SHALL include a "Sin periodo" option at the top (maps to `'sin_periodo'`), followed by Enero–Diciembre (maps to `'01'`–`'12'`). The year `<select>` SHALL show a range around the current year (e.g., 2020–2030). Default selection SHALL be the current month.

When "Sin periodo" is selected, the query switches to `where('periodo', '==', 'sin_periodo')`. A visual indicator (e.g., badge or chip color change) SHALL make it clear that the unclassified filter is active.

| Select | Options | Maps to |
|--------|---------|---------|
| Year | 2020–2030 | `periodo` prefix |
| Month | Sin periodo, Enero–Diciembre | `'sin_periodo'` or `'01'`–`'12'` |

#### Scenario: Default to current month

- GIVEN the current date is 2026-07
- WHEN ArchivadorTab mounts
- THEN the year select shows "2026"
- AND the month select shows "Julio"
- AND the query filters by `periodo == '2026-07'`

#### Scenario: Selector changes to sin_periodo

- GIVEN the selector shows "2026-07"
- WHEN the user selects "Sin periodo" in the month dropdown
- THEN the query switches to `where('periodo', '==', 'sin_periodo')`
- AND a visual indicator shows the unclassified filter is active

#### Scenario: Switch from sin_periodo back to normal month

- GIVEN the selector is set to "Sin periodo"
- WHEN the user selects "Marzo" in the month dropdown
- THEN the query switches to `where('periodo', '==', '2026-03')`
- AND the visual indicator is removed

### Requirement: Single Query + Client-Side Grouping

The system SHALL subscribe with a single query: `where('periodo', '==', X).where('status', '==', 'enlazado')`. Results SHALL be grouped client-side by `tipoDocumento` (fallback to `'otro'` if undefined). Each group renders as a category tab. Switching category tabs is instant — no additional Firestore reads.

#### Scenario: Documents grouped by tipoDocumento

- GIVEN 10 enlazado documents for period "2026-07" (3 factura_venta, 2 extracto_bancario, 5 planilla)
- WHEN the query returns
- THEN 3 category tabs are shown: factura_venta (3), extracto_bancario (2), planilla (5)
- AND switching between tabs is instant

#### Scenario: Document without tipoDocumento falls back to "otro"

- GIVEN a document with `status: 'enlazado'` and no `tipoDocumento` field
- WHEN results are grouped
- THEN it appears under the "otro" category tab

### Requirement: Category Tabs (8 tipos — always visible)

The Archivador SHALL render all 8 category tabs at all times: `factura_venta`, `factura_compra`, `extracto_bancario`, `comprobante_egreso`, `comprobante_ingreso`, `planilla`, `contrato`, `otro`. Each tab SHALL show a document count badge next to its label. Categories with 0 documents SHALL show "(0)" and render an empty state in the grid area. This ensures the accounting filing cabinet mental model is always consistent.

| Tab State | Badge | Grid Area |
|-----------|-------|-----------|
| Has documents | "(3)" | Document cards |
| Empty (0 docs) | "(0)" | Empty state: "No hay documentos de este tipo en {mes}" |

#### Scenario: All 8 tabs visible with mixed counts

- GIVEN documents only in factura_venta (3) and planilla (1) for the selected month
- WHEN the Archivador renders
- THEN all 8 tabs are visible
- AND factura_venta shows "(3)", planilla shows "(1)"
- AND the remaining 6 tabs show "(0)"
- AND clicking an empty tab shows an empty state message

#### Scenario: Month with zero documents

- GIVEN a month with no documents at all (all categories = 0)
- WHEN the Archivador renders
- THEN all 8 tabs are visible with "(0)"
- AND the first tab (factura_venta) is active by default
- AND shows an empty state: "No hay documentos de este tipo en {mes}"

### Requirement: Document Grid per Category

Each category tab SHALL render a card grid with: `fileName`, `metadata.proveedorTexto`, `projectId` (resolved to project name), `metadata.montoTotal`, and `periodo`. Clicking a card SHALL open `DocumentoSidepanel` in edit mode.

| Card Field | Source | Format |
|------------|--------|--------|
| File name | `fileName` | Truncated with ellipsis |
| Provider | `metadata.proveedorTexto` | Plain text, "—" if empty |
| Project | `projectId` → projectName lookup | Resolved label |
| Amount | `metadata.montoTotal` | Formatted COP |
| Date | `periodo` | YYYY-MM |

#### Scenario: Grid renders correctly

- GIVEN 6 documents in the factura_venta category
- WHEN the user clicks the factura_venta tab
- THEN 6 cards are rendered
- AND each card shows fileName, proveedorTexto (or "—"), project name, montoTotal, and periodo

#### Scenario: Card click opens sidepanel

- GIVEN a document card is visible
- WHEN the user clicks it
- THEN DocumentoSidepanel opens in edit mode with the document data pre-loaded

### Requirement: Partial Sum (Safe Pattern)

The system SHALL display the sum of `montoTotal` for the visible category using `Number()` + `isNaN()` guard. An indicator SHALL show "X de Y documentos con monto" where X is the count of documents with a valid numeric `montoTotal` and Y is the total documents in the category.

#### Scenario: Mixed montos in category

- GIVEN a category with 5 documents: 3 with `montoTotal: 1000000`, 1 with `montoTotal: 500000`, 1 without montoTotal
- WHEN the grid renders
- THEN the sum shows "$1.500.000"
- AND the indicator reads "4 de 5 documentos con monto"

#### Scenario: No documents have monto

- GIVEN a category with 4 documents, none with `montoTotal`
- WHEN the grid renders
- THEN the sum shows "$0"
- AND the indicator reads "0 de 4 documentos con monto"

### Requirement: Unclassified Documents Banner

The system SHALL show a banner at the top of the Archivador when documents with `status: 'enlazado'` and `periodo == 'sin_periodo'` exist. The count SHALL be fetched with `getCountFromServer()` on mount (not `onSnapshot`). Clicking the banner SHALL show those documents (either switching the selector to `'sin_periodo'` or displaying them inline).

| State | Banner Display |
|-------|---------------|
| No unclassified documents | Hidden |
| 5 documents with `periodo == 'sin_periodo'` | Visible: "5 documentos sin periodo asignado" |

#### Scenario: Banner loads with getCountFromServer

- GIVEN there are 7 documents with `periodo: 'sin_periodo'` and `status: 'enlazado'`
- WHEN ArchivadorTab mounts
- THEN `getCountFromServer()` returns 7
- AND the banner shows "7 documentos sin periodo asignado"
- AND no `onSnapshot` listener is active for this query

#### Scenario: User clicks banner

- GIVEN the banner shows "3 documentos sin periodo asignado"
- WHEN the user clicks the banner
- THEN the year-month selector switches to `'sin_periodo'`
- AND documents with that value populate the grid

### Requirement: Sidepanel Pre-Fill (Edit Mode)

When editing a document with `status: 'enlazado'` from the Archivador, the sidepanel SHALL pre-populate all classification fields (`tipoDocumento`, `periodo`, `terceroId`, `projectId`, `ejecucionIds`, `metadata`) from the existing document data. Save SHALL call `linkDocumentoToEntities()`, which syncs `_linkedDocumentos` on linked ejecuciones (added/kept/removed).

#### Scenario: Pre-fill from existing enlazado

- GIVEN a document has `tipoDocumento: 'factura_venta'`, `periodo: '2026-07'`, `terceroId: 'abc'`, `metadata.montoTotal: 1500000`
- WHEN the user clicks the document card in the Archivador
- THEN DocumentoSidepanel opens with all fields pre-populated
- AND the form is in edit mode

### Requirement: Elegant Disappearance

After saving changes from the Archivador sidepanel, if the updated `periodo` or `tipoDocumento` no longer matches the current Archivador filter, the system SHALL close the sidepanel and show a toast: "Documento movido a {nuevo mes}" or "Documento reclasificado a {nuevo tipo}".

#### Scenario: Periodo changed to different month

- GIVEN the Archivador filter is "2026-07" and the document has `periodo: '2026-07'`
- WHEN the user edits and sets `periodo: '2026-08'`
- THEN the sidepanel closes
- AND a toast reads "Documento movido a 2026-08"
- AND the document disappears from the current grid (on next snapshot)

#### Scenario: Document stays in filter after edit

- GIVEN the Archivador filter is "2026-07" and the document has `periodo: '2026-07'`
- WHEN the user edits metadata but keeps `periodo: '2026-07'` and the same `tipoDocumento`
- THEN the sidepanel closes normally
- AND no toast about movement is shown
- AND the document remains in the grid

## MODIFIED Capability: document-upload

### Requirement: Inbox Extracted to InboxTab

The current `MediaPage` content (dropzone, upload progress, inbox grid with `status == 'por_clasificar'` query) SHALL be extracted to a new component `InboxTab.tsx` without functional changes. `MediaPage` becomes a tab container rendering `<InboxTab />` by default.

(Previously: MediaPage rendered dropzone + inbox grid directly. Navigation was monolithic — no tab structure.)

#### Scenario: InboxTab renders same content as before

- GIVEN `/media` loads
- WHEN MediaPage renders
- THEN InboxTab is active by default
- AND the dropzone, upload progress, and inbox grid appear exactly as before
- AND the same Firestore query (`status == 'por_clasificar'`) executes

## ADDED Requirement: Schema Defaults

### Requirement: Default Values for periodo and tipoDocumento

When creating or updating a `DocumentoMedio`, if `periodo` is not provided, the system SHALL default to `'sin_periodo'`. If `tipoDocumento` is not provided, the system SHALL default to `'otro'`. This applies at the schema/save layer in `lib/schemas.ts`, not at the form validation level.

| Field | Zod Status | Default Behavior |
|-------|-----------|------------------|
| `periodo` | Currently `.optional()` | Default `'sin_periodo'` in save/update (field remains optional in forms) |
| `tipoDocumento` | Currently `.optional()` | Default `'otro'` in save/update (field remains optional in forms) |

#### Scenario: Upload without periodo defaults to sin_periodo

- GIVEN a user uploads a file via inbox
- WHEN the DocumentoMedio is created
- THEN `periodo` is set to `'sin_periodo'`
- AND `status` is `'por_clasificar'`

#### Scenario: Classify without tipoDocumento defaults to otro

- GIVEN a user calls `linkDocumentoToEntities()` without providing `tipoDocumento`
- WHEN the document transitions to `'enlazado'`
- THEN `tipoDocumento` is set to `'otro'`

## MODIFIED Requirement: Firestore Rules

### Requirement: Enlazado Validation for periodo and tipoDocumento

Firestore rules SHALL validate that when `status == 'enlazado'`, both `request.resource.data.periodo` and `request.resource.data.tipoDocumento` are `string` type. Writes from client SDKs that leave these fields undefined SHALL be rejected. Admin SDK writes bypassing rules are unaffected.

(Previously: No validation of `periodo` or `tipoDocumento` on `enlazado` documents.)

| Status | periodo | tipoDocumento | Allowed? |
|--------|---------|---------------|----------|
| enlazado | `is string` | `is string` | Yes |
| enlazado | undefined | `is string` | No |
| enlazado | `is string` | undefined | No |
| por_clasificar | any | any | Yes (current rules apply) |

#### Scenario: Write with missing periodo rejected

- GIVEN a client attempts to write a document with `status: 'enlazado'` and no `periodo` field
- WHEN the write reaches Firestore
- THEN the write is denied (permission-denied)
- AND the document remains unchanged

#### Scenario: Write with periodo string succeeds

- GIVEN a client writes a document with `status: 'enlazado'`, `periodo: '2026-07'`, `tipoDocumento: 'factura_venta'`
- WHEN the write reaches Firestore
- THEN it is allowed

### Backfill: Existing Enlazado Documents

Before deploying the hardened Firestore rules, a one-time backfill script SHALL run against all existing `enlazado` documents that are missing `periodo` or `tipoDocumento`. Each document SHALL receive `periodo: 'sin_periodo'` if missing, and `tipoDocumento: 'otro'` if missing. This prevents the new rules from making existing documents immutable.

The backfill SHALL be a separate script (`scripts/backfill-documento-defaults.ts`) that:
1. Queries `/companies/{cId}/documentos` where `status == 'enlazado'`
2. For each document, checks if `periodo` or `tipoDocumento` is missing
3. Batch-updates with `writeBatch` (500 at a time)
4. Logs the count of documents updated per company

| Step | Action | Details |
|------|--------|---------|
| 1 | Query | All `enlazado` documents across companies |
| 2 | Check | `periodo` missing? Set `'sin_periodo'`; `tipoDocumento` missing? Set `'otro'` |
| 3 | Write | `writeBatch` in batches of 500 |
| 4 | Rules deploy | Only after backfill completes successfully |

#### Scenario: Backfill enlazado documents

- GIVEN 100 `enlazado` documents exist — 20 without `periodo`, 10 without `tipoDocumento`, 5 without both
- WHEN the backfill script runs
- THEN 25 documents are updated (20 + 5 get `periodo: 'sin_periodo'`, 10 + 5 get `tipoDocumento: 'otro'`)
- AND the script logs "25 documentos actualizados"
- AND the hardened rules can be deployed safely
