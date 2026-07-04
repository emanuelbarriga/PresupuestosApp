# Delta for Company Selection

## Purpose

This delta adapts company selection from a static two-company registry to a dynamic, membership-filtered model. Companies shown are only those where the user is a member. Sidebar gains user email, logout, and admin Settings access.

## ADDED Requirements

### Requirement: Membership Filtered Company List

The system SHALL provide `subscribeUserCompanies(userId)` returning only companies where `/companies/{companyId}/users/{userId}` exists. This replaces `subscribeCompanies()` which returned all companies. The company list in `CompanyContext` SHALL only contain companies the user belongs to.

#### Scenario: User sees only their companies

- GIVEN `userId1` is a member of `companyA` but not `companyB`
- WHEN `subscribeUserCompanies("userId1")` resolves
- THEN the snapshot contains exactly `companyA`

#### Scenario: Empty list for user with no memberships

- GIVEN a newly registered user with no invitations accepted
- WHEN `subscribeUserCompanies(newUserId)` resolves
- THEN the snapshot is empty
- AND the UI shows "Crear nueva empresa" and pending invitations

### Requirement: Pending Invitations Display

The system SHALL provide `subscribeInvitations(email)` returning pending invitations where `email === userEmail` and `status === "pendiente"`. The `/select-company` page SHALL display these invitations with an "Aceptar" button.

#### Scenario: Pending invitation appears on select-company

- GIVEN a pending invitation for `user@example.com`
- WHEN the user logs in with that email and navigates to `/select-company`
- THEN the invitation is displayed with an "Aceptar" button

### Requirement: Create Company Redirect

The `/select-company` page SHALL provide a "Crear nueva empresa" button that navigates to `/onboarding`.

#### Scenario: User creates new company from select-company

- GIVEN an authenticated user with no companies
- WHEN they click "Crear nueva empresa"
- THEN `router.push("/onboarding")` is called

### Requirement: Sidebar User Email and Logout

The Sidebar SHALL display the authenticated user's email and a logout button (replacing the current static gray circle avatar placeholder).

#### Scenario: Authenticated user sees email and logout

- GIVEN an authenticated user with email "user@example.com"
- WHEN the Sidebar renders
- THEN the user's email is displayed in the sidebar footer
- AND a logout button is present
- WHEN the logout button is clicked
- THEN `signOut()` is called and the user is redirected to `/login`

### Requirement: Sidebar Settings MenuItem (Admin Only)

The Sidebar SHALL display a `menuItem` for `'Settings'` (not `'Configuración'`) ONLY when `userRole === 'admin'`. This menuItem navigates to the tab `'Settings'` in Datos.

#### Scenario: Admin sees Settings in sidebar

- GIVEN an authenticated user with `role: "admin"` in the current company
- WHEN the Sidebar renders
- THEN the `'Settings'` menuItem is visible

#### Scenario: Collaborator does NOT see Settings

- GIVEN an authenticated user with `role: "colaborador"` in the current company
- WHEN the Sidebar renders
- THEN the `'Settings'` menuItem is NOT visible

## MODIFIED Requirements

### Requirement: Company Context and Persistence

The system SHALL provide a `CompanyContext` React Context and a `useCompany` hook. The hook MUST expose: `selectedCompany` (current `Company`), `companies` (filtered by user membership — NOT the full registry), `setCompany` (setter), and `userRole` (`'admin'` | `'colaborador'` | `null`).

A `CompanyProvider` SHALL be mounted in `[company]/layout.tsx` (no longer in `[[...segments]]/page.tsx`). The provider SHALL receive `companyId` and `userRole` as props. On unmount or auth change, the context SHALL clean up the Firestore subscription.

(Previously: Companies were a static two-company registry. Persistence used `localStorage`. No `userRole` existed.)

#### Scenario: CompanyProvider receives userRole from layout

- GIVEN the membership guard in `[company]/layout.tsx` has verified the user has `role: "admin"`
- WHEN `CompanyProvider` mounts
- THEN `useCompany().userRole` equals `"admin"`

#### Scenario: Company list is filtered by membership

- GIVEN an authenticated user who is a member of 3 companies
- WHEN `useCompany().companies` is accessed
- THEN it contains exactly those 3 companies, not all companies in the database

#### Scenario: Navigating away cleans up subscription

- GIVEN `CompanyProvider` is mounted
- WHEN the user navigates to a non-company route
- THEN the Firestore `onSnapshot` subscription is unsubscribed
