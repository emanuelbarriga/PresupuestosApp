# Proposal: Entity References by ID

## Intent

Budget, Ejecucion, and Project store entity relationships as plain-text names. Renaming a project or client orphans all associated budgets/ejecuciones — Dashboard grouping, Datos filtering, and `handleProjectClick` all break. We need ID-based references with immutable name snapshots for historical accuracy.

## Scope

### In Scope
1. Add `projectId`, `entityId`, `entityType` to Budget and Ejecucion types
2. Rename `proyectoAsignado` → `projectName`, `clienteOProveedor` → `entityName` (immutable snapshots)
3. `Project.clientId` already exists — keep; `clientName` stays as snapshot
4. Update all CRUD in `firestore.ts` for new fields
5. Fix name-based comparisons in Dashboard (matrixData), Datos (proyectosConData), Sidepanel (search/link), page.tsx (handleProjectClick) to use IDs
6. Update Sidepanel forms to resolve entity IDs on submit
7. One-shot migration script to backfill IDs from existing name matches
8. Budget-to-Ejecucion linking (budgetId) remains ID-based

### Out of Scope
- Backfilling historical name changes (snapshots frozen at creation)
- Removing old string fields from Firestore (backward compat)

## Capabilities

### New Capabilities
- `entity-references`: ID-based entity reference system across Budget, Ejecucion, and Project with immutable name snapshots

### Modified Capabilities
- None — existing specs (budget-date, company-selection, firestore-tests, sidepanel-testing) unchanged at spec level

## Approach

Hybrid ID+snapshot. Add reference fields to types, keep snapshots frozen at creation time. Forms resolve selected name → ID + entityType on submit. Display uses snapshot names; aggregation/filtering uses IDs. Migration matches current names to entity IDs.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/types.ts` | Modified | Budget, Ejecucion new fields + renames |
| `lib/firestore.ts` | Modified | CRUD ops pass new fields |
| `components/Dashboard.tsx` | Modified | Group by projectId |
| `components/Datos.tsx` | Modified | Join by projectId |
| `components/Sidepanel.tsx` | Modified | Forms resolve/store IDs |
| `app/[company]/page.tsx` | Modified | Handlers use IDs |
| `scripts/migrate-references.ts` | New | One-shot backfill |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|-------------|
| Orphan IDs after rename | Medium | Migration matches name→entity at runtime; unmatched keep snapshot fallback |
| Typed form submission mismatch | Low | TypeScript catches; UI updates are scoped together |

## Rollback Plan

Revert type changes and UI updates. Old string fields remain in Firestore — no data loss. Migration is idempotent.

## Dependencies

- None

## Success Criteria

- [ ] Renaming a project preserves all its budget/ejecucion history in Dashboard and Datos
- [ ] Renaming a client preserves all project and budget/ejecucion references
- [ ] Migration script backfills IDs for all existing records
- [ ] All existing tests pass
