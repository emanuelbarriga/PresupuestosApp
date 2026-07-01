# Company Selection Specification

## Purpose

Introduce a company concept to the application so users can switch context between the two companies they manage: **Pácora** and **Samán**. This phase adds the type, context layer, persistence, and sidebar selector. Data filtering by company is explicitly deferred to the Firestore migration.

## Requirements

### Requirement: Company Type and Static Registry

The system SHALL define a `Company` interface with at minimum `id` (string) and `name` (string) fields. The system SHALL provide a static, read-only registry of exactly two companies: Pácora and Samán. The registry MUST be importable from the data layer (`mockData.ts`).

The `Transaction` type MAY include an optional `companyId` field (string). Existing transactions without `companyId` SHALL remain valid and render normally.

#### Scenario: Company registry contains both companies

- GIVEN the application starts
- WHEN a component imports the company registry
- THEN the registry contains exactly 2 entries: `{ id: "pacora", name: "Pácora" }` and `{ id: "saman", name: "Samán" }`

#### Scenario: Transaction without companyId is valid

- GIVEN a `Transaction` object with no `companyId` field
- WHEN the transaction is rendered in any view
- THEN the transaction displays normally without errors

### Requirement: Company Context and Persistence

The system SHALL provide a `CompanyContext` React Context and a `useCompany` hook. The hook MUST expose: `selectedCompany` (current `Company`), `companies` (the full registry), and `setCompany` (setter function).

The system SHALL persist the selected company ID in `localStorage` under a dedicated key. On mount, the hook MUST read from `localStorage`; if no stored value exists or the stored ID is invalid, the system SHALL default to the first company in the registry (Pácora).

A `CompanyProvider` MUST wrap the application component tree so any descendant can call `useCompany` without prop drilling.

#### Scenario: First visit defaults to Pácora

- GIVEN no `localStorage` entry for company selection
- WHEN the app mounts and a component calls `useCompany()`
- THEN `selectedCompany` is `{ id: "pacora", name: "Pácora" }`

#### Scenario: Selection persists across reloads

- GIVEN the user selected Samán via `setCompany`
- WHEN the page is reloaded
- THEN `useCompany().selectedCompany` is `{ id: "saman", name: "Samán" }`

#### Scenario: Invalid stored ID falls back to default

- GIVEN `localStorage` contains an invalid company ID (e.g. `"borondo"`)
- WHEN the app mounts
- THEN `selectedCompany` defaults to Pácora

### Requirement: Company Selector in Sidebar Header

The sidebar header SHALL replace the static logo (the indigo "B" square) with an interactive company selector. When the sidebar is expanded, the selector MUST display the full company name and allow switching via a dropdown or equivalent control. When the sidebar is collapsed, the selector MUST display only the company's first initial (e.g., "P" for Pácora, "S" for Samán).

Changing the selection MUST call `setCompany` from `useCompany`, updating both context and `localStorage`.

The selector MUST NOT alter any existing sidebar functionality (navigation, collapse toggle, view switching).

#### Scenario: Expanded sidebar shows company name and allows switching

- GIVEN the sidebar is expanded and Pácora is selected
- WHEN the user clicks the company selector and chooses Samán
- THEN the selector displays "Samán" and `useCompany().selectedCompany` updates to Samán

#### Scenario: Collapsed sidebar shows company initial

- GIVEN the sidebar is collapsed and Samán is selected
- WHEN the sidebar renders
- THEN the header area displays the letter "S" in the company indicator

#### Scenario: Existing sidebar behavior is preserved

- GIVEN the company selector is rendered
- WHEN the user clicks navigation items or the collapse toggle
- THEN views switch and sidebar collapses/expands exactly as before
