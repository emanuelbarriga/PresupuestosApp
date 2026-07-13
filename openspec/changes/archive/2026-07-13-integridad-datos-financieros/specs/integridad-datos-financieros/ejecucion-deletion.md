# Ejecucion Deletion Specification

> Change: `integridad-datos-financieros` · Capability: `ejecucion-deletion` · Date: 2026-07-13

## Purpose

Unificar todos los caminos de borrado de ejecuciones en `deleteEjecucion`, asegurando que el borrado reintegre montos a presupuestos vinculados, resetee movimientos bancarios asociados, y notifique al usuario el impacto financiero antes de confirmar.

## Requirements

### Requirement: Unified deleteEjecucion Entry Point

`deleteEjecucion` en `firestore.ts` SHALL ser el ÚNICO punto de entrada para borrar ejecuciones en toda la aplicación. Su flujo SHALL ser:

1. Leer `budgetLinks` de la subcolección de la ejecución
2. Si existen links: decrementar `totalEjecutado` y remover de `linkedEjecuciones` en cada budget vinculado (usando `writeBatch` atómico)
3. Verificar si la ejecución tiene `_movimientoId` y `_extractoId`
4. Si tiene `_movimientoId`: actualizar el `MovimientoBancario` correspondiente con `{ convertido: false, _ejecucionId: '' }`
5. Borrar todos los `budgetLinks` de la subcolección
6. Borrar el documento de la ejecución

#### Scenario: Delete ejecucion without budgetLinks or movimiento

- GIVEN una ejecución sin `budgetLinks`, sin `_movimientoId` y sin `_extractoId`
- WHEN `deleteEjecucion` es llamada
- THEN solo se borra el documento de la ejecución
- AND ningún otro documento es modificado

#### Scenario: Delete ejecucion with budgetLinks

- GIVEN una ejecución con 2 budgetLinks a Budget A ($300k) y Budget B ($200k)
- WHEN `deleteEjecucion` es llamada
- THEN `totalEjecutado` de Budget A decrementa en $300k
- AND `totalEjecutado` de Budget B decrementa en $200k
- AND la entrada correspondiente es removida de `linkedEjecuciones` en ambos budgets
- AND todas las operaciones del paso 2 se ejecutan dentro del mismo `writeBatch` atómico

#### Scenario: Delete ejecucion with _movimientoId

- GIVEN una ejecución con `_movimientoId: "mov123"` y `_extractoId: "ext456"`
- WHEN `deleteEjecucion` es llamada
- THEN el documento `MovimientoBancario` "mov123" es actualizado con `{ convertido: false, _ejecucionId: '' }`
- AND la ejecución es borrada

#### Scenario: Delete ejecucion with full links (budgetLinks + movimiento)

- GIVEN una ejecución con budgetLinks a Budget A por $500k Y `_movimientoId: "mov789"`
- WHEN `deleteEjecucion` es llamada
- THEN el budget es reintegrado (paso 2)
- AND el movimiento es reseteado (paso 4)
- AND los budgetLinks son borrados (paso 5)
- AND la ejecución es borrada (paso 6)

### Requirement: Inline deleteDoc Replacement

TODO `deleteDoc` inline de ejecuciones en la aplicación SHALL ser reemplazado por llamadas a `deleteEjecucion`. Específicamente en `MovimientoView.tsx` y `Extractos.tsx`.

#### Scenario: MovimientoView calls deleteEjecucion

- GIVEN el usuario está en `MovimientoView.tsx` viendo un movimiento convertido
- WHEN el usuario acciona el borrado de la ejecución vinculada
- THEN la UI llama a `deleteEjecucion(ejecucionId)` en lugar de `deleteDoc` directo

#### Scenario: Extractos calls deleteEjecucion

- GIVEN el usuario está en `Extractos.tsx` viendo un extracto con ejecuciones vinculadas
- WHEN el usuario acciona el borrado de una ejecución
- THEN la UI llama a `deleteEjecucion(ejecucionId)` en lugar de `deleteDoc` directo

### Requirement: Dynamic Confirmation Modal

El modal de confirmación de borrado SHALL ser dinámico y mostrar información contextual según el estado de la ejecución:

