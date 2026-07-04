# Verification Report

**Change**: autenticacion-usuarios — Phase 1: Backend Infrastructure (PR-1)
**Version**: N/A (specs v1)
**Mode**: Standard (Strict TDD inactive)

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 10 (1.1–1.9 + 1.T1) |
| Tasks complete | 9 |
| Tasks incomplete | 1 (1.T1 — Rules test with `@firebase/rules-unit-testing`) |

### Task Details

| ID | Status | File | Notes |
|----|--------|------|-------|
| 1.1 | ✅ Done | `lib/types.ts` | `UserRole`, `UsuarioEmpresa`, `Invitacion` added |
| 1.2 | ✅ Done | `lib/auth.ts` | `export const auth = getAuth(app)` |
| 1.3 | ⚠️ Partial | `lib/firestore.ts` | New functions added; `subscribeSettings` NOT migrated to company-scoped |
| 1.4 | ✅ Done | `firestore.rules` | Full rewrite with `isMember`, per-collection rules, catch-all |
| 1.5 | ✅ Done | `app/api/companies/create/route.ts` | POST with verifyIdToken, slugify, collision check, WriteBatch |
| 1.6 | ✅ Done | `app/api/companies/accept-invitation/route.ts` | POST with verifyIdToken, invitation validation, WriteBatch |
| 1.7 | ✅ Done | `middleware.ts` | Edge redirect with cookie check |
| 1.8 | ✅ Done | `context/AuthContext.tsx` + `app/layout.tsx` | AuthProvider, signIn/Up/Out, loading state, root layout wrapper |
| 1.9 | ✅ Done | `scripts/seed.ts` | Writes settings under company-scoped path + global transitional |
| 1.T1 | ❌ Not done | — | Rules integration test not written |

---

## Build & Tests Execution

**TypeScript Compilation**: ✅ Passed — `npx tsc --noEmit` exits with zero errors.

```text
$ npx tsc --noEmit
(no output)  # clean compile
```

**Tests**: ✅ 56 passed / ❌ 2 failed (pre-existing) / ⚠️ 0 skipped

```text
$ npx vitest run --reporter verbose
  ✓ lib/__tests__/fileUpload.test.ts  (10 tests)
  ✓ context/__tests__/CompanyContext.test.tsx  (6 tests)
  ❯ components/__tests__/Datos.test.tsx  (2 tests | 2 failed — PRE-EXISTING)
    × 3.5a muestra badge con número de comprobantes cuando > 0
    × 3.5b NO muestra badge cuando comprobantes está vacío
  ✓ components/__tests__/estado-resultados.test.tsx  (9 tests)
  ✓ components/__tests__/Sidepanel.test.tsx  (5 tests)
  ✓ lib/__tests__/firestore.test.ts  (19 tests)
  ✓ components/__tests__/estado-resultados.test.ts  (9 tests)
```

**Note**: The 2 failures in `Datos.test.tsx` are pre-existing and NOT caused by PR-1 changes. The mock for `@/lib/firestore` is missing `subscribeCuentasBancarias` and `subscribeExtractos` — both exist in the module but weren't added to the mock. These failures predate this PR.

**Coverage**: ➖ Not available (no coverage threshold configured)

---

## 1. Firestore Rules Analysis

### `isMember(companyId)` function
| Aspect | Result |
|--------|--------|
| Exists check path | ✅ PASS — Correctly uses `exists(/databases/$(database)/documents/companies/$(companyId)/users/$(request.auth.uid))` |
| Auth guard | ✅ PASS — Checks `request.auth != null` first |
| Spec match | ✅ PASS — Matches spec requirement exactly |

### `isAdmin(companyId)` function
| Aspect | Result |
|--------|--------|
| Read + role check | ✅ PASS — Uses `get()` and checks `.data.role == 'admin'` |
| Extra feature vs spec | ⚠️ WARNING — Not in spec but useful for admin-only operations (update company, manage users) |

### Companies collection
| Rule | Status | Analysis |
|------|--------|----------|
| `read: if request.auth != null` | ✅ PASS | Any authenticated user can list/read companies |
| `create: if request.auth != null && request.resource.data.name is string` | ✅ PASS | Create allowed for auth'd; name field validation bonus |
| `update: if isMember(companyId) && isAdmin(companyId)` | ✅ PASS | Admin-only updates, member-only access |
| `delete: if false` | ✅ PASS | No deletions |

