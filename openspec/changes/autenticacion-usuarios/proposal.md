# Proposal: Autenticación, Roles y Multi-Tenant para PresupuestosApp

> **Cambio**: `autenticacion-usuarios`
> **Fecha**: 2026-07-04
> **Artefacto de origen**: `openspec/changes/autenticacion-usuarios/explore.md`
> **Estrategia de PR**: chained (ver §8) — el cambio excede el budget de revisión de 400 líneas.
> **Naming note**: se usa el `TabType` existente **`'Settings'`** (declarado y renderizado en `components/Datos.tsx` línea 11). **NO** `'Configuración'` — esta es un `ViewType` declarado pero no implementado.

---

## 1. Intent

La app no tiene capa de autenticación: `firestore.rules` usa `allow read, write: if true;` en todas las rutas. Este cambio introduce Firebase Auth (Email/Password), un modelo multi-tenant con empresas, membresías y roles (`admin` | `colaborador`), un flujo de invitaciones atómico vía API Routes con `firebase-admin`, guards de ruta (middleware + layout cliente) y un panel de administración de equipo dentro de la tab `Settings`. El objetivo es que cada usuario solo acceda a las empresas de las que es miembro, con la seguridad real viviendo en las Firestore Rules y el guard cliente siendo solo UX.

## 2. Scope

### In Scope
- Firebase Auth Email/Password + `AuthContext` global (`app/layout.tsx`).
- Tipos `UsuarioEmpresa`, `Invitacion`, `UserRole` en `lib/types.ts`.
- Migración de `/stateProject` y `/settings/categorias` a `/companies/{companyId}/settings/` (config por empresa). `/terceros` queda global.
- Reescritura de `firestore.rules` con `isMember(companyId)` + catch-all `if false`.
- API Routes `POST /api/companies/create` y `POST /api/companies/accept-invitation` con `firebase-admin` (WriteBatch).
- Páginas `/login`, `/register`, `/onboarding`, `/select-company`.
- `app/[company]/layout.tsx` (client) con guard de membresía + `CompanyProvider`.
- `middleware.ts` (edge redirect de no autenticados → `/login`).
- Panel "Miembros del Equipo" en tab `Settings` (condicionado a `userRole === 'admin'`) + flujo de invitación vía Sidepanel.
- Sidebar: `subscribeUserCompanies` (reemplaza `subscribeCompanies`), logout, email del usuario.

### Out of Scope (explícito)
- Proveedores OAuth (Google, Apple, etc.) — solo Email/Password.
- Cloud Functions (se usan API Routes de Next.js).
- Autenticación server-side con cookies httpOnly / verificación de token en SSR.
- Flujo de recuperación de contraseña más allá del `sendPasswordResetEmail` básico de Firebase.
- Migración de datos de producción existentes (se asume seed limpio vía `scripts/seed.ts`).
- Eliminación de usuarios/empresas desde la UI (las rules las contemplan pero no se expone UI).
- Modo "conjunto" (`/all/dashboard`) bajo auth — se mantiene pero sin nuevo guard.

## 3. Architecture Decisions (resueltas por el usuario — no reabrir)

| ID | Decisión | Opción elegida | Justificación del usuario |
|----|----------|----------------|----------------------------|
| **DA-1** | Estructura de datos | **Híbrida** | `/terceros` queda global bajo auth estricta (lectura para cualquier autenticado, escritura si es miembro de alguna empresa) porque los terceros (clientes/proveedores) se repiten entre empresas. `/stateProject` y `/settings/categorias` migran a `/companies/{companyId}/settings/` como config por empresa — definen reglas de negocio por empresa. |
| **DA-2** | Paradoja de invitación | **API Route con `firebase-admin`** | `POST /api/companies/accept-invitation` y `POST /api/companies/create` usan `firebase-admin` (ya en `lib/firebase-admin.ts`) para WriteBatch privilegiado server-side. El cliente nunca escribe docs de membresía directamente — elimina la paradoja "para ser miembro hay que escribir como miembro". |
| **DA-3** | Contextos | **Separados** | `AuthContext` global envuelve la app en `app/layout.tsx` y expone `user`/`loading`/`signIn`/`signUp`/`signOut`. `CompanyContext` queda por ruta, instanciado en `app/[company]/layout.tsx`, recibe `userRole` como prop y se expone vía `useCompany()`. Separation of concerns. |
| **DA-4** | Guards de ruta | **Middleware redirect + Client Guard** | `middleware.ts` valida presencia de sesión en edge y redirige a `/login`. `app/[company]/layout.tsx` es client component: lee `user` de `useAuth()`, muestra spinner mientras valida, verifica membresía vía `subscribeUserCompanies(user.uid)` contra Firestore, redirige a `/select-company` si no es miembro, y monta `CompanyProvider` con `companyId`+`userRole`. La seguridad real vive en Firestore Rules; el guard cliente es solo navegación de UX — cualquier bypass cliente queda bloqueado server-side. Spinner elimina el flash de contenido. ~15 líneas, sin complejidad de cookies/httpOnly. |

