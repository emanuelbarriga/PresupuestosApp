# Proposal: Firestore Layer Unit Tests

## Intent

`lib/firestore.ts` (19 functions — reads, subscriptions, creates, updates) has zero tests. Bugs in path construction, missing-field handling, timestamp injection, or subscription cleanup propagate silently to consumers. These tests protect the data access layer contract with Firestore without requiring a live backend.

## Scope

### In Scope
- `lib/__tests__/firestore.test.ts` — unit tests for all 19 exported functions, covering:
  1. **Path construction**: `collection()` receives correct subcollection hierarchy
  2. **Data robustness**: incomplete Firestore documents handled gracefully
  3. **Timestamp injection**: `serverTimestamp()` applied on creates and updates
  4. **Subscription lifecycle**: listener registration, callback delivery, unsubscribe cleanup
- Vitest mock module for `firebase/firestore`

### Out of Scope
- Firestore emulator integration tests (deferred)
- Coverage of `lib/firebase.ts` (db initialization)
- UI/component-level tests

## Capabilities

### New Capabilities
None — testing-only change, no spec-level behavior.

### Modified Capabilities
None — existing behavior is unchanged.

## Approach

Mock `firebase/firestore` at the module boundary with `vi.mock()`. Each test isolates one function group:

1. **Path verification**: spy on `collection()`; assert segment args match `companies/{id}/subcollection`.
2. **Data robustness**: mock `getDocs` returning a doc missing `name`; assert safe partial or skip.
3. **Timestamp injection**: mock `addDoc` and `serverTimestamp`; verify timestamp key is present in the data spread.
4. **Subscription lifecycle**: mock `onSnapshot`; assert callback fires, returned unsubscribe calls the cleanup fn.

One function per group is tested (e.g., `subscribeProviders` for real-time, `addBudget` for creates, `updateEjecucion` for updates) since the pattern is identical across each group.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/firestore.ts` | Tested | No source changes |
| `lib/__tests__/firestore.test.ts` | New | Unit test file |
| `vitest.config.ts` | None | Sufficient as-is |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Mock drift — Firestore SDK API changes | Low | `collection`, `addDoc`, `onSnapshot` signatures are stable in v12 |
| False confidence from mocks | Low | Tests validate contract calls, not Firestore behavior. Scope documented. |

## Rollback Plan

Delete `lib/__tests__/firestore.test.ts`. No production code modified — zero rollback cost.

## Dependencies

- Vitest (configured)
- `firebase/firestore` (installed)

## Success Criteria

- [ ] `npx vitest run lib/__tests__/firestore.test.ts` passes
- [ ] Test 1 fails if a collection path segment changes (regression guard)
- [ ] Test 2 fails if field access becomes unchecked
- [ ] Test 3 fails if timestamp key is missing from data
- [ ] Test 4 fails if unsubscribe is not called on cleanup