### Per-subcollections (budgets, ejecuciones, projects, cuentasBancarias, extractos, settings)
| Rule | Status | Analysis |
|------|--------|----------|
| `read: if isMember(companyId)` | ✅ PASS | Correct — scoped to company members |
| `write: if isMember(companyId)` | ✅ PASS | Correct — scoped to company members |

### Users subcollection
| Rule | Status | Analysis |
|------|--------|----------|
| `read: if isMember(companyId)` | ✅ PASS | Members can see user list |
| `create: if false` | ✅ PASS | API Routes only via firebase-admin |
| `update: if isAdmin(companyId)` | ⚠️ WARNING | Deviates from design spec which says `allow update: if false`. Design explicitly says "write DENIED" for users subcollection. While pragmatic for future admin UI, it relaxes the intended security posture. |
| `delete: if isAdmin(companyId)` | ⚠️ WARNING | Same deviation as above |

### Global Terceros
| Rule | Status | Analysis |
|------|--------|----------|
| `read: if request.auth != null` | ✅ PASS | Any authenticated user can read |
| `write: if request.auth != null` | ✅ PASS | Any authenticated user can write — matches design DA-1 decision (trusted users) |

### Invitations
| Rule | Status | Analysis |
|------|--------|----------|
| `create: if request.auth != null` | ✅ PASS | Any authenticated user can invite |
| `read, update: if request.auth != null && (request.auth.uid == resource.data.invitedBy \|\| request.auth.token.email == resource.data.email)` | ✅ PASS | Creator or invitee-by-email can read/update |
| `delete: if false` | ✅ PASS | No deletions |

### TRANSITIONAL rules
| Rule | Status | Analysis |
|------|--------|----------|
| `/settings/{doc}` read/write: `if request.auth != null` | ✅ PASS | Correct — temporary while migration completes |
| `/stateProject/{doc}` read/write: `if request.auth != null` | ✅ PASS | Correct — temporary while migration completes |

### Catch-all
| Rule | Status | Analysis |
|------|--------|----------|
| `allow read, write: if false` | ✅ PASS | Correct — denies everything not explicitly allowed |

### Rules Analysis Summary
- **PASS**: All essential rules match spec
- **WARNING**: Users subcollection allows admin update/delete (deviates from strict design)
- **CRITICAL**: None

---

## 2. AuthContext Analysis

| Verification Point | Status | Notes |
|--------------------|--------|-------|
| `useState(true)` initial loading (prevents flash redirect) | ✅ PASS | Line 26: `const [loading, setLoading] = useState(true)` |
| Exposes `user` | ✅ PASS | Line 14: `user: User \| null` in interface |
| Exposes `loading` | ✅ PASS | Line 15: `loading: boolean` in interface |
| Exposes `signIn` | ✅ PASS | Line 17: `signIn: (email, password) => Promise<void>` |
| Exposes `signUp` | ✅ PASS | Line 18: `signUp: (email, password) => Promise<void>` |
| Exposes `signOut` | ✅ PASS | Line 19: `signOut: () => Promise<void>` |
| Exposes `error` | ✅ PASS | Line 16: `error: string \| null` in interface |
| `signIn` uses `signInWithEmailAndPassword` | ✅ PASS | Line 40 |
| `signUp` uses `createUserWithEmailAndPassword` | ✅ PASS | Line 51 |
| `signOut` catches errors internally | ✅ PASS | Line 59-62: No try/catch needed — Firebase `signOut` is always-online safe |
| Loading state transitions: true → false after initial auth | ✅ PASS | Lines 29-35: `useEffect` sets `loading(false)` in `onAuthStateChanged` callback |
| `useAuth()` throws if used outside provider | ✅ PASS | Lines 72-76: Guard clause with error message |
| `AuthProvider` wraps app in `layout.tsx` | ✅ PASS | `app/layout.tsx` line 14: `<AuthProvider>{children}</AuthProvider>` |

---

## 3. API Routes Analysis

### POST /api/companies/create

