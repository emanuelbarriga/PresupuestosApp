# Estado de Resultados Specification

## Purpose

Profit & Loss statement computing ingresos netos, utilidad bruta, and utilidad neta from Budget/Ejecucion collections. Supports Presupuestado/Ejecutado toggle, year filtering, manual override fields, and Colombian tax calculations (GMF 0.4%, Impuesto SIMPLE 8.1%).

## Requirements

### Requirement: P&L Row Computation (F1–F12)

The system SHALL compute 12 labeled rows per this structure:

| Row | Label | Source |
|-----|-------|--------|
| F1 | Ingresos Brutos | Σ ingresos (all projects, archived excluded) |
| F2 | Devoluciones, rebajas y descuentos | Manual, default $0 |
| F3 | Ingresos Netos | F1 − F2 |
| F4 | Costos de Operación | Σ egresos (non-Admin projects, archived excluded) |
| F5 | Utilidad Bruta | F3 − F4 |
| F6 | Gastos Administrativos | Σ egresos (Admin project, case-insensitive) |
| F7 | Gastos Financieros | Manual, default $0 |
| F8 | GMF (4×1000) | (F4 + F6 + F7) × 0.004 |
| F9 | Utilidad Operacional | F5 − F6 − F7 − F8 |
| F10 | Impuesto SIMPLE (8.1%) | F1 × 0.081 |
| F11 | Descuento Tributario GMF | MIN(F8, F10) |
| F12 | Utilidad Neta | F9 − F10 + F11 |

All monetary values SHALL render in COP format.

#### Scenario: P&L with mixed projects

- GIVEN budgets: "Vivienda" (ingresos $10M, egresos $3M), "Admin" (ingresos $0, egresos $1M), "Comercial" (ingresos $5M, egresos $2M) — none archived
- WHEN P&L computes in Presupuestado view
- THEN F1 = $15M, F4 = $5M, F6 = $1M; F8 = (5M+1M+0)×0.004 = $24,000; F10 = $1,215,000; F11 = $24,000; F12 = $7,785,000

#### Scenario: Manual F2/F7 edits recompute dependents

- GIVEN F2 = $0, F7 = $0
- WHEN user types $500,000 into F2 and $100,000 into F7
- THEN F3, F5, F8, F9, F12 recalculate immediately using edited values

#### Scenario: Admin matched case-insensitively

- GIVEN a project named "ADMIN", "admin", or "Admin" with egresos $2M
- WHEN classifying egresos
- THEN those egresos go to F6 and are excluded from F4

### Requirement: Presupuestado / Ejecutado Toggle

The system SHALL offer two independent views: **Presupuestado** (Budget collection, `fechaPresupuestado`) and **Ejecutado** (Ejecucion collection, `fechaEjecutado`). Toggling SHALL preserve manual F2/F7 values.

#### Scenario: Toggle switches data source

- GIVEN Presupuestado shows F1 = $15M
- WHEN user switches to Ejecutado
- THEN F1/F4/F6 reflect Ejecucion records; manual F2/F7 retain their current values

#### Scenario: Missing fecha field handled gracefully

- GIVEN a budget lacks `fechaPresupuestado`
- WHEN filtering by year
- THEN the document is excluded from that year's aggregation without crashing

### Requirement: Year Filtering

The system SHALL filter by year via `startsWith(year)` on the fecha field. A year selector SHALL default to the current year. Records with `archivado === true` SHALL be excluded from all aggregations.

#### Scenario: Year filter aggregates matching records

- GIVEN budgets for 2025 and 2026
- WHEN selector is "2025"
- THEN only budgets with `fechaPresupuestado` starting "2025" contribute to F1/F4/F6

#### Scenario: No records shows zeroes

- GIVEN no records exist for selected year
- WHEN P&L renders
- THEN all computed rows display $0; view does not crash

### Requirement: Route and Navigation

The system SHALL expose the view at `/{company}/estado-resultados`. The Sidebar SHALL include a "Estado de Resultados" entry with TrendingUp icon.

#### Scenario: Sidebar navigates to P&L

- GIVEN company is "pacora"
- WHEN user clicks "Estado de Resultados" sidebar item
- THEN URL becomes `/pacora/estado-resultados` and the P&L view renders
