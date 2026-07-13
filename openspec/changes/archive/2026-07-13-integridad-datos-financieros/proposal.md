# Proposal: Integridad de Datos Financieros

## Intent

Los caminos de borrado actuales dejan datos huérfanos o estados inconsistentes: `deleteEjecucion` no reintegra presupuestos ni resetea movimientos vinculados, `deleteTercero` es hard delete sin guardia de transacciones activas, y hay `deleteDoc` inline que bypasean la lógica unificada. Esto genera desajustes contables y datos no referenciables.

## Scope

### In Scope
- Refactor `deleteEjecucion` con verificación de `_movimientoId`/`_extractoId` y reintegro de `budgetLinks`
- Modal de confirmación dinámico con impacto financiero + checkbox obligatorio
- Soft delete (archivado) para terceros + guardia `countEjecucionesByTercero`
- Banner "proyecto fantasma" cuando `projectId` no resuelve
- Resolver `cuentaName` por ID en UI (snapshot como fallback)
- Eliminar botón de borrado físico de budget de la UI

### Out of Scope
- Borrar empresa (H1) — no expuesto en UI
- `deleteCuentaBancaria` (H5) — no existe ni se expone
- Migración batch de datos existentes

## Capabilities

### New Capabilities
- `ejecucion-deletion`: deleteEjecucion unificada con verificación de links, reintegro de montos a budgets, reseteo de `movimiento.convertido`, y modal de confirmación dinámico
- `tercero-archiving`: Soft delete (archivado) con guardia de transacciones activas + banner proyecto fantasma

### Modified Capabilities
- `ejecucion-budget-link`: Agregar comportamiento en cascada al borrar ejecución — reintegro de montos a budgets vía writeBatch
- `cuenta-bancaria-ejecucion`: Agregar reseteo de `movimiento.convertido` y desvinculación de extracto al borrar ejecución linkeada

## Approach

Unificar todos los caminos de borrado de ejecuciones en una sola función `deleteEjecucion` que (1) verifica `budgetLinks` y reintegra montos, (2) verifica `_movimientoId` y resetea `movimiento.convertido`, (3) verifica `_extractoId` y desvincula. Los `deleteDoc` inline existentes se reemplazan por esta función. Terceros migran de `deleteDoc` a `updateDoc({ archivado: true })` con guardia previa. CuentaName se resuelve por suscripción global con snapshot como fallback.

## Risks

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Budget totals inconsistentes si el reintegro falla | Baja | writeBatch atómico |
| Proyecto fantasma falso positivo por race condition | Baja | Cache de resolución con TTL corto |
| Usuario acostumbrado a hard delete terceros | Media | Banner informativo + degradación a archivar |

## Rollback

Reversión del commit. Si hay terceros archivados, `updateDoc({ archivado: false })` los restaura. No hay migración batch de datos existentes.

## Success Criteria

- [ ] `deleteEjecucion` verifica y reintegra budgetLinks, resetea `movimiento.convertido`, y desvincula extracto
- [ ] Todo `deleteDoc` de ejecución pasa por `deleteEjecucion` (0 inline deleteDoc)
- [ ] `deleteTercero` usa `archivado: true` con guardia de transacciones activas
- [ ] Banner "proyecto fantasma" visible en Dashboard
- [ ] CuentaName se resuelve por ID en UI; snapshot como fallback
- [ ] Budget sin botón de borrado físico en UI
- [ ] `npx tsc --noEmit` y `npm test` pasan sin errores nuevos