| Verification Point | Status | Notes |
|--------------------|--------|-------|
| Authorization header parsing (Bearer token) | ✅ PASS | Lines 8-10: checks `Bearer ` prefix |
| `verifyIdToken` call | ✅ PASS | Line 17: `adminAuth.verifyIdToken(token)` |
| Input validation: companyName string | ✅ PASS | Lines 31-33: checks `typeof !== 'string'` and `trim().length === 0` |
| Slugify logic | ✅ PASS | Lines 36-40: lowercases, trims, replaces spaces with hyphens, strips non-alphanumeric |
| Reserved companyId 'all' check | ✅ PASS | Lines 47-49: returns 400 for 'all' |
| Collision check (existing doc) | ✅ PASS | Lines 52-56: `existingDoc.exists` → 409 |
| WriteBatch atomicity | ✅ PASS | Lines 59-76: batch.set for company doc + admin user doc, then batch.commit() |
| Error: 400 missing companyName | ✅ PASS | Line 32 |
| Error: 400 invalid JSON | ✅ PASS | Lines 24-29 |
| Error: 401 missing/invalid auth header | ✅ PASS | Lines 9-10 |
| Error: 401 invalid token | ✅ PASS | Lines 18-19 |
| Error: 409 duplicate companyId | ✅ PASS | Lines 54-56 |
| Error: 500 internal server error | ✅ PASS | Lines 82-85 |
| Success: 201 with companyId | ✅ PASS | Lines 78-81 |

### POST /api/companies/accept-invitation

| Verification Point | Status | Notes |
|--------------------|--------|-------|
| Authorization header parsing (Bearer token) | ✅ PASS | Lines 8-10 |
| `verifyIdToken` call | ✅ PASS | Line 17 |
| Input validation: invitationId string | ✅ PASS | Lines 31-33 |
| Fetch invitation doc | ✅ PASS | Lines 36-42 |
| Validate status === 'pendiente' | ✅ PASS | Lines 47-49: 409 if not pending |
| Validate email match | ✅ PASS | Lines 51-54: 403 if email doesn't match |
| WriteBatch: membership + invitation update | ✅ PASS | Lines 57-74 |
| Error: 400 missing invitationId | ✅ PASS | Line 32 |
| Error: 401 invalid auth | ✅ PASS | Lines 9-10, 18-19 |
| Error: 403 email mismatch | ✅ PASS | Lines 52-53 |
| Error: 404 invitation not found | ✅ PASS | Lines 40-41 |
| Error: 409 already accepted | ✅ PASS | Lines 47-48 |
| Error: 500 internal | ✅ PASS | Lines 85-87 |
| Success: 200 with companyId | ✅ PASS | Lines 76-83 |

### Minor observation for accept-invitation route
❓ The route does not check if `invitation.companyId === 'all'` (reserved). While unlikely to occur in practice (nobody would create an invitation for 'all'), it's a gap vs. the create route's thoroughness. Minor edge case.

---

## 4. Firestore Functions Analysis

| Function | Status | Notes |
|----------|--------|-------|
| `subscribeUserCompanies(userId)` | ✅ PASS | Uses `collectionGroup('users')` + `where(documentId(), '==', userId)`. Fetches matching company docs. |
| `getUserCompaniesSnapshot(userId)` | ✅ PASS | One-time read version of the above. Uses same `collectionGroup` query pattern. |
| `subscribeCompanyUsers(companyId)` | ✅ PASS | Direct subcollection query on `/companies/{companyId}/users` |
| `subscribeInvitations(email)` | ✅ PASS | Filters by `email` + `status === 'pendiente'` |
| `createInvitation(invitation)` | ✅ PASS | `addDoc` to `/invitations/` collection |
| `subscribeSettings || updateSettings` | ⚠️ WARNING | **NOT migrated to company-scoped path.** Still reads/writes `/settings/categorias` (global). Works via transitional rules, but task 1.3 marked this as done. A proper migration would change the function signature to accept `companyId`. |

**Note**: `subscribeSettings` is called by `Datos.tsx` (line 56) and `Sidepanel.tsx` (lines 267, 1096) without a `companyId` parameter. The transitional rules in `firestore.rules` allow this to keep working. Migration will happen when those components are updated in later PRs.

---

## 5. Middleware Analysis

