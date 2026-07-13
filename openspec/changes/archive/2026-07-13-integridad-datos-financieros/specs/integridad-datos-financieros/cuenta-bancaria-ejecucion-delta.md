# Delta for Cuenta Bancaria de Ejecucion

## MODIFIED Requirements

### Requirement: Movimiento Reset on Ejecucion Delete

Al borrar una ejecución que tiene `_movimientoId`, el sistema DEBE resetear el `MovimientoBancario` correspondiente a `convertido: false` y `_ejecucionId: ''`.
(Previously: The `deleteEjecucion` function MUST decrement the linked budget's `totalEjecutado` by the ejecucion's `monto` and remove the entry from `linkedEjecuciones` before deleting the link and ejecucion documents.)

#### Scenario: Movimiento reset on delete

- GIVEN una ejecución con `_movimientoId: "mov456"`, sin budgetLinks
- WHEN `deleteEjecucion` es llamada
- THEN el documento `MovimientoBancario` "mov456" se actualiza con `{ convertido: false, _ejecucionId: '' }`
- AND la ejecución es borrada

#### Scenario: Movimiento reset with budgetLinks

- GIVEN una ejecución con `_movimientoId: "mov789"` Y un budgetLink a Budget A por $500k
- WHEN `deleteEjecucion` es llamada
- THEN el budget es reintegrado (writeBatch)
- AND el movimiento es reseteado
- AND ambas operaciones se completan (cada una en su propio mecanismo atómico)

#### Scenario: Delete ejecucion without movimiento

- GIVEN una ejecución sin `_movimientoId`
- WHEN `deleteEjecucion` es llamada
- THEN ningún documento de `MovimientoBancario` es modificado
- AND la ejecución es borrada normalmente

## ADDED Requirements

### Requirement: CuentaName Resolution via Global Subscription

La UI SHALL resolver `cuentaName` a través de la suscripción global `subscribeCuentasBancarias(companyId)` usando el `cuentaId` como key para buscar el nombre actualizado. El campo denormalizado `cuentaName` del snapshot SHALL usarse solo como fallback si la cuenta fue eliminada (ya no existe en la subcolección).

#### Scenario: CuentaName resolved from live subscription

- GIVEN una ejecución con `cuentaId: "bcol-123"` y `cuentaName: "Bancolombia - Ahorros 5678"` (snapshot anterior)
- WHEN el `nombre` de la cuenta bancaria fue cambiado a "Bancolombia - Ahorros Operativa"
- THEN la UI resuelve el nombre desde `subscribeCuentasBancarias` lookup por ID
- AND muestra "Bancolombia - Ahorros Operativa" (nombre actualizado)

#### Scenario: Fallback to snapshot when cuenta deleted

- GIVEN una ejecución con `cuentaId: "eliminada-123"` y `cuentaName: "Banco Viejo"` en el snapshot
- WHEN la cuenta bancaria fue eliminada de la subcolección
- THEN la UI usa `ejecucion.cuentaName` como fallback
- AND muestra "Banco Viejo" con un indicador visual de "Cuenta eliminada"

#### Scenario: Ejecucion without cuentaId

- GIVEN una ejecución sin `cuentaId` ni `cuentaName`
- WHEN la UI renderiza la fila
- THEN muestra "Sin cuenta bancaria"
- AND no realiza ningún lookup
