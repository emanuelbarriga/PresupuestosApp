# Proposal: Defensive Date Handling in Configuracion

## Intent

`getInvitationStatus` (L186) y el contador de días restantes (L578) asumen que `expiresAt` es siempre un string ISO, pero Firestore puede devolverlo como objeto Timestamp `{ seconds, nanoseconds }`. Ambos crashean (NaN) o producen comportamiento silenciosamente erróneo. Ya existe un helper `toTime` dentro de `aggregatedInvitations` (L153-159) que maneja ambos formatos. Hay que extraerlo y aplicarlo en los 2 puntos frágiles.

## Scope

### In Scope
1. Extraer `toTime` del `useMemo` `aggregatedInvitations` a un helper `toMillis` module-level
2. Reemplazar `new Date(inv.expiresAt).getTime()` en `getInvitationStatus` con `toMillis(inv.expiresAt)`
3. Reemplazar `new Date(inv.expiresAt).getTime()` en el render de días restantes con `toMillis(inv.expiresAt)`
4. Tests unitarios para `toMillis` (string ISO, Timestamp object, null, undefined, valores inválidos)
5. Tests unitarios para `getInvitationStatus` cubriendo todos los formatos de `expiresAt`

### Out of Scope
- Cambiar el tipo TypeScript `Invitacion.expiresAt` (sigue declarado `string | undefined`)
- Migrar strings existentes en Firestore a Timestamps
- Refactor defensivo en otros componentes
- Tests de integración (no se mockea Firestore)

## Capabilities

### New Capabilities
- None — pure refactor, sin nueva capacidad a nivel spec

### Modified Capabilities
- None — sin cambios de comportamiento en la API pública del componente

## Approach

1. Mover `toTime` de `aggregatedInvitations.useMemo` a fuera del componente como `toMillis(v: unknown): number`
2. El helper conserva la lógica actual: `!v → 0`, `typeof v === 'object' && 'seconds' in v → v.seconds * 1000`, else → `new Date(v as string).getTime()`
3. Usar `toMillis` en `getInvitationStatus` y en el JSX de días restantes
4. Eliminar la copia inline de `toTime` del `useMemo`, referenciar el helper compartido
5. Tests en `lib/__tests__/Configuracion-dates.test.ts`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/Configuracion.tsx` | Modified | Extraer `toMillis`, aplicar en 2 puntos frágiles, reusar en `aggregatedInvitations` |
| `lib/__tests__/Configuracion-dates.test.ts` | New | Tests puros (sin React), solo lógica de fechas |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `toTime` ya existe y funciona — refactor es local | Bajo | Misma lógica, extracción pura |
| TypeScript no detecta Timestamp runtime | Bajo | Tests cubren el caso Timestamp explícitamente |

## Rollback Plan

Revertir cambios en `Configuracion.tsx` y eliminar el archivo de test. El helper `toTime` original vuelve a quedar inline dentro del `useMemo`. Sin cambios de datos ni migraciones.

## Dependencies

- Ninguna

## Success Criteria

- [ ] `toMillis(null)` → `0`, `toMillis(undefined)` → `0`
- [ ] `toMillis(isoString)` devuelve timestamp UNIX correcto
- [ ] `toMillis({ seconds: 1_700_000_000, nanoseconds: 0 })` devuelve `1_700_000_000_000`
- [ ] `getInvitationStatus` retorna `'expired'` cuando `expiresAt` es Timestamp anterior a ahora
- [ ] `getInvitationStatus` NO crashea con `expiresAt = undefined`
- [ ] `npx tsc --noEmit` sin errores; `npm test` verde
