## Exploration: Fix 24 Failing Tests

### Current State
Verified each of the 5 hypothesis groups by reading actual source files. All hypotheses are CONFIRMED, with additional nuance found in Groups 1 and 3.

### Affected Areas
- `components/entities/project/ProjectEntity.smoke.test.tsx` — mock exports wrong function name (`subscribeCompanySettings` instead of `subscribeSettings`), wrong mock signature (expects companyId param)   
- `components/entities/project/ProjectEntity.tsx` — uses `subscribeSettings(setSettingsData, () => {})` (correct, no companyId param)
- `lib/firestore.ts` — real `subscribeSettings(onData, onError?)` signature confirmed
- `components/entities/invitacion/InvitacionEntity.smoke.test.tsx` — tests for company checkboxes and role toggle that no longer exist in simplified forms
- `components/entities/invitacion/InvitacionCreateForm.tsx` — simplified, no company/role UI
- `components/entities/invitacion/InvitacionEditForm.tsx` — simplified, no company/role UI
- `components/entities/invitacion/InvitacionView.tsx` — DOES render `DF label="Empresa"` and role badge (view mode works)
- `components/upload/__tests__/ComprobanteUploader.smoke.test.tsx` — missing mock for `@/lib/fileUpload`, causing `deleteFile` to fail in test environment, catch block swallows error preventing `onComprobantesChange`
- `components/upload/ComprobanteUploader.tsx` — `handleRemove` calls `deleteFile(comp.path)`, catch swallows errors
- `lib/parsers/__tests__/parsePipeline.test.ts` — missing `fetchMovimientoHashes` in import statement from `@/lib/firestore`
- `vitest.config.ts` — missing `exclude` pattern for `e2e/` directory
- `e2e/specs/login.spec.ts` — uses `import { test, expect } from '@playwright/test'` and `test.describe()` (not Vitest API)
- `e2e/specs/budget.spec.ts` — same Playwright API pattern

### Group-by-Group Verification

#### Group 1: ProjectEntity smoke (19 tests)
- **Verified root cause**: CONFIRMED — mock exports `subscribeCompanySettings` instead of `subscribeSettings`. Component imports `subscribeSettings`. Additionally:
  1. Mock defines `subscribeCompanySettings(_companyId, onData)` with 2 params (companyId + callback)
  2. But real `subscribeSettings(onData, onError?)` takes only callback + optional error callback (no companyId)
  3. Test assertion at line 228 also references `subscribeCompanySettings` so it would also fail
  4. Mock also exports `subscribeBudgets` and `subscribeEjecuciones` which are real functions in firestore but the test assertion doesn't verify them
- **Files to modify**: `components/entities/project/ProjectEntity.smoke.test.tsx` — rename mock export and fix assertion

#### Group 2: InvitacionEntity smoke (3 tests)
- **Verified root cause**: CONFIRMED — `InvitacionCreateForm` was simplified and no longer renders company checkboxes or role toggle. Tests check for:
  1. `"Constructora S.A."` and `"Inmobiliaria XYZ"` in create mode (company checkboxes removed)
  2. `"Colaborador"` and `"Administrador"` as toggle in create mode (role toggle removed)
  3. `"Constructora S.A."` in edit mode (company display removed)
  
  View mode (`InvitacionView`) still works correctly — renders DF fields, role badge, status badge.
- **Files to modify**: `components/entities/invitacion/InvitacionEntity.smoke.test.tsx` — update create/edit mode tests to match simplified forms

#### Group 3: ComprobanteUploader smoke (2 tests)
- **Verified root cause**: CORRECTED — hypothesis says "clicking delete button does NOT fire onComprobantesChange". Root cause is **missing mock for `@/lib/fileUpload`**. The component imports `deleteFile` from `@/lib/fileUpload` (line 6). When `handleRemove` executes, it calls `await deleteFile(comp.path)` where `comp.path = 'some/path'`. The real `deleteFile` uses Firebase Storage (`ref(storage, path)` + `deleteObject`), which fails in test environment. The catch block at line 113-115 silently swallows the error, so `onComprobantesChange` is NEVER called.
  
  Both delete tests (lines 84-105 and 107-125) fail because `onChange` is never called.
- **Files to modify**: `components/upload/__tests__/ComprobanteUploader.smoke.test.tsx` — add mock for `@/lib/fileUpload` exporting mocked `deleteFile` and `validateFile`

#### Group 4: parsePipeline (3 tests)
- **Verified root cause**: CONFIRMED — `fetchMovimientoHashes` is defined in the `vi.mock('@/lib/firestore', ...)` factory (line 21) but is NOT imported in the import statement at line 38. The import statement only imports `updateExtractoStatus` and `batchAddMovimientos`. Lines 128, 202, and 237 call `vi.mocked(fetchMovimientoHashes)` which throws `ReferenceError: fetchMovimientoHashes is not defined`.
- **Files to modify**: `lib/parsers/__tests__/parsePipeline.test.ts` — add `fetchMovimientoHashes` to the import from `@/lib/firestore`

#### Group 5: E2E exclusion (5 suites)
- **Verified root cause**: CONFIRMED — `vitest.config.ts` has NO `test.exclude` configuration. Vitest by default excludes `**/node_modules/**`, `**/dist/**`, `**/cypress/**`, `**/.{idea,git,cache,output,temp}/**`, etc. but does NOT exclude `e2e/`. The e2e spec files use Playwright API:
  - `login.spec.ts`: `import { test, expect } from '@playwright/test'` and `test.describe('Login', ...)`
  - `budget.spec.ts`: `import { test, expect } from '../helpers/fixture'` and `test.describe('Budget', ...)`
  - All 5 spec files follow this pattern
  
  Vitest's runner will attempt to execute these files, causing syntax/execution errors.
- **Files to modify**: `vitest.config.ts` — add `exclude: ['e2e/**']` to test config

### Approaches for Fixing

1. **Minimal fixes** — change only test files and config, no production code
   - Pros: Fast, safe, no risk of breaking production. Changes are purely in test/config files.
   - Cons: Tests may not accurately reflect current component behavior (Group 2 tests would be weakened if we just remove assertions instead of verifying new behavior). Group 3 test with missing mock doesn't test the actual delete flow.
   - Effort: Low

2. **Align tests to current components** — update tests to match new component behavior with proper mocks
   - Pros: Accurate test coverage, tests verify what actually renders. Group 2 tests would be rewritten to match simplified forms. Group 3 would properly mock fileUpload.
   - Cons: More work, but still test-only changes
   - Effort: Medium

### Recommendation
**Approach 2** — align tests to current components. The production code is presumably correct (recent refactors simplified the invitacion forms and unified comprobante upload). Tests should reflect current behavior, not legacy behavior. Since all changes are in test/config files, there's zero production risk.

### Risks
- Group 2 tests will lose coverage for company/role UI that may still be important in view mode — need to verify view mode tests still pass (InvitacionView renders DF for Empresa and role badge, so view mode tests should be fine)
- Group 4: Adding `fetchMovimientoHashes` import may need to update the mock signature if it's called with specific arguments — verify against real function signature
- All 24 tests currently fail, after fix ALL should pass. Run `npm test` after applying to verify.

### Ready for Proposal
Yes