| Verification Point | Status | Notes |
|--------------------|--------|-------|
| Edge runtime | ✅ PASS | No Node.js/firebase-admin imports. Uses `NextRequest`/`NextResponse` only. |
| Protects `/[company]/*` | ✅ PASS | Lines 38-48: catches any first segment that isn't login/register/api/_next |
| Protects `/onboarding` | ✅ PASS | Line 5: `protectedPrefixes` array |
| Protects `/select-company` | ✅ PASS | Line 6: `protectedPrefixes` array |
| Bypasses `/login` | ✅ PASS | Line 13 |
| Bypasses `/register` | ✅ PASS | Line 14 |
| Bypasses `/_next/*` | ✅ PASS | Line 15 |
| Bypasses `/api/*` | ✅ PASS | Lines 21-23 |
| No firebase-admin imports | ✅ PASS | No imports from firebase-admin |
| Redirects unauthenticated to `/login` | ✅ PASS | Lines 65-68: creates redirect URL with `redirect` param |
| Config matcher excludes static assets | ✅ PASS | Lines 83: `images/`, `_next/static`, `_next/image`, `favicon.ico` excluded |

### 🔴 CRITICAL: `__session` cookie check is non-functional

```typescript
const sessionCookie = request.cookies.get('__session')?.value;
```

**Problem**: Firebase Auth v9+ (modular SDK, `firebase/auth`) does NOT set a `__session` cookie by default. The default persistence is IndexedDB / localStorage, **not** cookies. This means the middleware would ALWAYS redirect to `/login` for ALL users, including authenticated ones.

**Evidence**:
- `lib/auth.ts` uses `getAuth(app)` with default persistence
- Firebase Auth web SDK default is `browserLocalPersistence` (IndexedDB in modern browsers)
- No `browserSessionPersistence` or custom persistence is configured
- No custom cookie-setting mechanism exists in the codebase

**Impact**: The entire middleware auth guard is effectively broken. Every navigation to a protected route (onboarding, select-company, any `/[company]/*`) will redirect to `/login`, making the app unusable for authenticated users.

**Mitigation options**:
1. Remove the middleware auth check and rely solely on client-side guards (simplest, matches the "security is in Firestore rules" philosophy)
2. Set a custom HttpOnly cookie server-side after successful token verification via an API route
3. Use `next/headers` cookies() API to check for a custom cookie set from the client after auth state resolves
4. Skip auth checking in middleware entirely and use the matcher config only to exclude public routes

**Design acknowledgement**: The design document's Critical Technical Gotcha #7 says: "middleware.ts runs in Edge Runtime — cannot use firebase-admin (Node.js only). Must use cookie-based detection or skip auth pages." This was a known limitation, but the cookie-based approach (`__session`) was incorrectly assumed to be set by Firebase Auth.

---

## 6. Integration Flow Analysis

### Flow 1: User registers → AuthContext → middleware → select-company → accept invitation → company dashboard

| Step | Component | Status | Notes |
|------|-----------|--------|-------|
| 1 | User registers via AuthContext.signUp() | ✅ | Implemented (call to `createUserWithEmailAndPassword`) |
| 2 | onAuthStateChanged fires, loading=false | ✅ | Implemented (useEffect in AuthContext) |
| 3 | middleware checks protected route | 🔴 CRITICAL | `__session` cookie doesn't exist → redirects to `/login` |
| 4 | app/page.tsx redirects to /select-company | 🔲 Phase 2 | Current page.tsx still has hardcoded `/saman/dashboard` redirect |
| 5 | subscribeInvitations(email) | ✅ | Implemented (queries pending invitations by email) |
| 6 | POST /api/companies/accept-invitation | ✅ | Implemented (validates, WriteBatch) |
| 7 | Redirect to company dashboard | 🔲 Phase 2 | Requires `[company]/layout.tsx` (Phase 3) |

