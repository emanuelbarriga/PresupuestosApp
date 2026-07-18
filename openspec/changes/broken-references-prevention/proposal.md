# Proposal: Broken References Prevention

## Intent

Prevenir nuevas inconsistencias de referencias soft entre colecciones Firestore sin migraciones ni cascades automáticos. 12+ relaciones soft detectadas (Tercero→Ejecucion, Budget→Tercero, DocumentoMedio→Tercero, etc.) sin limpieza automática. Arreglar bug existente: `subscribeEjecuciones*` no hidratan `_linkedDocumentos` ni `_estadoComprobantes`.

## Scope

### In Scope
- Bugfix: `subscribeEjecuciones`, `subscribeEjecucionesWithFilter`, `subscribeEjecucionesByBudget` hidratan `_linkedDocumentos` y `_estadoComprobantes`
- Nuevo script `scripts/audit-broken-references.ts` — auditoría dry-run de referencias rotas (solo lecturas)
- Guarda completa en UI al archivar tercero: verificar budgets + documentos + proyectos además de ejecuciones
- Refactor `deleteBudget` para usar `writeBatch` en vez de `deleteDoc` individual en loop

### Out of Scope
- Cascade deletes automáticos (archivar tercero → archivar ejecuciones)
- Reparación de datos existentes (solo auditoría)
- Migraciones o backfills
- UI de re-link de ejecuciones a otro budget

## Capabilities

### New Capabilities
None — cambios internos de integridad, sin nuevas capacidades visibles al usuario.

### Modified Capabilities
None — ninguna capability existente cambia su comportamiento a nivel de spec.

## Approach

Bugfix de subscribe functions → audit script → guardas en UI → refactor `deleteBudget`. Implementar en ese orden para minimizar riesgo de regresiones.

## Affected Areas

| Area | Impact |
|------|--------|
| `lib/firestore.ts` | Modified — subscribeEjecuciones* hydrate + deleteBudget writeBatch |
| `scripts/audit-broken-references.ts` | New — script de auditoría dry-run |
| `components/Datos.tsx` | Modified — guarda completa al archivar tercero |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| subscribeEjecuciones bugfix cambia shape de datos | Low | Es aditivo — agrega campos que ya existen en Firestore |
| deleteBudget refactor introduce race condition | Low | writeBatch mantiene atomicidad igual que hoy |
| Audit script modifica datos por error | Low | Solo lecturas, dry-run forzado |

## Rollback Plan

Revertir cambios en `lib/firestore.ts` y `components/Datos.tsx`. El audit script no escribe — no requiere rollback.

## Dependencies

Ninguna.

## Success Criteria

- [ ] `subscribeEjecuciones` retorna `_linkedDocumentos` y `_estadoComprobantes` hidratados
- [ ] `audit-broken-references.ts` detecta todas las referencias rotas en dry-run
- [ ] Guarda en `deleteTercero` muestra conteo completo (ejecuciones + budgets + documentos + proyectos)
- [ ] `deleteBudget` usa `writeBatch` en vez de `deleteDoc` loop
