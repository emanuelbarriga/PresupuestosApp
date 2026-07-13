# Proposal: ER Config System

## Intent

P&L has hardcoded formulas: auto-groups ALL ingresos (F1), ALL egresos (F4), "Admin" (F6), SIMPLE tax at 8.1%. Users need per-company config: which projects feed each line, dual regime, optional project links for manual fields.

## Scope

### In Scope
1. `ErConfig` type + Firestore subcollection `companies/{id}/er/config`
2. `er` EntityType + sidepanel config screen (`ErConfigPanel`)
3. Searchable project selector per P&L line (reuse CustomizePanel)
4. Tax regime toggle: `simple` (8.1% of F1) or `comun` (35% of F9)
5. `computePnL` accepts ErConfig (default = current behavior)
6. "Configurar" button in EstadoResultados header
7. Wire Sidepanel + page.tsx nav stack
8. Firestore get/save helpers

### Out of Scope
- Data migration, real-time subscriptions, config versioning, PDF export

## Capabilities

### New Capabilities
- `er-config`: Per-company P&L formula config with FormulaConfig (all-ingresos, all-egresos, all-egresos-no-admin, project-name, projects, manual, rate) and dual regime.

### Modified Capabilities
- `estado-resultados`: computePnL accepts optional ErConfig; default = identical output. F10–F12 vary by regime.

## Approach

1. **Types**: Add ErConfig, FormulaConfig, TaxRegime, 'er' EntityType.
2. **Firestore**: getErConfig / saveErConfig on `er/config` subcollection doc.
3. **Panel** (`ErConfigPanel.tsx`): Regime radio + per-line project selector. Reuse PanelHeader + searchable select from CustomizePanel.
4. **EstadoResultados**: `onConfigClick` prop, gear button in header. `computePnL(config?)` uses FormulaConfig to determine filters.
5. **Sidepanel**: Render ErConfigPanel for entity `'er'`.
6. **page.tsx**: `handleErConfigClick` pushes NavScreen `{type:'entity', entity:'er'}`. Pass to EstadoResultados.
7. **computePnL**: `simple` → F10=F1×0.081, F11=min(F8,F10). `comun` → F10=F9×0.35, F11=0.

## Affected Areas

| Area | Impact | What |
|------|--------|------|
| `lib/types.ts` | Modified | +ErConfig, FormulaConfig, TaxRegime, 'er' EntityType |
| `lib/firestore.ts` | Modified | +getErConfig, saveErConfig |
| `components/EstadoResultados.tsx` | Modified | computePnL accepts config, gear button |
| `components/panels/ErConfigPanel.tsx` | New | ~200 LOC config form |
| `components/Sidepanel.tsx` | Modified | Render ErConfigPanel for 'er' entity |
| `app/[company]/[[...segments]]/page.tsx` | Modified | handleErConfigClick wiring |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking existing P&L | Low | Default config = hardcoded behavior |
| Complex project selector UX | Medium | Reuse CustomizePanel pattern |

## Rollback Plan

Revert the 6 files. `ErConfig` is optional — zero side effects on removal.

## Dependencies

- Existing Project data for selectors
- Existing PanelHeader, CustomizePanel patterns
- Existing firestore.ts CRUD conventions

## Success Criteria

- [ ] ErConfig saves/loads per company via Firestore
- [ ] computePnL(default config) = identical current output
- [ ] Tax regime switch recalculates F10–F12 correctly
- [ ] User links specific projects to a P&L line (not auto-grouped)
- [ ] Sidepanel opens from ER "Configurar" button and closes cleanly
- [ ] All existing tests pass
