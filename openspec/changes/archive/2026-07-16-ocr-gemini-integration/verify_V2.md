## Verify Report V2: ocr-gemini-integration

### Summary
**PASS** — All spec requirements are implemented in source code, 846/846 tests pass (0 regressions), TypeScript compiles cleanly, and TDD cycle evidence is complete.

---

### Spec Coverage

#### ocr-extraction

- ✅ **Auth header-only**: Route reads `Authorization` header via `request.headers.get('Authorization')` — rejects missing/invalid headers with 401. Body `authToken` is explicitly checked and rejected with 401 at line 124-126. No body-token acceptance path exists.
  - Evidence: `route.ts` lines 102-113 (header auth), lines 124-126 (body token rejection)

- ✅ **5MB guard**: `const MAX_FILE_SIZE = 5_242_880` (line 9). `buffer.length > MAX_FILE_SIZE` check at line 155 returns `{ error: "El archivo excede el límite de 5MB" }` with status 413.
  - Evidence: `route.ts` lines 9, 155-160

- ✅ **Extension mapping + toLowerCase**: `path.extname(storagePath).toLowerCase()` in `getMimeFromExtension()` (line 40). Explicit MIME table maps `.pdf→application/pdf`, `.png→image/png`, `.jpg/.jpeg→image/jpeg` (lines 11-16). Unsupported extensions return null → 400.
  - Evidence: `route.ts` lines 11-16, 39-43, 134-140

- ✅ **429 retry + propagate as 429**: `callGeminiWithRetry()` catches `error.code === 429` → `sleep(1000)` → retry once. If retry also fails with 429, the error propagates. The route handler catches this propagated 429 and returns `{ error: "Demasiadas solicitudes. Intentá de nuevo." }` with status 429 (lines 170-174). Non-429 errors fall through to 502 (lines 177-180).
  - Evidence: `route.ts` lines 55-95 (retry logic), lines 169-181 (429 propagation), lines 177-180 (502 for non-429)

- ✅ **Nullable response schema**: `OCR_JSON_SCHEMA` declares all 4 fields with `nullable: true` (lines 18-27). Route response normalizes via `?? null` to guarantee null-safe output (lines 191-199). Response type `proveedorTexto: string | null`, `nit: string | null`, `fechaDocumento: string | null`, `montoTotal: number | null`.
  - Evidence: `route.ts` lines 18-27, 184-199

- ✅ **No Firestore writes**: No import from `firebase-admin/firestore` anywhere in `route.ts`. Only imports: `next/server`, `firebase-admin/auth`, `@google/genai`, `@/lib/firebase-admin`, `path`. No `firestore` method or `db` references anywhere in the route file or its mock dependencies.
  - Evidence: `grep firestore app/api/ocr/extract/` returns zero results

#### document-classification

- ✅ **"Extraer con IA" button**: Button renders with `Sparkles` icon and text "Extraer con IA". Clicking triggers `handleOcrExtract` which calls `POST /api/ocr/extract` with `Authorization` header and `storagePath` in body. Button shows `Loader2` spinner + "Extrayendo..." text while loading and is `disabled`.
  - Evidence: `DocumentoSidepanel.tsx` lines 296-319 (rendering), lines 185-231 (handler), lines 196-206 (fetch with auth header)

- ✅ **Non-destructive pre-fill**: Pre-fill logic checks each field individually before overwriting: `if (!nit && data.nit)`, `if (!proveedorTexto && data.proveedorTexto)`, `if (!fechaDocumento && data.fechaDocumento)`, `if (montoTotal === '' && data.montoTotal !== null)`. Only empty fields receive OCR values.
  - Evidence: `DocumentoSidepanel.tsx` lines 217-222

- ✅ **30s timeout**: `AbortSignal.timeout(30000)` — implemented via `AbortController` + `setTimeout(() => controller.abort(), 30000)` at lines 195-196. Timeout error handled via `DOMException.name === 'AbortError'` check at lines 225-226.
  - Evidence: `DocumentoSidepanel.tsx` lines 195-196, 225-227

- ✅ **Error mapping**: All spec-defined error codes are mapped:
  - `401 → "Sesión expirada"` (line 175)
  - `400 → "Formato no soportado. Usá PDF, PNG o JPG."` (line 176)
  - `413 → "El archivo excede el límite de 5MB"` (line 177)
  - `429 → "Demasiadas solicitudes. Esperá un momento e intentá de nuevo."` (line 178)
  - `default (5xx) → "Error al extraer datos. Intentá de nuevo."` (line 179)
  - Timeout → `"El servicio tardó demasiado. Intentá de nuevo."` (line 226)
  
  Error state clears when user clicks "Extraer con IA" again — `setOcrState({ status: 'loading' })` at line 186 replaces any previous error state.
  - Evidence: `DocumentoSidepanel.tsx` lines 173-181, 226, 186

---

### Test Results

- **Total**: 846 tests across 69 files — **ALL PASSED**
- **Regressions**: None — 846/846 passed (0 failures, 0 skipped)
- OCR-specific tests:
  - `app/api/ocr/extract/__tests__/route.test.ts` — 12 test cases covering auth (no header, invalid, body token), 400 (missing path, unsupported ext, uppercase ok), 413 (oversized), 429 retry (single, both fail), 502 (Gemini error), 200 (full, partial nulls)
  - `components/entities/documento/__tests__/DocumentoSidepanel.test.tsx` — OCR-related tests: button render, loading state, full/partial pre-fill, 401/400/413/429/5xx errors, timeout abort, state clearing on retry

---

### TypeScript

- `npx tsc --noEmit`: ✅ **PASS** — Zero errors, clean compilation.

---

### Lint

- `npm run lint`: ⚠️ **PASS (pre-existing only)** — 86 errors, 545 warnings, all pre-existing. No new lint issues introduced by OCR changes. The route file (`route.ts`) has zero lint errors. Only reference to `DocumentoSidepanel.tsx` is a pre-existing `react-hooks/exhaustive-deps` warning at line 114 (useEffect dependency array).

---

### TDD Discipline

- ✅ **Cycle evidence complete**: Apply-progress memory (#429) documents the full TDD cycle — 26 new tests written, 0 regressions, vi.mock hoisting pattern documented, React 19 state batching caveat noted, `responseJsonSchema` parameter name discovery documented. All tasks V2 phases (1-4) marked complete. Green CI-equivalent trace present.

---

### Verdict

**Critical items**: None
**Warning items**: None
**Suggestion items**: 
- Route tests lack explicit 404 (file not found) test case — handler exists at `route.ts` lines 150-152 but no test covers it
- Route tests lack explicit "non-429 error is not retried" test — implied by the 502 test but not explicitly verified

**Overall: ✅ PASS**

---

### Return Envelope

- **Status**: success
- **Summary**: All 6 ocr-extraction spec requirements and all 4 document-classification spec requirements are verified against source code. 846/846 tests pass (0 regressions). TypeScript compiles clean. TDD cycle evidence is complete. No critical or warning issues found. Two non-blocking suggestions for test coverage expansion (404 scenario, explicit non-429 retry guard).
- **Artifacts**: verify_V2.md
- **Next**: sdd-archive
- **Risks**: None identified. Minor gap: 404 file-not-found handler is untested.
- **Skill Resolution**: fallback-path — N/A (verify phase completed successfully using sdd-verify skill)
