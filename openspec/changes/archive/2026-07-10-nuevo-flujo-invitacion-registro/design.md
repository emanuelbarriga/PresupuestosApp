# Design: Nuevo Flujo de Invitación y Registro

## Technical Approach

Separar registro de membresía en dos fases: (1) invitación solo con email → registro sin empresa, (2) admin asigna manualmente empresa+rol desde Configuración. El flag `pendingAssignment` en `users/{uid}` es el guard que bloquea acceso a `/[company]/*` hasta que el admin complete la asignación.

## Architecture Decisions

### Decision: `pendingAssignment` flag sobre `users/{uid}` vs subcolección separada

| Option | Tradeoff |
|--------|----------|
| Flag booleano en users/{uid} | + query simple (`where pendingAssignment == true`), + update atómico con WriteBatch, - toca migrar users existentes |
| Subcolección `pendingUsers` | + cero impacto en users existentes, - query más compleja, - consistencia eventual cruzando colecciones |

**Choice**: flag booleano. Migrar users existentes seteando `pendingAssignment: false` en lote.

### Decision: Admin asigna desde Configuración vía API route (no direct Firestore write)

**Choice**: Nueva API route `POST /api/companies/assign-user` con verificación de admin token en server. WriteBatch atómico: create membership + update user flag.
**Rationale**: Consistente con el patrón existente de `accept-invitation` (server-side validation). Evita writes inseguros desde cliente.

## Data Flow

```
Invitación (email only) ──→ Register Page ──→ accept-invitation API ──→ users/{uid} (pending)
                                                                               │
                                        Configuración (admin) ─── assign-user API ──→ companies/{cid}/members/{uid}
                                                                                      └── users/{uid}.pendingAssignment = false
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/types.ts` | Modify | Invitacion: sacar companyId/companyName/role; agregar acceptedAt/acceptedBy (ya existen). UserDoc: agregar pendingAssignment |
| `lib/firestore.ts` | Modify | createInvitation simplificada (solo email+metadata). Agregar subscribeUnassignedUsers. updateInvitation sin role |
| `app/api/companies/accept-invitation/route.ts` | Modify | NO crear membership. NO batch-accept otras invitaciones. Setear pendingAssignment=true |
| `app/api/companies/assign-user/route.ts` | New | POST: validar admin + body {userId, companyId, role}. WriteBatch: create membership + pendingAssignment=false |
| `app/register/page.tsx` | Modify | No precargar email. Post-registro redirect a pantalla de espera. NO redirect a select-company |
| `app/pending-assignment/page.tsx` | New | Pantalla de espera: "Tu cuenta fue creada, esperá asignación del admin". Botón cerrar sesión |
| `components/entities/invitacion/InvitacionCreateForm.tsx` | Modify | Sacar selector empresas + rol. Solo email + expiración |
| `components/entities/invitacion/InvitacionEditForm.tsx` | Modify | Sacar campos companyId/companyName/role |
| `components/Configuracion.tsx` | Modify | Nueva sección "Usuarios pendientes" con subscribeUnassignedUsers + botón Asignar |
| `context/AuthContext.tsx` | Modify | Leer users/{uid}.pendingAssignment on auth state change. Exponer needsAssignment |
| `context/CompanyContext.tsx` | Modify | Redirigir a /pending-assignment si needsAssignment |

## Interfaces / Contracts

```typescript
// Modificado: Invitacion sin companyId/companyName/role
export interface Invitacion {
  id?: string;
  email: string;
  status: 'pendiente' | 'aceptada';
  invitedBy: string;
  createdAt: string;
  expiresAt?: string;
  acceptedAt?: string;  // ya existe
  acceptedBy?: string;  // ya existe
}

// Nuevo: perfil de usuario
export interface UserProfile {
  id: string;
  email: string;
  createdAt: string;
  pendingAssignment: boolean;  // default true
}

// API: POST /api/companies/accept-invitation
// Request: { invitationId: string }
// Response: { success: true }
// Efectos: invitation → aceptada, users/{uid} creado con pendingAssignment:true

// API: POST /api/companies/assign-user
// Request: { userId: string, companyId: string, role: 'admin' | 'colaborador' }
// Response: { success: true }
// Efectos: companies/{companyId}/members/{userId} creado, users/{userId}.pendingAssignment = false
```

## AuthContext Extension

```typescript
interface AuthContextValue {
  // ...existing fields
  needsAssignment: boolean;  // true si user existe pero no tiene empresa asignada
}

// En onAuthStateChanged, después de setUser:
if (firebaseUser) {
  const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
  setNeedsAssignment(userDoc.data()?.pendingAssignment ?? false);
}
```

## Navigation Flow Post-Registro

```
register?invite=X ──→ submit ──→ accept-invitation API ──→ /pending-assignment
                                                              │
                                                         user signs out
                                                              │
                                                         /login
                                                              │
                                                         (admin assigns)
                                                              │
                                                         next login ──→ /select-company
```

## Migración

```sql
-- Batch para usuarios existentes con membership
users/{uid} → SET pendingAssignment = false (where exists companies/*/members/{uid})
```

## Implementation Phases

1. **Data model + types**: Modificar Invitacion, agregar UserProfile, pendingAssignment
2. **API routes**: Modificar accept-invitation, crear assign-user
3. **Register page + pending page**: No precargar email, nuevo redirect
4. **AuthContext guard**: Leer pendingAssignment, exponer flag
5. **InvitacionCreateForm**: Simplificar (saco selector empresas/rol)
6. **Configuracion**: Agregar sección usuarios pendientes + modal asignación
7. **CompanyContext**: Honrar needsAssignment redirect
8. **Migración**: Batch set pendingAssignment=false para users existentes con membership
