# User Authentication Specification

## Purpose

Provide Email/Password authentication via Firebase Auth with an `AuthContext` global provider, middleware edge redirect, and session lifecycle (sign in, sign up, sign out). This is the pure identity layer — no company or role awareness.

## Requirements

### Requirement: Auth Initialization

The system SHALL initialize Firebase Auth from `lib/firebase.ts` and export a dedicated `auth` instance via `lib/auth.ts`. An `AuthProvider` (`context/AuthContext.tsx`) SHALL wrap the app in `app/layout.tsx` and expose `user`, `loading`, `signIn`, `signUp`, `signOut` via the `useAuth()` hook.

#### Scenario: AuthProvider wraps the app tree

- GIVEN the application starts
- WHEN `app/layout.tsx` renders
- THEN `AuthProvider` wraps children and `useAuth()` is available in client components

#### Scenario: Returning user loads without content flash

- GIVEN a returning user with a valid Firebase session
- WHEN `onAuthStateChanged` fires
- THEN `loading` becomes `false` and `user` is populated with the authenticated user

### Requirement: Sign In

The system SHALL provide `signIn(email, password)` calling `signInWithEmailAndPassword`. On success the user is redirected to `/select-company`. On failure a user-visible error message SHALL be displayed.

#### Scenario: Valid credentials redirect to company selection

- GIVEN a registered user with correct password
- WHEN `signIn("user@example.com", "correct-password")` succeeds
- THEN `router.push("/select-company")` is called

#### Scenario: Wrong password shows error

- GIVEN a registered user
- WHEN `signIn` is called with the correct email but wrong password
- THEN the UI displays `auth/wrong-password` error message

#### Scenario: Non-existent email shows error

- GIVEN an email not registered in Firebase Auth
- WHEN `signIn` is called
- THEN the UI displays `auth/user-not-found` error message

### Requirement: Sign Up

The system SHALL provide `signUp(email, password)` calling `createUserWithEmailAndPassword`. Post-registration redirection SHALL depend on pending invitations: if invitations exist → `/select-company`; otherwise → `/onboarding`.

#### Scenario: New user without invitations goes to onboarding

- GIVEN a new email not registered in Firebase
- WHEN `signUp("nuevo@example.com", "password123")` succeeds
- THEN the user is redirected to `/onboarding`

#### Scenario: Already registered email shows error

- GIVEN an email already registered in Firebase Auth
- WHEN `signUp` is called with the same email
- THEN the UI displays `auth/email-already-in-use` error

### Requirement: Sign Out

The system SHALL provide `signOut()` calling Firebase `signOut`. The session SHALL be cleared and the user redirected to `/login`.

#### Scenario: Sign out clears session

- GIVEN an authenticated user
- WHEN `signOut()` is called
- THEN `user` becomes `null` and `router.push("/login")` is called

### Requirement: Middleware Edge Redirect

The system SHALL provide `middleware.ts` that runs on all routes except `/login`, `/register`, `/_next/*`, and `/favicon.ico`. Unauthenticated requests to protected routes SHALL be redirected to `/login`.

#### Scenario: Unauthenticated user redirected

- GIVEN a non-authenticated request to `/saman/dashboard`
- WHEN middleware evaluates the request
- THEN the response redirects to `/login`

#### Scenario: Authenticated user passes middleware

- GIVEN a valid Firebase session
- WHEN the user navigates to `/saman/dashboard`
- THEN the request proceeds

#### Scenario: Login and register pages bypass middleware

- GIVEN a request to `/login` or `/register`
- WHEN middleware runs
- THEN no redirect occurs

### Requirement: Root Page Conditional Redirect

The root page (`app/page.tsx`) SHALL redirect based on auth state: `loading === true` → no action; `user != null` → `/select-company`; else → `/login`.

#### Scenario: Authenticated user redirected to select-company

- GIVEN `user` is not null and `loading` is false
- WHEN the root page renders
- THEN `router.replace("/select-company")` is called

#### Scenario: Loading state prevents premature redirect

- GIVEN `loading === true`
- WHEN the root page renders
- THEN no redirect occurs
