# Proposal: Nuevo Flujo de Invitación y Registro

## Intent

El flujo actual de invitación precarga el email en pantalla y auto-asigna empresa + rol al registrarse. Esto permite que terceros usen el mismo enlace, expone el email en dispositivos compartidos, y le quita al admin el control sobre la asignación post-registro. Este cambio separa el registro de la membresía: el usuario solo se registra (sin empresa asignada) y el admin asigna manualmente después.

## Scope

### In Scope
- Invitación: solo email (sin companyId, companyName, role)
- Registro: usuario debe tipear su email, el sistema valida match exacto contra la invitación
- Post-registro: se crea cuenta + documento `/users/{uid}`; NO se crea membership
- Admin: tabla de usuarios muestra alerta "Pendiente de asignar" + UI para asignar empresa/rol
- Auth guard: login normal deshabilitado hasta completar registro vía invitación

### Out of Scope
- Flujo de recuperación de contraseña
- Reenvío de invitaciones (misma invitación expirada)
- Desactivar/baja de usuarios desde UI admin

## Capabilities

### New Capabilities
None — todas las capabilities existen del cambio `autenticacion-usuarios`.

### Modified Capabilities
- `user-auth`: Registration ya NO precarga email, valida match manual contra invitación, soporta Google Auth (mismo email). Login sin invitación deshabilitado hasta completar registro.
- `company-membership`: Invitación simplificada (solo email). Accept-invitation NO crea membership — solo marca invitación como aceptada y crea `/users/{uid}`. Nueva API `assign-user-to-company` para asignación manual del admin.
- `company-selection`: Manejar usuarios sin empresa asignada (redirect condicional). Tabla de usuarios en Configuración con alerta de pending.

## Approach

1. **Invitacion type**: sacar `companyId`, `companyName`, `role`. Agregar `registeredAt` opcional.
2. **createInvitation**: solo recibe email + invitedBy. No escribe company data.
3. **Register page**: input vacío. Usuario escribe email, se valida contra `invitations/{email}` en Firestore. Si no hay match → error. Si hay match → `createUserWithEmailAndPassword` o `GoogleAuthProvider` (mismo email). Post-registro: llama API route que crea `/users/{uid}` + marca invitación `status = 'aceptada'` (sin membership).
4. **AuthContext**: agregar flag `needsAssignment`. Usuarios sin `assignedAt` en `/users/{uid}` no acceden a `/[company]/*`.
5. **Configuracion.tsx**: subscription a `/users` con filtro `status === 'aceptada' && !assignedAt`. Mostrar alerta + dropdown para asignar empresa/rol vía nueva API.
6. **API `assign-user-to-company`**: WriteBatch: crea `/companies/{companyId}/users/{uid}` + actualiza `/users/{uid}/assignedAt`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/types.ts` | Modified | Invitacion: sacar companyId/companyName/role; agregar registeredAt |
| `lib/firestore.ts` | Modified | createInvitation simplificada; agregar assignUserToCompany |
| `components/entities/invitacion/InvitacionCreateForm.tsx` | Modified | Solo email input, sin selector empresa/rol |
| `app/register/page.tsx` | Modified | No precargar email, validar match, no auto-accept |
| `app/api/companies/accept-invitation/route.ts` | Modified | No crear membership, solo user doc + invitation status |
| `app/api/companies/assign-user/route.ts` | New | Asignar usuario a empresa + rol (WriteBatch) |
| `components/Configuracion.tsx` | Modified | Tabla usuarios: alerta pending + UI asignación |
| `context/AuthContext.tsx` | Modified | Flag needsAssignment, bloquear acceso sin empresa |
| `app/select-company/page.tsx` | Modified | Manejar usuarios sin empresa asignada |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Usuarios existentes con membership directa quedan bloqueados por nuevo guard | Medium | Migrar usuarios existentes: agregar `assignedAt` retroactivo en `/users/{uid}` |
| Email spoofing en Google Auth (email diferente al invitado) | Low | Validar `user.email === invitation.email` post-auth en ambos flujos |

## Rollback Plan

- **Revertir types**: git revert `lib/types.ts` para restaurar Invitacion anterior.
- **Revertir API routes**: restaurar `accept-invitation` anterior que creaba membership.
- **Revertir AuthContext**: quitar flag `needsAssignment` — el guard anterior (membership check) sigue funcionando para usuarios con empresa.
- Rolling back es seguro porque los cambios son aditivos: ningún usuario pierde acceso existente, solo se agrega un paso intermedio para nuevos.

## Dependencies

- `firebase-admin` (ya instalado)
- Specs existentes de `autenticacion-usuarios` para `user-auth` y `company-membership`

## Success Criteria

- [ ] Admin invita solo con email (sin empresa/rol)
- [ ] Usuario debe escribir email manualmente para registrarse
- [ ] Email no coincide → enlace inválido, no puede registrarse
- [ ] Post-registro: usuario existe en Firebase Auth + `/users/{uid}`, sin membership
- [ ] Admin ve alerta "Pendiente de asignar" en tabla de usuarios
- [ ] Admin asigna manualmente empresa + rol; usuario accede a `/[company]/*`
- [ ] Login normal (sin invitación) redirige a registro
