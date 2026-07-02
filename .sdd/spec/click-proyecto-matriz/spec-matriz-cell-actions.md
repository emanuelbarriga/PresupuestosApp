# matriz-cell-actions Specification

## Purpose

Allow users to click on an empty cell in the budget matrix (a month with no budget or ejecucion data for a given project) and open the sidepanel with a creation form, with the project and month pre-filled. This eliminates the need to navigate to a separate data entry screen and replaces the current behavior of opening a useless empty DataPanel.

---

## Requirements

### Requirement: Empty cell opens creation form instead of DataPanel

The system **SHALL** change the click behavior for matrix cells where the value is zero (no data). Instead of opening the `DataPanel` with empty budgets and ejecuciones, the system **SHALL** open the form sidepanel (`FormPanel`) in add mode, prompting the user to create either a new budget or a new ejecucion.

#### Scenario: Click empty ingreso cell

- GIVEN the matrix shows an ingreso section for project "Obras Públicas" in month "Marzo" with value `0` (no data)
- WHEN the user clicks on that empty cell
- THEN the sidepanel opens in form mode
- AND the form type selector allows choosing between "Presupuesto" and "Ejecución"
- AND the "Tipo" switch is pre-set to "Ingreso"
- AND the "Proyecto" field shows "Obras Públicas" pre-filled and read-only
- AND the month field or date field reflects "Marzo"
- AND the DataPanel is NOT opened

#### Scenario: Click empty egreso cell

- GIVEN the matrix shows an egreso section for project "Consultoría" in month "Julio" with value `0`
- WHEN the user clicks on that empty cell
- THEN the "Tipo" switch is pre-set to "Egreso"
- AND the "Proyecto" field shows "Consultoría" pre-filled and read-only

#### Scenario: Cell with data retains existing behavior

- GIVEN a matrix cell has a non-zero value
- WHEN the user clicks on that cell
- THEN the existing DataPanel behavior is preserved (shows budget/ejecucion details for that cell)
- AND the creation form is NOT opened

---

### Requirement: Project and month are pre-filled from cell context

The system **SHALL** pre-fill the creation form with the project name, month, and transaction type (`ingreso`/`egreso`) from the matrix cell context. These fields **SHALL** be read-only to prevent user error.

#### Scenario: Pre-filled fields are read-only

- GIVEN the creation form opened from an empty cell
- THEN the project field shows the project name pre-filled
- AND the month (for budgets) or date range (for ejecuciones) reflects the cell's month
- AND the transaction type switch is pre-set to the matrix section's type
- AND these pre-filled fields are not user-editable

#### Scenario: Month is mapped to date fields

- GIVEN the user selects "Presupuesto" as the form type
- WHEN the form loads
- THEN the "Mes Presupuestado" field is pre-set to the cell's month
- AND the "Fecha del presupuesto" date picker is pre-set to the 1st of that month (YYYY-MM-01)

- GIVEN the user selects "Ejecución" as the form type
- WHEN the form loads
- THEN the "Fecha de ejecución" date picker is pre-set to the current date
- AND the month is implicit from the selected date

---

### Requirement: Form type switch is presented at entry

The system **SHALL** present a clear choice between "Presupuesto" (Budget) and "Ejecución" (Ejecucion) at the top of the form when opened from an empty cell. The form fields **SHALL** dynamically adjust based on the selected type, matching the existing `FormPanel` behavior.

#### Scenario: Budget form selected

- GIVEN the user selects "Presupuesto" from the type switch
- THEN the form shows: Tipo (Ingreso/Egreso), Proyecto, Cliente/Proveedor, Descripción, Monto Presupuestado, Fecha del presupuesto
- AND the "Vincular presupuesto" section is NOT shown
- AND the month is calculated from the date

#### Scenario: Ejecucion form selected

- GIVEN the user selects "Ejecución" from the type switch
- THEN the form shows: Tipo (Ingreso/Egreso), Proyecto, Cliente/Proveedor, Descripción, Monto Ejecutado, Fecha de ejecución, Vincular presupuesto (optional)
- AND the budget link search filters by the pre-filled project

---

### Requirement: Successful creation closes form and refreshes matrix

The system **SHALL** close the sidepanel after successful budget or ejecucion creation. The matrix **SHALL** automatically reflect the new data via the existing Firestore real-time subscriptions.

#### Scenario: Budget created from empty cell

- GIVEN the creation form is open from an empty cell
- WHEN the user fills all required fields and clicks "Crear"
- THEN `addBudget` is called with the form data
- AND the sidepanel closes
- AND the matrix cell updates to show the new budget value (via subscription)

#### Scenario: Ejecucion created from empty cell

- GIVEN the creation form is open from an empty cell
- WHEN the user fills all required fields and clicks "Crear"
- THEN `addEjecucion` is called with the form data
- AND the sidepanel closes
- AND the matrix cell updates to show the new ejecucion value (via subscription)

#### Scenario: Creation fails

- GIVEN the creation form is open
- WHEN the user clicks "Crear" and the Firestore operation fails
- THEN an error message is displayed inline: "Error al guardar"
- AND the form remains open with the entered data preserved
- AND the user can retry or cancel

---

### Requirement: Existing DataPanel for non-empty cells is unchanged

The system **SHALL** NOT modify the existing behavior for non-empty cells. When a cell has budgets or ejecuciones, clicking it **SHALL** continue to open the DataPanel showing the cell's data summary.

#### Scenario: Non-empty cell click

- GIVEN a cell has at least one budget or ejecucion (value !== 0)
- WHEN the user clicks on that cell
- THEN the DataPanel opens showing budgets, ejecuciones, and totals for that project+month
- AND no creation form is presented