## 4. High-Level Approach (roadmap de 4 fases)

### Fase 1 — Auth, middleware, datos globales
- Habilitar Firebase Auth Email/Password en consola.
- Tipos `UsuarioEmpresa`, `Invitacion`, `UserRole` en `lib/types.ts`.
- `context/AuthContext.tsx` con `onAuthStateChanged`; envolver app en `app/layout.tsx`.
- `middleware.ts` para redirect edge de no autenticados.

### Fase 2 — Reglas de seguridad y API Routes (backend, Admin SDK)
- Reescribir `firestore.rules`: función `isMember(companyId)`, reglas por colección, catch-all `if false`.
- `/terceros` global: read si `request.auth != null`, write si miembro de cualquier empresa.
- `/companies/{companyId}/settings/` (nueva) company-scoped.
- `POST /api/companies/create` — onboarding: crea doc empresa + `/usuarios/{uid}` admin atómicamente.
- `POST /api/companies/accept-invitation` — verifica token, valida invitación, WriteBatch: crea `/usuarios/{uid}` + actualiza estado invitación.
- Actualizar `scripts/seed.ts` para inyectar settings bajo `/companies/{companyId}/settings/`.

### Fase 3 — Layout client guard y páginas de onboarding
- `app/[company]/layout.tsx` (`'use client'`) — guard membresía + montar `CompanyProvider`.
- Mover `CompanyProvider` de `app/[company]/[[...segments]]/page.tsx` al nuevo layout.
- `app/login/page.tsx`, `app/register/page.tsx`.
- `app/select-company/page.tsx` — empresas del usuario (`subscribeUserCompanies`) + invitaciones pendientes (`subscribeInvitations(email)`).
- `app/onboarding/page.tsx` — formulario crea empresa (llama `/api/companies/create`).
- `app/page.tsx` — redirect condicional: autenticado → `/select-company`, else → `/login`.

### Fase 4 — Panel admin e invitaciones UI
- Extender tab `'Settings'` en `components/Datos.tsx` con sección "Miembros del Equipo" (cond. `userRole === 'admin'`).
- Formulario de invitación vía Sidepanel: `ActiveForm` para invite-user, escribe en `invitations/`.
- Extender `Sidebar.tsx`: `subscribeUserCompanies` (reemplaza `subscribeCompanies`), botón logout, email del usuario.
- Conectar `acceptInvitation` desde `/select-company`.

## 5. Risks

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Reglas mal escritas bloquean TODA la app (regresión de acceso) | **Alta** | Reescribir `firestore.rules` primero y probar con `@firebase/rules-unit-testing` (ya en devDeps) antes de cualquier cambio de UI. Mantener las rules actuales en git para rollback inmediato. |
| Data leak entre empresas si las rules de `/terceros` quedan mal (`allow read: if true`) | **Alta** | `/terceros` read exige `request.auth != null`; nunca `if true`. Documentar el tradeoff aceptado (terceros visibles a cualquier autenticado) como decisión DA-1. |
| Falla de atomicidad en `accept-invitation` (doc de membresía creado pero invitación no actualizada, o viceversa) | **Media** | Usar `WriteBatch` server-side con `firebase-admin`; la API Route valida token + invitación antes de abrir el batch. Respuesta 500 si el batch falla. |
| Complejidad del estado de sesión (flash de contenido, loops de redirect `login`↔`select-company`) | **Media** | `AuthContext.loading` bien manejado; spinner en `[company]/layout.tsx`; `app/page.tsx` solo redirige cuando `loading === false`. |
| Cambio excede presupuesto de revisión de 400 líneas (~1,600 total) | **Alta** | Chained PRs obligatorios (ver §8). Cada slice < 400 líneas y revisable en una sesión. |

## 6. Dependencies

