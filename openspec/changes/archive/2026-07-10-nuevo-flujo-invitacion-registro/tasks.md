# Tasks: Separar registro de membresía en dos fases (Invitación solo email + asignación manual admin)

Decision needed before apply: Yes  
Chained PRs recommended: Yes  
Chain strategy: pending  
400-line budget risk: High

| Field | Estimate |
|-------|----------|
| New files | ~170 lines (3 files) |
| Modified files | ~260 lines (10 files) |
| Tests (strict_tdd) | ~200+ lines |
| **Total** | **~630 lines** |
| 400-line budget risk | High |
| Chained PRs | Recommended |

### Suggested Work Units

| Unit | Goal | PR | Notes |
|------|------|----|-------|
| 1 | Data model + Firestore + API routes | PR 1 | Foundation: types, firestore functions, both API routes, migration batch |
| 2 | Registro UI + Auth guards | PR 2 | Register page, pending page, AuthContext, CompanyContext |
| 3 | Admin UI + Forms cleanup | PR 3 | AssignUserModal, Configuracion section, Invitacion forms, select-company |

## Phase 1: Data Model & Firestore (Foundation)

- [x] 1.1 `lib/types.ts` — Sacar `companyId`/`companyName`/`role` de `Invitacion`. Agregar `UserProfile` con `pendingAssignment: boolean`
- [x] 1.2 `lib/firestore.ts` — Simplificar `createInvitation`: solo email + invitedBy + expiresAt. Sacar company params
- [x] 1.3 `lib/firestore.ts` — Agregar `subscribeUnassignedUsers`: query `users` where `pendingAssignment == true`
- [x] 1.4 `lib/firestore.ts` — Agregar `assignUserToCompany(userId, companyId, role)`: WriteBatch create membership + update `pendingAssignment = false`

## Phase 2: API Routes

- [x] 2.1 `app/api/companies/accept-invitation/route.ts` — Sacar creación de membership. Solo: marcar invitación `aceptada` + crear/update `users/{uid}` con `pendingAssignment: true`
- [x] 2.2 `app/api/companies/assign-user/route.ts` — Nueva ruta `POST`. Validar admin token + body `{userId, companyId, role}`. WriteBatch crear membership + update user flag

## Phase 3: Registration UI

- [x] 3.1 `app/register/page.tsx` — No precargar email desde query param. Validar email manual contra invitación en submit. Post-registro: redirect a `/pending-assignment` (no a `/select-company`)
- [x] 3.2 `app/pending-assignment/page.tsx` — Nueva página: "Cuenta creada, esperá asignación del admin" + botón cerrar sesión

## Phase 4: Auth Guards

- [x] 4.1 `context/AuthContext.tsx` — En `onAuthStateChanged`, leer `users/{uid}.pendingAssignment`. Exponer `needsAssignment: boolean`
- [x] 4.2 `context/CompanyContext.tsx` — Redirigir a `/pending-assignment` si `needsAssignment === true`

## Phase 5: Admin UI

- [x] 5.1 `components/AssignUserModal.tsx` — Nuevo modal con selector de empresa + rol (`admin` | `colaborador`). Llama `POST /api/companies/assign-user`
- [x] 5.2 `components/Configuracion.tsx` — Agregar sección "Usuarios pendientes" con badge. Usar `subscribeUnassignedUsers`. Botón "Asignar" abre `AssignUserModal`

## Phase 6: Cleanup

- [x] 6.1 `components/entities/invitacion/InvitacionCreateForm.tsx` — Sacar selector empresas + rol. Solo email + expiración
- [x] 6.2 `components/entities/invitacion/InvitacionEditForm.tsx` — Sacar campos `companyId`/`companyName`/`role`
- [x] 6.3 `app/select-company/page.tsx` — Manejar caso usuario sin empresas asignadas: mostrar mensaje en vez de lista vacía
- [x] 6.4 Migración: batch set `pendingAssignment = false` en todos los `users/{uid}` que tengan membership existente

## Phase 7: Tests (strict_tdd)

- [x] 7.1 Test: `createInvitation` no guarda company data
- [x] 7.2 Test: `POST /api/companies/accept-invitation` no crea membership
- [x] 7.3 Test: `POST /api/companies/assign-user` crea membership + actualiza flag (admin only)
- [x] 7.4 Test: `AuthContext.needsAssignment` se setea desde Firestore user doc
- [x] 7.5 Test: Register page valida email match contra invitación, falla si no coincide
- [x] 7.6 Test: `subscribeUnassignedUsers` solo trae docs con `pendingAssignment == true`
- [x] 7.7 Test: `AssignUserModal` llama API correcta con payload esperado
