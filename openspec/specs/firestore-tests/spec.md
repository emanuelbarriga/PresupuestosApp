# Firestore Layer Tests — Specification

## Overview

Unit test specification for `lib/firestore.ts` (19 functions) that validates the Firestore contract layer — path construction, corrupted data resilience, timestamp injection, and subscription lifecycle — using mocked `firebase/firestore` imports. No live backend required.

## Requirements

### Requirement 1: Path Construction

The system MUST construct the correct subcollection path when calling create functions. Every `add*` function builds a path as `companies/{companyId}/{subcollection}` via `collection()`.

#### Scenario: addBudget builds correct subcollection hierarchy

- GIVEN `collection` and `addDoc` are mocked from `firebase/firestore` to capture their arguments
- WHEN `addBudget('compañia-x', {descripcion: 'test', amount: 100})` is called
- THEN `collection` MUST be invoked with `db`, `'companies'`, `'compañia-x'`, `'budgets'` in that exact argument order
- AND `addDoc` MUST receive the collection reference returned by that `collection()` call as its first argument

### Requirement 2: Corrupted Data Resilience

The system MUST propagate incomplete Firestore documents without crashing. The `as Company` TypeScript cast provides zero runtime validation — this test documents that gap.

#### Scenario: getCompanies returns doc missing required `name` field

- GIVEN `getDocs` resolves to a `QuerySnapshot` containing one document with data `{something: 'y'}` and no `name` property (doc id: `'x'`)
- WHEN `getCompanies()` resolves
- THEN the returned array MUST contain exactly one item with `id` equal to `'x'`
- AND that item's `name` field SHALL be `undefined`

### Requirement 3: Timestamp Injection

The system MUST include a `createdAt` property with a `serverTimestamp()` sentinel value in data passed to `addDoc` for every create function.

#### Scenario: addEjecucion includes createdAt in payload

- GIVEN `addDoc` is mocked to capture the data object passed as its second argument
- WHEN `addEjecucion('empresa-1', {descripcion: 'test', monto: 500})` is called
- THEN the data object received by `addDoc` MUST include a `createdAt` property
- AND `createdAt` MUST be truthy (a sentinel value, not `null` or `undefined`)

### Requirement 4: Subscription Lifecycle

The system MUST register `onSnapshot` listeners, transform snapshot docs into typed arrays via callback, and expose an unsubscribe function that disconnects the listener.

#### Scenario 4a: subscribeProviders registers listener with correct path

- GIVEN `onSnapshot` is mocked to return `vi.fn()` as the unsubscribe function
- WHEN `subscribeProviders('empresa-1', vi.fn())` is called
- THEN `onSnapshot` MUST be called with a `collection()` result whose path segments are `'companies'`, `'empresa-1'`, `'providers'`

#### Scenario 4b: snapshot delivers mapped documents to onData

- GIVEN `onSnapshot` captured the snapshot callback
- WHEN a snapshot fires with two documents: `{id: 'p1', data: () => ({name: 'Proveedor A'})}` and `{id: 'p2', data: () => ({name: 'Proveedor B'})}`
- THEN `onData` MUST be called with an array of two items
- AND each item MUST have `id` matching the source document
- AND each item MUST contain the spread of `data()` (e.g., `name: 'Proveedor A'`)

#### Scenario 4c: unsubscribe function cleans up listener

- GIVEN `subscribeProviders` returned an unsubscribe function
- WHEN that returned function is invoked
- THEN the `onSnapshot` returned unsubscribe MUST have been called exactly once

## Acceptance Criteria

| # | Criterion | Fail condition |
|---|-----------|----------------|
| 1 | `npx vitest run lib/__tests__/firestore.test.ts` passes | Any assertion fails |
| 2 | Path verification breaks if collection constants change | Regression guard |
| 3 | Corrupted-doc test proves `name` is `undefined` | Runtime validation added |
| 4 | Timestamp test proves `createdAt` is present | Key removed from create calls |
| 5 | Unsubscribe fires exactly once | `onSnapshot` return not wired to cleanup |

## Mock Setup Requirements

- **Module mock**: `vi.mock('firebase/firestore')` — hoisted level, before any imports
- **`collection`**: `vi.fn()` returning a mock ref (e.g., `{path: 'mock'}`)
- **`addDoc`**: `vi.fn()` resolving to `{id: 'generated-id'}`
- **`getDocs`**: `vi.fn()` resolving to a snapshot built by the factory (see below)
- **`onSnapshot`**: `vi.fn()` capturing the snapshot callback `(snapshot) => void` and returning `vi.fn()` as unsubscribe
- **`serverTimestamp`**: `vi.fn(() => ({seconds: 0, nanoseconds: 0}))` — any truthy sentinel
- **`doc`**: `vi.fn()` returning a mock doc ref
- **`updateDoc`**: `vi.fn()` resolving to `void`
- **`setDoc`**: `vi.fn()` resolving to `void`
- **`db`**: needs to be exported from `lib/firebase`; mock at `@/lib/firebase` with `{db: {}}`

### Factory: `makeMockSnapshot(docs)`

Reusable helper to simulate a Firestore `QuerySnapshot`:

```ts
function makeMockSnapshot(
  docs: Array<{id: string} & Record<string, unknown>>
): { docs: Array<{id: string, data: () => Record<string, unknown>}> } {
  return {
    docs: docs.map(({id, ...rest}) => ({
      id,
      data: () => rest,
    })),
  };
}
```

Used by Tests 2 and 4 to simulate snapshot contents without importing Firestore types.

## Skill Resolution

none
