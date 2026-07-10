# Proposal: Batch Accept Invitations

## Intent

Cuando un admin invita a un mismo email a múltiples empresas, se crean N invitaciones independientes. El usuario invitado debe aceptar cada una por separado — una fricción innecesaria. Este cambio hace que al aceptar **una** invitación, el endpoint acepte automáticamente **todas** las invitaciones pendientes para ese mismo email.

## Scope

### In Scope
- Modificar `POST /api/companies/accept-invitation` para batch-acceptar todas las invitaciones pendientes del mismo email
- Escribir batch Firestore writes: crear memberships + marcar como aceptadas (una por invitación)
- Tests: single-invitation existing scenarios siguen verdes + nuevo escenario batch

### Out of Scope
- Modelo `Invitacion`: sin cambios
- Formulario de creación de invitaciones: sin cambios (sigue creando N docs)
- UI `Configuracion.tsx`: sin cambios (sigue mostrando N filas)
- `subscribeCompanyInvitations` hook: sin cambios
- Eliminar invitaciones ya aceptadas como limpieza (deferred)

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `company-membership`: el requirement "API Route — Accept Invitation" cambia su comportamiento. Ya no acepta solo la invitación solicitada, sino que también busca y acepta todas las invitaciones pendientes para el mismo email en un solo batch.

## Approach

1. En `POST /api/companies/accept-invitation`, después de validar la invitación solicitada (existencia, status pendiente, email match, no expirada):
2. **Query**: `adminDb.collection('invitations').where('email', '==', invitation.email).where('status', '==', 'pendiente').get()`
3. **Batch write**: en el mismo `WriteBatch`, para cada invitación pendiente (incluyendo la solicitada):
   - Crear membership en `companies/{companyId}/members/{uid}`
   - Hacer `update` de la invitación a `status: 'aceptada'`
4. **Commit** el batch atómico
5. El response sigue siendo 200 con `{ companyId, companyName, success: true }` (la primera compañía)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/api/companies/accept-invitation/route.ts` | Modified | Agregar query de invitations pendientes + iterar en batch |
| `openspec/specs/company-membership/spec.md` | Modified | Delta: escenario batch-accept en "API Route — Accept Invitation" |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Batch commit excede el límite de 500 writes de Firestore | Low | Un admin invitando a +500 empresas al mismo email es improbable; documentar límite |
| Una invitación batch tiene email distinto (edge case) | Low | El query filtra por `email` del token, mismo criterio que la invitación original |

## Rollback Plan

Revertir el diff en `app/api/companies/accept-invitation/route.ts` — el endpoint vuelve al comportamiento single-invitation. La data ya escrita (memberships batch) es correcta, no requiere migración inversa.

## Dependencies

None.

## Success Criteria

- [ ] `POST /api/companies/accept-invitation` acepta la invitación solicitada + todas las demás pendientes del mismo email
- [ ] Se crea un membership por cada compañía en el batch
- [ ] Cada invitación se marca como `aceptada`
- [ ] Escenarios existentes (email mismatch, ya aceptada, expirada, no encontrada) siguen funcionando
- [ ] Tests pasan, `npx tsc --noEmit` sin errores
