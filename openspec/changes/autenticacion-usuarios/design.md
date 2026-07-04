# Design: Autenticación, Roles y Multi-Tenant

## Technical Approach

Hybrid multi-tenant on existing Firestore structure: `/terceros` stays global (auth read), `/companies/{companyId}` scoped data + new `/settings/` under company scope. Auth via Firebase Email/Password with `AuthContext` (root layout), membership guard in `[company]/layout.tsx` (client), and Firestore security rules as the real enforcement layer. Two API Routes (`/api/companies/create`, `/api/companies/accept-invitation`) with `firebase-admin` WriteBatch for privileged operations.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `/terceros` global vs per-company | Global = no data duplication but cross-company visibility. Per-company = isolation but duplicate shared clients/providers | **Global** — auth read; write only if member of any company |
| Invitation paradox (non-member must write membership doc) | Client-side rules complex. Cloud Function = extra infra. API Route = simple, no new deploy | **API Route** with firebase-admin WriteBatch (DA-2) |
| AuthContext merged vs separate from CompanyContext | Merged = fewer wrappers but CompanyContext is per-route. Separate = clean separation | **Separate** — AuthContext global, CompanyContext per-route (DA-3) |
| Middleware vs client guard | Middleware = edge-speed but can't check Firestore membership. Client guard = slower but can verify | **Dual** — middleware for unauth redirect + client guard for membership (DA-4) |

## Data Flow

```
Browser             AuthContext           Middleware         CompanyLayout        Firestore
  │                     │                     │                   │                  │
  │─ navigate ─────────→│                     │                   │                  │
  │                     │                     │─ check cookie ───→│                  │
  │                     │                     │← redirect /login │(unauth)          │
  │                     │← user/loading ──────│                   │                  │
  │                     │                     │                   │─ isMember() ────→│
  │                     │                     │                   │← userRole ──────│
  │                     │                     │                   │─ CompanyProvider │
  │                     │                     │                   │  (companyId,role)│
```

## Firestore Rules Pseudocode

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isMember(companyId) {
      return request.auth != null
        && exists(/databases/$(database)/documents/companies/$(companyId)/users/$(request.auth.uid));
    }

    function isMemberOfAnyCompany() {
      return request.auth != null; // checked at collection level
    }

    // Companies collection
    match /companies/{companyId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null; // onboarding (API route writes users)
      allow update: if isMember(companyId) && request.auth.uid
        in get(/databases/$(database)/documents/companies/$(companyId)/users).keys(); // admin check via custom claim
      allow delete: if false;

      // Scoped data — member only
      match /budgets/{doc} { allow read, write: if isMember(companyId); }
      match /ejecuciones/{doc} { allow read, write: if isMember(companyId); }
      match /projects/{doc} { allow read, write: if isMember(companyId); }
      match /cuentasBancarias/{doc} { allow read, write: if isMember(companyId); }
      match /extractos/{doc} { allow read, write: if isMember(companyId); }
      match /settings/{doc} { allow read, write: if isMember(companyId); }

      // Users subcollection — API Routes only via firebase-admin (bypasses rules)
      // On client: read allowed for members, write DENIED
      match /users/{userId} {
        allow read: if isMember(companyId);
        allow create: if false; // API route only
        allow update: if false;
        allow delete: if false;
      }
    }

    // Global terceros — readable by any auth'd user, writable only by members
    match /terceros/{doc} {
      allow read: if request.auth != null;
      allow create: if isMemberOfAnyCompany();
      allow update: if isMemberOfAnyCompany();
      allow delete: if false;
    }

    // Invitations — creator writes, invitee reads/accepts by email match
    match /invitations/{inv} {
      allow read: if request.auth != null
        && (resource.data.invitedBy == request.auth.uid
         || resource.data.email == request.auth.token.email);
      allow create: if request.auth != null;
      allow update: if request.auth != null
        && resource.data.email == request.auth.token.email
        && resource.data.status == 'pendiente';
      allow delete: if false;
    }

    // OLD paths — denied by catch-all
    match /settings/{doc} { allow read, write: if false; }
    match /stateProject/{doc} { allow read, write: if false; }

    // Catch-all
    match /{document=**} { allow read, write: if false; }
  }
}
```

**Note**: `'all'` companyId is reserved for conjunto mode and MUST NOT have a users subcollection. The guard in `[company]/layout.tsx` and the API route both enforce this — rules alone can't block doc creation at the path level, but the API route will reject writes to `/companies/all/users/`.

## API Routes

### POST /api/companies/create

```
Request:  { companyName: string }
Auth:     Authorization: Bearer <Firebase ID Token>
Logic:    verifyIdToken(token) → uid
          companyId = slugify(companyName).toLowerCase()
          if doc exists → 409
          WriteBatch: companies/{companyId} .set({ name, createdBy: uid, createdAt })
                      companies/{companyId}/users/{uid} .set({ email, role: 'admin', joinedAt })
