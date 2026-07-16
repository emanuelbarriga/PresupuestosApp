# Design: Sistema de Medios Desacoplado

## Technical Approach

Replace embedded `Ejecucion.comprobantes` with a flat `/documentos` Firestore collection + flat Storage paths. Uploads always create `status: por_clasificar` records; `enlazado` is set atomically only after successful entity linking. Dashboard reads `_estadoComprobantes` denormalized on the Ejecucion doc — zero extra queries on list views.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Storage paths | `companies/{cId}/documentos/{uuid}-{name}` | `ejecuciones/{ejId}/{uuid}-{name}` | Flat paths let a single file link to multiple ejecuciones (recurring contracts). No file duplication or move on entity change. |
| Comprobante state | `_estadoComprobantes` on Ejecucion doc | Read-time N+1 query | Dashboard shows hundreds of ejecuciones — N+1 would be 100+ reads every render. Denormalized field (Completada/Falta/Sin) updated via Firestore Transaction on link/unlink. |
| Concurrency for `_estadoComprobantes` | Firestore `runTransaction` | `writeBatch`, Cloud Function trigger | Transaction reads current `DocumentoMedio[]` for the ejecucion, computes state, writes. Firestore retries on conflict. Safe for 100 docs/month. Cloud Function trigger deferred to Phase 3. |
| Document-to-ejecucion link | `ejecucionIds: string[]` on DocumentoMedio | Embedded array, junction collection | One file backs N ejecuciones (e.g. annual contract → 12 monthly execs). Single doc, single Storage file, no duplication. N:M without junction overhead for MVP. |
| Classification UI | Manual form (8 tipos, selects) | OCR / AI extraction | MVP scope. OCR stubbed as disabled banner. Field data (`metadata`) schema-ready for Phase 3. |
| `enlazado → por_clasificar` | Allowed ONLY when `ejecucionId === null` in same write | Always allow, use soft-delete flag | Prevents accidental unlinking without lifecycle intent. Rules enforce the invariant at the DB level. |
| Client-side `_estadoComprobantes` integrity | Accepted risk for MVP | Cloud Function trigger | Rules can't validate cross-collection writes. A client could update DocumentoMedio without updating Ejecucion. Mitigation: single-tenant (1-3 users), code review, transaction consistency. Cloud Function trigger documented as Phase 3 tech debt. |
| Client delete of documentos | Denied in firestore.rules + storage.rules | Allow delete from client | Orphan prevention. GC script is the sole cleanup mechanism. |

## Data Flow

```
── Upload (Inbox) ──────────────────────────────────────────
  Dropzone → generateMediaFilePath(cId, file)
           → uploadFile(file, path)                         [Storage]
           → createDocumento({status:por_clasificar, _source:'inbox-upload'})
  Inbox subscription → query WHERE status==por_clasificar AND _source!='ejecucion-form'

── Upload (EjecucionForm) ──────────────────────────────────
  ComprobanteUploader → generateMediaFilePath(cId, file)
                      → uploadFile(file, path)               [Storage]
                      → createDocumento({status:por_clasificar, _source:'ejecucion-form'})
                      → on form submit success:
                          runTransaction → read docs linked to ejId
                                         → compute _estadoComprobantes
                                         → updateDoc(DocumentoMedio, status:enlazado, ...fields)
                                         → updateDoc(Ejecucion, {_estadoComprobantes})

── Classification (DocumentoSidepanel) ────────────────────
  Form fill (tipo, periodo, tercero, ejecucionIds, metadata)
  → linkDocumentoToEntities()
    → runTransaction → read linked DocumentoMedio[] for each ejecucionId
                     → compute _estadoComprobantes per ejecucionId
                     → updateDoc(DocumentoMedio, {status:enlazado, ...fields})
                     → for each ejecucionId: updateDoc(Ejecucion, {_estadoComprobantes})

── Delete Ejecucion ──────────────────────────────────────
  deleteEjecucion(cId, ejId)
    → query /documentos WHERE ejecucionIds HAS ejId
    → for each doc: runTransaction → arrayRemove(ejId)
                                   → if ejecucionIds becomes empty: status→por_clasificar
                                   → recalc _estadoComprobantes for remaining linked docs
    → delete Ejecucion + budgetLinks (existing flow)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/types.ts` | Modify | Add `DocumentoMedio`, `TipoDocumentoMedio`, `DocumentoStatus`, `DocumentoMedioMetadata` types |
