# Comprobantes de Ejecucion Specification

> Change: `mejorar-ejecutados` · Capability: `comprobantes-ejecucion` · Date: 2026-07-05

## Purpose

Add mandatory comprobante types to ejecuciones with derived states (Completada, Falta un comprobante, Sin comprobantes) and granularity showing which specific type is missing. The two required comprobante types ("Comprobante de pago" and "Cuenta de Cobro") already exist in `settings.tipoComprobante` (orders 3 and 4 respectively).

## Requirements

### Requirement: Two Required Comprobante Types

The system SHALL require ejecuciones to track two mandatory comprobante types from `settings.tipoComprobante`:

| Order | Name | Code |
|-------|------|------|
| 3 | Comprobante de pago | `falta_pago` |
| 4 | Cuenta de Cobro | `falta_cuenta_cobro` |

Additional comprobantes MAY be uploaded (they are optional and complementary). Only comprobantes whose `tipo` matches one of the required types are considered for state derivation.

#### Scenario: Settings already contain both required types

- GIVEN a company's `settings/tipoComprobante` array
- WHEN the system reads it
- THEN the array contains items with `name: "Comprobante de pago"` (order 3) and `name: "Cuenta de Cobro"` (order 4)

#### Scenario: Optional comprobante does not affect state

- GIVEN an ejecucion with a "Comprobante de pago", a "Cuenta de Cobro", and an additional "Factura" comprobante
- WHEN the state is derived
- THEN the state is "Completada" — the extra comprobante does not change the result

### Requirement: Derived State from Comprobantes

The system SHALL compute the comprobante state at read time using a pure function `derivarEstadoComprobantes(comprobantes, tiposComprobanteSettings)` that returns:

| State | Condition | Granularity |
|-------|-----------|-------------|
| `Completada` | Both required types present | N/A |
| `Falta un comprobante` | Exactly 1 of 2 required types present | `"falta_pago"` or `"falta_cuenta_cobro"` |
| `Sin comprobantes` | 0 of 2 required types present (or empty comprobantes array) | N/A |

This state SHALL NOT be persisted to Firestore — it is derived on each read.

#### Scenario: Completada — both comprobantes present

- GIVEN an ejecucion with comprobantes: `[{ tipo: "Comprobante de pago" }, { tipo: "Cuenta de Cobro" }]`
- WHEN `derivarEstadoComprobantes` is called
- THEN it returns `{ estado: "Completada" }`

#### Scenario: Falta un comprobante — only payment receipt

- GIVEN an ejecucion with comprobantes: `[{ tipo: "Comprobante de pago" }]`
- WHEN `derivarEstadoComprobantes` is called
- THEN it returns `{ estado: "Falta un comprobante", faltante: "falta_cuenta_cobro" }`

#### Scenario: Falta un comprobante — only invoice

- GIVEN an ejecucion with comprobantes: `[{ tipo: "Cuenta de Cobro" }]`
- WHEN `derivarEstadoComprobantes` is called
- THEN it returns `{ estado: "Falta un comprobante", faltante: "falta_pago" }`

#### Scenario: Sin comprobantes — empty array

- GIVEN an ejecucion with `comprobantes: []`
- WHEN `derivarEstadoComprobantes` is called
- THEN it returns `{ estado: "Sin comprobantes" }`

#### Scenario: Sin comprobantes — no required types

- GIVEN an ejecucion with comprobantes: `[{ tipo: "Factura" }]`
- WHEN `derivarEstadoComprobantes` is called
- THEN it returns `{ estado: "Sin comprobantes" }` because none of the required types are present

### Requirement: State Display and Filtering

The UI SHALL display the comprobante state for each ejecucion in the Datos list view with color-coded badges:

| State | Color | Badge text |
|-------|-------|------------|
| Completada | Green | "Completada" |
| Falta un comprobante | Amber | "Falta {faltante}" |
| Sin comprobantes | Gray | "Sin comprobantes" |

When state is "Falta un comprobante", the badge SHALL surface the granularity: "Falta pago" or "Falta cuenta de cobro".

