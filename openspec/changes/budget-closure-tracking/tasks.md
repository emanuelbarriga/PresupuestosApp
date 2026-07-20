# Tasks: Budget Closure Tracking (v2)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,000 (impl + tests + scripts) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 (see work units) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Types + addBudgetLink + computeCellState | PR 1 | Foundation; pure logic + validation; ~500 LOC |
| 2 | buildMatrixData + Dashboard 4-color | PR 2 | Depends on PR 1; matrix rendering; ~450 LOC |
| 3 | EjecucionForm + EjecucionView + EstadoResultados toggle | PR 3 | Depends on PR 1; user-facing writes + P&L; ~600 LOC |
| 4 | Sidepanel + ConfirmDeleteModal + deleteEjecucion | PR 4 | Depends on PR 1-2; cascade delete; ~400 LOC |
| 5 | Migration scripts (backfill + revert + acumulado) | PR 5 | Independent; scripts only; ~400 LOC |

## Phase 1: Foundation — Types

- [x] 1.1 RED: extend `lib/__tests__/types-entity.test.ts` asserting `Ejecucion.montoAsignadoAcumulado`, `variacionCambiariaTotal`, link closure fields, `CellStatus`/`CellState` exports (~40 LOC)
- [x] 1.2 GREEN: add fields to `Ejecucion` + `EjecucionBudgetLink` in `lib/types.ts`; export `CellStatus`/`CellState` (~30 LOC). Acceptance: `npx tsc --noEmit` clean, tests pass

## Phase 2: Core Write Logic

- [x] 2.1 RED: failing tests in `lib/__tests__/firestore.test.ts` for `addBudgetLink` — monto<0, sum>TOLERANCIA_TRM, justificacion required, reads `montoAsignadoAcumulado` without collection query (~150 LOC)
- [x] 2.2 GREEN: rewrite `addBudgetLink` in `lib/firestore.ts` per design (transaction reads ejecucion doc, validates + increments) (~80 LOC). Acceptance: all 2.1 tests pass
- [x] 2.3 RED: failing tests in `components/hooks/__tests__/useBudgetMatrix.test.ts` for `computeCellState` — over-run before completed, completed, partial, pending, null-safe fallback (~120 LOC)
- [x] 2.4 GREEN: implement `computeCellState` in `components/hooks/useBudgetMatrix.ts` with corrected order + `tipo_cierre ?? 'parcial'` + `fechaEjecutado` fallback (~50 LOC). Acceptance: 2.3 tests pass

## Phase 3: Matrix + Dashboard

- [ ] 3.1 RED: failing tests for `buildMatrixData` accepting `budgetLinksMap: Map<budgetId, link[]>` and producing CellStates keyed by `fecha_afectacion_presupuestal` (~150 LOC)
- [ ] 3.2 GREEN: extend `buildMatrixData` signature in `components/hooks/useBudgetMatrix.ts` (~60 LOC). Acceptance: 3.1 tests pass, legacy path intact
- [ ] 3.3 RED: failing tests in `components/__tests__/Datos.test.tsx` for 4-color cell rendering (green/amber/red/gray) (~80 LOC)
- [ ] 3.4 GREEN: update `components/Dashboard.tsx` to render `CellState.estado` colors (~80 LOC). Acceptance: visual + tests pass

## Phase 4: Form, View, P&L

- [ ] 4.1 RED: failing tests in `components/entities/ejecucion/EjecucionForm.comprobantes.test.tsx` (or new) — closure fields render, sum validation blocks save, justification dropdown mandatory (~200 LOC)
- [ ] 4.2 GREEN: update `components/entities/ejecucion/EjecucionForm.tsx` — per-link closure fields, `variacionCambiariaTotal` computed on submit, save disabled when `|sum - montoEjecutado| > TOLERANCIA_TRM` (~150 LOC)
- [ ] 4.3 RED: failing tests for `components/entities/ejecucion/EjecucionView.tsx` closure display (~50 LOC)
- [ ] 4.4 GREEN: update EjecucionView showing `tipo_cierre`, `fecha_afectacion`, `variacionCambiariaTotal` (~40 LOC)
- [ ] 4.5 RED: failing tests in `components/__tests__/estado-resultados.test.tsx` — toggle switches aggregation basis between `fecha_banco` and `fecha_afectacion` (~150 LOC)
- [ ] 4.6 GREEN: add `viewMode` toggle + `collectionGroup('budgetLinks')` devengo aggregation in `components/EstadoResultados.tsx` (~120 LOC)

## Phase 5: Sidepanel + Delete Cascade

- [ ] 5.1 RED: failing tests in `components/__tests__/Sidepanel.test.tsx` — same ejecucion appears in multiple months via `linksByMonth` fragments (~120 LOC)
- [ ] 5.2 GREEN: update `components/Sidepanel.tsx` to iterate link fragments per month (~80 LOC)
- [ ] 5.3 RED: failing tests for `ConfirmDeleteModal` closure-impact display (~60 LOC)
- [ ] 5.4 GREEN: update `components/entities/ejecucion/ConfirmDeleteModal.tsx` — display only, no extra writes (~40 LOC)
- [ ] 5.5 RED: failing tests in `lib/__tests__/firestore.test.ts` — `deleteEjecucion` reintegrates montos, removes `linkedEjecuciones`, no fake flags (~100 LOC)
- [ ] 5.6 GREEN: update `deleteEjecucion` in `lib/firestore.ts` per design (~40 LOC). Acceptance: 5.5 tests pass

## Phase 6: Migration Scripts

- [ ] 6.1 RED: failing tests for backfill of `fecha_afectacion_presupuestal` from ejecucion `fechaEjecutado` (~100 LOC)
- [ ] 6.2 GREEN: extend `scripts/reconciliar-budget-links.ts` (~80 LOC)
- [ ] 6.3 RED: failing tests for rollback stripping closure fields + recalculating `totalEjecutado` (~100 LOC)
- [ ] 6.4 GREEN: create `scripts/revert-budget-closure.ts` (~120 LOC)
- [ ] 6.5 RED+GREEN: script + tests setting `montoAsignadoAcumulado = 0` on existing ejecuciones (~140 LOC). Acceptance: dry-run on staging data clean
