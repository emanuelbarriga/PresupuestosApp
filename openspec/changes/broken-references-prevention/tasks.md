# Tasks: Broken References Prevention

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~440 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Fase 1 + Fase 4 (firestore.ts internals) — PR 2: Fase 2 + Fase 3 (audit + UI) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Bugfix subscribe + writeBatch refactor | PR 1 | Solo `lib/firestore.ts` + tests |
| 2 | Audit script + UI guarda archivar | PR 2 | Script nuevo + `Datos.tsx` |

---

## Fase 1: Bugfix subscribe hydration

- [x] 1.1 Crear `formatEjecucion(data): Partial<Ejecucion>` en `lib/firestore.ts` con defaults de `_linkedDocumentos: []` y `_estadoComprobantes: ''`
- [x] 1.2 Refactor `subscribeEjecuciones` para usar `formatEjecucion`
- [x] 1.3 Refactor `subscribeEjecucionesWithFilter` para usar `formatEjecucion`
- [x] 1.4 Refactor `subscribeEjecucionesByBudget` para usar `formatEjecucion` en el mapper de `fetchDocsByIds`
- [x] 1.5 Test (RED): test que verifica defaults de formatEjecucion y subscribe hydration
- [x] 1.6 Test (GREEN): verificar que las 3 subscribes retornan ambos campos hidratados

## Fase 2: Audit script

- [x] 2.1 Crear `scripts/audit-broken-references.ts` — CLI con `npx tsx`, dry-run forzado, flag `--json <path>`
- [x] 2.2 Implementar chequeo Budget→Tercero (entityId archivado/inexistente)
- [x] 2.3 Implementar chequeo Ejecucion→Tercero (entityId archivado/inexistente)
- [x] 2.4 Implementar chequeo DocumentoMedio→Tercero (terceroId archivado/inexistente)
- [x] 2.5 Implementar chequeo Proyecto→Tercero (clientId archivado/inexistente)
- [x] 2.6 Test: script corre sin errores con dataset vacío y detecta referencias rotas

## Fase 3: Guarda en UI al archivar tercero

- [x] 3.1 Agregar `countBudgetsByTercero`, `countDocumentosByTercero`, `countProyectosByTercero` en `lib/firestore.ts` (mismo patrón que `countEjecucionesByTercero`)
- [x] 3.2 Modificar `handleDeleteTercero` en `Datos.tsx`: `Promise.all` con 4 queries paralelas, toast con desglose si algún count > 0
- [x] 3.3 Test: mock de 4 count functions verifica desglose en toast

## Fase 4: Refactor deleteBudget a writeBatch

- [x] 4.1 Reemplazar loop `deleteDoc` individual en `deleteBudget` con `writeBatch`, flush cada 400 ops
- [x] 4.2 Test: writeBatch recibe todos los deletes, flush cada 400, commit exactamente una vez

---

**Total: 6 archivos | ~14 tasks | ~440 líneas estimadas**