A filter dropdown in Datos SHALL allow filtering by comprobante state with options: Todos, Sin comprobantes, Falta un comprobante, Completada.

#### Scenario: Filter by "Falta un comprobante"

- GIVEN the Datos view displays 10 ejecuciones (3 Completadas, 4 Falta un comprobante, 3 Sin comprobantes)
- WHEN the user selects "Falta un comprobante" in the filter
- THEN only 4 ejecuciones are shown, each with the amber badge showing which comprobante is missing

### Requirement: ComprobanteUploader Support for Required Types

The existing `ComprobanteUploader` component SHALL be extended to accept an optional `requiredTypes` prop. When provided, the component SHALL:
- Mark which types are mandatory (e.g., with a visual indicator like `*`)
- Validate that at least one comprobante exists for each required type
- Show an inline validation error if required types are missing on submit

Comprobantes are NOT mandatory at upload time — the ejecucion can be saved with missing comprobantes. The validation is guidance, not a block.

#### Scenario: Uploader shows required type markers

- GIVEN the user is creating a new ejecucion
- WHEN the ComprobanteUploader renders with `requiredTypes: ["Comprobante de pago", "Cuenta de Cobro"]`
- THEN these two types are visually marked as required in the tipo chips

## Security Rules

The `comprobantes` array is embedded in the `Ejecucion` document. No new security rules are needed for the array itself. Security rules SHALL continue to use:

```javascript
match /companies/{companyId}/ejecuciones/{doc} {
  allow read, write: if isMember(companyId);
}
```

The state derivation function lives entirely on the client — no rules changes needed for state computation.

## Indexes

No new indexes are required. Comprobante state filtering is performed client-side on the already-subscribed `ejecuciones` array. If future requirements add server-side filtering by comprobante state, a composite index on the comprobante array or derived field would be needed — but that is out of scope.

## Query Patterns

| Pattern | Method | Location |
|---------|--------|----------|
| Read ejecuciones with state | `onSnapshot` on `ejecuciones` collection | Client subscribes normally |
| Filter by state | Array filter on subscribed data | `Datos.tsx` — client-side |
| Derive state | `derivarEstadoComprobantes()` pure function | Any component that needs it |

## UI Behavior

- **Badge in Datos.tsx**: each ejecucion row gets a colored badge next to the description showing state + granularity
- **Filter dropdown**: above the ejecuciones table in Datos, a dropdown with 4 options
- **EjecucionView detail**: state shown in the comprobantes section header with granularity text
- **ComprobanteUploader**: visual markers for required types; validation feedback but not blocking
- **Color coding**: green (#22c55e) for Completada, amber (#f59e0b) for Falta, gray (#94a3b8) for Sin comprobantes

## Stories / Scenarios

### Story: Receipt uploaded but invoice missing

Usuario registra un pago de $500k. Sube el "Comprobante de pago" bancario pero no tiene la "Cuenta de Cobro" del proveedor.

- Guarda la ejecución. El badge muestra "Falta cuenta de cobro" en ámbar.
- Una semana después, el proveedor envía la cuenta de cobro.
- Usuario abre la ejecución en el detalle, sube el PDF con tipo "Cuenta de Cobro".
- El badge cambia automáticamente a "Completada" en verde.

### Story: Datos filter finds missing comprobantes

Usuario necesita auditar qué pagos del mes no tienen comprobantes completos.

- En Datos, selecciona filtro "Falta un comprobante".
- Ve 7 ejecuciones con badge ámbar.
- Para cada una, ve exactamente qué falta ("Falta pago" o "Falta cuenta de cobro").
- Puede abrir cada ejecución y subir el comprobante faltante.

## Out of Scope

- Auto-validation at Firestore rules level (state is derived, not stored)
- Sending notifications when comprobantes are missing
- Comprobantes on Budget documents (they live only on Ejecucion)
- Creating the required tipos (they already exist in settings)
- Making comprobantes blocking for ejecucion creation (they remain optional but tracked)
