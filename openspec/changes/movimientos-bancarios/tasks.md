# Tasks: Movimientos Bancarios

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,000–1,200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Foundation) → PR 2 (Parsers) → PR 3 (Pipeline+UI) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation: types, firestore helpers, fixtures, rules | PR 1 | Base = main; ~300 lines |
| 2 | Parsing: bank detection, 3 parsers, reconcile, dedup + tests | PR 2 | Base = main; requires PR 1 types; ~400 lines |
| 3 | Pipeline + UI: orchestration, Datos.tsx expandible, bank modal, button | PR 3 | Base = main; requires PR 2 parsers; ~400 lines |

---

## Phase 1: Foundation

- [x] **1.1** `lib/types.ts`: add `MovimientoBancario`, `MovimientoBancarioInput`, extend `ExtractoEstado` with `'Parseando' | 'Error de parseo'`, add `totalMovimientosParseados?`, `errorParseo?` to `ExtractoBancario`
- [x] **1.2** Create `lib/parsers/types.ts` with `Banco` enum, `ParseContext`, `ParseResult`, `ExtractoParser` interface
- [x] **1.3** Create `lib/parsers/__fixtures__/` with 3 `.txt` files of real extracted PDF text (Bancolombia, Bancoomeva, Global66); verify each is parseable by its parser
- [x] **1.4** Add to `lib/firestore.ts`: `MOVIMIENTOS_COLLECTION`, `subscribeMovimientos()`, `batchAddMovimientos()`, `deleteMovimiento()`, `fetchMovimientoHashes()` — mirror existing `subscribeExtractos` / `addExtracto` pattern
- [x] **1.5** Update `firestore.rules`: add `match /extractos/{extractoId}/movimientos/{doc}` under `companies/{companyId}` with `allow read, write: if isMember(companyId)`
- [x] **1.6** `package.json`: add `pdfjs-dist` dependency; `npm install`

## Phase 2: Pure Logic (each with tests)

- [x] **2.1** `lib/parsers/strategies/bancolombia.ts` + `__tests__/bancolombia.test.ts`: parse `FECHA | D/M` → YYYY-MM-DD (infer year from DESDE/HASTA, handle Dec→Jan cross); `VALOR` sign = debit(neg)/credit(pos); skip `SUCURSAL`, `DCTO.`, `VIGILADO`; tests per spec scenarios
- [x] **2.2** `lib/parsers/strategies/bancoomeva.ts` + `__tests__/bancoomeva.test.ts`: parse `DD-MM-YYYY`; separate `DEBITO`/`CREDITO` columns; regex unstuck `OFICINA+DESCRIPCION`; skip per-page summary blocks; test OFICINA unstick scenario
- [x] **2.3** `lib/parsers/strategies/global66.ts` + `__tests__/global66.test.ts`: pre-merge multi-line amounts (`$2,208,017` + `.00`); normalize `YYYY-MM-DD HH:MM:SS` → YYYY-MM-DD; preserve `horaOriginal`; test multi-line merge scenario
- [x] **2.4** `lib/parsers/reconciliador.ts` + `__tests__/reconciliador.test.ts`: `reconciliar(movs, saldoInicial)` — fill `requiereRevision` per row; test all-ok, one-fails, first-row-fails
- [x] **2.5** `lib/parsers/detectordup.ts` + `__tests__/detectordup.test.ts`: `SHA-256(fecha|descripcion|valor|saldo)` via `SubtleCrypto`; take first 16 bytes as hex; mark `posibleDuplicado`; test collision and no-collision
- [x] **2.6** `lib/parsers/index.ts` + `__tests__/detectarBanco.test.ts`: `detectarBanco(texto)` scanning for `bancolombia.com`, `Bancoomeva`, Global66 column header; `getParser(banco)` factory; test all 3 detections + unknown fallback

## Phase 3: Pipeline + UI

