# Tasks: Firestore Layer Tests

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150–170 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Mock Infrastructure

- [x] 1.1 Create `lib/__tests__/firestore.test.ts` with `vi.mock('firebase/firestore')` hoisting `collection`, `addDoc`, `getDocs`, `onSnapshot`, `doc`, `updateDoc`, `setDoc`, `serverTimestamp` as `vi.fn()`. Also mock `@/lib/firebase` to export `{db: {}}`.
- [x] 1.2 Export `makeMockSnapshot(docs)` factory returning `{docs: docs.map(({id, ...rest}) => ({id, data: () => rest}))}` and a `mockCollectionRef` constant (`{type: 'collection', path: 'mock'}`) for path assertions.

## Phase 2: Tests

- [x] 2.1 **Path construction** — `describe('addBudget')` with `beforeEach` clearing mocks. Call `addBudget('compañia-x', data)`, assert `collection` called with `db, 'companies', 'compañia-x', 'budgets'`, and `addDoc` received the collection ref.
- [x] 2.2 **Corrupted data** — `describe('getCompanies')`. Mock `getDocs` to resolve `makeMockSnapshot([{id: 'x', something: 'y'}])`. Assert result[0].id === 'x' and result[0].name === undefined. Add inline comment documenting `as Company` cast is unsafe.
- [x] 2.3 **Timestamp injection** — `describe('addEjecucion')`. Call `addEjecucion('empresa-1', {descripcion: 'test', monto: 500})`. Assert `serverTimestamp` was called and data passed to `addDoc` includes `createdAt` with a truthy sentinel value.
- [x] 2.4 **Subscription lifecycle** — `describe('subscribeProviders')`. Mock `onSnapshot` returning `vi.fn()`. Verify `collection()` called with correct path. Capture snapshot callback, invoke it with two docs, assert `onData` received mapped array with `id` and spread `data()`. Assert returned unsubscribe calls the cleanup fn exactly once.

## Files

| File | Action |
|------|--------|
| `lib/__tests__/firestore.test.ts` | Create |

## Implementation Order

1.1 → 1.2 → 2.1 → 2.2 → 2.3 → 2.4 (strict dependency chain — mock infra first, then each test builds on it). No Phase 3/4 needed — this is pure testing with no cleanup or docs beyond inline comments.
