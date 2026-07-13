# Tasks: Fix 24 Failing Tests

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 40-50 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Quick Config & Import Fixes

- [x] 1.1 Add `exclude: ['e2e/**']` to `vitest.config.ts` — stops Vitest picking 5 Playwright suites
- [x] 1.2 Add `fetchMovimientoHashes` to the `import` from `@/lib/firestore` in `lib/parsers/__tests__/parsePipeline.test.ts` (line~38)

## Phase 2: Test Alignment Fixes

- [x] 2.1 **ProjectEntity.smoke.test.tsx** — Rename mock export `subscribeCompanySettings` → `subscribeSettings`; fix mock signature (remove `companyId` param); update assertion at line 228
- [x] 2.2 **InvitacionEntity.smoke.test.tsx** — Remove outdated assertions for company checkboxes (lines 118-122) and role toggle (lines 129-133) in create mode; remove company name assertion in edit mode (lines 154-157). Keep view-mode tests unchanged
- [x] 2.3 **ComprobanteUploader.smoke.test.tsx** — Add `vi.mock('@/lib/fileUpload')` at top with stubs for `deleteFile` and `validateFile`; adjust assertions to account for mocked delete flow

## Phase 3: Verification

- [x] 3.1 Run `npm test` — confirm 0 failures (all 531 tests pass) and no E2E suites in output
- [x] 3.2 Run `npx tsc --noEmit` — confirm no new type errors from our changes (4 pre-existing errors remain)
