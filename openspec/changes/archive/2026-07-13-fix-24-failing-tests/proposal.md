# Proposal: Fix 24 Failing Tests

## Intent

24 unit tests are failing + 5 E2E suites incorrectly run by Vitest, blocking CI and eroding confidence. Root causes identified: wrong mock exports, tests asserting removed UI, missing mocks, missing imports, missing Vitest exclude. All fixes in test/config files — zero production code changes.

## Scope

### In Scope
- **Group 1** — Fix `ProjectEntity.smoke.test.tsx` mock: rename `subscribeCompanySettings` → `subscribeSettings`, remove extra `companyId` param, fix line-228 assertion
- **Group 2** — Fix `InvitacionEntity.smoke.test.tsx` create/edit tests: replace removed company/role UI assertions with current simplified form checks
- **Group 3** — Fix `ComprobanteUploader.smoke.test.tsx`: add `vi.mock('@/lib/fileUpload')` so `deleteFile` doesn't hit Firebase Storage
- **Group 4** — Fix `parsePipeline.test.ts`: add `fetchMovimientoHashes` to the import from `@/lib/firestore`
- **Group 5** — Fix `vitest.config.ts`: add `exclude: ['e2e/**']`

### Out of Scope
- New test coverage or test refactors beyond fixing failures
- Production code changes of any kind
- Playwright E2E config or CI pipeline

## Capabilities

> Pure test/config fix — no spec-level behavior changes.

### New Capabilities
None

### Modified Capabilities
None

## Approach

Minimal targeted fixes aligning tests to current component behavior. Each group is independent:

1. **Group 1**: Rename mock export + fix sig + assertion in `ProjectEntity.smoke.test.tsx`
2. **Group 2**: Update assertions in `InvitacionEntity.smoke.test.tsx` to match simplified forms
3. **Group 3**: `vi.mock('@/lib/fileUpload')` with mocked `deleteFile`/`validateFile`
4. **Group 4**: Add `fetchMovimientoHashes` to import in `parsePipeline.test.ts`
5. **Group 5**: Add `exclude: ['e2e/**']` to `vitest.config.ts`

## Affected Areas

| Area | Impact |
|------|--------|
| `components/entities/project/ProjectEntity.smoke.test.tsx` | Modified |
| `components/entities/invitacion/InvitacionEntity.smoke.test.tsx` | Modified |
| `components/upload/__tests__/ComprobanteUploader.smoke.test.tsx` | Modified |
| `lib/parsers/__tests__/parsePipeline.test.ts` | Modified |
| `vitest.config.ts` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Group 3 mock sig mismatch | Low | Match real `deleteFile(filePath: string)` |
| Group 2 view tests also broken | Low | Verified view mode works in exploration |
| Cross-group regression | Low | Each fix independent; run full suite |

## Rollback Plan

`git revert <commit-hash>` — safe since all changes are test-only.

## Dependencies

None.

## Success Criteria

- [ ] `npm test` passes — 0 failures (all 24 tests green)
- [ ] No E2E suites in Vitest output
- [ ] `npx tsc --noEmit` produces no new type errors
