# Tasks: Entity References by ID

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~250–300 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-always |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Types + Migration + Core + UI wiring | Single PR | One concern — types cascade everywhere; well under 400 lines |

## Phase 1: Foundation

- [x] 1.1 Modify `lib/types.ts` — Add `projectId`, `entityId`, `entityType` to `Budget` and `Ejecucion`; rename `proyectoAsignado` → `projectName`, `clienteOProveedor` → `entityName`
- [x] 1.2 Create `scripts/migrate-references.ts` — Backfill `projectId`/`entityId`/`entityType` for existing docs by matching names to doc IDs per company. Skip docs already having `projectId` (idempotent)

## Phase 2: Core ID Resolution

- [x] 2.1 Update `FormPanel.handleSubmit` (Sidepanel.tsx) — Resolve `projectId` from selected project, `entityId`/`entityType` from selected entity; keep snapshot names as-is
- [x] 2.2 Update `SearchableSelect` options — Projects use `{ value: id, label: name }`; entity list uses `{ value: id, label: name, type }` for resolution
- [x] 2.3 Update `FormPanel.handleCreateProject`/`handleCreateClient` — Set `projectId`/`entityId` on new inline creations
- [x] 2.4 Update `BudgetView.handleAddEj` — Copy `projectId`, `entityId`, `entityType` from source budget to linked ejecucion payload

## Phase 3: UI Wiring

- [x] 3.1 Update `Dashboard.matrixData` — Group by `b.projectId || b.projectName`; change `onProjectClick` to pass `projectId`
- [x] 3.2 Update `Datos.proyectosConData` — Filter by `projectId === p.id` instead of name match; update search fields to `projectName`/`entityName`
- [x] 3.3 Update `page.tsx.handleProjectClick` — Match budgets/ejecuciones by `projectId`; update `handleEmptyCellClick` defaults to use new field names
- [x] 3.4 Update all display references — Replace `.proyectoAsignado`/`.clienteOProveedor` with new field names in Sidepanel, Dashboard, Datos, page.tsx

## Phase 4: Testing

- [x] 4.1 Write unit test — Budget/Ejecucion create with all new fields, verify correct typing
- [x] 4.2 Write unit test — Dashboard groups by `projectId`: same ID different names → 1 group
- [x] 4.3 Write unit test — Datos joins by ID: budget `projectId="x"` matches project `id="x"`
- [x] 4.4 Write unit test — Migration idempotent: second pass makes no changes
- [x] 4.5 Run `npx tsc --noEmit` + `npm test` — fix type errors and test failures
