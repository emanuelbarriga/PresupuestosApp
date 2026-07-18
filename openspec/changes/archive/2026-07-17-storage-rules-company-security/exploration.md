# Exploration: storage-rules-company-security

## Current State

### storage.rules (raíz del proyecto)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{companyId}/ejecuciones/{ejecucionId}/{fileName} { ... }
    match /{companyId}/documentos/{fileName} { ... }
    match /{companyId}/ejecuciones/{allPaths=**} { allow list: if ... }
    match /{companyId}/extractos/{fileName} { ... }
    match /{allPaths=**} { allow read, write: if false; }
  }
}
```

**Match patterns actuales:**

| Segment | Path | read | write | delete |
|---------|------|------|-------|--------|
| `${companyId}/ejecuciones/${ejecucionId}/${fileName}` | para comprobantes legacy | `request.auth != null` | `request.auth != null` + size < 5MB + contentType JPEG/PNG/PDF | `request.auth != null` |
| `${companyId}/documentos/${fileName}` | para el nuevo sistema de medios | `request.auth != null` | `request.auth != null` + size < 10MB + contentType PDF/JPEG/PNG/WebP | `if false` |
| `${companyId}/ejecuciones/{allPaths=**}` | listado | `request.auth != null` | — | — |
| `${companyId}/extractos/${fileName}` | extractos bancarios | `request.auth != null` | `request.auth != null` + size < 10MB + contentType PDF | `request.auth != null` |
| `{allPaths=**}` | catch-all deny | `if false` | `if false` | — |

**Ninguno** verifica membresía a la compañía. Cualquier usuario autenticado puede leer/escribir archivos de *cualquier* compañía con tal de conocer el path.

### firestore.rules — función `isMember(companyId)`

```javascript
function isMember(companyId) {
  return request.auth != null &&
    exists(/databases/$(database)/documents/companies/$(companyId)/members/$(request.auth.uid));
}
```

Usa `exists()` sobre el documento `companies/{companyId}/members/{uid}`. Es el mismo patrón usado en TODAS las reglas de Firestore para subcolecciones scoped a compañía.

Importante: `exists()` en rules es una llamada a Firestore que cuenta contra el quota de reads y tiene latencia adicional (~50-200ms). En Firestore rules se usa extensivamente (17+ match blocks) sin problemas reportados.

### Estructura de `CompanyMember` (de `lib/types.ts`)

```typescript
export interface CompanyMember {
  id: string;          // Firebase Auth UID
  email: string;
  role: UserRole;      // 'admin' | 'colaborador'
  joinedAt: string;
  blocked?: boolean;
}
```

El documento existe en `companies/{companyId}/members/{uid}` con `id === uid`. La función `isMember` solo verifica existencia, no rol ni `blocked`.

### Paths reales en Storage

La app genera paths SIN prefijo `companies/`:
- `generateMediaFilePath`: `${companyId}/documentos/${uuid}-${sanitizedName}` → ej. `c1/documentos/uuid-factura.pdf`
- `generateFilePath`: `${companyId}/ejecuciones/${ejecucionId}/${uuid}-${sanitizedName}` → ej. `c1/ejecuciones/e1/uuid-doc.pdf`

Los storage.rules usan `/{companyId}/...` que coincide exactamente con estos paths.

**⚠️ Hallazgo**: El GC script (`garbage-collector-media.ts`) usa `companies/${cId}/documentos/` como prefix (con `companies/`), mientras que la app guarda paths sin ese prefijo. Esto parece un bug en el GC, no en rules, pero debe validarse.

## Affected Areas

| Archivo | Por qué está afectado |
|---------|----------------------|
| `storage.rules` | Archivo a modificar — agregar chequeo `isMember` a cada match |
| `firestore.rules` | No se modifica, pero la función `isMember` es la que se va a reutilizar en storage |
| `lib/__tests__/storage-rules-documentos.test.ts` | Tests existentes para storage — solo cubren `/documentos/`. No cubren `ejecuciones` ni `extractos` |
| `lib/__tests__/firestore-rules-documentos.test.ts` | Tests de Firestore — referencia para cómo se testea membership |
| `scripts/garbage-collector-media.ts` | Usa Admin SDK → bypassea rules. No le afecta el cambio |
| `openspec/specs/storage-rules/spec.md` | Spec existente del cambio `sistema-medios-desacoplado`, solo cubre `/documentos/` |
| `lib/__tests__/garbage-collector-media.test.ts` | Tests del GC — verifican phantom/abandoned/stale cleanup. No dependen de rules |
| `lib/fileUpload.ts` | Contiene `generateMediaFilePath` y `generateFilePath` — define la convención de paths que las rules deben validar |

## Approaches

### 1. Replicar `isMember` inline en storage.rules

Copiar la función `isMember(companyId)` de firestore.rules a storage.rules (usando `firestore.exists()`).

```javascript
function isMember(companyId) {
  return request.auth != null &&
    firestore.exists(/databases/(default)/documents/companies/$(companyId)/members/$(request.auth.uid));
}
```

Storage Rules soporta `firestore.exists()` desde `rules_version = '2'` y es exactamente el mismo patrón que Firestore rules, solo que en Storage se usa `firestore.exists()` en vez de `exists()`.

| Segment | Cambio propuesto |
|---------|-----------------|
| `/{companyId}/ejecuciones/{ejecucionId}/{fileName}` | `read: if isMember(companyId)` — reemplazar `request.auth != null` |
| `/{companyId}/documentos/{fileName}` | `read: if isMember(companyId)`, `write: if isMember(companyId) && ...`, `delete: if false` (se queda igual) |
| `/{companyId}/ejecuciones/{allPaths=**}` | `list: if isMember(companyId)` |
| `/{companyId}/extractos/${fileName}` | `read: if isMember(companyId)`, `write: if isMember(companyId) && ...`, `delete: if isMember(companyId)` |

- **Pros**: Sigue el mismo patrón exacto que Firestore; `delete: if false` se conserva para documentos; consistente.
- **Cons**: `firestore.exists()` agrega latencia en cada request a Storage; el primer request puede ser lento si el ruleset no está en cache.
- **Effort**: Bajo (~10 líneas de cambio)

### 2. Función helper más restrictiva — verificar `blocked` + `role`

Además de `isMember`, crear una función que también verifique que el miembro no esté bloqueado, replicando la lógica de negocio en rules.

```javascript
function isActiveMember(companyId) {
  return request.auth != null &&
    firestore.exists(/databases/(default)/documents/companies/$(companyId)/members/$(request.auth.uid))
    && !firestore.get(...).data.blocked;
}
```

- **Pros**: Previene que usuarios bloqueados accedan a archivos incluso si su doc member existe.
- **Cons**: `firestore.get()` es más caro que `firestore.exists()` (cuesta 1 read vs ~0); inconsistente con firestore.rules que no verifica `blocked`; rompe simetría.
- **Effort**: Medio (~15 líneas + considerar si firestore.rules debería también actualizarse)

### 3. No cambiar storage.rules (mantener solo `request.auth != null`)

Riesgo aceptado — el acceso a Storage está "protegido" porque los companyId no son adivinables.

- **Pros**: Cero cambios, cero latencia adicional.
- **Cons**: Cualquier usuario autenticado puede leer archivos de cualquier compañía si conoce o descubre el companyId. Los companyId son Firestore doc IDs (no secrets).
- **Effort**: Nulo.

## Recommendation

**Approach 1** — replicar `isMember` inline en storage.rules.

Razones:
- Es el mínimo cambio que cierra la brecha de seguridad multi-tenant.
- Sigue exactamente el mismo patrón que firestore.rules (simetría).
- `firestore.exists()` es bien soportado en Storage rules `v2`.
- El spec existente ya lo especifica como requerimiento (ver `openspec/specs/storage-rules/spec.md` Requerimiento 1).
- `delete: if false` solo aplica a `documentos/` (que es correcto — GC bypassa rules vía Admin SDK). Para `ejecuciones` y `extractos` que hoy tienen `allow delete: if request.auth != null`, el cambio a `isMember` es suficiente restricción.

## Riesgos / Edge Cases

1. **Latencia de `firestore.exists()`**: Storage rules que llaman a Firestore agregan latencia (típicamente 100-400ms en el primer request, luego se cachea el resultado de la evaluación de reglas por ~5 min). Esto puede afectar la carga inicial de la MediaPage. Se recomienda monitorear.

2. **Caracteres especiales en `companyId`**: Los companyId son Firestore doc IDs generados por `addDoc` o `doc().id`, que usan caracteres alfanuméricos seguros (20 chars). NO hay riesgo de path traversal o caracteres especiales. El wildcard `{companyId}` captura cualquier string.

3. **Efecto en el GC**: El GC usa Admin SDK (`firebase-admin` + `@google-cloud/storage`) que bypasea completamente security rules. **No afecta al GC.**

4. **Caché de rules**: Firebase Storage cachea el ruleset compilado. Los cambios no son instantáneos — hay que esperar ~5 min o redeployar. En desarrollo con emuladores los cambios son inmediatos.

5. **Paths existentes**: Los archivos ya subidos no se ven afectados. Los permisos se evalúan en cada request, no son asignados por archivo.

6. **Discrepancia GC path prefix**: El GC usa `companies/${cId}/documentos/` como prefix para listar archivos, mientras que la app guarda paths sin `companies/` prefijo. **Esto es un bug separado** que no bloquea el cambio de rules, pero hay que investigar si los archivos en producción tienen o no el prefijo `companies/`. Si lo tienen, los storage.rules actuales NO los están protegiendo adecuadamente porque los `match /{companyId}/...` no coinciden con `companies/{cId}/...`.

7. **Simetría con firestore.rules**: Firestore rules usan `isMember(companyId)` sin verificar `blocked`. Storage rules deberían usar el mismo nivel de verificación para evitar confusión.

## Ready for Proposal

**Sí** — los hallazgos son claros, los riesgos conocidos y el cambio es de bajo riesgo, bien acotado, con precedente directo en el spec existente.

La propuesta debe:
1. Definir el delta sobre `storage.rules` agregando `isMember` a cada match block.
2. Decidir si `delete: if false` en `documentos/` se extiende también a `ejecuciones/` y `extractos/` (hoy tienen delete permitido).
3. Incluir tarea para actualizar `lib/__tests__/storage-rules-documentos.test.ts` agregando tests para `ejecuciones/` y `extractos/`.
4. Investigar la discrepancia del path prefix `companies/` en el GC antes del deploy.
