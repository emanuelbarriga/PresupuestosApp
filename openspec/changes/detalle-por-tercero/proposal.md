# Proposal: Detalle por Tercero

## Intent

Dashboard shows project × month totals but no visibility into **which terceros** compose those numbers. Users need budgets/ejecuciones grouped by tercero per project — understand concentration, compare budget vs execution per third party, and drill into details.

## Scope

### In Scope
- `DetalleTerceroGroup` interface + `'detalle-tercero'` RecordDetail variant in types
- Button in Dashboard header opening grouped tercero view in sidepanel
- Project → tercero hierarchy with aggregate totals (Presupuestado, Ejecutado, Diferencia)
- Click tercero row → DataPanel filtered by project+tercero
- Grouping logic: aggregate by entityId across current year's budgets/ejecuciones

### Out of Scope
- Year selector for aggregated view, CSV/PDF export, editing from grouped view
- Real-time updates while panel is open (data captured at open time)

## Capabilities

### New Capabilities
- `detalle-tercero`: Grouped tercero view accessible from Dashboard. Renders projects with nested tercero rows showing aggregate amounts. Supports drill-down into DataPanel.

### Modified Capabilities
- None

## Approach

1. **Types**: Add `DetalleTerceroGroup { entityId, entityName, entityType, budgets, ejecuciones, totalPresupuestado, totalEjecutado, diferencia }` — data-only, no derived state. Add `RecordDetail` variant `{ type: 'detalle-tercero', projectId, projectName, groups[], totalPresupuestado, totalEjecutado }`.
2. **TerceroGroupPanel**: New sub-component in Sidepanel, registered inside ViewPanel dispatch. Groups budgets/ejecuciones by entityId (`Map<string, {item, budgets, ejecuciones}>`), sums per group, renders hierarchy. Project header collapsible.
3. **Dashboard button**: Add in header between mode switch and Negociación toggle. On click, builds grouped data from filteredBudgets/filteredEjecuciones, sets recordDetail on parent via callback.
4. **Drill-down**: Tercero row click constructs a `SidepanelData` with that project+tercero's records and opens DataPanel.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/types.ts` | Modified | Add `DetalleTerceroGroup` + RecordDetail variant |
| `components/Sidepanel.tsx` | Modified | New TerceroGroupPanel, wire into ViewPanel |
| `components/Dashboard.tsx` | Modified | Button in header, build grouped data |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Performance on large datasets | Low | O(n) grouping, no extra reads |
| Zero-value tercero clutter | Low | Filter groups where both values are 0 |

## Rollback Plan

Revert 3 files. Button disappears, sidepanel returns to previous behavior. No data migration needed.

## Dependencies

- None. All data in `budgets` and `ejecuciones` props.

## Success Criteria

- [ ] Button visible when budgets/ejecuciones exist, opens sidepanel with grouped terceros
- [ ] Each tercero row shows Presupuestado, Ejecutado, Diferencia (COP)
- [ ] Clicking a tercero row opens DataPanel filtered to that project+tercero
- [ ] Zero-activity tercero groups hidden
- [ ] All existing tests pass
