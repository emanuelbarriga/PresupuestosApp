# Design: Comprobantes de Ejecutado

## Technical Approach

New `ComprobanteUploader` component renders inline in FormPanel (ejecucion mode) and EjecucionView. Uses Firebase Storage SDK (`uploadBytesResumable`, `getDownloadURL`, `deleteObject`). Files stored at `gs://planningsaman-3cf7e.firebasestorage.app/{companyId}/ejecuciones/{ejecucionId}/{uuid}-{sanitizedName}`. Upload timing differs by mode: EDIT-mode uploads immediately (doc exists), ADD-mode defers to submit (avoids orphan complexity).

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **Upload timing** — immediate vs on submit | Immediate prevents data loss on panel close but creates orphans on cancel for ADD. Deferred for ADD is simpler and avoids skeleton docs. | **Deferred for ADD, immediate for EDIT**. ADD uses local pending state; uploads run after `addEjecucion` returns the real ID. |
| **Comprobantes as inline array vs subcollection** | Subcollection scales better but adds queries and complexity. Inline array is simple, consistent with current model (no subcollections in the app). | **Inline `Comprobante[]` on Ejecucion doc**. Matches existing pattern, sufficient for expected volumes. |
| **UUID generation** — crypto vs nanoid vs uuid lib | `crypto.randomUUID()` is built-in, no deps. Wide browser support. | **`crypto.randomUUID()`** for file names. Available in all modern browsers, zero-dependency. |
| **Storage path structure** — with/without ejecucionId | Without ejecucionId is simpler but makes cleanup harder. With ejecucionId groups files logically per ejecucion. | **`{companyId}/ejecuciones/{ejecucionId}/{uuid}-{sanitizedName}`**. Groups related files. |
| **Upload progress** — XHR progress vs polling | `uploadBytesResumable` provides `snapshot.bytesTransferred` / `totalBytes` via its `on` method. Native, no extra work. | **`uploadBytesResumable` with `on('state_changed')`**. Standard Firebase pattern. |

## Data Flow

```
ADD mode:
  Select file → validate type+size → store in pending[]
  Submit form → addEjecucion() returns docId
            → for each pending: uploadBytesResumable → getDownloadURL
            → updateEjecucion() with { comprobantes: [...] }
            → close panel

EDIT mode:
  Select file → validate type+size → uploadBytesResumable using ejecucion.id
            → on complete: getDownloadURL → updateEjecucion() append new comprobante
            → UI updates via real-time subscription

View mode (EjecucionView):
  Read ejecucion.comprobantes → render list
  Image files (jpg/png): show <img> thumbnail via downloadURL[]
  PDF/others: show download link via getDownloadURL()
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/types.ts` | Modify | Add `Comprobante` interface + `comprobantes: Comprobante[]` to `Ejecucion` |
| `lib/firebase.ts` | Modify | Import `getStorage`, export `storage` instance |
| `lib/fileUpload.ts` | Create | Helpers: `validateFile()`, `uploadFile()`, `deleteFile()`, `generateFilePath()` |
| `lib/firestore.ts` | Modify | `subscribeEjecuciones` — deserialize `comprobantes` (default `[]`). `addEjecucion`/`updateEjecucion` already pass through extra fields — no change needed |
| `components/Sidepanel.tsx` | Modify | Add `ComprobanteUploader` to FormPanel's ejecucion section. Add comprobantes list + thumbnails to `EjecucionView` and `MiniEjecucionView` |
| `app/[company]/[[...segments]]/page.tsx` | Modify | `handleFormSubmit` for ADD ejecucion: add file upload step after `addEjecucion`, then `updateEjecucion` with comprobantes |
| `storage.rules` | Create | Firebase Storage security rules — auth, path, content-type, size validation |
| `firebase.json` | Modify | Add `"storage": {"rules": "storage.rules"}` |
| `cors.json` | Create | CORS config for client-side browser uploads (`gsutil cors set`) |

## Interfaces / Contracts

```typescript
// lib/types.ts additions
export interface Comprobante {
  id: string;
  name: string;         // Original file name
  url: string;          // Download URL (getDownloadURL result)
  type: string;         // MIME type — image/jpeg, image/png, application/pdf
  size: number;         // File size in bytes
  uploadedAt: string;   // ISO date string
}

// Ejecucion gets:
comprobantes: Comprobante[];

// lib/fileUpload.ts contract
validateFile(file: File): { valid: boolean; error?: string }
generateFilePath(companyId: string, ejecucionId: string, fileName: string): string
uploadFile(file: File, path: string): Promise<string>  // returns download URL
deleteFile(path: string): Promise<void>
```

### ComprobanteUploader props

```typescript
interface ComprobanteUploaderProps {
  companyId: string;
  ejecucionId?: string;             // undefined in ADD mode (pending state)
  comprobantes: Comprobante[];
  onComprobantesChange: (updated: Comprobante[]) => void;
  mode: 'add' | 'edit';
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `validateFile()` — type/size rejection, edge cases | vitest, pure function tests |
| Unit | `generateFilePath()` — path construction, sanitization | vitest |
| Unit | `ComprobanteUploader` — renders, validates, shows error | @testing-library/react + mocked Firebase Storage |
| Unit | `ComprobanteUploader` — progress indicator renders during upload | mock `uploadBytesResumable` progress callback |
| Integration | FormPanel with upload — ADD mode: pending → submit | mock firestore + storage, verify flow |
| Integration | EjecucionView — renders comprobantes list with thumbnails | @testing-library/react, mock data |
| E2E | Manual: upload PDF → verify in Storage → verify in view | Documented manual flow |

## Migration / Rollout

No migration required. Existing Ejecucion docs without `comprobantes` deserialize as `undefined` — `subscribeEjecuciones` defaults to `[]`. Storage bucket already exists; needs `gsutil cors set` once.

## Open Questions

- [ ] CORS config: `gsutil cors set cors.json` needs GCP credentials — document exact command in setup notes