- [x] **3.1** `lib/parsers/parsePipeline.ts`: async pipeline — fetch PDF URL → `pdfjs.getDocument()` → extract text → `detectarBanco` → await user confirm → `getParser().parse()` → `reconciliar()` → `detectarDuplicados()` → `batchAddMovimientos()` → update extracto estado; handle corrupt PDF → `errorParseo`; chunk >500 rows
- [x] **3.2** `components/bancos/MovimientosTable.tsx` + Datos.tsx: expandible extracto row with movimientos table, badges for `requiereRevision` and `posibleDuplicado`, delete-btn per row
- [x] **3.3** `components/bancos/BankConfirmModal.tsx` + Datos.tsx: bank confirmation modal showing detected bank name; fallback dropdown if null; only fires `parsePipeline` on confirm
- [x] **3.4** `components/forms/FormExtracto.tsx`: add "Parsear PDF" / "Volver a parsear" button; loading state; triggers extraction + detection + modal flow

## Phase 4: UX Redesign — drop-zone + split-view parse modal

Motivo: el flujo de creación de extracto en el Sidepanel exponía todos los campos por adelantado y requería un click extra para parsear. Se rediseña a: drop-zone único → auto-parse → modal de confirmación con preview.

- [x] **4.1** `components/Sidepanel.tsx`: extracto "add" mode shows ONLY a drag & drop zone (no Mes/Año/Saldo/Estado fields upfront). On file select (click or drop), auto-detect bank and auto-run parse pipeline (client-side, no manual "extraer datos" click required).
- [x] **4.2** New `components/bancos/ExtractoParseModal.tsx`: split-view modal — left pane: editable data table of extracted header (mes/año/saldoInicial/saldoFinal/banco) + movimientos list (reuse/adapt `MovimientosTable`); right pane: PDF preview via `<iframe>`/`<embed>` over `URL.createObjectURL(file)`. Actions: **Corregir** (re-open bank picker / allow manual edits to header fields), **Guardar** (persist), **Cancelar** (discard, close modal, reset drop-zone).
- [x] **4.3** Add progress reporting to the parse flow: a loading state showing "Procesando X de Y" (pages extracted / movimientos reconciliados). Requires an `onProgress` callback threaded through PDF text extraction loop and reconciliation loop.
- [x] **4.4** On **Guardar** in the modal: save extracto + movimientos (existing `_pendingMovimientos` batch path), then close modal AND close the Sidepanel (call the panel's close/onClose).
- [x] **4.5** Remove/retire the now-unused inline "extraer datos" button + banner flow in Sidepanel's extracto form (superseded by 4.1–4.4). Keep `FormExtractoParseBtn` for the existing Datos.tsx row-level "re-parse" action untouched.
- [x] **4.6** Tests: bank auto-detect on drop, progress callback invocation, modal save closes both modal and panel, cancel resets state without persisting.

---

## Dependencias entre tareas

```
1.1 → 1.2 → 1.4 → 1.5
               ↓
1.3 ─────────→ 2.1  2.2  2.3  2.4  2.5
                ↓    ↓    ↓    ↓    ↓
                2.6 ────────────┘
                ↓
3.1 ─────────────
 ↓    ↓
3.2  3.3  3.4  ← 1.6 (pdfjs-dist needed for pipeline)
```

## Tareas para tests

| Archivo | Fixture | Scenarios |
|---------|---------|-----------|
| `bancolombia.test.ts` | `__fixtures__/bancolombia.txt` | Year inference (no cross), Year inference (Dec→Jan cross), sign detection |
| `bancoomeva.test.ts` | `__fixtures__/bancoomeva.txt` | OFICINA+DESCRIPCION unstick, per-page summary skip |
| `global66.test.ts` | `__fixtures__/global66.txt` | Multi-line amount merge, horaOriginal preservation |
| `reconciliador.test.ts` | Fabricated rows | All reconcile, one fails, first row fails |
| `detectordup.test.ts` | Precomputed hashes | Collision, no collision, empty set |
| `detectarBanco.test.ts` | Fixture substrings | All 3 banks detected, no match, noise tolerance |
