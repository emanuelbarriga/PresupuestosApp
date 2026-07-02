# Detalle Tercero Specification

## Purpose

The Detalle Tercero view exposes the third-party composition of each project's Dashboard totals. Users see budgets and ejecuciones grouped by entityId per project — Presupuestado, Ejecutado, Diferencia — and drill into line-item details.

## Requirements

### Requirement: Dashboard button opens grouped tercero view

The Dashboard MUST render a button opening the grouped tercero view in the sidepanel. The button MUST sit in the header between the mode switch and the Negociación toggle. The button SHOULD be hidden when both filteredBudgets and filteredEjecuciones are empty for the selected year.

#### Scenario: Open tercero view from Dashboard header

- GIVEN the Dashboard displays filtered budgets and ejecuciones for the selected year
- WHEN the user clicks the "Detalle por Tercero" button
- THEN the sidepanel opens with the grouped tercero view using the current filter scope

#### Scenario: Button hidden with empty data

- GIVEN filteredBudgets and filteredEjecuciones for the selected year are both empty
- WHEN the Dashboard renders
- THEN the tercero button MUST NOT be rendered

### Requirement: Group by tercero per project

The system MUST group budgets and ejecuciones by entityId per project using the current year's filtered data. Each group aggregates totalPresupuestado (sum of montoPresupuestado), totalEjecutado (sum of montoEjecutado), and diferencia. Groups where both totals are zero MUST be excluded.

#### Scenario: Aggregate values per tercero group

- GIVEN project P has 2 budgets from tercero A (8M COP total) and 1 from tercero B (3M COP), plus ejecuciones from both
- WHEN the grouped view renders
- THEN tercero A shows totalPresupuestado=8M, totalEjecutado=its ejecuciones sum, diferencia=Ejecutado - Presupuestado
- AND tercero B shows totalPresupuestado=3M with its own aggregates

#### Scenario: Zero-activity tercero omitted

- GIVEN project P has records for tercero C with all-zero or no amounts
- WHEN the grouped view renders
- THEN tercero C MUST NOT appear

### Requirement: Hierarchical project-tercero display

The view MUST render projects as collapsible headers with aggregate totals across all terceros. Nested under each, tercero rows MUST show entityName, totalPresupuestado, totalEjecutado, and diferencia. All amounts MUST use COP currency formatting via formatCurrency.

#### Scenario: Render project header with nested terceros

- GIVEN the grouped view has data for projects P1 and P2, each with multiple terceros
- WHEN the view renders
- THEN each project header shows its name and cross-tercero totals in COP
- AND each tercero row under its project shows the three aggregate columns

#### Scenario: Toggle project collapse

- GIVEN a project header is visible in the grouped view
- WHEN the user clicks the project header
- THEN the nested tercero rows toggle between collapsed and expanded

### Requirement: Drill-down to DataPanel filtered by project+tercero

Clicking a tercero row MUST open the DataPanel with a SidepanelData containing only budgets and ejecuciones matching that projectId AND entityId. The DataPanel MUST support the same edit capabilities as existing drill-downs.

#### Scenario: Click tercero row opens filtered DataPanel

- GIVEN the grouped view displays tercero rows
- WHEN the user clicks a tercero row for entity X in project P
- THEN the sidepanel transitions to DataPanel mode
- AND the DataPanel shows only budgets and ejecuciones where projectId=P and entityId=X

### Requirement: Static data snapshot at open time

The grouped data MUST be captured when the user clicks the Dashboard button. The view MUST NOT reflect real-time data changes while open.

#### Scenario: Data frozen while panel is open

- GIVEN the grouped tercero view is open
- WHEN a new budget matching the current filter scope is added
- THEN the open view MUST NOT update
- AND the user MUST close and re-open to see changes
