# Company Membership Specification

## Purpose

Provide the multi-tenant layer: user membership in companies, roles (`admin`/`colaborador`), Firestore security rules enforcing membership, API Routes for privileged WriteBatch operations (create company, accept invitation), a client membership guard in `[company]/layout.tsx`, and migration of `/stateProject` and `/settings/categorias` under company scope.

## Requirements

### Requirement: Data Types

The system SHALL add to `lib/types.ts`: `UserRole = 'admin' | 'colaborador'`, `UsuarioEmpresa { id, email, role, joinedAt }`, and `Invitacion { id, companyId, companyName, email, role, status, invitedBy, createdAt }`.

#### Scenario: Types compile and are importable

- GIVEN any file importing from `lib/types`
- WHEN the build runs (`npx tsc --noEmit`)
- THEN `UserRole`, `UsuarioEmpresa`, `Invitacion` are available with correct shape

### Requirement: Firestore Security Rules — Membership Function

The system SHALL define a rule function `isMember(companyId)` that returns `exists(/databases/$(database)/documents/companies/$(companyId)/users/$(request.auth.uid))`.

### Requirement: Firestore Security Rules — Collection Access Matrix

The system SHALL enforce the following access rules. Every unmatched path SHALL be denied by a catch-all `allow read, write: if false;`.

| Collection pattern | Read rule | Write rule | Notes |
|---|---|---|---|
| `/companies/{companyId}` | `request.auth != null` | `request.auth != null` | Create allowed for any auth'd user |
| `/companies/{companyId}/users/{userId}` | `isMember(companyId)` | Denied (API only) | Admin SDK writes via API Routes |
| `/companies/{companyId}/budgets/{doc}` | `isMember(companyId)` | `isMember(companyId)` | Same for `ejecuciones`, `projects`, `cuentasBancarias`, `extractos` |
| `/companies/{companyId}/settings/{doc}` | `isMember(companyId)` | `isMember(companyId)` | Migrated from global `/settings/` and `/stateProject/` |
| `/terceros/{doc}` | `request.auth != null` | `request.auth != null && isMemberOfAnyCompany()` | Global collection — readable by all auth'd users |
| `/invitations/{inv}` | Creator or invitee | `request.auth != null` | Creator: `resource.data.invitedBy == uid`. Invitee: `resource.data.email == auth.token.email` |
| `/companies/{companyId}/extractos/{doc}` | `isMember(companyId)` | `isMember(companyId)` | Same as budgets |
| Everything else | `if false` | `if false` | Catch-all |

#### Scenario: Member reads company data

- GIVEN `uid1` has a doc at `/companies/companyA/users/uid1`
- WHEN `uid1` reads `/companies/companyA/budgets/budget1`
- THEN the read is allowed

#### Scenario: Non-member blocked from company data

- GIVEN `uid1` has NO doc under `/companies/companyB/users/`
- WHEN `uid1` reads `/companies/companyB/budgets/budget1`
- THEN the read is denied

#### Scenario: Authenticated user reads global terceros

- GIVEN an authenticated user (any membership status)
- WHEN they read `/terceros/tercero1`
- THEN the read is allowed

#### Scenario: Catch-all denies unknown paths

- GIVEN an authenticated user
- WHEN they attempt to read `/unknownCollection/doc`
- THEN the operation is denied

#### Scenario: Invitation visible to invitee by email

- GIVEN an invitation with `email: "user@example.com"` and `invitedBy: "adminUid"`
- WHEN user with `auth.token.email === "user@example.com"` reads the invitation
- THEN the read is allowed
- WHEN the same adminUid reads the invitation
- THEN the read is also allowed

#### Scenario: Invitation hidden from unrelated users

- GIVEN an invitation with `email: "invited@example.com"`
- WHEN a user with `auth.token.email === "stranger@example.com"` reads the invitation
- THEN the read is denied

### Requirement: API Route — Create Company (Onboarding)

The system SHALL provide `POST /api/companies/create` using `firebase-admin` WriteBatch to atomically create: a `/companies/{companyId}` document and a `/companies/{companyId}/users/{userId}` document with `role: "admin"`. The endpoint SHALL validate required fields and return 400 on missing fields, 409 on duplicate company ID, 201 on success.

#### Scenario: Successful company creation

- GIVEN a valid payload `{ companyId: "nueva-empresa", companyName: "Nueva Empresa", userId: "uid1", userEmail: "admin@example.com" }`
- WHEN `POST /api/companies/create` is called
- THEN the response is 201
- AND `/companies/nueva-empresa` exists with `name: "Nueva Empresa"`
- AND `/companies/nueva-empresa/users/uid1` exists with `role: "admin"` and `email: "admin@example.com"`