Response: 201 { companyId, name, success: true }
Errors:   400 (missing name), 401 (invalid token), 409 (duplicate companyId)
```

### POST /api/companies/accept-invitation

```
Request:  { invitationId: string }
Auth:     Authorization: Bearer <Firebase ID Token>
Logic:    verifyIdToken(token) → { uid, email }
          read invitations/{invitationId}
          if not found → 404
          if status != 'pendiente' → 409
          if invitation.email != email → 403
          WriteBatch: companies/{inv.companyId}/users/{uid} .set({ email, role: 'colaborador', joinedAt })
                      invitations/{invitationId} .update({ status: 'aceptada', acceptedAt })
Response: 200 { companyId, success: true }
Errors:   400 (missing id), 401 (invalid token), 403 (email mismatch),
          404 (not found), 409 (already accepted)
```

## AuthContext Interface

```typescript
// context/AuthContext.tsx
interface AuthState {
  user: User | null;
  loading: boolean;   // true until onAuthStateChanged fires
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const useAuth = () => useContext(AuthContext);
```

## CompanyContext Extension

```typescript
// context/CompanyContext.tsx — ADDITIONS
interface CompanyContextValue {
  // ... existing fields
  userRole: UserRole | null;      // NEW: 'admin' | 'colaborador' | null
  roleLoading: boolean;            // NEW: true while subscribing user role
}

// CompanyProvider now accepts userRole as a prop
// subscribeCompanies() → subscribeUserCompanies(userId)
```

## Component Tree

```
Root Layout (app/layout.tsx)
  └── AuthProvider
      ├── /login, /register       ← unauthenticated
      ├── /onboarding, /select-company  ← authenticated, no company
      └── /[company] layout (client)
          ├── spinner while loading
          ├── redirect if not member
          └── CompanyProvider (companyId, userRole)
              └── [[...segments]]/page.tsx
                  ├── Sidebar (user email, logout, filtered companies, Settings for admin)
                  └── Datos (Settings tab → "Miembros del Equipo" for admin)
```

## New Files

| File | LOC | Purpose |
|------|-----|---------|
| `context/AuthContext.tsx` | ~100 | onAuthStateChanged, signIn/Up/Out |
| `middleware.ts` | ~30 | Edge redirect unauth → /login |
| `lib/auth.ts` | ~5 | `export const auth = getAuth(app)` |
| `app/[company]/layout.tsx` | ~40 | Membership guard + CompanyProvider |
| `app/login/page.tsx` | ~80 | Login form |
| `app/register/page.tsx` | ~80 | Register form |
| `app/select-company/page.tsx` | ~150 | Company list + pending invitations |
| `app/onboarding/page.tsx` | ~80 | Create company form |
| `app/api/companies/create/route.ts` | ~60 | Create company + admin member |
| `app/api/companies/accept-invitation/route.ts` | ~70 | Accept invitation |

## Modified Files

| File | Delta | What |
|------|-------|------|
| `app/layout.tsx` | +5 | Wrap with AuthProvider |
| `app/page.tsx` | +15 | Conditional redirect (auth→/select-company, else→/login) |
| `app/[company]/[[...segments]]/page.tsx` | +20 | Remove CompanyProvider wrapper; add Settings view routing; receive userRole via context |
| `lib/types.ts` | +20 | Add `UserRole`, `UsuarioEmpresa`, `Invitacion` types |
| `lib/firestore.ts` | +80 | `subscribeUserCompanies`, `subscribeCompanyUsers`, `subscribeInvitations`, `createInvitation`. Migrate `subscribeSettings` to company-scoped path |
| `context/CompanyContext.tsx` | +30 | Add `userRole`, `roleLoading`, accept `userRole` prop |
| `components/Sidebar.tsx` | +60 | Filtered companies, user email, logout, Settings menuItem for admin |
| `components/Datos.tsx` | +100 | Extend Settings tab with user management section (admin only) |
| `firestore.rules` | +80 | Complete rewrite with `isMember`, per-collection rules, catch-all |
| `scripts/seed.ts` | +15 | Write settings under `/companies/{companyId}/settings/` |

## Interfaces / Contracts

```typescript
// lib/types.ts — ADDITIONS
export type UserRole = 'admin' | 'colaborador';

export interface UsuarioEmpresa {
  id: string;        // = uid from Firebase Auth
  email: string;
  role: UserRole;
  joinedAt: string;  // ISO date
}

export interface Invitacion {
  id: string;
  companyId: string;
  companyName: string;
  email: string;
  role: UserRole;         // default 'colaborador'
  status: 'pendiente' | 'aceptada';
  invitedBy: string;      // uid of inviting admin
  createdAt: string;
}
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | AuthContext | vitest + vi.mock firebase/auth — test state transitions (loading→user, loading→null) |
| Unit | API Routes | Test with mocked firebase-admin — verify WriteBatch calls, error codes |
| Integration | Firestore Rules | `@firebase/rules-unit-testing` — test isMember, catch-all, terceros, invitations |
| Integration | CompanyContext extension | Test userRole propagation, membership filtering |
| E2E | Full auth flow | Manual: register → onboarding → dashboard → logout → login |

## Migration / Rollout

- PR-1: Rules + API Routes + AuthContext + middleware (backend infra, no UI change)
- PR-2: /login, /register, /onboarding, /select-company pages
- PR-3: [company]/layout.tsx guard + CompanyProvider refactor
- PR-4: Sidebar + Datos Settings admin panel

Settings migration: `scripts/seed.ts` writes to `/companies/{companyId}/settings/categorias`. Old `/settings/categorias` and `/stateProject` paths hit catch-all `if false` after rules deploy.

## Open Questions

- [ ] Should `isMemberOfAnyCompany()` for `/terceros` write check existence across all companies? Risk: 10 `exists()` limit. **Decision**: use `request.auth != null` for write — trusted users only. Re-evaluate if abuse.

## Critical Technical Gotchas

1. **`isMember()` counts as 1 `exists()` call**. Firestore rules limit is 10 per request. Safe for now.
2. **`listAll` in Storage** requires `list` permission — confirmed working from previous change.
3. **API Routes must extract Bearer token manually** and call `admin.auth().verifyIdToken(token)` — no middleware.
4. **companyId generation**: `slugify(name).toLowerCase()`. Reserved IDs: `saman`, `pacora`, `all`. Check collision before write.
5. **`'all'` companyId is reserved** for conjunto mode. No users subcollection. API routes must reject writes to `/companies/all/users/`.
6. **AuthContext loading flash**: `useState(true)` initial, set `false` in `onAuthStateChanged` callback. This prevents premature redirects.
7. **`middleware.ts` runs in Edge Runtime** — cannot use firebase-admin (Node.js only). Must use cookie-based detection or skip auth pages.
8. **SubscribeUserCompanies**: Use `collectionGroup('users')` with `where(fieldPath, '==', uid)` — Firestore query on `/companies/{companyId}/users/`. Alternative: maintain `/user-companies/{uid}` doc with array of companyIds.
9. **Settings subscription**: `subscribeSettings` currently reads `/settings/categorias`. Must change to `/companies/{companyId}/settings/categorias`. Datos.tsx line 56 calls it — will fail until migration.
