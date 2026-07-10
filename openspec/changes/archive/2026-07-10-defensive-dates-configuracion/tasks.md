# Tasks: Defensive Dates — Configuracion

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~80–120 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Helper + tests + apply to fragile spots | PR 1 | Single PR. Well under 400 lines. |

## Phase 1: Foundation — Helper Extraction + RED Tests

- [x] 1.1 Crear `lib/__tests__/Configuracion.test.ts` con tests ROJOS para `toMillis`: string ISO → timestamp, `{seconds, nanoseconds}` → timestamp, `null` → 0, `undefined` → 0, valor inválido → NaN. Verificar que fallen antes de implementar.
- [x] 1.2 Crear y exportar `toMillis(v: unknown): number` como helper module-level en `components/Configuracion.tsx` (o archivo separado si aplica). Misma lógica que el `toTime` inline actual.
- [x] 1.3 Reemplazar `toTime` inline dentro de `aggregatedInvitations.useMemo` con el nuevo `toMillis` importado. Tests 1.1 ahora pasan.

## Phase 2: Core Implementation — Blindar Puntos Frágiles

- [x] 2.1 Reemplazar `new Date(inv.expiresAt).getTime()` en `getInvitationStatus` (L186) con `toMillis(inv.expiresAt)`.
- [x] 2.2 Reemplazar `new Date(inv.expiresAt).getTime()` en el render de días restantes (L578) con `toMillis(inv.expiresAt)`. Considerar borde: si `toMillis` retorna 0, `Math.ceil((0 - Date.now()) / ...)` da negativo — decidir si mostrar `0d` o no renderizar.

## Phase 3: Verification

- [x] 3.1 `npx tsc --noEmit` sin errores nuevos (3 errores pre-existentes no relacionados).
- [x] 3.2 `npm test` — tests nuevos pasan (5/5). Fallas pre-existentes no relacionadas.
- [x] 3.3 Build compila exitosamente (`.nft.json` error pre-existente de deploy trace).