- `firebase: ^12.15.0` (incluye `@firebase/auth` transitivo) — ya instalado.
- `firebase-admin: ^14.1.0` — ya instalado (`lib/firebase-admin.ts` existe).
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` en `.env.local` (verificar).
- Dominio de la app agregado a Authorized Domains en Firebase Console.
- Vitest + `@testing-library/react` disponibles para tests unitarios/integración.

## 7. Capabilities

> Contrato con la fase sdd-spec. Investigado contra `openspec/specs/`.

### New Capabilities
- `user-auth`: Autenticación Email/Password con `AuthContext`, middleware de redirect y ciclo de sesión (`signIn`/`signUp`/`signOut`).
- `company-membership`: Membresía de usuarios en empresas, roles (`admin`/`colaborador`), flujo de invitaciones (create/accept) vía API Routes con `firebase-admin`, guard de membresía en `[company]/layout.tsx`.

### Modified Capabilities
- `company-selection`: `subscribeCompanies` (retorna TODAS) pasa a `subscribeUserCompanies` (filtra por membresía). `CompanyProvider` se mueve al layout y recibe `userRole`. Sidebar muestra solo empresas del usuario.

## 8. PR Strategy (chained — ABSOLUTAMENTE REQUERIDO)

~1,600 líneas totales > 400 budget. Encadenar en 4 slices revisables:

| PR | Contenido | Líneas est. | Depende de |
|----|-----------|-------------|------------|
| **PR-1** Backend: Auth core + `firestore.rules` + API Routes (`/api/companies/create`, `/api/companies/accept-invitation`) + `AuthContext` + `middleware.ts` | ~550 | — |
| **PR-2** Páginas onboarding: `/login`, `/register`, `/onboarding`, `/select-company` + `app/page.tsx` condicional | ~400 | PR-1 |
| **PR-3** Client guard: `app/[company]/layout.tsx` + refactor `CompanyProvider` (mover de `[[...segments]]/page.tsx`) + `subscribeUserCompanies` | ~250 | PR-1, PR-2 |
| **PR-4** Admin UI: tab `Settings` "Miembros del Equipo", Sidepanel invite form, `Sidebar.tsx` (logout/email), wire `acceptInvitation` | ~400 | PR-3 |

Cada PR se mergea secuencialmente; el siguiente se rebasa sobre el anterior.

## 9. Líneas estimadas por fase

| Fase | Líneas est. | Archivos |
|------|-------------|----------|
| Fase 1 (Auth+middlglobal) | ~150 | `context/AuthContext.tsx` (n), `lib/types.ts` (+20), `app/layout.tsx` (m), `middleware.ts` (n) |
| Fase 2 (Rules+API) | ~350 | `firestore.rules` (rewrite), `app/api/companies/create/route.ts` (n), `app/api/companies/accept-invitation/route.ts` (n), `scripts/seed.ts` (m), `lib/firestore.ts` (+80) |
| Fase 3 (Layout+onboarding) | ~650 | `app/[company]/layout.tsx` (n), `app/[company]/[[...segments]]/page.tsx` (m), `app/login/`, `app/register/`, `app/onboarding/`, `app/select-company/`, `app/page.tsx` (m) |
| Fase 4 (Admin UI) | ~400 | `components/Datos.tsx` (m), `components/Sidepanel.tsx` (m), `components/Sidebar.tsx` (m), `context/CompanyContext.tsx` (m) |
| Tests | ~150 | `lib/__tests__/`, `components/__tests__/` |
| **Total** | **~1,700** | |

## 10. Rollback Plan

- **Rules**: `firestore.rules` rewrite es el punto más crítico. Mantener versiones anteriores en git; si las reglas nuevas bloquean acceso legítimo, `git revert` + `firebase deploy --only firestore:rules` con la versión previa restaura acceso. Deploy de rules es independiente y atómico.
- **API Routes**: si `/api/companies/*` falla, onboarding e invitaciones quedan inoperables pero la app existente sigue funcionando (rules no mergedadas aún).
- **Rollout en slices (PR-1 → PR-4)**: cada PR es reversible de forma independiente. PR-1 (rules) es el único con riesgo de blast radius global — mergedar con feature flag de rules en el emulador primero.
- **Migration de datos**: `/settings/categorias` → `/companies/{companyId}/settings/` — script de migración idempotente; si falla, los datos viejos quedan en `/settings/categorias` (no se elimina hasta confirmar).

## 11. Success Criteria

- [ ] Usuario no autenticado es redirigido a `/login` por `middleware.ts`.
- [ ] Usuario autenticado sin empresa ve `/select-company` + invitaciones pendientes; no accede a `/[company]/*` de empresa ajena (redirect a `/select-company`).
- [ ] Admin puede crear empresa desde `/onboarding` y queda como `admin` atómicamente (WriteBatch server-side).
- [ ] Admin puede invitar; el invitado acepta y aparece en `/companies/{companyId}/usuarios/`.
- [ ] `colaborador` NO ve la sección "Miembros del Equipo" en tab `Settings`.
- [ ] `firestore.rules` pasa tests con `@firebase/rules-unit-testing`: miembro lee/escribe, no-miembro bloqueado, catch-all niega.
- [ ] `/terceros` legible solo por autenticados; nunca `allow read: if true`.
- [ ] `npm test` verde; `npx tsc --noEmit` sin errores.
- [ ] 4 PRs mergedados secuencialmente, cada uno < 400 líneas.