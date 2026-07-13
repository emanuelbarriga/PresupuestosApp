# Archive Report: Integridad de Datos Financieros

> **Change**: `integridad-datos-financieros` · **Archived at**: 2026-07-13 · **Mode**: openspec

## Summary

Unificó todos los caminos de borrado de ejecuciones en `deleteEjecucion` con writeBatch atómico, migró terceros de hard delete a soft delete (archivado), añadió modal de confirmación dinámico con impacto financiero, resolvió cuentaName por suscripción global, y eliminó el borrado físico de budgets de la UI. Se implementaron 8 tareas en 4 PRs stacked-to-main.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `ejecucion-budget-link` | Updated | Added "Cascade Deletion — Budget Reintegration" requirement (2 scenarios) |
| `cuenta-bancaria-ejecucion` | Updated | Replaced "Budget-Ejecucion Link Consistency on Delete" → "Movimiento Reset on Ejecucion Delete" (3 scenarios); added "CuentaName Resolution via Global Subscription" (3 scenarios) |
| `ejecucion-deletion` | Created | Full spec: unified deleteEjecucion with budgetLinks + movimiento reset + dynamic modal |
| `tercero-archiving` | Created | Full spec: soft delete via archivado, guardia de transacciones activas, filtered subscription |

## Tasks Status

| Tarea | Estado | Archivos |
|-------|--------|----------|
| T5 — archivado en Tercero (types.ts) | ✅ Completado | `lib/types.ts` |
| T1 — deleteEjecucion unificada (writeBatch + movimiento reset) | ✅ Completado | `lib/firestore.ts` |
| T4 — deleteTercero soft delete + subscribeTerceros filter | ✅ Completado | `lib/firestore.ts` |
| T3 — ConfirmDeleteModal dinámico | ✅ Completado | `components/entities/ejecucion/ConfirmDeleteModal.tsx` (nuevo) |
| T2 — Reemplazar deleteDoc inline por deleteEjecucion | ✅ Completado | `MovimientoView.tsx`, `Extractos.tsx` |
| T7 — Resolver cuentaName por ID en UI | ✅ Completado | `EjecucionView.tsx`, `EjecucionEntity.tsx` |
| T6 — Banner proyecto fantasma | ✅ Completado | `ProjectView.tsx` |
| T8 — Eliminar botón borrado físico budget | ✅ Completado | `Datos.tsx`, `page.tsx` |
| T9 — Tests (deleteEjecucion, deleteTercero, subscribeTerceros) | ✅ Completado | `firestore.test.ts` |

**8/8 tareas completadas.** Todos los `[x]` marcados en tasks.md.

## Implementation Stats

| Metric | Value |
|--------|-------|
| Tasks implemented | 8 |
| PRs (stacked-to-main) | 4 |
| Files modified | 12 |
| Files created | 1 (`ConfirmDeleteModal.tsx`) |
| Tests passing | 549 (52 files) |
| TypeScript regressions | 0 |

## Out of Scope (confirmed)

- H1 (borrar empresa) — no expuesto en UI
- H5 (deleteCuentaBancaria) — no existe ni se expone
- Migración batch de datos existentes

## Source of Truth Updated

The following main specs now reflect the new behavior:

- `openspec/specs/ejecucion-budget-link/spec.md` — +1 requirement (Cascade Deletion)
- `openspec/specs/cuenta-bancaria-ejecucion/spec.md` — +2 requirements (Movimiento Reset, CuentaName Resolution)
- `openspec/specs/ejecucion-deletion/spec.md` — nuevo (full spec, 161 lines)
- `openspec/specs/tercero-archiving/spec.md` — nuevo (full spec, 140 lines)

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
