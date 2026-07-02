# Proposal: Comprobantes de Ejecutado

## Intent

Ejecuciones have no way to attach proof documents — receipts, invoices, PDFs — blocking audit and reconciliation. Add upload, storage, and display for comprobantes attached to each ejecucion.

## Scope

### In Scope
- `getStorage` init + export in `lib/firebase.ts`
- `Comprobante` interface + `comprobantes: Comprobante[]` on `Ejecucion`
- Upload UI in ejecucion form (add + edit) within Sidepanel
- Comprobante display in detail view (thumbnail + download)
- Firebase Storage security rules
- Google Cloud CORS config for the bucket
- Orphan file cleanup consideration

### Out of Scope
- File upload for budgets (ejecuciones only)
- Bulk/multi-file upload
- Image compression or resizing
- File deletion from UI

## Capabilities

### New Capabilities
- `comprobantes-ejecutado`: Upload, store, and display evidence files for ejecuciones. Supports PDF, JPG, PNG with immediate upload on selection.

### Modified Capabilities
- None

## Approach

1. **Storage init**: Export `storage` from `lib/firebase.ts` via `getStorage(app)`.
2. **Types**: Add `Comprobante { id, name, url, uploadedAt }` + `comprobantes: Comprobante[]` to `Ejecucion` in `lib/types.ts`.
3. **Upload component**: File picker in Sidepanel → upload immediately to `{companyId}/ejecuciones/{ejecucionId}/{uuid}-{name}` → save metadata in array → update Firestore doc.
4. **Display**: In ejecucion detail view, render comprobantes as links (thumbnails for images) via `getDownloadURL`.
5. **Security**: `storage.rules` — authenticated access only, validate content-type (PDF/JPG/PNG), max 5MB.
6. **Orphans**: Acceptable risk for first iteration; cleanup via `deleteObject` on cancel deferred.
7. **CORS**: Configure bucket once via `gsutil cors set`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/firebase.ts` | Modified | Add `getStorage` init + export |
| `lib/types.ts` | Modified | Add `Comprobante` type + field on `Ejecucion` |
| `components/Sidepanel.tsx` | Modified | Upload UI + display in detail view |
| `storage.rules` | New | Storage security rules |
| `firebase.json` | Modified | Reference `storage.rules` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Orphan files on cancel | Medium | Deferred cleanup |
| CORS blocks uploads | Low | Configure via gsutil once |
| First upload feature — unknown edge cases | Medium | Start with PDF/JPG/PNG only |

## Rollback Plan

Revert file changes (git revert). Remove orphan files via `gsutil rm -r gs://planningsaman-3cf7e.firebasestorage.app/{companyId}/ejecuciones/`. Restore default bucket CORS.

## Dependencies

- Firebase Storage bucket `planningsaman-3cf7e.firebasestorage.app` (already configured)
- Google Cloud credentials for `gsutil cors` setup

## Success Criteria

- [ ] Upload PDF/image from ejecucion form — file appears in Storage bucket
- [ ] Comprobante displays in ejecucion detail view with download link
- [ ] Download opens the file correctly
- [ ] Storage rules reject unauthenticated read/write
- [ ] All existing tests pass
