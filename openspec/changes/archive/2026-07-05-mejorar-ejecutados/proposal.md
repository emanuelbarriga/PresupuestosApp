# Proposal: Mejorar Ejecutados (N:M + Comprobantes + Banco)

> Phase: propose · Change: `mejorar-ejecutados` · Date: 2026-07-05

## Intent

El modelo actual limita la realidad operativa: una ejecución se vincula a **un** solo presupuesto (`budgetId`), no hay obligatoriedad ni estados sobre comprobantes, y no se registra cuenta bancaria. Necesitamos que la ejecución refleje cómo se pagan las cosas de verdad: un pago que cubre varios presupuestos con monto parcial, que marque si tiene los 2 comprobantes requeridos o cuál falta, y que registre el banco de origen/destino para ingresos y egresos.

## Scope

### In Scope
- Reemplazo de `budgetId` por N:M con **split de monto** vía junction.
- Estados derivados: `Completada`, `Falta un comprobante`, `Sin comprobantes` + granularity (`falta pago` / `falta cuenta de cobro`).
- Filtro de ejecuciones por estado.
- `cuentaId` + `cuentaName` (denormalizado) para ingresos y egresos.
- Borrado de ejecuciones existentes (no migración).

### Out of Scope
- Migración de legacy (se eliminan).
- Comprobantes en presupuestos (viven en la ejecución).
- Crear tipos de comprobante (los 2 ya existen en `settings.tipoComprobante`).
- Extractos bancarios automáticos / conciliación.

## Capabilities

### New Capabilities
- `ejecucion-budget-link`: N:M Budget↔Ejecucion con junction `ejecucionBudgetLinks` y `monto` por vínculo. Reemplaza `budgetId`.
- `comprobantes-ejecucion`: 2 obligatorios en ejecución, estados derivados, granularity, filtrado.
- `cuenta-bancaria-ejecucion`: `Ejecucion.cuentaId` → `cuentasBancarias/{cuentaId}` para ingresos y egresos.

### Modified Capabilities
- None. Specs existentes (`budget-date`, `company-selection`, `firestore-tests`, `sidepanel-testing`) no cambian.

## Approach

- **N:M con split (A2)**: colección `companies/{companyId}/ejecucionBudgetLinks/{id}` con `{ ejecucionId, budgetId, monto }`. Querys bidireccionales. Σ `monto` de links **debe** coincidir con `Ejecucion.montoEjecutado` (validación en cliente + transacción al escribir). Sin migración.
- **Comprobantes (B1)**: función pura `derivarEstadoComprobantes(comprobantes, tiposObligatorios)` → 3 estados; granularity desde `tipo` presente. Tipos requeridos ya en `settings.tipoComprobante` (order 3 y 4). Filtro por estado en `Datos.tsx`.
- **Banco (C1)**: `cuentaId?` + `cuentaName?` (patrón `entityId/entityName`). `SearchableSelect` con `subscribeCuentasBancarias` en form. Storage reutiliza path `/{company}/ejecuciones/{ejecucionId}/{uuid}-{filename}`.

## Affected Areas

| Area | Impact |
|------|--------|
| `lib/types.ts` | Pierde `budgetId`, gana `cuentaId/cuentaName`; tipo `EjecucionBudgetLink`; helpers estado. |
| `lib/firestore.ts` | CRUD de links, queries bidireccionales, transacción consistencia. |
| `components/Sidepanel.tsx` | Form multi-presupuesto + banco; `EjecucionView` estados + links; `ComprobanteUploader` validación. |
| `components/Datos.tsx` | Badges estado, filtro, indicador cuenta. |
| `app/[company]/[[...segments]]/page.tsx` + `firestore.rules` + Tests | Persistir links + cuentaId; reglas `ejecucionBudgetLinks`; factories sin `budgetId`. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Excede budget 400 líneas | High | Chained PRs (ask-always); ~3 PRs por capability. |
| Composite indexes Firestore | Med | `firestore.indexes.json` + documentar. |
| Σ links ≠ `montoEjecutado` | Med | Transacción al escribir + validación cliente. |
| Doble conteo agregación por presupuesto | Med | Usar Σ `monto` de links, no `montoEjecutado`. |

## Rollback Plan

Revertir PRs en orden inverso (cuenta-bancaria → comprobantes → junction); restaurar `Ejecucion.budgetId` desde git; `firestore.rules`/`indexes.json` se revierten con cada PR.

## Dependencies

- Tipos `Comprobante de pago` (order 3) y `Cuenta de Cobro` (order 4) ya en `settings.tipoComprobante`.
- Colección `cuentasBancarias` ya existe. Storage path ya usado por `lib/fileUpload.ts`.

## Success Criteria

- [ ] Ejecución se vincula a N presupuestos con monto parcial; Σ montos = `montoEjecutado`.
- [ ] Estado de comprobantes correcto (3 estados + granularity) según `tipo` presente.
- [ ] Filtro por estado funciona en `Datos.tsx`.
- [ ] Ejecución (ingreso o egreso) asocia cuenta bancaria y muestra nombre.
- [ ] Querys bidireccionales (presupuesto↔ejecución) en tiempo real.
- [ ] Tests cubren `derivarEstadoComprobantes`, junction, filtro, selector de cuenta.
- [ ] `firestore.rules` protege `ejecucionBudgetLinks` por company; no quedan refs a `Ejecucion.budgetId`.

## No Migration (explicit)

Las ejecuciones existentes **se borran**, no se migran. El modelo `budgetId: string` se reemplaza directamente por el N:M con junction. Sin backward-compat. Confirmado por el usuario.
