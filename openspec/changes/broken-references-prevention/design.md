# Design: Broken References Prevention

## Technical Approach

Cuatro cambios independientes, sin cascades ni migraciones: (1) bugfix subscribe hydration vía helper centralizado, (2) audit script dry-run, (3) guardas completas en UI al archivar tercero, (4) refactor `deleteBudget` a `writeBatch`. Implementar en ese orden para minimizar riesgo de regresiones — cada paso es verificable sin depender del anterior.

## Architecture Decisions

### Decision 1: Subscribe hydration approach

| Opción | Descripción | Rationale |
|--------|-------------|-----------|
| **B — Helper `formatEjecucion`** ✅ | Función pura que recibe `data` de Firestore y retorna `Ejecucion` hidratado con defaults | Un solo lugar para mantener; las 3 subscribe functions lo llaman |
| A — Modificar cada subscribe | Editar inline cada mapper en `subscribeEjecuciones`, `subscribeEjecucionesWithFilter`, `subscribeEjecucionesByBudget` | Repite lógica, propenso a que una se quede atrás |
| C — Firestore converters | Usar `withConverter` en las queries | Más overhead de tipos, no es compatible directo con `fetchDocsByIds` |

**Choice**: Opción B — crear `formatEjecucion(data: Record<string, unknown>, id: string): Ejecucion` en `lib/firestore.ts` y reemplazar los 3 mappers inline. Las subscribe functions existentes ya tienen una estructura casi idéntica (solo varía el source de datos: `snapshot.docs.map` en dos, `fetchDocsByIds` mapper en la de budget). El helper recibe `data` crudo y aplica todos los defaults incluyendo los campos faltantes.

### Decision 2: Audit script

| Aspecto | Elección |
|---------|----------|
| Runtime | `npx tsx` — script standalone, sin build step |
| Lectura vs escritura | Solo lecturas; `--apply` flag reservado para futura reparación, no implementada |
| Output | Consola (tabla agrupada por tipo de relación rota) + flag `--json <path>` opcional |

**Choice**: Script CLI en `scripts/audit-broken-references.ts` que itera las relaciones soft conocidas (Tercero→Ejecucion, Budget→Tercero, DocumentoMedio→Tercero, etc.), compara referencias contra documentos existentes, y reporta inconsistencias. Dry-run forzado — `--apply` no implementado en este change.

### Decision 3: Guarda en UI

| Situación actual | Cambio |
|------------------|--------|
| `handleDeleteTercero` solo cuenta ejecuciones (`countEjecucionesByTercero`) | Agregar `countBudgetsByTercero`, `countDocumentosByTercero`, `countProyectosByTercero` en `lib/firestore.ts` |
| Solo muestra error si hay ejecuciones | Mostrar modal de confirmación con desglose completo |

**Choice**: Crear 3 nuevas funciones count en `firestore.ts` (mismo patrón que `countEjecucionesByTercero`), y modificar `handleDeleteTercero` en `Datos.tsx` para ejecutarlas en paralelo con `Promise.all`. Si hay algún conteo > 0, mostrar toast con desglose y bloquear borrado.

### Decision 4: deleteBudget refactor

| Aspecto | Elección |
|---------|----------|
| Patrón actual | Loop anidado con `deleteDoc` individual por cada budgetLink y un `deleteDoc` final |
| Patrón nuevo | Acumular en `writeBatch`, flush cada 400 ops, commit final |

**Choice**: Reemplazar los `deleteDoc` individuales en el loop de budgetLinks con `batch.delete(linkDoc.ref)`, más contador de batch (máximo 400 operaciones por batch para safety margin, siguiendo `MAX_BATCH_OPS = 450` usado en `deleteEjecucion`). Mantener el `getDoc` inicial y `getDocs` del query — solo cambia la escritura.

## Data Flow

```
subscribeEjecuciones*
    onSnapshot / fetchDocsByIds
        → formatEjecucion(data)    [nuevo helper]
        → _linkedDocumentos ✅     [agregado]
        → _estadoComprobantes ✅   [agregado]
        → resto de campos como hoy

deleteBudget(companyId, budgetId)
    getDoc(budgetRef)
    links = budget.linkedEjecuciones
    for each link:
        query budgetLinks → getDocs
        batch.delete(linkDoc.ref)  [antes: deleteDoc loop]
        if batch.count >= 400: batch.commit + new batch
    batch.delete(budgetRef)
    batch.commit()

deleteTercero(terceroId, terceroName) — en Datos.tsx
    Promise.all([
      countEjecucionesByTercero,
      countBudgetsByTercero,
      countDocumentosByTercero,
      countProyectosByTercero,
    ])
    if any > 0 → toast desglose + bloquear
    else → confirm → parentOnDeleteTercero(terceroId)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/firestore.ts` | Modify | Agregar `formatEjecucion()` helper; modificar 3 subscribe functions para usarlo; agregar `countBudgetsByTercero`, `countDocumentosByTercero`, `countProyectosByTercero`; refactor `deleteBudget` a `writeBatch` |
| `scripts/audit-broken-references.ts` | Create | Script CLI con npx tsx, solo lecturas, dry-run default, output consola + JSON opcional |
| `components/Datos.tsx` | Modify | `handleDeleteTercero` — agregar queries paralelas y desglose en UI |

## Interfaces / Contracts

```typescript
// Helper nuevo — hidrata todos los campos de Ejecucion desde Firestore data crudo
function formatEjecucion(id: string, data: Record<string, unknown>): Ejecucion;

// Funciones count nuevas (mismo patrón que countEjecucionesByTercero)
function countBudgetsByTercero(companyId: string, terceroId: string): Promise<number>;
function countDocumentosByTercero(companyId: string, terceroId: string): Promise<number>;
function countProyectosByTercero(companyId: string, terceroId: string): Promise<number>;
```

No se modifican tipos existentes — `Ejecucion` ya tiene `_linkedDocumentos` y `_estadoComprobantes` en `lib/types.ts`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `formatEjecucion` | Test que retorna _linkedDocumentos y _estadoComprobantes desde data crudo, y que preserva defaults existentes |
| Unit | subscribe hydration | Mock `onSnapshot`, verificar que el callback recibe _linkedDocumentos hidratado |
| Unit | `deleteBudget` refactor | Mock `writeBatch`, verificar que acumula deletes y hace commit una vez |
| Unit | Count functions | Mock `getDocs`, verificar que retorna `snap.size` |
| Component | Guarda en UI | Mock queries, verificar que el toast muestra desglose con ejecuciones + budgets + documentos + proyectos |

## Migration / Rollout

No migration requerida — los campos `_linkedDocumentos` y `_estadoComprobantes` ya existen en Firestore (escritos por `mediaLinking.ts`), solo faltaban en las subscribes. Rollback: revertir `lib/firestore.ts` y `components/Datos.tsx`. Audit script no escribe — no requiere rollback.

## Open Questions

- [ ] `deleteBudget` — ¿se llama desde la UI exclusivamente, o hay calls desde tests/server? Verificar antes del refactor.
- [ ] `Datos.tsx` — `handleDeleteTercero` usa `parentOnDeleteTercero` que eventualmente llama `deleteTercero` (soft-delete). `deleteTercero` actualmente solo archivea el doc — confirmar que la guarda es puramente preventiva (no bloquea el archive, solo informa).
