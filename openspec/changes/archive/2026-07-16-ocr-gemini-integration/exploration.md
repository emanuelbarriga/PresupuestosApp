# Exploration: OCR/IA con Gemini API

## Current State

### Document Upload Flow

1. **Two upload entry points:**
   - **InboxTab** (`components/media/InboxTab.tsx`): Bulk upload via drag-and-drop or file picker. Uploads to flat Storage path `companies/{cId}/documentos/{uuid}-{name}`, creates `DocumentoMedio` with `status: 'por_clasificar'`, `_source: 'inbox-upload'`. Real-time subscription via `subscribeDocumentos()`.
   - **ComprobanteUploader** (`components/upload/ComprobanteUploader.tsx`): Inside EjecucionForm, uploads per-ejecucion. Same flat Storage path, creates `DocumentoMedio` with `status: 'por_clasificar'`, `_source: 'ejecucion-form'`.

2. **Storage paths:** Flat — `companies/{cId}/documentos/{uuid}-{sanitizedName}`. No subdirectories per entity. All files are PDF, JPG, or PNG (max 5MB).

3. **Metadata captured on upload:** Only `fileName`, `storagePath`, `url`, `size`, `mimeType`, `status`, `ejecucionIds`, `_source`. **No OCR happens.** All fields like `tipoDocumento`, `periodo`, `terceroId`, `projectId`, `metadata` (proveedorTexto, nit, fechaDocumento, montoTotal) are filled **manually** via DocumentoSidepanel.

4. **DocumentoSidepanel** (`components/entities/documento/DocumentoSidepanel.tsx`):
   - Shows PDF preview via shared `PdfViewer`
   - Has an **OCR stub banner**: "OCR disponible en futura versión" (defined in `openspec/specs/document-classification/spec.md` as Phase 3)
   - Manual classification form: tipo (8 chips), periodo (YYYY-MM), tercero, proyecto, ejecuciones
   - Manual metadata: NIT, proveedor, monto total
   - On save, calls `linkDocumentoToEntities()` which atomically updates the DocumentoMedio and linked Ejecuciones via `runTransaction`.

5. **DocumentoMedio type** (`lib/types.ts`):
   ```typescript
   interface DocumentoMedioMetadata {
     proveedorTexto?: string;
     nit?: string;
     fechaDocumento?: string; // YYYY-MM-DD
     montoTotal?: number;
   }
   ```
   The `metadata` fields map **directly** to what Gemini OCR would extract from a factura/comprobante. No changes needed to the type — it's already designed for OCR output.

6. **Server-side execution:** The project has 4 existing API routes at `app/api/companies/*` using `firebase-admin` with service account auth. Uses `Bearer` token verification from `firebase-admin/auth`. **No server actions** pattern exists.

### Existing Gemini Usage

- **`@google/genai` is NOT installed.** The `package.json` does NOT include it. It was explicitly excluded in the archived `sistema-medios-desacoplado` proposal ("no se instala en MVP"). The task description noted it was in dependencies, but that appears to be incorrect — it must be installed.
- **No `.env` variable exists for Gemini API key.** The `.env.example` only has Firebase config + service account vars. A `GEMINI_API_KEY` would need to be added.
- **No existing Gemini integration code** anywhere in the codebase.

### Document Classification System

- Spec at `openspec/specs/document-classification/spec.md`
- **Fully manual today.** Users select tipo, periodo, and link to entities via `DocumentoSidepanel`.
- The OCR requirement exists as a **disabled stub** ("OCR disponible en futura versión"). Phase 3 was always the plan.
- Classification transitions: `por_clasificar → enlazado` via `linkDocumentoToEntities()`.

### Service Layer

- `lib/mediaService.ts`: `subscribeDocumentos()`, `createDocumento()`, `getDocumento()` — all client-side Firestore operations.
- `lib/mediaLinking.ts`: `linkDocumentoToEntities()`, `unlinkDocumentoFromEjecucion()`, `deleteDocumentoComplete()` — uses `runTransaction` for atomicity.
- `lib/fileUpload.ts`: `uploadFileWithTask()`, `validateFile()`, `generateMediaFilePath()` — Firebase Storage client operations.
- `lib/firebase-admin.ts`: Initializes Firebase Admin SDK for API routes (service account credentials).

## Affected Areas

