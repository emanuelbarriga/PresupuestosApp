# Proposal V2: OCR/Gemini Integration (Revised)

> **Note**: This is V2 of the proposal, incorporating 9 corrections from the architecture evaluation report against the actual codebase. See `proposal.md` for the original plan.

## Intent

Replace the OCR stub with real AI-powered extraction via Gemini 2.5 Flash **Paid Tier** (single model — no hybrid, no Gemma). Users click "Extraer con IA" in DocumentoSidepanel to auto-fill metadata fields (proveedor, NIT, fecha, monto) from facturas/comprobantes — reducing manual entry while keeping human-in-the-loop review before save.

## Scope

### In Scope
- Install `@google/genai` dependency
- Add `GEMINI_API_KEY` to `.env` / `.env.example`
- New `POST /api/ocr/extract` route with corrections:
  - Auth via `Authorization: Bearer <token>` header **only** (body = `{ storagePath }` only)
  - Single-step file fetch: `download()` → validate size from `buffer.length` + infer MIME from file extension → Base64 (avoids one Storage roundtrip, saves ~200ms on cold start)
  - Hard 5MB file size guard → 413 Payload Too Large
  - 1 retry at 1s for 429 rate limits
- "Extraer con IA" button in DocumentoSidepanel replacing OCR stub
- Pre-fill **only empty** metadata fields (non-destructive — respect manual entry)
- Client AbortController at **30s** timeout (safety net — Gemini typical latency is 2-5s)

### Explicitly Discarded (from V1)
- **Gemma 4 / hybrid routing**: Gemma Free Tier uses customer data for training = privacy violation for financial data. No Paid Tier exists. 60 docs/month makes routing overhead pointless. Cost difference is ~$0.01/mo.
- **Two-step Storage fetch (`getMetadata` + `download`)**: Eliminated to save ~200ms roundtrip on cold start. Single `download()` with buffer validation is faster and simpler.
- **Body auth token**: All 4 existing API routes read from `Authorization` header. Body auth was inconsistent.

### Out of Scope (unchanged)
- Bulk OCR in InboxTab batch processing — Phase 2
- Auto-OCR on upload — Phase 2
- Document type detection / auto-classification — Phase 2
- OCR usage tracking or cost management — Phase 2

## Approach

### 1. Infrastructure
- `npm install @google/genai` — server-side Gemini SDK
- `GEMINI_API_KEY` in `.env` / `.env.example` (Google AI API key with Gemini API enabled)
- Add `getAdminStorage()` to `lib/firebase-admin.ts` — static import from `firebase-admin/storage`

### 2. API Route: POST /api/ocr/extract

| Step | Detail |
|------|--------|
| Auth | `Authorization: Bearer <token>` → `verifyIdToken()` (matches 4 existing routes) |
| Body | `{ storagePath: string }` — no auth in body |
| File fetch | `bucket.file(storagePath).download()` → `Buffer` |
| Guard | `buffer.length > 5MB` → return `413 Payload Too Large` |
| Guard | Extension not in `[.pdf, .png, .jpg, .jpeg]` → return 400 |
| MIME resolve | Map extension to MIME: `.pdf` → `application/pdf`, `.png` → `image/png`, `.jpg/.jpeg` → `image/jpeg` |
| Gemini call | `inlineData` with real MIME type + Base64 data → `responseJsonSchema` for structured output |
| Retry | 1 retry at 1s delay on 429 only; other errors propagate immediately |
| Response | `{ proveedorTexto, nit, fechaDocumento, montoTotal }` — JSON only, no Firestore writes |

### 3. Client: DocumentoSidepanel
- Replace OCR stub with "Extraer con IA" button + loading spinner
- On click: `fetch('/api/ocr/extract', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ storagePath }), signal: AbortSignal.timeout(30000) })`
- On success: pre-fill **only** fields that are empty (`if (!nit) setNit(data.nit)`)
- On timeout (30s): "El servicio tardó demasiado. Intentá de nuevo."

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | Add `@google/genai` |
| `.env` / `.env.example` | Modified | Add `GEMINI_API_KEY` |
| `lib/firebase-admin.ts` | Modified | Add `getAdminStorage()` export |
| `app/api/ocr/extract/route.ts` | **New** | POST endpoint with all corrections |
| `components/entities/documento/DocumentoSidepanel.tsx` | Modified | OCR trigger + pre-fill + timeout handling + states |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Gemini latency (2-5s typical, up to 10s worst case) | Low | 30s client timeout — más de 3x el peor caso |
| Accuracy on varied Colombian doc formats | Medium | Human-in-the-loop review; non-destructive pre-fill |
| API key exposure | Low | Server-side only, never in client bundle |
| Rate limit (429) burst | Low | 1 retry at 1s; 60 docs/month = ~2 calls/day avg |
| `@google/genai` API changes | Low | Pin version, integration test |

## Cost Estimate

- **~$0.04 USD/month** (~$160 COP) for 60 documents
- Gemini 2.5 Flash: $0.15/1M input tokens, $0.60/1M output tokens
- Factura PDF ~500 tokens → 60 docs = well under free tier equivalent

## Rollback Plan

1. Remove `GEMINI_API_KEY` from deployment env vars — API routes fail safely (no downstream callers)
2. Revert `DocumentoSidepanel.tsx` to show OCR stub again
3. Keep or delete API route file — no impact (no callers other than the button)
4. Revert `package.json` (`@google/genai` removed)
5. Revert `lib/firebase-admin.ts` (remove `getAdminStorage()`)
6. No data migration: OCR results are ephemeral until user saves

## Success Criteria

- [ ] "Extraer con IA" button visible and functional in DocumentoSidepanel
- [ ] API route returns structured JSON for PDF and image uploads
- [ ] Auth rejects requests without valid `Authorization: Bearer` header
- [ ] 413 returned for files >5MB
- [ ] 400 returned for unsupported content types
- [ ] Empty fields pre-filled; manually entered fields preserved
- [ ] Client timeout (30s) shows friendly error
- [ ] All existing tests + new tests pass
- [ ] No regressions in classification workflow
