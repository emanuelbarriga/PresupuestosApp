# Tasks: Sistema de Medios Desacoplado

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,100 (690 new + 410 modified) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Foundation + Rules → PR 2: Inbox → PR 3: Linking + Form → PR 4: Scripts + Tests |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain — PR 1 → PR 2 → PR 3 → PR 4 sobre `feat/media-system` |

```
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

### Suggested Work Units

| Unit | Goal | Likely PR | Base Branch | Notes |
|------|------|-----------|--------|-------|
| 1 | Core Foundation & Rules | PR 1 | feat/media-system | Types, schemas, mediaService (sin linking), firestore.rules, storage.rules |
| 2 | Inbox & Upload | PR 2 | <PR 1 branch> | Dropzone, inbox page (`_source` filter), ComprobanteUploader refactor, Sidepanel wiring |
| 3 | Atomic Linking & Form | PR 3 | <PR 2 branch> | mediaLinking (`_linkedDocumentos` array), EjecucionForm refactor, delete lifecycle |
| 4 | Scripts & Tests | PR 4 | <PR 3 branch> | Migration, down-migration (file duplication), GC (draft cleanup), all tests |

## Phase 1: Foundation

- [x] 1.1 Add `DocumentoMedio`, `TipoDocumentoMedio`, `DocumentoStatus`, `DocumentoMedioMetadata` to `lib/types.ts`; add `_linkedDocumentos` array (`{documentoId, tipoDocumento}[]`) to `Ejecucion` type
- [x] 1.2 Add `generateMediaFilePath()` to `lib/fileUpload.ts`
- [x] 1.3 Add `documentoMedioSchema` to `lib/schemas.ts`; add `_estadoComprobantes` to `ejecucionSchema`
- [x] 1.4 Refactor `derivarEstadoComprobantes` in `lib/comprobantes.ts` to accept `DocumentoMedio[]`
- [x] 1.5 Create `lib/mediaService.ts` — `subscribeDocumentos`, `createDocumento`, `getDocumento` (CRUD base, sin linking)
- [x] 1.6 Refactor `derivarEstadoComprobantes` in `lib/comprobantes.ts` to read from `_linkedDocumentos` array on `Ejecucion` doc

## Phase 2: Inbox & Upload

- [x] 2.1 Create `app/[company]/media/page.tsx` — dropzone + inbox grid filtered `status==por_clasificar`, `_source!='ejecucion-form'`
- [x] 2.2 Wire Media view in `app/[company]/[[...segments]]/page.tsx`
- [x] 2.3 Register `documento` entity in `components/Sidepanel.tsx` (`EntityType`, `renderEntityScreen`)

## Phase 3: Classification & Linking

- [x] 3.1 Create `components/entities/documento/DocumentoSidepanel.tsx` — iframe preview + classification form (8 tipos, periodo, tercero/proyecto/ejecucion selects, metadata, OCR stub)
- [x] 3.2 Implement searchable selects (`SearchableSelect`) for tercero, proyecto, ejecucion linking
- [x] 3.3 Create `lib/mediaLinking.ts` — `linkDocumentoToEntities` (push to `_linkedDocumentos`, recalc `_estadoComprobantes` via `runTransaction`), `unlinkDocumentoFromEjecucion` (arrayRemove, recalc)

## Phase 4: EjecucionForm Integration

- [x] 4.1 Refactor `components/upload/ComprobanteUploader.tsx` — upload to flat path, create `DocumentoMedio` via `mediaService`
- [x] 4.2 Refactor `components/entities/ejecucion/EjecucionForm.tsx` — persist to `/documentos`, call `linkDocumentoToEntities` on submit success (creates `_linkedDocumentos` entry), remove embedded `comprobantes` payload

## Phase 5: Lifecycle & Scripts

- [x] 5.1 Extend `lib/firestore.ts` `deleteEjecucion` — unlink linked documentos (arrayRemove, recalc `_estadoComprobantes`) before exec delete
- [x] 5.2 Create `scripts/migrate-legacy-comprobantes.ts` — read `Ejecucion.comprobantes` arrays, create `DocumentoMedio` records (exported function + auto-run as script)
- [x] 5.3 Create `scripts/down-migration-media.ts` — copy `/documentos` back to `Ejecucion.comprobantes`; **duplicate Storage file** for each linked ejecucion to prevent domino effect on delete
- [x] 5.4 Create `scripts/garbage-collector-media.ts` — cross-reference Storage vs Firestore (delete phantom files); clean `por_clasificar` >30d without `ejecucionIds`; **clean abandoned drafts**: `_source=='ejecucion-form' AND status=='por_clasificar' AND uploadedAt<now-24h` (delete Firestore + Storage)

## Phase 6: Security Rules

- [x] 6.1 Add `/companies/{cId}/documentos/{doc}` in `firestore.rules` — multi-tenant, status transition validation, no client delete
- [x] 6.2 Add `companies/{cId}/documentos/{fileName}` in `storage.rules` — MIME/size validation, no client delete

## Phase 7: Tests

- [x] 7.1 Unit: `derivarEstadoComprobantes` with `DocumentoMedio[]` (all 3 states + granularity)
- [x] 7.2 Unit: `generateMediaFilePath` (UUID format, sanitization)
- [x] 7.3 Integration: `linkDocumentoToEntities` atomic write — verify `_linkedDocumentos` push + `_estadoComprobantes` recalc on linked ejecucion
- [x] 7.4 Integration: `unlinkDocumentoFromEjecucion` — verify arrayRemove, status revert, `_estadoComprobantes` recalc
- [x] 7.5 Integration: `deleteEjecucion` extended — documentos unlinked, not deleted
- [x] 7.6 Rules: firestore.rules — allowed/denied transitions per spec
- [x] 7.7 Rules: storage.rules — MIME/size reject, member-only read
- [x] 7.8 Integration: down-migration script round-trip
- [x] 7.9 Integration: GC script — phantom file cross-reference (Storage without Firestore record)
- [x] 7.10 Integration: GC script — abandoned draft cleanup (`_source:'ejecucion-form'` older than 24h)
