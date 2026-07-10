# Tasks: Batch Accept Invitations

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 30–50 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Batch accept invitations + response update | Single PR | Un solo archivo, single commit |

## Phase 1: Core Implementation

- [x] 1.1 Query invitations pendientes del mismo email y batch-acceptarlas — en `app/api/companies/accept-invitation/route.ts`, después de validar la invitación primaria y dentro del mismo `WriteBatch` (antes de `batch.commit()`): query `invitations.where('email', '==', invitation.email).where('status', '==', 'pendiente')`, excluir `invitationId` actual, para cada una validar `expiresAt`, agregar membership y update al batch
- [x] 1.2 Manejar edge cases — skip invitaciones expiradas sin bloquear el batch, usar `set con merge: true` si el usuario ya es miembro, y particionar en batches de 500 si es necesario (improbable pero protect)
- [x] 1.3 Actualizar respuesta — cambiar de `{ companyId, companyName, success }` a `{ companies: [{ companyId, companyName }, ...], success: true }` manteniendo compatibilidad hacia atrás

## Phase 2: Verification

- [x] 2.1 Type-check — `npx tsc --noEmit` sin errores. Smoke test manual con un email que tenga múltiples invitaciones pendientes (verificar que se creen los memberships y se marquen como aceptadas)