| File | Why Affected |
|------|-------------|
| `package.json` | Need to add `@google/genai` dependency |
| `.env.example` / `.env` | Need `GEMINI_API_KEY` env var |
| `app/api/ocr/extract/route.ts` (new) | New API route for server-side Gemini calls (protect API key) |
| `lib/mediaService.ts` | May need a `processDocumentoWithOCR()` function or similar |
| `lib/types.ts` | Possibly extend `DocumentoMedioMetadata` for additional OCR fields (e.g., `ocrRaw`, `ocrConfidence`) |
| `components/entities/documento/DocumentoSidepanel.tsx` | Replace OCR stub with real OCR trigger, auto-fill fields from result |
| `components/entities/documento/DocumentoEntity.tsx` | May need new `onOCRComplete` callback or state |
| `components/media/InboxTab.tsx` | May add an "OCR Bulk" action button for multiple docs |
| `lib/firebase-admin.ts` | No changes needed (already supports API routes) |
| `openspec/specs/document-classification/spec.md` | Will need to update OCR stub requirement to real requirement |
| `components/entities/documento/__tests__/DocumentoSidepanel.test.tsx` | Tests will need updates for OCR flow |

## Approaches

### 1. Server-side Gemini API Route (Recommended)

**Single API Route at `app/api/ocr/extract/route.ts`**

The client uploads the file URL (from Storage), the API route:
1. Validates the auth token (same pattern as existing routes)
2. Fetches the file from Storage using `firebase-admin` or directly via the URL
3. Sends the image/PDF bytes to Gemini via `@google/genai`
4. Returns structured JSON (tipoDocumento, periodo, proveedor, NIT, monto, fecha)
5. Client auto-fills the classification form

```typescript
// Request
POST /api/ocr/extract
Authorization: Bearer <firebase-id-token>
Body: { storagePath: "companies/c1/documentos/uuid-factura.pdf" }

// Response
{
  proveedorTexto: "Distribuidora ABC S.A.S.",
  nit: "900.123.456-7",
  fechaDocumento: "2026-06-15",
  montoTotal: 1500000,
  tipoDocumentoSugerido: "factura_compra",
  periodo: "2026-06",
  rawText: "..." // full OCR text for debugging
}
```

- **Pros:** API key never leaves server, same auth pattern as existing routes, structured JSON output via `responseJsonSchema`, handles PDF/image natively via Gemini vision
- **Cons:** Network hop for each OCR call, Gemini API latency (~2-5s per document), need to handle file download from Storage server-side
- **Effort:** Medium

### 2. Client-side Gemini Call

**Direct Gemini call from browser (using restricted API key)**

- **Pros:** No server infrastructure, simpler code, faster (no double-hop)
- **Cons:** API key exposed in client bundle (even with HTTP referrer restrictions), cannot use Firebase Admin to fetch files, security concerns
- **Effort:** Low
- **Veredict:** Rejected — API key protection is a hard requirement for production

### 3. Server Action with Gemini

**Next.js Server Action instead of API Route**

- **Pros:** RSC-native, no manual route setup
- **Cons:** No existing server action pattern in the project, harder to test in isolation, mixing concerns with page components
- **Effort:** Medium
- **Veredict:** The project already has API routes with a consistent auth pattern. Stick with API Route for consistency.

### 4. Bulk OCR (Post-Upload Batch)

**Background processing after every upload + bulk action in Inbox**

Two modes:
- **Auto-OCR on upload:** As soon as a file is uploaded to Inbox, automatically trigger OCR
- **Manual bulk OCR:** User selects multiple documents in Inbox and clicks "Extraer con IA"

- **Pros:** Batch efficiency, good UX for bulk imports
- **Cons:** Auto-OCR costs money even for irrelevant docs, need progress tracking for bulk mode
- **Effort:** High
- **Veredict:** Start with **single-document on-demand** (from DocumentoSidepanel), add bulk in a follow-up

## Recommendation

**Approach 1** (Server-side API Route) with **single-document on-demand trigger**.

The flow would be:

1. User opens a `por_clasificar` document in DocumentoSidepanel
2. Sees an "Extraer con IA" button (replacing the OCR stub)
3. Clicks → client calls `POST /api/ocr/extract` with the document's `storagePath`
4. API route fetches the file via Firebase Admin Storage, sends to Gemini 2.5 Flash
5. Gemini returns structured JSON (proveedor, NIT, monto, fecha, tipo sugerido, periodo)
6. Client auto-fills the classification form fields
7. User reviews, corrects if needed, and clicks "Guardar y Enlazar"

This maintains the **human-in-the-loop** pattern (user always reviews OCR output before saving), keeps the existing `linkDocumentoToEntities` atomic transaction unchanged, and only adds an optional AI step.

