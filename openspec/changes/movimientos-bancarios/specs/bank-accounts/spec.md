# Delta for bank-accounts

## ADDED Requirements

### Requirement: Extracto Status Extensions

The system SHALL add `errorParseo?: string` and `totalMovimientosParseados?: number` to `ExtractoBancario`. The `ExtractoEstado` union SHALL be extended with `'Parseando'` (before `'Pendiente'` in the lifecycle, transitions to `'Pendiente'` on success or `'En revisión'` on partial). The `parseo` state machine: `Parseando → Pendiente | En revisión | Error de parseo`.

#### Scenario: Successful parse transitions state

- GIVEN an extract in state `'Parseando'` with a PDF attached
- WHEN parsing completes with all rows reconciled
- THEN `estado` becomes `'Pendiente'` and `totalMovimientosParseados` is set to the count of persisted rows

#### Scenario: Partial parse sets revision status

- GIVEN an extract in state `'Parseando'`
- WHEN parsing completes with some rows having `requiereRevision: true`
- THEN `estado` becomes `'En revisión'` with `totalMovimientosParseados` counting all persisted rows

#### Scenario: Parse error sets errorParseo

- GIVEN a corrupt PDF
- WHEN parsing fails
- THEN `estado` remains `'Parseando'` and `errorParseo` contains the error message

### Requirement: Upload Triggers Parse Pipeline

When a user saves an `ExtractoBancario` with an `archivo.url` set, the system SHALL automatically start the parse pipeline: extract text from the PDF URL → run bank detection → prompt user confirmation → parse → reconcile → deduplicate → batch-write. The pipeline SHALL run client-side after the `addDoc`/`updateDoc` resolves.

#### Scenario: Upload then auto-parse flow

- GIVEN the user fills the extract form and attaches a PDF
- WHEN they save the extract
- THEN the extract document is created with `estado: 'Parseando'` and `totalMovimientosParseados: null`
- AND the parse pipeline starts showing a loading indicator

#### Scenario: Parse progress visible in UI

- GIVEN an extract in `'Parseando'` state
- WHEN the Bancos tab renders
- THEN the extract shows a spinner/badge next to its status
