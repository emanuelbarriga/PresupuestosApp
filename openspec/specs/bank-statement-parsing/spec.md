# Bank Statement Parsing Specification

## Purpose

Parse uploaded PDF bank statements into structured movement rows and persist them in Firestore. Detection by bank signature, deterministic parsing per bank, row-level reconciliation, and deduplication — all client-side, no Cloud Functions, no AI.

## Requirements

### Requirement: Bank Detection

When a user uploads a PDF for parsing, the system SHALL extract its text content and SHALL detect the issuing bank by scanning for known text signatures. The system SHALL present the detected bank to the user for confirmation. If no bank is detected, the system SHALL present a dropdown of known banks. The system SHALL NOT parse the PDF until the user explicitly confirms or selects the bank.

| Signature Target | Detection Pattern | Source |
|-----------------|-------------------|--------|
| Bancolombia | `bancolombia.com` appears anywhere in the text | URL in footer/header |
| Bancoomeva | `Bancoomeva` appears anywhere in the text | Bank name in header |
| Global66 | Title row `Fecha | Descripción | Movimiento | Tarjeta | Débito | Abono | Saldo` | Column headers |

#### Scenario: Bank detected and confirmed

- GIVEN a PDF containing `bancolombia.com` in its text
- WHEN the user uploads it and the system extracts text
- THEN the system shows "Bancolombia" as detected bank and awaits user confirmation
- AND no parsing occurs until the user clicks "Confirmar banco"

#### Scenario: No bank signature found

- GIVEN a PDF whose text contains none of the known signatures
- WHEN the system extracts text
- THEN a dropdown with all known banks is shown
- AND parsing only begins after the user picks a bank and confirms

### Requirement: Deterministic Parsing per Bank

The system SHALL implement a parser per bank (Strategy pattern: `ExtractoParser.parse(text: string): MovimientoBancarioInput[]`). The parser SHALL be selected by the confirmed/selected bank. The parser SHALL handle bank-specific layout as follows:

| Bank | Date Handling | Amount Handling | Column Handling | Special Handling |
|------|--------------|-----------------|-----------------|------------------|
| Bancolombia | `D/M` → infer year from DESDE/HASTA range; detect Dec→Jan cross | Single `VALOR` column, sign indicates debit(neg)/credit(pos) | Skip `SUCURSAL`, `DCTO.` columns; skip marketing disclaimers | Description of literal `"0"` treated as valid move; discard `VIGILADO` watermark noise |
| Bancoomeva | `DD-MM-YYYY` directly parseable | Two columns `VALOR DEBITO` / `VALOR CREDITO` | `OFICINA` + `DESCRIPCION` stuck together → regex anchor on `OFICINA UNICENTRO BOGOTA` | Per-page summary blocks deduplicated before parsing |
| Global66 | `YYYY-MM-DD HH:MM:SS` → normalize to `YYYY-MM-DD` | Amounts split across 2 lines → pre-merge lines before parsing | Column `Tarjeta` included (may be `0.0` or real) | Rows spanning 2 text lines must be joined before field extraction |

#### Scenario: Bancolombia date year inference (no cross)

- GIVEN a Bancolombia PDF with DESDE `2026/01/31` and HASTA `2026/02/28`
- WHEN a movement row has date `2/02`
- THEN the parsed date is `2026-02-02`

#### Scenario: Bancolombia date year inference (Dec→Jan cross)

- GIVEN a Bancolombia PDF with DESDE `2025/12/01` and HASTA `2026/01/15`
- WHEN a movement row has date `5/01` and another has `28/12`
- THEN `5/01` → `2026-01-05` and `28/12` → `2025-12-28`

#### Scenario: Bancoomeva OFICINA+DESCRIPCION unstick

- GIVEN a Bancoomeva extracted line `"OFICINA UNICENTRO BOGOTAN/DND COBRO GMF-PAGO EMANUEL"`
- WHEN parsed by the Bancoomeva parser
- THEN `oficina` is `"OFICINA UNICENTRO BOGOTA"` and `descripcion` starts with `"N/D ND COBRO GMF-PAGO EMANUEL"`

#### Scenario: Global66 multi-line amount merge

- GIVEN two consecutive text lines `"$2,208,017"` and `".00"`
- WHEN the Global66 parser processes them
- THEN they are merged into the single amount value `2208017.00`

### Requirement: Row Reconciliation

After parsing all rows, the system SHALL verify each row by checking `saldo_anterior ± valor == saldo_reportado`. If a row fails this check, the system SHALL set `requiereRevision: true` on that row and SHALL continue processing remaining rows. One failed row SHALL NOT block other rows from persisting.

#### Scenario: All rows reconcile

- GIVEN a parsed extract with 50 rows
- WHEN all 50 rows pass the reconciliation check
- THEN all rows persist with `requiereRevision: false`

#### Scenario: One row fails reconciliation

- GIVEN a parsed extract with 50 rows
- WHEN row 23 fails reconciliation
- THEN row 23 is saved with `requiereRevision: true` and rows 1-22, 24-50 are saved with `requiereRevision: false`

### Requirement: Deduplication

Before persisting, the system SHALL compute a fingerprint per parsed row: `SHA256(fecha + descripcion + valor + saldo)`. If a fingerprint matches an existing `MovimientoBancario` in the same extract's subcollection, the system SHALL mark the incoming row as `posibleDuplicado: true` and SHALL NOT overwrite the existing row. The user SHALL be able to delete duplicate rows from the UI.

#### Scenario: Re-upload detects all duplicates

- GIVEN an extract with 50 already-persisted movements
- WHEN the same PDF is uploaded again
- THEN all 50 incoming rows have `posibleDuplicado: true` and no new documents are written

### Requirement: Persistence

The system SHALL persist parsed movements as documents in the subcollection `companies/{companyId}/cuentasBancarias/{accountId}/extractos/{extractoId}/movimientos/{movimientoId}` using `writeBatch`. A single batch SHALL contain at most 500 operations. The system SHALL expose a Firestore subscription via `onSnapshot` for real-time UI updates.

#### Scenario: Batch write succeeds

- GIVEN 150 parsed movements
- WHEN the batch commits
- THEN all 150 documents are readable from the `movimientos` subcollection

### Requirement: Error Handling

If the PDF cannot be read by `pdfjs-dist` (corrupt, zero pages, zero text extractable), the system SHALL set `extracto.errorParseo` with a user-facing message. The system SHALL NOT crash the UI or block other functionality.

#### Scenario: Corrupt PDF

- GIVEN an uploaded PDF that throws on `pdfjs.getDocument()`
- WHEN the parse pipeline starts
- THEN `extracto.errorParseo` is set to `"No se pudo leer el PDF. Verificá que no esté dañado."` and no movements are written