**Why Gemini 2.5 Flash:** Best latency/quality tradeoff for document OCR. Available via `@google/genai`. Supports PDF and image input natively. The `responseJsonSchema` feature can enforce structured JSON output.

**Why not auto-OCR on upload:**
- Costs accumulate even for garbage/scanned docs
- User might want to classify manually for sensitive documents
- Adds complexity to the upload pipeline
- Start with on-demand, measure adoption, then consider auto-OCR

## Risks

- **Gemini API costs:** Each call costs money. Need to budget and potentially add usage limits. Suggested: track per-company usage in Firestore.
- **Latency:** OCR calls can take 2-5s. Need good loading UI, timeout handling (30s), and retry logic.
- **Accuracy on Spanish documents:** Colombian facturas/comprobantes have varied formats. Gemini might misinterpret fields. The human-in-the-loop review mitigates this.
- **PDF handling:** Gemini 2.5 Flash supports PDF natively, but very large or scanned PDFs may have lower accuracy. Consider only sending the first page for very large documents.
- **API key management:** The exact same `GEMINI_API_KEY` pattern used across all environments. Need to add to `.env.example` and deployment config (Firebase App Hosting env vars).
- **Rate limiting:** Free tier has RPM limits. Need to handle 429 errors gracefully.
- **`@google/genai` is currently NOT installed.** The task description noted it was in dependencies, but `package.json` confirms it's absent. First step is `npm install @google/genai`.

## Architectural Corrections (from Evaluation Report)

These corrections SUPERSEDE any contradictory statements in the previous sections of this document. Each was verified against the actual codebase.

### 1. ❌ Discard Gemma 4 entirely

**Why**: Gemma 4 Free Tier uses customer data for training — privacy violation for financial data (facturas, comprobantes, NITs). No Paid Tier available. No native PDF support.

**Impact**: Single model approach: **Gemini 2.5 Flash Paid Tier ONLY**. Remove all references to Gemma 4 or hybrid model selection. The cost difference is negligible (~$0.01/month for the expected volume of 60 docs/month).

### 2. ❌ Discard hybrid routing (Gemma 4 for images, Gemini for PDFs)

**Why**: 30 images + 30 PDFs/month = ~60 docs total. Cost difference between any model pair is $0.01/month. Hybrid routing adds routing logic, two code paths, and two API key configs — pure overengineering.

**Impact**: One unified path: ALL documents → Gemini 2.5 Flash. Simpler code, same privacy guarantees, no routing logic.

### 3. 🔧 Auth token: Authorization header ONLY (verified against existing code)

**✅ VERIFIED**: All 4 existing API routes (`companies/create`, `assign-user`, `accept-invitation`, `manage-member`) read the auth token from:
```typescript
const authHeader = request.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) { /* 401 */ }
const token = authHeader.slice(7);
```

**Previous mistake**: The data flow diagram in `design.md` (line 24) incorrectly showed `{ storagePath, auth token }` in the request body.

**Correction**: `POST /api/ocr/extract` body = `{ storagePath }` ONLY. Token in `Authorization: Bearer <id-token>` header — same pattern as all existing routes.

### 4. 🔧 File metadata fetched separately (verified against Firebase Admin SDK API)

**Why**: `bucket.file(path).download()` returns a raw `Buffer` — it does NOT return `contentType` or any MIME type. The current design incorrectly assumed the download returns both.

**Correction**:
```typescript
const [file] = await bucket.file(storagePath).getMetadata();
const mimeType = file.contentType; // real MIME from Storage
const [buffer] = await bucket.file(storagePath).download();
```
Call `getMetadata()` FIRST to obtain the real MIME type before passing to Gemini's `inlineData`. This is critical because:
- Gemini rejects mismatched MIME types
- Storage metadata is the authoritative source (not the file extension)
- The file could have been uploaded with a detected or overridden content type

### 5. 🔧 UX pre-fill: ONLY empty fields

**Why**: The design.md contained a contradiction: "Design choice: **always pre-fill**" vs the spec's "fills ONLY fields that are currently empty."

**Correction**: "Extraer con IA" fills ONLY fields that are currently empty. If the user has manually typed a NIT, the OCR result does NOT overwrite it — the user's entry takes precedence. Rationale:
- User may have partially filled the form before clicking OCR
- OCR can be wrong — the user's manual entry is the authoritative source
- Non-destructive pre-fill matches the "human-in-the-loop" pattern

