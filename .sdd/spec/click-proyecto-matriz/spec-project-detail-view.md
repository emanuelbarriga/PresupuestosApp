# project-detail-view Specification

## Purpose

Allow users to click a project name in the budget matrix and view project details (name, client, budgets, ejecuciones) in the sidepanel, with the ability to change the project state inline. For projects that only exist inferred from budget/ejecucion data (no document in the `projects` subcollection), the system prompts the user to create the project document before enabling state changes.

---

## Requirements

### Requirement: Project name click opens detail sidepanel

The system **SHALL** make project names in the matrix clickable. When clicked, it **SHALL** open the sidepanel with the existing `RecordDetail<'project'>` view showing project name, client, current state (as a badge), and lists of associated budgets and ejecuciones.

#### Scenario: Click project name

- GIVEN the dashboard matrix displays rows grouped by project with the project name visible in the leftmost column
- WHEN the user clicks on a project name
- THEN the sidepanel opens showing the project detail view
- AND the sidepanel displays: project name, client name, current state badge, total budgets count with amounts, total ejecuciones count with amounts

#### Scenario: Project has no associated budgets or ejecuciones

- GIVEN a project exists in the matrix (from the projects subcollection)
- WHEN the user clicks on the project name
- THEN the sidepanel shows the project details
- AND budgets and ejecuciones sections show "Sin datos" or an empty state if none exist

---

### Requirement: Project state is editable from the sidepanel

The system **SHALL** render the project state as a `<select>` dropdown in the project detail sidepanel, populated with all valid `ProjectState` values (`'Activo'`, `'Cerrado'`, `'Negociación'`, `'En ejecución'`, `'Cancelado'`). Changing the dropdown value **SHALL** immediately persist the change via `updateProject(companyId, projectId, { estado })`.

#### Scenario: Change project state via dropdown

- GIVEN the project detail sidepanel is open and the project has a document in the `projects` subcollection
- WHEN the user selects a different state from the dropdown
- THEN `updateProject` is called with the new state
- AND the sidepanel dropdown reflects the new value
- AND the badge in the matrix row updates to reflect the new state (via Firestore real-time subscription)

#### Scenario: State change propagates to all matrix entries

- GIVEN a project state was changed
- WHEN the Firestore snapshot emits the updated document
- THEN all matrix rows referencing that project display the updated state badge
- AND subsequent budget entries for that project carry the new `estadoProyecto`

---

### Requirement: Inferred projects (no document) show creation prompt

The system **SHALL** detect when a project exists in the matrix only because it appears in `budgets[].proyectoAsignado` or `ejecuciones[].proyectoAsignado` but has no corresponding document in `companies/{company}/projects`. In this case, the sidepanel **SHALL** display the project info as read-only and show a prompt to create the project document before enabling state editing.

#### Scenario: Click inferred project name

- GIVEN a project appears in the matrix derived from budgets or ejecuciones data (no doc in `projects` subcollection)
- WHEN the user clicks on the project name
- THEN the sidepanel shows project details read-only
- AND the system displays a prompt: "Este proyecto no tiene un registro. Creá uno para poder cambiar su estado."
- AND a primary action button labeled "Crear proyecto" is shown

#### Scenario: Create inferred project

- GIVEN the user sees the creation prompt for an inferred project in the sidepanel
- WHEN the user clicks "Crear proyecto"
- THEN `addProject` is called with the inferred project name, the associated client name, and default state `'Activo'`
- AND the sidepanel transitions to the editable state view
- AND the dropdown is now enabled for state changes

---

### Requirement: State dropdown reflects server-side validation

The system **SHALL** disable the dropdown and show an error state if the `updateProject` call fails (e.g., network error, permission denied).

#### Scenario: State update fails

- GIVEN the user selected a new state from the dropdown
- WHEN `updateProject` throws or returns an error
- THEN the system shows a toast or inline error: "Error al actualizar el estado"
- AND the dropdown reverts to the previous value

---

### Requirement: Project detail view matches existing RecordDetail type

The system **SHALL** use the existing `RecordDetail<'project'>` type for the project detail sidepanel data, passing `project`, `budgets[]`, and `ejecuciones[]` as currently defined in the type system. No new types are needed.

#### Scenario: RecordDetail structure is preserved

- GIVEN the project detail sidepanel is opened
- THEN the data matches `{ type: 'project', project: Project, budgets: Budget[], ejecuciones: Ejecucion[] }`
- AND budgets are the complete list for that project across all months and types
- AND ejecuciones are the complete list for that project across all months and types
