# Bank Accounts Specification

## Purpose

Allow users to manage bank accounts and monthly bank statements within the Datos view. Users can register accounts, track balances, upload statements, and mark reconciliation status — all scoped per company.

## Requirements

### Requirement: Type Definitions

The system SHALL define `AccountType` (`'Ahorros' | 'Corriente' | 'Tarjeta de Crédito' | 'Caja Menor / Efectivo'`), `ExtractoEstado` (`'Pendiente' | 'En revisión' | 'Conciliado'`), `CuentaBancaria` (with `saldoInicial`, `saldoActual`, `moneda`, `nombre`, `banco`, `tipo`, `numero`), and `ExtractoBancario` (with `accountId`, `mes`, `anio`, `saldoInicial`, `saldoFinal`, optional `archivo`, and `estado`). The field linking extract to account SHALL be `accountId` (not `cuentaId`) for consistency with `projectId`, `entityId`, `budgetId`.

#### Scenario: New fields type-check correctly

- GIVEN a `CuentaBancaria` object is constructed with all fields
- WHEN it is assigned to a variable typed as `CuentaBancaria`
- THEN TypeScript compiles without errors

#### Scenario: Extracto uses accountId convention

- GIVEN an `ExtractoBancario` is created
- WHEN its account link field is accessed
- THEN the field is named `accountId` and matches the parent `CuentaBancaria.id`

### Requirement: Firestore Subscriptions and Mutations

The system SHALL expose 6 functions in `lib/firestore.ts`: `subscribeCuentasBancarias`, `addCuentaBancaria`, `updateCuentaBancaria`, `subscribeExtractos`, `addExtracto`, `updateExtracto`. Subscriptions SHALL use `onSnapshot` and accept `(companyId, onData, onError)` returning `Unsubscribe`. Mutations SHALL use `addDoc`/`updateDoc` with `serverTimestamp()` on `createdAt`/`updatedAt`. Collections SHALL be `cuentasBancarias` and `extractos` under `companies/{companyId}`.

#### Scenario: Subscription returns real-time updates

- GIVEN `subscribeCuentasBancarias(companyId, onData, onError)` is called
- WHEN a new account document is added to Firestore
- THEN `onData` is invoked with the updated list including the new account

#### Scenario: Add creates document and returns ID

- GIVEN a new `CuentaBancaria` without `id`
- WHEN `addCuentaBancaria(companyId, data)` resolves
- THEN a document is created in `companies/{companyId}/cuentasBancarias/` and the new document ID is returned

#### Scenario: Update preserves unmodified fields

- GIVEN an account has `nombre`, `banco`, and `saldoActual` set
- WHEN `updateCuentaBancaria(companyId, id, { saldoActual: 5000000 })` is called
- THEN only `saldoActual` and `updatedAt` change; `nombre` and `banco` remain untouched

### Requirement: Bancos Tab in Datos Component

The `Datos` component SHALL include `'Bancos'` in the `TabType` union and `tabs` array. When `activeTab === 'Bancos'`, a bancos panel SHALL render with a table of accounts and an "Agregar cuenta" button. Existing tabs SHALL remain unaffected.

#### Scenario: Tab renders accounts table

- GIVEN the subscription returns 3 accounts
- WHEN the user navigates to the "Bancos" tab
- THEN a table with 3 rows is shown, each displaying nombre, banco, tipo, número, and saldo actual

#### Scenario: Empty state is handled

- GIVEN no accounts exist for the current company
- WHEN the Bancos tab renders
- THEN a message indicating no registered accounts is displayed

#### Scenario: Other tabs work unchanged

- GIVEN the user switches to "Bancos" and back to "Presupuestos"
- WHEN the Presupuestos tab re-renders
- THEN the budgets list displays exactly as before

### Requirement: Extractos Display Within Account

Clicking a bank account row SHALL toggle display of its extractos. Each extracto SHALL show mes, anio, saldo inicial, saldo final, estado, and an attach-PDF option. An "Agregar extracto" button SHALL appear within each expanded account.

#### Scenario: Clicking account shows its extractos

- GIVEN an account with 2 extractos in Firestore
- WHEN the user clicks that account row
- THEN both extractos are displayed with their month/year, amounts, and status

#### Scenario: New extract is linked to parent account

- GIVEN the user clicks "Agregar extracto" inside an expanded account
- WHEN the sidepanel form submits
- THEN the new extract document has `accountId` set to the parent account's `id`

### Requirement: Forms via Sidepanel

Add and edit operations for accounts and extractos SHALL use the existing Sidepanel/FormPanel infrastructure, following the same pattern as other Datos tabs. The add-account form SHALL include fields for nombre, banco, tipo, número, moneda, and saldoInicial.

#### Scenario: Add account opens pre-filled form

- GIVEN the user clicks "Agregar cuenta"
- WHEN the sidepanel renders
- THEN it contains empty fields for nombre, banco, tipo, número de cuenta, moneda, and saldo inicial

#### Scenario: Edit account pre-fills existing values

- GIVEN the user triggers edit on an existing account
- WHEN the sidepanel opens
- THEN all fields are populated with the current account values

### Requirement: Firestore Security Rules

The rules SHALL grant read and write access to `companies/{companyId}/cuentasBancarias/{doc}` and `companies/{companyId}/extractos/{doc}`.

#### Scenario: New collections are accessible

- GIVEN the rules are deployed
- WHEN a client reads or writes to `companies/{companyId}/cuentasBancarias/abc123`
- THEN the operation is permitted
