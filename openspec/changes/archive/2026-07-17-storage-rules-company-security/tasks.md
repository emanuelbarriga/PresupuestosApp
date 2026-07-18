# Tasks: Storage Rules Company Security

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~190–250 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | `isMember()` in `storage.rules` + tests | PR 1 | Single PR. Tests first (strict_tdd), then rules, then deploy |

## Phase 1: RED — Write Failing Tests

- [x] 1.1 Extend `lib/__tests__/storage-rules-documentos.test.ts` — add cross-company read/write deny, unauthenticated deny, and delete-policy scenarios
- [x] 1.2 Create `lib/__tests__/storage-rules-ejecuciones.test.ts` — member CRUD, cross-company deny, write constraints (5 MB, `image/jpeg|image/png|application/pdf`), delete allowed for member
- [x] 1.3 Create `lib/__tests__/storage-rules-extractos.test.ts` — member CRUD, cross-company deny, write constraints (10 MB, `application/pdf`), delete allowed for member
- [ ] 1.4 Run all three test files — ⚠ BLOCKED. The Firebase Storage emulator's rules runtime (v1.1.3 JAR) is incompatible with Java 26 on macOS arm64 — auth tokens not recognized, SDK throws `storage/unknown` on all calls. Cannot execute integration tests. Test files are structurally correct per Firebase Testing Library docs.

## Phase 2: GREEN — Implement `isMember()` in `storage.rules`

- [x] 2.1 Add `isMember(companyId)` function at top of `storage.rules` using `firestore.exists()` — mirror `firestore.rules` verbatim
- [x] 2.2 Replace `request.auth != null` → `isMember(companyId)` in all 4 match blocks (`ejecuciones/{ejecucionId}/{fileName}`, `documentos/{fileName}`, `ejecuciones/{allPaths=**}`, `extractos/{fileName}`) preserving existing `size` and `contentType` constraints
- [x] 2.3 Preserve delete policy: `documentos/` stays `if false`; `ejecuciones/` and `extractos/` migrate to `isMember(companyId)`
- [ ] 2.4 Run all three test files — ⚠ BLOCKED (same emulator issue as 1.4). Rules syntax validated via `firebase deploy --only storage --dry-run` instead (needs `firebase login --reauth` first).

## Phase 3: Verify & Deploy

- [ ] 3.1 Run full project test suite — ⚠ PARTIALLY BLOCKED. Only storage-rules tests are blocked; unit/component tests (`vitest run`) can still pass.
- [ ] 3.2 Deploy: `firebase deploy --only storage` — ⚠ BLOCKED. Auth session expired. Run `firebase login --reauth` then deploy.
- [ ] 3.3 Post-deploy verification: manual smoke test with member and non-member across all three paths — ⚠ BLOCKED until deployed.
