# Design: Entity References by ID

## Technical Approach

Hybrid ID+snapshot — add `projectId`, `entityId`, `entityType` to Budget/Ejecucion, freeze `projectName`/`entityName` at creation. Dashboard groups by `projectId`, Datos joins by `projectId`, Sidepanel resolves doc IDs on submit. Migration backfills IDs from name matches.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| New fields on Budget/Ejecucion | Add IDs + renames | ID-only (breaks history), name-only (current orphans) | Hybrid allows ID aggregation + frozen display. Old Firestore fields kept for backward compat |
| Dashboard groups by projectId | `matrixData` key = `b.projectId`, fallback `b.projectName` | Name-only (breaks on rename) | Empty-ID fallback protects pre-migration docs without crashing |
| Sidepanel resolves IDs on submit | One resolution point in `handleSubmit` | Resolve per-field (duplication), Firestore-layer (coupling) | Single atomic point keeps fields in sync — ID + snapshot set together |
| Edit form shows snapshots | Pre-populates snapshot names, no ID→name resolution | Resolve current name (breaks "show what was recorded") | Snapshot immutability extends to edit UX — user sees what was stored |

## Data Flow

```
FormPanel: select project/entity
  │ onChange: stores projectId, entityId in fields map
  │ handleSubmit:
  │   ├─ resolve entityType from clientsAndProviders
  │   └─ data = { projectId, projectName, entityId, entityName, entityType, ...rest }
  ▼
page.tsx handleFormSubmit → addBudget/Ejecucion(companyId, data)
  ▼
Firestore doc → subscribeBudgets → Budget[] (new fields via spread)
  │
  ├─ Dashboard.matrixData: groupBy b.projectId || b.projectName
  ├─ Datos: filter b.projectId === p.id
  └─ handleProjectClick: match by projectId
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/types.ts` | Modify | Budget/Ejecucion: +`projectId`, +`entityId`, +`entityType`, rename `proyectoAsignado→projectName`, `clienteOProveedor→entityName` |
| `lib/firestore.ts` | Modify | No signature changes — `d.data()` spread picks up new fields automatically |
| `components/Dashboard.tsx` | Modify | `matrixData` groups by `projectId` (L153); `onProjectClick` passes `projectId` |
| `components/Datos.tsx` | Modify | `proyectosConData` filters by `projectId` (L81); search uses `projectName`/`entityName` (L127,138) |
| `components/Sidepanel.tsx` | Modify | FormPanel resolves doc IDs on submit; SearchableSelect uses `{ value: id, label: name }`; `BudgetView.handleAddEj` copies IDs (L393) |
| `app/[company]/page.tsx` | Modify | `handleProjectClick` matches by `projectId` not `projectName` (L157-166); `handleFormSubmit` passes new fields |
| `scripts/migrate-references.ts` | Create | One-shot backfill via name matches across all companies |

## Interfaces / Contracts

```ts
interface Budget {
  id: string;
  descripcion: string;
  projectId: string;                   // NEW
  projectName: string;                 // renamed from proyectoAsignado
  entityId: string;                    // NEW
  entityName: string;                  // renamed from clienteOProveedor
  entityType: 'client' | 'provider' | 'interno';  // NEW
  tipo: TransactionType;
  montoPresupuestado: number;
  mesPresupuestado: Month;
  fechaPresupuestado: string;
  estadoProyecto: ProjectState;
}

interface Ejecucion {
  id: string;
  descripcion: string;
  projectId: string;                   // NEW
  projectName: string;                 // renamed
  entityId: string;                    // NEW
  entityName: string;                  // renamed
  entityType: 'client' | 'provider' | 'interno';  // NEW
  tipo: TransactionType;
  montoEjecutado: number;
  fechaEjecutado: string;
  budgetId?: string;
}
```

### Form Resolution Contract (Sidepanel → handleFormSubmit)

Budget/Ejecucion submit payload always includes:
- `projectId`: selected project's Firestore doc ID (or `""` if no match)
- `projectName`: displayed project name (snapshot at creation)
- `entityId`: selected client/provider doc ID (`""` for `interno`)
- `entityName`: displayed entity name
- `entityType`: `"client"` | `"provider"` | `"interno"`

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | Budget/Ejecucion serialize with new fields | Create objects with all new fields, verify typed |
| Unit | Dashboard groups by projectId | Feed budgets same `projectId` different `projectName` → yields 1 group |
| Unit | Datos joins by ID | Budget with `projectId="x"`, project with `id="x"` → filter matches |
| Unit | Sidepanel resolves IDs | Mock clients/providers, verify `handleSubmit` output has correct `entityId`/`entityType` |
| Unit | Migration idempotent | Run twice on same data — second pass makes no changes |
| Integration | Pre-migration doc tolerated | Doc without `projectId` → app does not crash, fallback to `projectName` |

## Migration / Rollout

**Script**: `scripts/migrate-references.ts`. Reads all Budgets/Ejecuciones per company, matches `proyectoAsignado` → project docs (by company subcollection), matches `clienteOProveedor` → clients & providers (root collections). Writes `projectId`, `entityId`, `entityType`. Skips docs already having `projectId` (idempotent). Runs independently before code deploy.

**Rollback**: Revert all TS/UI changes. Firestore retains old string fields — no data dependency on new fields. Migration is safe to re-run after rollback.

## Open Questions

None.