**Implementation**: For each field, pre-fill only if `currentValue === ''`:
```typescript
if (!nit) setNit(data.nit ?? '');
if (!proveedorTexto) setProveedorTexto(data.proveedorTexto ?? '');
if (!fechaDocumento) setFechaDocumento(data.fechaDocumento ?? '');
if (!montoTotal) setMontoTotal(data.montoTotal?.toString() ?? '');
```

### 6. 🔧 Add 5MB file size guard (verified: client already validates at 5MB)

**✅ VERIFIED**: Client-side `lib/fileUpload.ts` already enforces 5MB max:
```typescript
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
```

**Server-side guard**: After `getMetadata()`, check `size > 5MB → return 413 Payload Too Large`. Rationale:
- Raw Buffer + Base64 encoding in serverless functions = memory risk (~7MB RSS per request)
- Prevents Gemini API call on oversized files (saves $)
- Consistent with existing client-side limit

**Design correction**: Change from "Phase 2 concern" (as noted in design.md Open Questions) to a HARD REQUIREMENT in the API route. Return `{ error: "File too large. Maximum: 5MB" }` with status 413.

### 7. 🔧 Vercel Hobby Plan: 10s hard timeout (verified: no maxDuration export)

**Why**: `export const maxDuration = 30` only works on Vercel paid plans. The Hobby plan imposes a **10-second hard limit**. If the function takes longer than 10s, Vercel kills it with a 504 BEFORE the client's AbortController fires.

**✅ VERIFIED**: The project has NO `maxDuration` exports in any existing route — no precedent for serverless duration configuration.

**Correction**: 
- Client: `AbortController` with **8 second timeout** (not 30s as in the current spec)
- On abort: show friendly "La extracción tardó demasiado. Intentá de nuevo." — BEFORE the server kills the connection
- This gives 2s of headroom before Vercel's 10s hard limit
- Gemini 2.5 Flash typical latency is 2-5s, so 8s covers outliers

**Design correction**: Remove `maxDuration: 30` from the route. The Hobby plan does not support it.

### 8. 🔧 Multi-page PDF limitation: permanent UI warning

**Why**: Gemini 2.5 Flash processes only **page 1** of PDFs by default. This is NOT documented in the UI.

**Correction**: Add a permanent UI warning under the "Extraer con IA" button:
```
"La IA solo leerá la primera página de los documentos PDF."
```
This manages user expectations and prevents confusion when multi-page documents are only partially extracted.

### 9. 🔧 Retry logic for rate limits (429)

**Why**: Multiple concurrent OCR calls may hit Google AI API rate limits (especially during bulk upload or rapid clicking).

**Correction**: Wrap the Gemini SDK call in a simple retry:
```typescript
async function callGeminiWithRetry(prompt: string, maxRetries = 1): Promise<...> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await genAI.models.generateContent({ ... });
    } catch (err) {
      if (attempt < maxRetries && err instanceof Error && 'status' in err && (err as any).status === 429) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
}
```
- 1 retry after 1s delay on 429 only
- Other errors propagate immediately
- Prevents transient rate limit failures without masking real errors

## Revised Single Approach

After corrections, the approach is simplified:

| Aspect | Before (needs correction) | After (corrected) |
|--------|--------------------------|-------------------|
| Model | Gemini 2.5 Flash (implicitly single) | **Explicitly** Gemini 2.5 Flash Paid Tier ONLY — no Gemma, no hybrid |
| Auth transport | Mixed (diagram showed body) | **Authorization header** only — consistent with all 4 existing routes |
| File fetch | Assumed `download()` returns contentType | **Two-step**: `getMetadata()` first, then `download()` |
| Pre-fill behavior | "Always pre-fill" (contradictory) | **Non-destructive**: fill only if field is empty |
| File size limit | "Phase 2 concern" at 10MB | **Hard 5MB guard** in API route (413) — matches client limit |
| Timeout | `maxDuration: 30` + 30s AbortController | **8s AbortController** — Hobby plan hard limit is 10s |
| PDF warning | Not mentioned in UI | **Permanent banner**: "La IA solo leerá la primera página..." |
| Rate limit retry | None | **1 retry at 1s** for 429 errors |
| `maxDuration` export | `maxDuration: 30` | **Removed** — Hobby plan doesn't support it |

## Ready for Proposal

Yes — the exploration is complete and corrected. All 9 architectural corrections have been verified against the actual codebase. The revised approach is simpler, more reliable on Vercel Hobby, and privacy-compliant. Proceed to `sdd-propose` with these corrections, then update spec, design, and tasks accordingly.
