# Tercero Archiving Specification

> Change: `integridad-datos-financieros` · Capability: `tercero-archiving` · Date: 2026-07-13

## Purpose

Migrar `deleteTercero` de hard delete a soft delete (archivado) con guardia de transacciones activas, protegiendo la integridad referencial de ejecuciones vinculadas y permitiendo la recuperación de terceros sin pérdida de datos históricos.

## Requirements

### Requirement: Soft Delete via archivado

`deleteTercero` en `firestore.ts` SHALL migrar de `deleteDoc(terceroRef)` a `updateDoc(terceroRef, { archivado: true })`. No SHALL existir ningún camino de hard delete para terceros desde la UI.

#### Scenario: Tercero archivado correctamente

- GIVEN un tercero existente con `id: "terc123"`
- WHEN `deleteTercero("terc123")` es llamada
- THEN el documento conserva todos sus campos originales
- AND se agrega el campo `archivado: true`
- AND el documento NO es eliminado de Firestore

### Requirement: Guardia de Transacciones Activas

Antes de archivar, `deleteTercero` SHALL ejecutar `countEjecucionesByTercero(terceroId)` para informar al usuario cuántas ejecuciones están vinculadas a ese tercero.

#### Scenario: Tercero sin ejecuciones — confirmación simple

- GIVEN `countEjecucionesByTercero` retorna 0
- WHEN el usuario hace clic en "Archivar tercero"
- THEN el modal muestra solo "¿Archivar tercero [Nombre]?"
- AND al confirmar se ejecuta `updateDoc({ archivado: true })`

#### Scenario: Tercero con ejecuciones — modal con guardia

- GIVEN `countEjecucionesByTercero` retorna 5
- WHEN el usuario hace clic en "Archivar tercero"
- THEN el modal muestra "Este tercero tiene 5 transacciones vinculadas"
- AND muestra checkbox "Entiendo que este tercero tiene transacciones históricas y que al archivarlo perderán el acceso al detalle actualizado"
- AND el botón "Archivar" está deshabilitado hasta marcar el checkbox
- AND al confirmar se ejecuta `updateDoc({ archivado: true })`

### Requirement: Filtered Subscription

`subscribeTerceros(companyId)` SHALL retornar solo terceros con `archivado !== true` por defecto. El hook o función SHALL exponer un parámetro opcional `includeArchivados?: boolean` para obtener todos los terceros.

#### Scenario: Default subscription excludes archived

- GIVEN la empresa tiene 10 terceros activos y 3 archivados
- WHEN `subscribeTerceros(companyId)` se suscribe sin parámetros
- THEN la subscripción retorna 10 terceros (los archivados son excluidos)

#### Scenario: Explicit includeArchivados

- GIVEN la empresa tiene 10 activos y 3 archivados
- WHEN `subscribeTerceros(companyId, { includeArchivados: true })` se suscribe
- THEN la subscripción retorna 13 terceros (incluyendo archivados)

### Requirement: Tercero Type

El tipo `Tercero` en `types.ts` SHALL ganar el campo opcional `archivado?: boolean`.

#### Scenario: Type includes archivado field

- GIVEN un documento de tercero archivado en Firestore
- WHEN es deserializado al tipo `Tercero`
- THEN `tercero.archivado` es `true`
- AND el campo es opcional (terceros existentes sin el campo son válidos)

### Requirement: UI Toggle for Archived Terceros

La UI SHALL incluir un toggle "Mostrar archivados" que alterna entre la vista por defecto (solo activos) y la vista completa (activos + archivados).

#### Scenario: Toggle muestra archivados

- GIVEN el usuario está viendo la lista de terceros (solo activos)
- WHEN el usuario activa el toggle "Mostrar archivados"
- THEN la lista se actualiza para incluir los 3 terceros archivados
- AND los archivados muestran un badge o indicador visual de "Archivado"
- AND el usuario puede desarchivar un tercero desde la misma vista

## Security Rules

No se requieren reglas nuevas. El campo `archivado` es un campo de datos regulares protegido por las reglas existentes de `terceros`.

## Indexes

No se requieren índices nuevos. El filtro `archivado !== true` se aplica en memoria o vía `where("archivado", "!=", true)` si se requiere a nivel de base de datos. Para colecciones pequeñas (cientos de terceros), el filtro en memoria es aceptable.

## Query Patterns

| Pattern | Method |
|---------|--------|
| Count ejecuciones by tercero | `collectionGroup('ejecuciones').where('terceroId', '==', id).get()` |
| Subscribe terceros (excluir archivados) | `where("archivado", "!=", true)` o filtro en memoria |
| Subscribe terceros (incluir archivados) | Sin filtro |

## UI Behavior

- **Lista de terceros**: toggle "Mostrar archivados" en el header de la sección
- **Tercero archivado**: badge gris "Archivado" + opción "Desarchivar"
- **Modal de archive**: contenido dinámico según count de ejecuciones
- **Desarchivar**: botón que ejecuta `updateDoc({ archivado: false })` sin confirmación adicional

## Stories / Scenarios

### Story: Archivado sin transacciones

Usuario archiva un tercero que nunca tuvo ejecuciones.

- Busca "Proveedor Inactivo" en la lista
- Hace clic en "Archivar"
- Modal simple: "¿Archivar Proveedor Inactivo?" con Confirmar/Cancelar
- Confirma. Tercero se archiva, desaparece de la lista activa

### Story: Archivado con transacciones históricas

Usuario archiva un tercero que tuvo 12 pagos registrados.

- Hace clic en "Archivar"
- Modal muestra: "Este tercero tiene 12 transacciones vinculadas"
- Checkbox obligatorio: "Entiendo que este tercero tiene transacciones históricas..."
- Marca checkbox, confirma
- Tercero se archiva. Las ejecuciones históricas mantienen su `terceroId` pero muestran "(Archivado)" junto al nombre

### Story: Recuperar tercero archivado

Usuario necesita reactivar un tercero archivado.

- Activa toggle "Mostrar archivados"
- Busca el tercero, nota el badge "Archivado"
- Hace clic en "Desarchivar"
- El tercero vuelve a `archivado: false` inmediatamente

## Out of Scope

- Borrado físico de terceros desde la UI (solo archive)
- Archive automático por inactividad
- Migración batch de terceros existentes (solo nuevos archives)
- Notificación a ejecuciones históricas cuando un tercero es desarchivado