#### Scenario: Duplicate company ID returns 409

- GIVEN company `nueva-empresa` already exists
- WHEN `POST /api/companies/create` is called with `companyId: "nueva-empresa"`
- THEN the response is 409 with error body

#### Scenario: Missing required fields return 400

- GIVEN a payload without `companyName`
- WHEN `POST /api/companies/create` is called
- THEN the response is 400

### Requirement: API Route — Accept Invitation

The system SHALL provide `POST /api/companies/accept-invitation` using `firebase-admin` WriteBatch to atomically create a `/companies/{companyId}/users/{userId}` document and set the invitation status to `"aceptada"`. The endpoint SHALL validate that `userEmail` matches the invitation's email, that the invitation is pending, and that the invitation exists. Returns 200, 403 (email mismatch), 404 (not found), 409 (already accepted).

#### Scenario: Successful invitation acceptance

- GIVEN a pending invitation for `user@example.com` in `companyA` with `role: "colaborador"`
- WHEN `POST /api/companies/accept-invitation` is called with `{ invitationId, userId: "uid1", userEmail: "user@example.com" }`
- THEN the response is 200
- AND `/companies/companyA/users/uid1` exists with `email: "user@example.com"` and `role: "colaborador"`
- AND the invitation status becomes `"aceptada"`

#### Scenario: Email mismatch returns 403

- GIVEN an invitation for `invited@example.com`
- WHEN the API is called with `userEmail: "other@example.com"`
- THEN the response is 403
- AND no membership document is created

#### Scenario: Already accepted invitation returns 409

- GIVEN an invitation with status `"aceptada"`
- WHEN `POST /api/companies/accept-invitation` is called
- THEN the response is 409
- AND no duplicate membership doc is created

#### Scenario: Non-existent invitation returns 404

- GIVEN an `invitationId` that does not exist
- WHEN `POST /api/companies/accept-invitation` is called
- THEN the response is 404

#### Scenario: Concurrent double-accept is idempotent

- GIVEN a pending invitation
- WHEN two simultaneous `POST /api/companies/accept-invitation` requests arrive
- THEN exactly one succeeds (200) and the other returns 409
- AND exactly one membership doc exists

### Requirement: Client Membership Guard

The system SHALL provide `app/[company]/layout.tsx` as a `'use client'` component that reads `user` from `useAuth()`. While `loading === true`, it SHALL display a spinner. After loading, it SHALL subscribe to `subscribeUserCompanies(user.uid)`. If the user is not a member of `[company]`, it SHALL redirect to `/select-company`. If the user is a member, it SHALL mount `CompanyProvider` with `companyId` and `userRole`. This guard is UX-only — real security is in Firestore rules.

#### Scenario: Member accesses company route normally

- GIVEN an authenticated user who is a member of `companyA`
- WHEN they navigate to `/companyA/dashboard`
- THEN the layout shows a spinner briefly while validating
- THEN `CompanyProvider` mounts with `companyId: "companyA"` and the correct `userRole`
- AND the child page renders

#### Scenario: Non-member redirected to company selection

- GIVEN an authenticated user who is NOT a member of `companyB`
- WHEN they navigate to `/companyB/dashboard`
- THEN the layout redirects to `/select-company`
- AND no company data components render

#### Scenario: Loading state shows spinner, no redirect

- GIVEN `AuthContext.loading === true`
- WHEN `[company]/layout.tsx` renders
- THEN a spinner is displayed
- AND no redirect occurs

#### Scenario: Bypassing guard via direct API call is blocked by rules

- GIVEN a non-member of `companyB`
- WHEN they make a direct Firestore query to `/companies/companyB/budgets`
- THEN the Firestore rules deny the read (even if client guard is bypassed)

### Requirement: Data Migration — Settings Per Company

`/stateProject` and `/settings/categorias` SHALL be migrated under `/companies/{companyId}/settings/`. The old global paths SHALL be removed from rules (denied by catch-all). `scripts/seed.ts` SHALL write settings data under the company-scoped path.

#### Scenario: Company-scoped settings readable by members

- GIVEN an authenticated member of `companyA`
- WHEN they read `/companies/companyA/settings/categorias`
- THEN the read is allowed (via `isMember(companyA)`)

#### Scenario: Old global settings path is denied

- GIVEN an authenticated user
- WHEN they attempt to read `/settings/categorias` (old global path)
- THEN the read is denied by catch-all
