# Budget Date Specification

## Purpose

Budgets must store a sortable year-month identifier alongside the display-only month name to distinguish budgets that span multiple years. The `fechaPresupuestado` field provides this while preserving backward compatibility with the Dashboard via the unchanged `mesPresupuestado` field.

## Requirements

### Requirement: Budget Type Includes fechaPresupuestado

The `Budget` type SHALL include a required `fechaPresupuestado: string` field in `"YYYY-MM"` format (e.g., `"2026-02"`). The existing `mesPresupuestado: Month` field SHALL remain present and populated. Data written without `fechaPresupuestado` SHALL NOT crash the application at runtime.

#### Scenario: New budget document contains both month fields

- GIVEN a new budget is created via the Sidepanel form
- WHEN the document is written to Firestore
- THEN it contains both `mesPresupuestado` (e.g., `"Febrero"`) and `fechaPresupuestado` (e.g., `"2026-02"`)

#### Scenario: Missing fechaPresupuestado handled gracefully

- GIVEN a Firestore document has `mesPresupuestado: "Enero"` but no `fechaPresupuestado`
- WHEN the application reads it into a `Budget` object
- THEN the application SHALL NOT crash; the field MAY default to empty string

### Requirement: Sidepanel Form Stores Year-Month

When the user picks a budget date in the Sidepanel, the system SHALL extract both the Spanish month name (for `mesPresupuestado`) and the `"YYYY-MM"` string (for `fechaPresupuestado`). Editing an existing budget SHALL preserve the previously stored `fechaPresupuestado`.

#### Scenario: New budget saves year-month from date picker

- GIVEN the user selects `"15 Febrero 2026"` in the Sidepanel date picker
- WHEN `handleDateChange` processes the selection
- THEN `fechaPresupuestado` is set to `"2026-02"` AND `mesPresupuestado` is set to `"Febrero"`

#### Scenario: Editing preserves fechaPresupuestado

- GIVEN an existing budget has `fechaPresupuestado: "2026-02"`
- WHEN the user opens the Sidepanel and resubmits without changing the date
- THEN Firestore still contains `fechaPresupuestado: "2026-02"`

### Requirement: Data Migration Backfills Existing Budgets

A one-shot migration script SHALL iterate all `companies/{companyId}/budgets` documents and set `fechaPresupuestado` where missing. The year SHALL be derived from the document's `createdAt` timestamp when available; documents without a reliable `createdAt` SHOULD assume the current year. The script MUST be idempotent.

#### Scenario: Migration uses createdAt for year extraction

- GIVEN a budget with `mesPresupuestado: "Febrero"` and `createdAt` timestamp in January 2026
- WHEN the migration runs
- THEN the document is updated with `fechaPresupuestado: "2026-02"`

#### Scenario: Re-running migration is safe

- GIVEN a budget already has `fechaPresupuestado: "2026-02"`
- WHEN the migration runs again
- THEN the document is unchanged; no duplicate data or errors occur

#### Scenario: Budget without createdAt falls back to current year

- GIVEN a budget with `mesPresupuestado: "Enero"` and no `createdAt` field
- WHEN the migration runs
- THEN `fechaPresupuestado` is set to `"{currentYear}-01"`

### Requirement: Test Fixtures Include fechaPresupuestado

Existing test fixtures that create budgets SHALL include `fechaPresupuestado` with a valid `"YYYY-MM"` value. All existing tests MUST pass after the code change.

#### Scenario: addBudget test fixture includes new field

- GIVEN the test file imports `addBudget` from `lib/firestore.ts`
- WHEN a test calls `addBudget` with fixture data
- THEN the fixture includes `fechaPresupuestado` with a valid `"YYYY-MM"` value

#### Scenario: Full test suite passes

- GIVEN the code changes are implemented and the migration script exists
- WHEN `npm test` is executed
- THEN all tests pass with no regressions
