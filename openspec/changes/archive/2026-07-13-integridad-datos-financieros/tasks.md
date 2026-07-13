# Tasks: Integridad de Datos Financieros

> Change: `integridad-datos-financieros` · Date: 2026-07-13

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~420–480 |
| Files modified | 12 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

```
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium
```

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation + deleteEjecucion core | PR 1 | T5 + T1 (types + data layer) |
| 2 | Wire deleteEjecucion into UI + modal | PR 2 | T2 + T3 (depends on PR 1) |
| 3 | Tercero archiving + tests | PR 3 | T4 + T9 (depends on T5) |
| 4 | CuentaName + fantasma + budget cleanup | PR 4 | T6 + T7 + T8 (independientes) |

## Phase 1: Foundation (types + data layer)

- [x] **T5** `lib/types.ts` — Agregar `archivado?: boolean` a `Tercero` (línea 63). ~1 línea.
- [x] **T1** `lib/firestore.ts` — Refactor `deleteEjecucion` (líneas 1113–1131): leer ejecucion con `getDoc` para obtener `_movimientoId`/`_extractoId`/`cuentaId`; agregar batch.update para resetear `movimiento.convertido` y `_ejecucionId`; mantener reintegro budgetLinks existente; log + continue si `_movimientoId` no resuelve movimiento. ~35 líneas.

## Phase 2: Core implementation

- [x] **T4** `lib/firestore.ts` — `deleteTercero` (líneas 586–588): cambiar `deleteDoc` → `updateDoc({ archivado: true })`; agregar parámetro `includeArchivados?: boolean` a `subscribeTerceros` (líneas 95–106). ~15 líneas.
- [x] **T3** `components/entities/ejecucion/ConfirmDeleteModal.tsx` — Nuevo componente: modal dinámico con lista de presupuestos afectados + alerta de movimiento bancario, checkbox obligatorio con texto dinámico, botón deshabilitado hasta marcar. Sigue el patrón BankConfirmModal del proyecto. ~130 líneas.

## Phase 3: Integration / wiring

- [x] **T2** `components/entities/movimiento/MovimientoView.tsx` (líneas 96–116): reemplazar `deleteDoc` + `updateMovimiento` inline con `deleteEjecucion(companyId, ejecucionId)`. Lo mismo en `components/Extractos.tsx` (líneas 540–546). Limpiar imports no usados (`deleteDoc` removido de ambos). ~20 líneas.
- [x] **T7** `components/entities/ejecucion/EjecucionEntity.tsx` → `EjecucionView.tsx`: pasar `cuentas` como prop; en `EjecucionView` resolver `cuentas.find(c => c.id === ejecucion.cuentaId)?.nombre ?? ejecucion.cuentaName ?? 'Sin cuenta bancaria'`; agregar indicador "Cuenta eliminada" si la cuenta no existe. ~25 líneas.
- [x] **T6** `components/entities/project/ProjectView.tsx` (línea 84): agregar banner naranja cuando `isInferred` es true, mostrando "Este proyecto no existe en la base de datos. Podría haber sido eliminado o estar mal referenciado." ~25 líneas.
- [x] **T8** `components/Datos.tsx` (líneas 1123–1149): eliminar `DeleteBtn` de la fila de budget (solo archivar); verificar que no quede ningún `deleteBudget` llamado desde UI. ~15 líneas.

## Phase 4: Testing

- [x] **T9** `lib/__tests__/firestore.test.ts`: Agregar tests para:
  1. `deleteEjecucion` con budgetLinks + `_movimientoId` — verificar batch incluye update de movimiento
  2. `deleteEjecucion` sin links ni movimiento — solo batch.delete del ejecucion
  3. `deleteTercero` usa `updateDoc` en vez de `deleteDoc` (spy)
  4. `subscribeTerceros` con `includeArchivados: true` incluye archivados
  Seguir patrón de mocks existente (vi.hoisted). ~150 líneas.

## Dependency Graph

```
T5 ──> T4 ──┐
            ├──> T9
T1 ──> T2 ──┘
T1 ──> T3
T6 (independiente — puede ir en paralelo con T2/T3)
T7 (independiente — puede ir en paralelo con T2/T3)
T8 (independiente — puede ir en paralelo con T2/T3)
```

## Implementation Order

1. **PR 1 (Foundation)**: T5 + T1 — tipos + data layer. Seguro, sin cambios de UI.
2. **PR 2 (UI deleteEjecucion)**: T2 + T3 — integrar deleteEjecucion en vistas + modal.
3. **PR 3 (Tercero archiving)**: T4 + T9 — soft delete + tests.
4. **PR 4 (Cleanup)**: T6 + T7 + T8 — banner, cuentaName, budget cleanup. Todos independientes entre sí.
