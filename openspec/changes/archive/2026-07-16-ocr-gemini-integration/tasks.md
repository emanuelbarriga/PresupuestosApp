# Tasks: OCR/Gemini Integration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~330 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | API route + client integration + tests | PR 1 | Single feature, well-scoped |

## Phase 1: Infrastructure

- [ ] 1.1 `npm install @google/genai` — add Gemini SDK dependency
  - Test: verify `@google/genai` in `package.json`
- [ ] 1.2 Add `GEMINI_API_KEY` to `.env` / `.env.example`
  - Test: env var loads in route handler
- [ ] 1.3 Export `getAdminStorage()` from `lib/firebase-admin.ts` (`getStorage` from `firebase-admin/storage`)
  - Test: `import { getAdminStorage } from '@/lib/firebase-admin'` resolves

## Phase 2: API Route

- [ ] 2.1 Create `app/api/ocr/extract/route.ts` — POST handler: verifyIdToken auth (companies/create pattern), body validation (storagePath required), bucket.file().download(), MIME type guard (pdf/png/jpeg), Gemini 2.5 Flash call with `responseJsonSchema`, 30s `maxDuration`, response mapping
  - Test: `POST /api/ocr/extract` scenarios per `specs/ocr-extraction/spec.md` (auth, validation, Storage errors, Gemini errors, success with partial nulls)

## Phase 3: Client Integration

- [ ] 3.1 `DocumentoSidepanel.tsx`: replace OCR stub (lines 216–221) with "Extraer con IA" button — add `ocrLoading`/`ocrError` state, `handleOcrExtract` with AbortController (30s), pre-fill all 4 metadata fields on 200
  - Test: button renders, click starts loading, success fills fields
- [ ] 3.2 Wire error UX per spec: inline banner for auth/format/timeout/Gemini errors; existing form values never modified on failure
  - Test: each error path renders expected message in banner

## Phase 4: Tests

- [ ] 4.1 Unit tests for `app/api/ocr/extract/route.ts`: mock verifyIdToken, Storage download, GoogleGenAI.generateContent. Cover: 401 (no/invalid auth), 400 (missing body/storagePath, unsupported format), 404 (file not found), 504 (timeout), 502 (Gemini error), 200 (full + partial nulls)
  - Test: `npx vitest run app/api/ocr/extract/__tests__/route.test.ts`
- [ ] 4.2 Update `DocumentoSidepanel.test.tsx`: replace "renders OCR stub banner" with "renders Extraer con IA button", add tests for loading spinner, success pre-fill, error banner, timeout via mocked `global.fetch`
  - Test: `npx vitest run components/entities/documento/__tests__/DocumentoSidepanel.test.tsx`
- [ ] 4.3 Run full suite — no regressions
  - Test: `npx vitest run`