| `lib/fileUpload.ts` | Modify | Add `generateMediaFilePath()` (flat path), refactor `generateFilePath` as thin wrapper |
| `lib/comprobantes.ts` | Modify | Refactor `derivarEstadoComprobantes` to accept `DocumentoMedio[]`, check `tipoDocumento` |
| `lib/mediaService.ts` | Create | Flat Storage CRUD: `subscribeDocumentos`, `createDocumento`, `getDocumento` |
| `lib/mediaLinking.ts` | Create | `linkDocumentoToEntities`, `unlinkDocumentoFromEjecucion`, status transitions + `_estadoComprobantes` update |
| `lib/schemas.ts` | Modify | Add `documentoMedioSchema` for Zod validation, add `_estadoComprobantes` to `ejecucionSchema` |
| `lib/firestore.ts` | Modify | Extend `deleteEjecucion` to unlink documentos before delete |
| `components/entities/ejecucion/EjecucionForm.tsx` | Modify | Upload to flat `/documentos` path. Call `linkDocumentoToEntities` post-commit. Remove embedded `comprobantes` from submit payload. |
| `components/upload/ComprobanteUploader.tsx` | Modify | Call `mediaService.createDocumento` instead of embedded flow. Accept `onUploadComplete` callback. |
| `app/[company]/[[...segments]]/page.tsx` | Modify | Wire Media view. Update `handleSaveComprobantes` to use mediaService. |
| `app/[company]/media/page.tsx` | Create | Inbox grid: real-time `subscribeDocumentos(status==por_clasificar)`, filtered by `_source != 'ejecucion-form'`. Dropzone sets `_source: 'inbox-upload'`. Status chips. |
| `components/entities/documento/DocumentoSidepanel.tsx` | Create | iframe preview + classification form (8 tipos, periodo, tercero/proyecto/ejecucion selects, metadata fields) |
| `components/Sidepanel.tsx` | Modify | Register `documento` entity in `renderEntityScreen` switch. Add `DocumentoMedio` to `EntityType`. |
| `components/Construction.tsx` | No change | Still renders for other unfinished views |
| `firestore.rules` | Modify | Add `/companies/{cId}/documentos/{doc}` rules: create validation, status-based update, no client delete |
| `storage.rules` | Modify | Add `companies/{cId}/documentos/{fileName}` rules: MIME + size validation, no client delete |
| `scripts/migrate-legacy-comprobantes.ts` | Create | Read all Ejecucion.comprobantes arrays, create DocumentoMedio records, set `status: enlazado` |
| `scripts/down-migration-media.ts` | Create | Reverse migration: copy /documentos records back to Ejecucion.comprobantes array for safe rollback |
| `scripts/garbage-collector-media.ts` | Create | **Cross-reference**: list all files in `companies/{cId}/documentos/` (Storage) → query all `storagePath` in Firestore → delete files without a matching Firestore record. Also cleans `status: por_clasificar` older than 30d with no `ejecucionIds`. |

## Interfaces — New Types & Signatures