| Elemento | Condición |
|----------|-----------|
| Nombre del presupuesto afectado | Si existen budgetLinks |
| Monto a decrementar | Si existen budgetLinks |
| Alerta "Esta ejecución está vinculada a un movimiento bancario" | Si tiene `_movimientoId` |
| Checkbox obligatorio "Entiendo que esto descuadrará el presupuesto [Nombre] y que deberé conciliar manualmente el movimiento" | Si aplica (budgetLinks y/o movimiento) |
| Botón de confirmación deshabilitado | Hasta que el checkbox esté marcado |

#### Scenario: Simple confirmation — no links

- GIVEN una ejecución sin budgetLinks, sin `_movimientoId`
- WHEN el usuario hace clic en "Eliminar"
- THEN el modal muestra solo "¿Eliminar ejecución?" con botones Confirmar/Cancelar
- AND no requiere checkbox
- AND al confirmar se ejecuta `deleteEjecucion` directo

#### Scenario: Modal with financial impact

- GIVEN una ejecución con 1 budgetLink a "Proyecto Q1" por $300k
- WHEN el usuario hace clic en "Eliminar"
- THEN el modal muestra "Presupuesto afectado: Proyecto Q1" y "Monto a reintegrar: $300.000"
- AND muestra checkbox "Entiendo que esto descuadrará el presupuesto Proyecto Q1"
- AND el botón "Confirmar" está deshabilitado hasta marcar el checkbox

#### Scenario: Modal with movimiento alert

- GIVEN una ejecución con `_movimientoId` pero sin budgetLinks
- WHEN el usuario hace clic en "Eliminar"
- THEN el modal muestra "Esta ejecución está vinculada a un movimiento bancario"
- AND muestra checkbox "Entiendo que... deberé conciliar manualmente el movimiento"
- AND botón deshabilitado hasta marcar checkbox

#### Scenario: Full modal — budgetLinks + movimiento

- GIVEN una ejecución con budgetLinks Y `_movimientoId`
- WHEN el usuario hace clic en "Eliminar"
- THEN el modal muestra TODA la información: presupuesto, monto, alerta de movimiento
- AND un único checkbox combinado o acumulativo
- AND botón deshabilitado hasta marcar checkbox

## Security Rules

No se requieren reglas nuevas. Los permisos existentes para `ejecuciones` y la subcolección `budgetLinks` cubren todas las operaciones.

## Indexes

No se requieren índices nuevos.

## Query Patterns

| Pattern | Method |
|---------|--------|
| Leer budgetLinks de una ejecución | `collection('companies', cid, 'ejecuciones', eid, 'budgetLinks').get()` |
| Actualizar budget (writeBatch) | `batch.update(budgetRef, { totalEjecutado: increment(-monto), linkedEjecuciones: arrayRemove(...) })` |
| Resetear movimiento bancario | `updateDoc(movimientoRef, { convertido: false, _ejecucionId: '' })` |

## UI Behavior

- Botón "Eliminar" en ejecución → Modal dinámico según links → Confirmación → `deleteEjecucion`
- Modal usa `react-hot-toast` para feedback de éxito/error post-eliminación
- El checkbox usa texto dinámico que incluye el nombre del presupuesto cuando aplica

## Stories / Scenarios

### Story: Usuario elimina ejecución con presupuesto vinculado

Usuario eliminó una ejecución de $500k que estaba vinculada a "Proyecto Q1".

- Abre el detalle de la ejecución, hace clic en "Eliminar"
- Modal muestra: "Presupuesto afectado: Proyecto Q1 — Monto a reintegrar: $500.000"
- Marca el checkbox obligatorio
- Confirma. La ejecución se borra, el presupuesto recupera los $500k
- Toast verde: "Ejecución eliminada. Presupuesto actualizado."

### Story: Usuario elimina ejecución convertida de movimiento bancario

Usuario eliminó una ejecución que había sido convertida desde un movimiento de Bancolombia.

- Modal muestra alerta de movimiento bancario vinculado
- Marca checkbox, confirma
- La ejecución se borra, el movimiento vuelve a `convertido: false`
- En Extractos, el movimiento aparece nuevamente como "Disponible para convertir"

## Out of Scope

- Migración batch de ejecuciones existentes con datos huérfanos
- Borrado en cascada de extractos completos (solo ejecuciones individuales)
- Transacciones distribuidas multi-company
