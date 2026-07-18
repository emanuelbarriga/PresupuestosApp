# Proposal: Storage Rules Company Security

## Intent

Cerrar brecha de seguridad multi-tenant en Storage. Hoy `storage.rules` solo verifica `request.auth != null`, permitiendo que cualquier usuario autenticado acceda a archivos de cualquier compañía. Necesitamos verificar membresía igual que `firestore.rules`.

## Scope

### In Scope
- Agregar función `isMember(companyId)` en `storage.rules` idéntica a `firestore.rules`
- Aplicar el check a todos los paths existentes: `documentos/`, `ejecuciones/`, `extractos/`
- Unificar criterio de `delete`: `documentos/` mantiene `if false`; `ejecuciones/` y `extractos/` migran de `request.auth != null` a `isMember(companyId)`
- Documentar discrepancia del prefijo `companies/` en GC como deuda técnica con plan de acción

### Out of Scope
- Token personalizado con claims (approach B de exploración)
- Refactor del GC script (solo se documenta)
- Reglas para archivos temporales o nuevos paths no contemplados

## Capabilities

**New Capabilities**: None — no introduce capacidades visibles al usuario.

**Modified Capabilities**: None — no cambian requerimientos a nivel spec. Storage sigue admitiendo los mismos tipos de archivo, tamaños y paths por compañía. Solo cambia quién puede acceder (members vs. any auth user).

## Approach

**Approach A** — replicar `isMember()` de `firestore.rules` en `storage.rules`:

```javascript
function isMember(companyId) {
  return request.auth != null &&
    firestore.exists(
      /databases/(default)/documents/companies/$(companyId)/members/$(request.auth.uid)
    );
}
```

Aplicar a todos los match blocks reemplazando `request.auth != null`. Es el enfoque de menor riesgo porque: (1) mismo patrón ya probado en 17+ match blocks de firestore.rules, (2) cero cambios en la app, (3) Firestore reads desde Storage rules están cacheadas por el runtime (~5 min TTL).

La unificación de `delete` mantiene `documentos/` en `if false` (protegido por GC) y aplica `isMember` a `ejecuciones/` y `extractos/` — suficiente restricción sin romper funcionalidad existente.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `storage.rules` | Modified | Agregar `isMember()` + reemplazar `request.auth != null` en todos los match blocks |
| `garbage-collector-media.ts` | None (documented) | Usa Admin SDK → bypasses rules. Discrepancia de prefijo `companies/` vs paths reales documentada |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Latencia extra por `firestore.exists()` en primer request | Low | Runtime cachea resultado de reglas ~5 min. Impacto ~100ms solo en cold start |
| Discrepancia prefijo `companies/` en GC | Medium | Documentar como deuda técnica. No afecta rules porque Admin SDK bypassea |
| Usuarios bloqueados aún acceden a archivos | Low | `isMember()` no verifica `blocked` — misma simetría que `firestore.rules`. Se puede agregar en futuro si es necesario |

## Rollback Plan

Revertir `storage.rules` a la versión anterior mediante `git revert`. No hay migración de datos ni cambios en la app — es cambio únicamente en reglas. El deploy de rules es inmediato vía `firebase deploy --only storage`.

## Success Criteria

- [ ] `storage.rules` tiene `isMember(companyId)` idéntica a `firestore.rules`
- [ ] Todos los match paths (`documentos/`, `ejecuciones/`, `extractos/`) verifican membresía en read/write/delete
- [ ] Tests de reglas existentes pasan sin cambios en la app
- [ ] Usuarios no miembros reciben 403 al intentar acceder a archivos de compañías ajenas
