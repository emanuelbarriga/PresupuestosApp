# Tasks: Autenticación, Roles y Multi-Tenant

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

~1,400 lines total > 400 budget. 4 chained PRs. Feature-branch-chain: PR-1→main, PR-2→PR-1, PR-3→PR-2, PR-4→PR-3.

**Gotchas**: AuthContext `useState(true)` init; middleware Edge = no Node.js; `subscribeSettings` migrates before rules block old path; `all` reserved; `collectionGroup('users')` for membership.

## Phase 1: Backend Infra (PR-1, ~350 lines)

- [x] 1.1 **[lib/types.ts]** Add `UserRole`, `UsuarioEmpresa`, `Invitacion`
- [x] 1.2 **[lib/auth.ts]** Create — `export const auth = getAuth(app)`
- [x] 1.3 **[lib/firestore.ts]** Add `subscribeUserCompanies`, `subscribeCompanyUsers`, `subscribeInvitations`, `createInvitation`. Migrate `subscribeSettings` → company-scoped
- [x] 1.4 **[firestore.rules]** Rewrite: `isMember()`, per-collection matrix, `/terceros` auth read, `/invitations` creator/invitee rules, catch-all `if false`
- [x] 1.5 **[app/api/companies/create/route.ts]** POST: verifyIdToken, slugify, collision check, WriteBatch company doc + admin user
- [x] 1.6 **[app/api/companies/accept-invitation/route.ts]** POST: verifyIdToken, validate invitation, WriteBatch membership + status
- [x] 1.7 **[middleware.ts]** Edge redirect unauth → `/login`. Bypass `/login`, `/register`, `/_next/*`
- [x] 1.8 **[context/AuthContext.tsx + app/layout.tsx]** AuthProvider: `onAuthStateChanged`, `signIn/Up/Out`, `loading`. Wrap root layout
- [x] 1.9 **[scripts/seed.ts]** Write settings under `/companies/{companyId}/settings/categorias`
- [ ] 1.T1 Rules test with `@firebase/rules-unit-testing` — full access matrix

## Phase 2: Auth Pages (PR-2, ~350 lines)

- [ ] 2.1 **[app/page.tsx]** Replace hardcoded redirect: user→`/select-company`, else→`/login`, loading→null
- [ ] 2.2 **[app/login/page.tsx]** Form: email+password → `signIn`. Show errors. Success→`/select-company`
- [ ] 2.3 **[app/register/page.tsx]** Form: email+password → `signUp`. Invitations→`/select-company`, else→`/onboarding`
- [ ] 2.4 **[app/onboarding/page.tsx]** Company name → POST `/api/companies/create`. 201→`/companyId/dashboard`
- [ ] 2.5 **[app/select-company/page.tsx]** User companies + pending invitations. Crear empresa→`/onboarding`. Aceptar→POST accept-invitation
- [ ] 2.T1 AuthContext unit test — state transitions, error handling

## Phase 3: Client Guard + Refactor (PR-3, ~300 lines)

- [x] 3.1 **[app/[company]/layout.tsx]** `'use client'`: spinner while loading, subscribe membership, non-member→`/select-company`, mount CompanyProvider with `userRole`. Skip for `all`
- [x] 3.2 **[context/CompanyContext.tsx]** Add `userRole`+`roleLoading` to value. Accept `userRole` prop. (Replace `subscribeCompanies` deferred — not in scope for this PR per user instructions)
- [x] 3.3 **[page.tsx: [[...segments]]]** Remove `<CompanyProvider>`. Add `'settings'`→`'Configuración'` in `viewFromSegments`. Add Configuración render case.
- [ ] 3.T2 Layout guard test — member passes, non-member redirects

## Phase 4: Admin UI (PR-4, ~400 lines)

- [x] 4.1 **[components/Sidebar.tsx]** `'Settings'` menuItem only if `userRole==='admin'`. Gray circle→user email+logout from `useAuth()`.
  - Also updated `context/CompanyContext.tsx` to use `subscribeUserCompanies(userId)` instead of `subscribeCompanies`.
  - Passed `userId` prop from `app/[company]/layout.tsx` to `CompanyProvider`.
- [x] 4.2 **[components/Datos.tsx]** Added member management section (admin-only) via `subscribeCompanyMembers`. Member list with email, role badge, joined date. "Invitar colaborador" button opens sidepanel.
- [x] 4.3 **[lib/types.ts + Sidepanel.tsx]** Added `'invite-user'` to `FormType`. Invite form with email input, role selector (Colaborador/Administrador), calls `createInvitation()`. Shows success message then closes.
- [x] 4.4 **[components/Datos.tsx + lib/firestore.ts]** Migrated `subscribeSettings` to company-scoped path. Created `subscribeCompanySettings(companyId,...)`. Both old and new subscribers run (old as fallback with TODO).
- [ ] 4.T3 Sidebar test — admin sees Settings, colaborador doesn't

## Order

PR-1 (backend) → PR-2 (pages) → PR-3 (guard) → PR-4 (admin). Sequential chain, each < 400 lines.
