# Design: Integridad de Datos Financieros

## Technical Approach

Unificar todos los caminos de borrado de ejecuciones en `deleteEjecucion` con writeBatch atómico que abarque reintegro de budgetLinks + reseteo de movimiento. Migrar terceros de hard delete a soft delete (`archivado: true`). Reemplazar `deleteDoc` inline en componentes. Eliminar borrado físico de budgets de la UI (solo archive).

## Architecture Decisions

### 1. deleteEjecucion — writeBatch único vs separado

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| Movimiento update en el mismo writeBatch | Batch puede cubrir cualquier doc en la misma DB. Límite 500 ops. Menos riesgo de estado inconsistente | **Elegido**. El batch ya tiene ~N+2 ops (budgetLinks + ejecucion). Agregar 1 movimiento update no lo acerca al límite |
| Movimiento update aparte | Si el batch falla después del update, el movimiento queda reseteado sin ejecución borrada | Rechazado — riesgo de estado inconsistente |

### 2. Modal de confirmación — Toast vs Componente

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| Toast con checkbox | Toast no está diseñado para input obligatorio. UX pobre, difícil de mantener foco | Rechazado |
| Modal state nativo | Render condicional con overlay. Control total sobre checkboxes y botones. Fácil de extender | **Elegido**. `ConfirmDeleteModal` como componente interno, retorna `Promise<boolean>` |

### 3. subscribeTerceros — default filtering

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| `where("archivado", "!=", true)` en query | Filtro server-side, no requiere migración de datos. Índice compuesto si hay otros filtros | **Elegido** para la subscripción default |
| Filtro en memoria en el callback | Más simple, pero rompe paginación si hay muchos archivados | Rechazado para default, aunque lo usamos como fallback |

### 4. CuentaName — lookup por suscripción global

Pasar el array `cuentas` desde `EjecucionEntity` (ya las subscribe) como prop a `EjecucionView`, `Datos`, y `Dashboard`. Resolver `cuentas.find(c => c.id === ejecucion.cuentaId)?.nombre ?? ejecucion.cuentaName ?? 'Sin cuenta bancaria'`.

## Data Flow

```
[Usuario] → clic "Eliminar" en ejecución
  ↓
ConfirmDeleteModal (lee ejecucion del snapshot)
  ├─ budgetLinks → muestra presupuestos afectados + montos
  ├─ _movimientoId → alerta naranja
  └─ checkbox obligatorio si hay impacto
  ↓
deleteEjecucion(companyId, ejecucionId)
  ├─ getDoc(ejecucionRef) + getDocs(budgetLinksSubcollection)
  ├─ writeBatch:
  │   ├─ budgetRef.update({ totalEjecutado: increment(-monto), linkedEjecuciones: arrayRemove(...) })  ← por cada link
  │   ├─ budgetLinkRef.delete()  ← por cada link
  │   ├─ (if _movimientoId) movimientoRef.update({ convertido: false, _ejecucionId: '' })
  │   └─ ejecucionRef.delete()
  └─ batch.commit()
```

## File Changes

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `lib/firestore.ts` | Modificar `deleteEjecucion` | Agregar lectura de ejecucion + movimiento reset en writeBatch |
| `lib/firestore.ts` | Modificar `deleteTercero` | Cambiar `deleteDoc` → `updateDoc({ archivado: true })` |
| `lib/firestore.ts` | Modificar `subscribeTerceros` | Agregar parámetro `includeArchivados?: boolean` |
| `lib/types.ts` | Modificar `Tercero` | Agregar campo `archivado?: boolean` |
| `components/entities/movimiento/MovimientoView.tsx` | Modificar | Reemplazar deleteDoc inline → `deleteEjecucion()` |
| `components/Extractos.tsx` | Modificar | Reemplazar deleteDoc inline → `deleteEjecucion()` |
| `components/entities/ejecucion/EjecucionEntity.tsx` | Modificar | Pasar `cuentas` a `EjecucionView` |
| `components/entities/ejecucion/EjecucionView.tsx` | Modificar | Resolver `cuentaName` desde prop `cuentas` |
| `components/Dashboard.tsx` | Modificar | Resolver `cuentaName` desde prop `cuentas` |
| `components/Datos.tsx` | Modificar múltiple | Reemplazar delete budget físico → archive; resolver cuentaName; adaptar handleDeleteTercero |
| `app/[company]/[[...segments]]/page.tsx` | Modificar | Pasar `cuentas` a Dashboard; modificar `handleDeleteBudget` para solo archive |
| `components/entities/project/ProjectEntity.tsx` | Modificar | Pasar `projects` a `ProjectView` para detección de proyecto fantasma |
| `components/entities/project/ProjectView.tsx` | Modificar | Detectar proyecto fantasma por `projectId` (además de `name`) |

## Interfaces / Contracts

### Nueva función deleteEjecucion

```typescript
export async function deleteEjecucion(
  companyId: string,
  ejecucionId: string,
): Promise<void>
```

Comportamiento expandido:
1. `getDoc(ejecucionRef)` — lee `cuentaId`, `_movimientoId`, `_extractoId`
2. `getDocs(budgetLinksRef)` — para reintegro
3. `writeBatch` con:
   - `increment(-monto)` + `arrayRemove(...)` por cada budgetLink
   - `budgetLinkRef.delete()` por cada link
   - Si `_movimientoId` y `cuentaId` y `_extractoId`: `movimientoRef.update({ convertido: false, _ejecucionId: '' })`
   - `ejecucionRef.delete()`
4. Si `_movimientoId` pero no resuelve `cuentaId`/`extractoId`: log + continuar sin resetear

### Tercero type — modified

```typescript
export interface Tercero {
  // ... existing fields
  archivado?: boolean;
}
```

### subscribeTerceros — modified signature

```typescript
export function subscribeTerceros(
  onData: (terceros: Tercero[]) => void,
  onError?: (err: Error) => void,
  includeArchivados?: boolean,
): Unsubscribe
```

## Testing Strategy

| Capa | Qué testear | Cómo |
|------|-------------|------|
| Unit (firestore.ts) | `deleteEjecucion` con budgetLinks + movimiento | Mock getDoc/getDocs/writeBatch. Verificar que batch incluye todas las ops esperadas |
| Unit (firestore.ts) | `deleteEjecucion` sin links ni movimiento | Verificar solo deleteDoc del ejecucion |
| Unit (firestore.ts) | `deleteTercero` usa updateDoc, no deleteDoc | Spy en updateDoc |
| Unit (firestore.ts) | `subscribeTerceros` filtra archivados | Mock onSnapshot, verificar filtro |
| Integration | MovimientoView → deleteEjecucion | Mock deleteEjecucion, verificar que se llama en lugar de deleteDoc |
| Integration | Extractos → deleteEjecucion | Mock deleteEjecucion, verificar que se llama |
| Integration | ConfirmDeleteModal con budgetLinks | Renderizar, verificar texto dinámico y checkbox |
| E2E | Flujo completo: eliminar ejecución con budgetLink | Verificar toast, Firestore state, UI updates |

## Migration / Rollout

No requiere migración batch. Terceros existentes sin `archivado` son válidos (campo opcional). Rollback: revertir commit + `updateDoc({ archivado: false })` para terceros archivados.

## Open Questions

- None — todas las decisiones están documentadas arriba con tradeoffs.