```typescript
// ─── Types (lib/types.ts) ─────────────────────────────────

type DocumentoStatus = 'por_clasificar' | 'enlazado';

type TipoDocumentoMedio =
  | 'factura_venta' | 'factura_compra' | 'extracto_bancario'
  | 'comprobante_egreso' | 'comprobante_ingreso'
  | 'planilla' | 'contrato' | 'otro';

interface DocumentoMedioMetadata {
  proveedorTexto?: string;
  nit?: string;
  fechaDocumento?: string;   // YYYY-MM-DD
  montoTotal?: number;
}

interface DocumentoMedio {
  id: string;
  fileName: string;
  storagePath: string;
  url: string;
  size: number;
  mimeType: string;
  status: DocumentoStatus;
  tipoDocumento?: TipoDocumentoMedio;
  periodo?: string;          // YYYY-MM
  terceroId?: string;
  projectId?: string;
  ejecucionIds: string[];
  metadata: DocumentoMedioMedioMetadata;
  _source: 'inbox-upload' | 'ejecucion-form' | 'migration';  // Prevents orphan docs from EjecucionForm flooding the Inbox
  uploadedAt: string;
  updatedAt?: string;
  createdBy: string;
}

// ─── Services ─────────────────────────────────────────────

// lib/fileUpload.ts — new function
function generateMediaFilePath(companyId: string, fileName: string): string;

// lib/mediaService.ts
function subscribeDocumentos(
  companyId: string,
  filters?: { status?: DocumentoStatus; tipoDocumento?: TipoDocumentoMedio; excludeSource?: 'inbox-upload' | 'ejecucion-form' | 'migration' },
  onData: (docs: DocumentoMedio[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe;

async function createDocumento(
  companyId: string,
  data: Omit<DocumentoMedio, 'id' | 'uploadedAt' | 'updatedAt'>,
  userId: string,
  source: 'inbox-upload' | 'ejecucion-form' | 'migration' = 'inbox-upload',
): Promise<string>;  // returns doc ID

// lib/mediaLinking.ts
async function linkDocumentoToEntities(
  companyId: string,
  documentoId: string,
  data: {
    tipoDocumento: TipoDocumentoMedio;
    periodo: string;
    terceroId: string;
    projectId?: string;
    ejecucionIds: string[];
    metadata?: DocumentoMedioMedioMetadata;
  },
): Promise<void>;
// Uses Firestore runTransaction:
//   1. Read current DocumentoMedio[] linked to each ejecucionId
//   2. Compute _estadoComprobantes per ejecucionId
//   3. updateDoc(DocumentoMedio, {status:enlazado, ...fields})
//   4. for each ejecucionId: updateDoc(Ejecucion, {_estadoComprobantes})
// If transaction conflicts, Firestore retries automatically.

async function unlinkDocumentoFromEjecucion(
  companyId: string,
  documentoId: string,
  ejecucionId: string,
): Promise<void>;
// Uses runTransaction:
//   1. arrayRemove(ejecucionId) from DocumentoMedio
//   2. If ejecucionIds becomes empty: status→por_clasificar
//   3. Recompute _estadoComprobantes for the ejecucion
//   4. All in one transaction
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `derivarEstadoComprobantes` with `DocumentoMedio[]` | Pure function — test all 3 states + granularity |
| Unit | `generateMediaFilePath` | UUID format, sanitization edge cases |
| Unit | `validateFile` (existing) | No change needed |
| Integration | `linkDocumentoToEntities` | Firestore emulator: verify atomic write, verify `_estadoComprobantes` on linked Ejecuciones |
| Integration | `unlinkDocumentoFromEjecucion` | Emulator: status revert, array removal |
| Integration | `deleteEjecucion` extended | Emulator: documentos unlinked not deleted |
| Integration | Down-migration script | Emulator: create docs, run script, verify they appear in Ejecucion.comprobantes |
| Integration | GC script — phantom files | Admin SDK: create file in Storage without Firestore record, run GC, verify file deleted |
| E2E | Upload → Inbox → Classify → Dashboard | Cypress/Playwright: full flow |
| Rules | firestore.rules | Emulator: test allowed/denied transitions per spec |
| Rules | storage.rules | Emulator: MIME reject, size reject, member-only read |

## Migration / Rollout

1. **Deploy rules first** (firestore.rules + storage.rules) — no downtime, new collection just denied until members exist
2. **Deploy code** — Media view replaces `<Construction />`, EjecucionForm writes to `/documentos`
3. **Run migration script** — transforms legacy `Ejecucion.comprobantes` arrays to `/documentos` records. Non-destructive: leaves `comprobantes` field on Ejecucion untouched
4. **Run GC script** — cleanup old nested Storage paths (`ejecuciones/{ejId}/{file}`) after migration verified
5. **Monitor** — check for failed `_estadoComprobantes` computations on dashboard render

**Rollback**: Revert code PR. Legacy `comprobantes` field still exists on Ejecucion docs. BEFORE reverting, run `scripts/down-migration-media.ts` which copies `DocumentoMedio` records (with `ejecucionIds`) back into the `Ejecucion.comprobantes` embedded array for each linked ejecucion. This ensures documents uploaded during the new system remain visible after rollback. Loss: `metadata`, `_source`, and documents not linked to any ejecucion remain only in `/documentos` (safe — GC script cleans them post-mortem).

## Open Questions

- [ ] `derivarEstadoComprobantes` mapping: how do `TipoDocumentoMedio` values map to the two required types ("Comprobante de pago", "Cuenta de Cobro")? Needs settings config or hardcoded mapping.
- [ ] `ejecucionIds` size limit: single documento could link to 200+ ejecuciones — Firestore doc max 1MB. Acceptable for MVP but worth a warning.
