# Tasks: Comprobantes de Ejecutado

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550–700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Foundation + Config → PR 2: UI + Display → PR 3: Wiring |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Types + storage init + helpers + rules | PR 1 | Self-contained foundation, no UI deps |
| 2 | Upload UI + display in views | PR 2 | Depends on PR 1 for types/helpers |
| 3 | Firestore wiring + orphan cleanup | PR 3 | Depends on PR 2 for uploader |

## Phase 1: Foundation

- [ ] **1.1** Add `Comprobante { id, name, url, type, size, uploadedAt }` + `comprobantes: Comprobante[]` to `Ejecucion` in `lib/types.ts`
  **Test**: Deserialization defaults `comprobantes` to `[]`
- [ ] **1.2** Import `getStorage`, init & export `storage` from `lib/firebase.ts`
  **Test**: Named import `storage` resolves without error
- [ ] **1.3** Create `lib/fileUpload.ts` — `validateFile()` (type/size), `generateFilePath()` (UUID + path), `uploadFile()` (uploadBytesResumable + downloadURL), `deleteFile()` (deleteObject)
  **Tests**: Unit tests for type rejection (GIF→error), size rejection (6MB→error), valid PDF passes; path format `{company}/ejecuciones/{id}/{uuid}-{name}`; mock storage for upload/delete

## Phase 2: Security + Config

- [ ] **2.1** Create `storage.rules` — auth required, path pattern `/{companyId}/ejecuciones/{ejecucionId}/{fileName}`, content-type whitelist (image/jpeg, image/png, application/pdf), max 5MB
  **Test**: Review-only (rules need emulator)
- [ ] **2.2** Update `firebase.json` — add `"storage": {"rules": "storage.rules"}`
- [ ] **2.3** Create `cors.json` + document gsutil command in setup note: `gsutil cors set cors.json gs://planningsaman-3cf7e.firebasestorage.app`
  **Test**: Manual — run gsutil once

## Phase 3: Upload UI + Display

- [ ] **3.1** Create `ComprobanteUploader` in Sidepanel.tsx: file input → validate → progress bar → file list with name/size/type
  **Tests**: renders input; shows progress during mock `uploadBytesResumable` callback; shows error on invalid file; displays uploaded file list
- [ ] **3.2** Integrate in FormPanel for ADD ejecucion: store pending comprobantes in local state, defer upload to submit
  **Test**: Selected files appear in pending list, no upload call before submit
- [ ] **3.3** Integrate in FormPanel for EDIT ejecucion: upload immediately on selection, append comprobante, update view
  **Test**: Upload triggers on file select, new comprobante appended to existing list
- [ ] **3.4** Show comprobantes in `EjecucionView` + `MiniEjecucionView`: thumbnail `<img>` for JPG/PNG, download link for PDF
  **Tests**: renders comprobante list with name/type/size; image shows thumbnail; PDF shows download link with correct URL
- [ ] **3.5** Add comprobantes count badge/indicator in `Datos.tsx` ejecuciones table rows
  **Test**: Row with 2 comprobantes shows badge; row with 0 shows nothing

## Phase 4: Firestore Wiring + Orphan Cleanup

- [ ] **4.1** Update `handleFormSubmit` in `page.tsx` for ADD ejecucion: upload pending files after `addEjecucion` returns ID, then `updateEjecucion` with comprobantes array. For EDIT: wire existing comprobantes into update payload
  **Test**: Integration — mock storage + firestore, verify upload fires after doc creation, verify `updateEjecucion` called with comprobantes
- [ ] **4.2** Update `subscribeEjecuciones` in `firestore.ts` to deserialize field `comprobantes` (default to `[]`)
  **Test**: Document without `comprobantes` returns empty array
- [ ] **4.3** Handle cancel cleanup: if form closes with pending comprobantes (ADD mode), call `deleteFile` for each orphan path
  **Test**: Cancel after file selection → `deleteObject` called for pending paths
