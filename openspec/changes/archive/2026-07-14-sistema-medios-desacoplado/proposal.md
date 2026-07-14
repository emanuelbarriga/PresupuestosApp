# Proposal: Sistema de Medios Desacoplado

## Intent

Documents are embedded in `Ejecucion.comprobantes` — duplicating storage, blocking cross-module linking. Build a flat media system (Firestore metadata + Firebase Storage) so any entity links any document without duplication.

## Scope

### In Scope
- `DocumentoMedio` type + `/documentos` collection + indexes
- Inbox (bulk-upload dropzone, grid with `por_clasificar` status)
- DocumentoSidepanel (preview + classification form)
- Services (mediaService, mediaLinking) + scripts

### Out of Scope
- Monthly Org, Third-party Explorer, view injections (Phase 2)
- OCR / IA para extracción automática (Phase 3 — MVP usa formulario manual)
- Document editing/deletion UI (admin scripts + GC script)
- `@google/genai` SDK (no se instala en MVP)

## Capabilities

### New
- `document-upload`: Upload, inbox, status management
- `document-classification`: Tipo/periodo/entity linking + sidepanel
- `document-organization`: Phase 2 stub

### Modified
- `ejecucion-form`: `EjecucionForm` + `ComprobanteUploader` persisten a `/documentos` en vez del array embebido
- `firestore-rules`: Nuevas reglas para `/companies/{cId}/documentos/{doc}`
- `storage-rules`: Nuevas reglas para `companies/{cId}/documentos/`

## Approach

1. `DocumentoMedio` type + collection with status/tipo/periodo indexes
2. Services: flat storage paths (`companies/{cId}/documentos/{uuid}-{name}`), batched entity linking
3. `EjecucionForm` refactor: comprobantes persisten a `/documentos` con `status: 'por_clasificar'` inicial, transicionan a `'enlazado'` post-commit exitoso
4. Inbox at existing `/media` route (already resolved by `viewFromSegments()`)
5. DocumentoSidepanel: iframe preview + 8-tipo form + dynamic selects + campos manuales (sin OCR)
6. `firestore.rules` + `storage.rules` actualizadas con scoping multi-tenant
7. Ciclo de vida: al borrar una ejecución, sus documentos NO se eliminan — `ejecucionId` pasa a `null`, status vuelve a `por_clasificar`
8. Migration + GC scripts (manual run)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/types.ts` | Modified | `DocumentoMedio`, `TipoDocumentoMedio`, `DocumentoStatus` |
| `lib/fileUpload.ts` | Modified | Extract shared upload logic |
| `lib/mediaService.ts` | New | Flat Storage paths, CRUD, atomic delete |
| `lib/mediaLinking.ts` | New | Batched linking + status transition |
| `components/entities/ejecucion/EjecucionForm.tsx` | Modified | Persiste a `/documentos` en vez de array embebido |
| `components/upload/ComprobanteUploader.tsx` | Modified | Sube a Storage + Firestore plano |
| `app/[company]/media/page.tsx` | New | Inbox grid + dropzone |
| `components/entities/DocumentoSidepanel.tsx` | New | Preview + classification form |
| `components/Sidepanel.tsx` | Modified | Register `DocumentoMedio` entity |
| `firestore.rules` | Modified | Reglas para `/companies/{cId}/documentos/` |
| `storage.rules` | Modified | Reglas para `companies/{cId}/documentos/` |
| `scripts/migrate-legacy-comprobantes.ts` | New | One-time migration |
| `scripts/garbage-collector-media.ts` | New | Orphan cleanup |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Large file blocking upload | Low | 5MB limit + Firebase func check |
| Orphan `/documentos` si falla creación de ejecución | Med | `status: por_clasificar` inicial, cambio a `enlazado` solo post-commit exitoso |
| Datos multi-tenant expuestos | Low | Reglas en firestore.rules + storage.rules desde el día 1 |
| Slow entity selects | Low | Pagination + searchable selects |

## Rollback Plan

- `status: por_clasificar` asegura que fallos de creación no dejen datos inconsistentes
- Migración no-destructiva (deja ejecuciones intactas, solo crea registros nuevos en `/documentos`)
- Ciclo de vida conservador: borrar ejecución revincula documentos, no los elimina
- Revert PR — `/media` renders `<Construction />`, `EjecucionForm` vuelve a array embebido

## Dependencies

- `viewFromSegments()` routes `/media` → `'Media'` view type
- `firestore.rules` + `storage.rules` actualizadas para scoping multi-tenant
- Sin APIs externas — clasificación 100% manual en MVP

## Success Criteria

- [ ] Dropzone upload → Storage file + `DocumentoMedio` in Firestore
- [ ] Inbox grid shows `por_clasificar` docs with status chips
- [ ] Sidepanel preview + classification persists all fields
- [ ] `linkDocumentoToEntities()` transitions atomically to `enlazado`
- [ ] Fallo en creación de ejecución NO deja registros huérfanos en `/documentos`
- [ ] Borrar ejecución revierte documentos a `por_clasificar` sin eliminar físicamente
- [ ] Migration converts all legacy comprobantes without data loss
- [ ] `firestore.rules` + `storage.rules` aíslan documentos por empresa
- [ ] All new code passes TypeScript strict mode
