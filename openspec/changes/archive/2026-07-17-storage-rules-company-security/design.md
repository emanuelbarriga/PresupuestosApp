# Design: Storage Rules — Company Security

## Technical Approach

Replicar `isMember(companyId)` de `firestore.rules` en `storage.rules` usando `firestore.exists()`. Reemplazar todos los `request.auth != null` por `isMember(companyId)` en los 4 match blocks existentes. Unificar `delete` según spec: `documentos/` mantiene `if false`, `ejecuciones/` y `extractos/` migran de `request.auth != null` a `isMember(companyId)`.

Un solo archivo modificado: `storage.rules`. Zero cambios en la app o en Firestore.

## Architecture Decisions

### Decision: Storage `isMember()` implementation

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| Replicar `firestore.exists()` directo | Misma semántica probada en 17+ match blocks de firestore.rules. Sintaxis varía ligeramente: `firestore.exists()` (Storage) vs `exists()` (Firestore), y `(default)` en vez de `$(database)` | ✅ **Elegida** |
| Custom claims via Admin SDK | Requiere backend + auth token refresh. Sin latency pero con deploy dependencies | ❌ Rechazada — ver proposal |
| Firestore get() + field check | `exists()` es más barato (~1 read doc) vs `get()` + field access (~1 read doc + data parse). Misma latencia | ❌ Rechazada — `exists()` es semánticamente correcto |

La función en storage.rules queda:

```javascript
function isMember(companyId) {
  return request.auth != null &&
    firestore.exists(
      /databases/(default)/documents/companies/$(companyId)/members/$(request.auth.uid)
    );
}
```

Diferencia clave con firestore.rules: Storage rules usa `firestore.exists()` (con prefijo `firestore.`) y el path usa `(default)` en vez de `$(database)`.

### Decision: Unified delete policy

| Path | Antes | Después | Razón |
|------|-------|---------|-------|
| `documentos/` | `if false` | `if false` | Sin cambio — GC scripts via Admin SDK |
| `ejecuciones/` | `request.auth != null` | `isMember(companyId)` | Miembros pueden borrar |
| `extractos/` | `request.auth != null` | `isMember(companyId)` | Miembros pueden borrar |

### Decision: Cold start handling

`firestore.exists()` en Storage Rules tiene ~50-150ms de latencia en frio. El runtime cachea resultados ~5 min. Aceptable para seguridad multi-tenant — la regla se evalúa una vez por operación, y Storage es un medio (no tiempo real).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `storage.rules` | Modify | Agregar `isMember()` + reemplazar `request.auth != null` → `isMember(companyId)` en los 4 match blocks |
| `lib/__tests__/storage-rules-documentos.test.ts` | Modify | Tests existentes pasan (member reads/writes). Agregar tests para cross-company, `ejecuciones/`, `extractos/`, delete policy |
| `lib/__tests__/storage-rules-ejecuciones.test.ts` | Create | Tests específicos para path `ejecuciones/` (write constraints + delete) |
| `lib/__tests__/storage-rules-extractos.test.ts` | Create | Tests específicos para path `extractos/` (write constraints + delete) |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Integration | Intra-company read/write/list/delete | `@firebase/rules-unit-testing` — emulador Storage + Firestore + Auth |
| Integration | Cross-company read/write/list/delete | Misma tool — `nonMemberUid` sin doc en `members/{uid}` |
| Integration | Unauthenticated access | `testEnv.unauthenticatedContext()` — deny all |
| Integration | Write constraints preserved | Size + MIME type checks con member context |

Los tests existentes en `storage-rules-documentos.test.ts` ya usan `@firebase/rules-unit-testing` y seedean `companies/{companyId}/members/{uid}` — ajustan perfecto. Los tests de cross-company funcionan porque `nonMemberUid` no tiene documento de membership.

## Migration / Rollout

No migration requerida. Rollback: `git revert HEAD` del commit de `storage.rules` + `firebase deploy --only storage`. No hay datos ni app que migrar — solo reglas.

## Open Questions

- [ ] **Confirmado**: `@firebase/rules-unit-testing` ya está configurado para Storage — `storage-rules-documentos.test.ts` lo usa con `ref/uploadBytes/getDownloadURL/deleteObject` de `firebase/storage`
- [ ] **Tests existentes**: `storage-rules-documentos.test.ts` necesita extensión para cubrir cross-company y nuevos paths. No hay tests para `ejecuciones/` ni `extractos/` — crearlos
