## Tasks V2: ocr-gemini-integration

### Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~305 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Phase 1: Infrastructure

- [x] 1.1 `npm install @google/genai@latest` — pin versión exacta en `package.json` (sin `^` ni `~`). Ej: `"@google/genai": "4.2.0"`. Verificar que `responseJsonSchema` sea el parámetro correcto en esa versión.
  - Test: `grep '"@google/genai"' package.json` muestra sin rango semver
- [x] 1.2 Add `GEMINI_API_KEY` to `.env` / `.env.example`
  - Test: env var loads in route handler
- [x] 1.3 Export `getAdminStorage()` from `lib/firebase-admin.ts` (`getStorage` from `firebase-admin/storage`)
  - Test: `import { getAdminStorage }` resolves

### Phase 2: API Route

- [x] 2.1 Create `app/api/ocr/extract/route.ts` — POST handler:
  — Auth: `Authorization: Bearer` → `verifyIdToken()` per `companies/create`
  — Body `{ storagePath }` only — reject body tokens
  — `bucket.file(path).download()` → Buffer; size guard: `buffer.length > 5242880` (5MB) → 413
  — Extension via `path.extname().toLowerCase()`; reject ≠ `.pdf/.png/.jpg/.jpeg`
  — MIME: `.pdf→application/pdf`, `.png→image/png`, `.jpg/.jpeg→image/jpeg`
  — `@google/genai` + `responseJsonSchema`; 1 retry at 1s on 429 (propagate as 429)
  — Error table: 401, 400, 413, 404, 429, 502, 504, 500 per design_V2.md
  — No Firestore writes; PDF multi-page OK (Gemini 2.5 Flash handles natively)
  - Test: `npx vitest run app/api/ocr/extract/__tests__/route.test.ts`

### Phase 3: Client Integration

- [x] 3.1 `DocumentoSidepanel.tsx`: `OcrState` (`idle|loading|success|error`) + "Extraer con IA" button + `AbortSignal.timeout(30000)` + spinner "Extrayendo..." + button disabled while loading
  - Test: button renders, click shows spinner, button disabled
- [x] 3.2 Pre-fill no destructivo: solo campos vacíos (`!nit && ocrData.nit`); `montoTotal` `number|null` → `.toString()`, condición `montoTotal === '' && ocrData.montoTotal !== null`. Usar `ocrData.campo ?? ''` como fallback en los setters para evitar pasar `null` a estados tipados como `string`.
  - Test: campo manual preservado (ej. NIT ya ingresado), vacíos se llenan; null de la IA no rompe tipos
- [x] 3.3 Error UX: 401→"Sesión expirada", 400→"Formato no soportado", 413→"El archivo excede 5MB", 429→"Demasiadas solicitudes...", timeout→"El servicio tardó demasiado", 5xx→"Error al extraer datos". Transición a `loading` limpia error previo.
  - Test: cada código muestra mensaje correcto; error se limpia al reintentar

### Phase 4: Tests

- [x] 4.1 Route unit tests: mock `firebase-admin/auth`, `firebase-admin/storage`, `@google/genai`. Cover:
  — 401: no token, invalid token, **token en body JSON (no header)** — todos deben rechazar
  — 400: missing storagePath, extensión no soportada (.docx), **mayúsculas ok (FACTURA.PDF no debe dar 400)**
  — 413: buffer > 5242880 bytes (simular 6MB)
  — 429 retry: primer intento falla 429 → segundo intento 200 OK (reintento exitoso)
  — 429 both fail: primer y segundo intento 429 → respuesta 429 al cliente (NO 502)
  — 502: Gemini error no recuperable
  — 200: full fields + partial nulls
  - Test: `npx vitest run app/api/ocr/extract/__tests__/route.test.ts`
- [x] 4.2 `DocumentoSidepanel.test.tsx`: reemplazar test "OCR stub" por "Extraer con IA". Add: loading state, full + partial pre-fill, 401/400/413/429/5xx errors, timeout abort, state clearing on retry
  - Test: `npx vitest run components/entities/documento/__tests__/DocumentoSidepanel.test.tsx`
- [x] 4.3 Full suite — zero regressions
  - Test: `npx vitest run`