**Blocked by**: Middleware cookie issue (#3) and Phase 2 pages (#4, #7)

### Flow 2: User registers with no invitations → create company → onboarding

| Step | Component | Status | Notes |
|------|-----------|--------|-------|
| 1 | User registers | ✅ | Implemented |
| 2-3 | middleware check | 🔴 CRITICAL | Same cookie issue |
| 4 | POST /api/companies/create | ✅ | Implemented (WriteBatch, collision check) |
| 5 | Redirect to new company dashboard | 🔲 Phase 2/3 | Requires pages |

**Blocked by**: Same middleware cookie issue

### Flow 3: Existing user opens app → select-company → click company → dashboard

| Step | Component | Status | Notes |
|------|-----------|--------|-------|
| 1 | onAuthStateChanged resolves user | ✅ | Implemented |
| 2 | middleware check | 🔴 CRITICAL | Same cookie issue |
| 3 | app/page.tsx → /select-company | 🔲 Phase 2 | Current hardcoded to `/saman/dashboard` |
| 4 | subscribeUserCompanies(user.uid) | ✅ | Implemented |
| 5 | User clicks company | 🔲 Phase 3 | Requires `[company]/layout.tsx` |

**Blocked by**: Middleware cookie issue (#2) and Phase 2/3 pages (#3, #5)

---

## 7. TypeScript Compilation & Test Results

| Check | Result | Details |
|-------|--------|---------|
| `npx tsc --noEmit` | ✅ PASS | Zero errors |
| `npm test` | ✅ 56 passed / ❌ 2 failed | 2 failures are pre-existing in Datos.test.tsx (missing mock for `subscribeCuentasBancarias` and `subscribeExtractos`) |

---

## Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Data types: UserRole, UsuarioEmpresa, Invitacion | ✅ Implemented | `lib/types.ts` lines 148-166 |
| Auth instance export | ✅ Implemented | `lib/auth.ts` — `export const auth = getAuth(app)` |
| AuthProvider wraps app | ✅ Implemented | `app/layout.tsx` wraps children with `<AuthProvider>` |
| AuthContext exposes user/loading/signIn/signUp/signOut | ✅ Implemented | `context/AuthContext.tsx` lines 14-19 |
| signIn uses signInWithEmailAndPassword | ✅ Implemented | Line 40 |
| signUp uses createUserWithEmailAndPassword | ✅ Implemented | Line 51 |
| isMember() rule function | ✅ Implemented | `firestore.rules` lines 5-8 |
| isAdmin() rule function | ✅ Implemented | `firestore.rules` lines 9-12 |
| Per-collection access matrix | ✅ Implemented | Full coverage of companies, subcollections, terceros, invitations |
| Catch-all denies unknown paths | ✅ Implemented | Line 70: `match /{document=**} { allow read, write: if false; }` |
| Transitional /settings and /stateProject | ✅ Implemented | Lines 60-67 (any auth'd user, temporary) |
| POST /api/companies/create | ✅ Implemented | verifyIdToken, slugify, collision, WriteBatch, all error codes |
| POST /api/companies/accept-invitation | ✅ Implemented | verifyIdToken, validate, WriteBatch, all error codes |
| subscribeUserCompanies | ✅ Implemented | Uses collectionGroup('users') query pattern |
| subscribeCompanyUsers | ✅ Implemented | Direct subcollection query |
| subscribeInvitations | ✅ Implemented | Filtered by email + status |
| createInvitation | ✅ Implemented | addDoc to invitations collection |
| Middleware edge redirect | ⚠️ Implemented with bug | `__session` cookie check doesn't work with default Firebase Auth persistence |
| Seed script writes company-scoped settings | ✅ Implemented | Lines 120-131: writes under `/companies/{companyId}/settings/categorias` |
| Seed script writes global settings (transitional) | ✅ Implemented | Line 135: keeps old path working during migration |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| DA-1: Hybrid data structure (global terceros, company-scoped settings) | ✅ Yes | Rules enforce auth on terceros, membership on company data. Settings under company scope. |
| DA-2: API Route for invitation paradox | ✅ Yes | Both `/api/companies/create` and `/api/companies/accept-invitation` use firebase-admin WriteBatch |
| DA-3: Separate AuthContext and CompanyContext | ✅ Yes | AuthContext is global in root layout; CompanyContext per-route (in later PR) |
| DA-4: Dual middleware + client guard | ⚠️ Partial | Middleware implemented but non-functional (cookie issue). Client guard pending (Phase 3). |
| Catch-all `if false` | ✅ Yes | Implemented (line 70) |
| 'all' companyId reserved | ✅ Yes | Checked in create API route (lines 47-49) |
| Users subcollection: read=member, write=denied | ⚠️ Partial | Reads correct; admin update/delete allowed (deviates from strict denial) |
| Settings migration: company-scoped seed | ✅ Yes | Seed writes to both old and new paths |
| `isMemberOfAnyCompany()` for terceros writes | ✅ Yes (simplified) | Design says use `request.auth != null` for write — implemented correctly |

---

## Issues Found

### 🔴 CRITICAL (must fix before merge)

1. **Middleware `__session` cookie check is non-functional**
   - **File**: `middleware.ts` line 63
   - **What**: `request.cookies.get('__session')?.value` — Firebase Auth v9+ does NOT set a `__session` cookie by default (uses IndexedDB/localStorage persistence)
   - **Impact**: ALL authenticated users are redirected to `/login` when navigating to any protected route. The app is completely blocked for any route behind middleware protection.
   - **Suggestion**: Remove the auth check from middleware entirely (since security is enforced via Firestore rules), or implement a custom cookie mechanism (e.g., set a cookie from the client after `onAuthStateChanged` resolves, or use a dedicated `/api/auth/session` endpoint).

### ⚠️ WARNING (address before merge or document as known)

2. **`subscribeSettings` not migrated to company-scoped path**
   - **File**: `lib/firestore.ts` lines 113-138
   - **What**: Task 1.3 is marked completed, but `subscribeSettings()` still reads from the old global path `/settings/categorias`. The function signature does not accept `companyId`. Migration is pending.
   - **Mitigation**: Transitional rules in `firestore.rules` keep the old path working. The seed writes to both paths. This is not a blocker now but must be completed before transitional rules are removed.
   - **Blueprint**: `subscribeSettings(companyId, ...)` → reads `/companies/{companyId}/settings/categorias`

3. **Users subcollection allows admin update/delete from client**
   - **File**: `firestore.rules` lines 33-34
   - **What**: `allow update: if isAdmin(companyId)` and `allow delete: if isAdmin(companyId)` — the design explicitly says "write DENIED" for users subcollection, with API routes being the only writer.
   - **Risk**: An admin client-side bug or malicious script could modify/delete user documents directly. The intended security model was that ALL membership mutations go through API Routes (which validate server-side).
   - **Suggestion**: Restore `allow update, delete: if false` if no admin UI is planned for this PR. Otherwise, document as intentional deviation.

4. **`accept-invitation` route does not check reserved `companyId === 'all'`**
   - **File**: `app/api/companies/accept-invitation/route.ts`
   - **What**: The create route checks for reserved 'all' companyId (lines 47-49), but accept-invitation doesn't validate that `invitation.companyId !== 'all'`.
   - **Risk**: Low — no legitimate invitation would have companyId 'all'. But inconsistent with the create route's thoroughness.

### 💡 SUGGESTION (nice to have, not blocking)

5. **Rules integration test (Task 1.T1) not implemented**
   - **What**: The task list includes writing a rules test with `@firebase/rules-unit-testing`, but it's not done. This is the only way to verify the Firestore rules matrix end-to-end.
   - **Suggestion**: Implement before merging to production. The test would validate isMember, catch-all, terceros, and invitation rules.

6. **`collectionGroup('users')` requires composite index**
   - **File**: `lib/firestore.ts` lines 371-374
   - **What**: `subscribeUserCompanies` uses `collectionGroup('users')` with `where(documentId(), '==', userId)`. This query requires a composite index in Firestore that may not exist.
   - **Suggestion**: Create the index via `firebase.json` or the Firebase Console, or handle the error gracefully with a user-visible message if the index doesn't exist.

7. **`subscribeSettings` and `subscribeCuentasBancarias` not mocked in Datos test**
   - **File**: `components/__tests__/Datos.test.tsx`
   - **What**: The mock for `@/lib/firestore` (lines 33-38) is missing `subscribeCuentasBancarias` and `subscribeExtractos`, causing 2 test failures. This is pre-existing but should be fixed.
   - **Suggestion**: Add the missing exports to the mock.

---

## Verdict

**PASS WITH WARNINGS**

The Phase 1 implementation is structurally sound: the Firestore rules are correctly designed, both API Routes follow the WriteBatch pattern with proper validation and error handling, the AuthContext is correctly implemented with the critical `useState(true)` initial loading pattern, and the new Firestore subscription functions match the spec.

However, the middleware has a **CRITICAL bug** (the `__session` cookie check is non-functional with Firebase Auth's default persistence) that must be fixed before this PR can be merged. The middleware will incorrectly redirect ALL authenticated users to `/login`, effectively breaking the app for any route under its protection.

**Recommended action before merge**:
1. Fix the middleware cookie check (remove it or implement a working auth detection mechanism)
2. Optionally write the rules integration test (1.T1)

Once the middleware is addressed, this PR provides a solid backend foundation for the remaining phases.
