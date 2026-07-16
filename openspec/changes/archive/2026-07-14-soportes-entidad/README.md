# Archive: soportes-entidad

**Archived at**: 2026-07-14
**Verdict**: PASS WITH WARNINGS
**Tasks**: 7/7 complete
**Tests**: 812 passing, 0 failing, 0 skipped
**Type-check**: `tsc --noEmit` — 0 errors

## Summary

Agregó una pestaña "Soportes" dentro de las vistas de Tercero (TerceroView) y Proyecto (ProjectView) que muestra los documentos vinculados a esa entidad, permitiendo visibilidad bidireccional sin salir del sidepanel.

### Cambios realizados

| File | Action | Description |
|------|--------|-------------|
| `lib/mediaService.ts` | Modified | Extendido `DocumentoFilters` con `terceroId?: string` y `projectId?: string`; constraints condicionales |
| `components/entities/shared/SoportesTab.tsx` | Created | Componente compartido (133 lines) con cards, loading/empty states, click → DocumentoSidepanel |
| `components/entities/tercero/TerceroView.tsx` | Modified | Agregado `activeTab` state + tab bar "Detalle" \| "Soportes" + render condicional |
| `components/entities/project/ProjectView.tsx` | Modified | Mismo patrón de tabs + `<SoportesTab projectId={record.id} />` |

### Decisiones de diseño

1. **Tabs dentro del View**, no en el Entity wrapper — cada View controla su estado local, cero impacto en Sidepanel
2. **Extender `subscribeDocumentos` filters** en lugar de crear nueva función — backward compatible, un solo punto de cambio
3. **SoportesTab compartido** en `components/entities/shared/` — ignora si tercero o proyecto, solo recibe props

### Specs synced

| Main spec | Action | Details |
|-----------|--------|---------|
| `openspec/specs/comprobantes-ejecucion/spec.md` | Updated | Added "Entity filters for subscribeDocumentos" requirement + 5 scenarios |
| `openspec/specs/sidepanel-entity-components/spec.md` | Updated | Modified R12-R21 (Project/Tercero tabs), added SoportesTab component requirement + 9 scenarios |

### Archive contents

- `proposal.md` — Intent, scope, approach
- `spec.md` — Full delta spec with requirements and scenarios
- `specs/comprobantes-ejecucion/spec.md` — Delta for comprobantes-ejecucion
- `specs/sidepanel-entity-components/spec.md` — Delta for sidepanel-entity-components
- `design.md` — Architecture decisions, data flow, file changes
- `tasks.md` — 7/7 tasks completed
- `verify-report.md` — Static verification, spec compliance matrix
- `README.md` — This file

## Source of Truth Updated

The following specs now reflect the new behavior:
- `openspec/specs/comprobantes-ejecucion/spec.md`
- `openspec/specs/sidepanel-entity-components/spec.md`
