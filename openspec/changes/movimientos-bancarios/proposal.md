# Proposal: Movimientos Bancarios

## Intent

`ExtractoBancario` solo guarda metadata del PDF, sin movimientos. Parsear el PDF en filas estructuradas y consultables en Firestore, client-side y determinístico (sin Cloud Functions, sin IA).

## Scope

### In Scope
- Parsers determinísticos por banco (Bancolombia, Bancoomeva, Global66), patrón Strategy/Adapter.
- Detección de banco por firma de texto con confirmación del usuario; fallback manual.
- Reconciliación fila a fila (`saldo_anterior ± valor == saldo_reportado`) → `requiereRevision`, sin bloquear el resto.
- Deduplicación por huella (fecha+descripción+valor+saldo) → `posibleDuplicado`, eliminación manual.
- Subcolección `movimientos` bajo cada extracto; extensión de `lib/types.ts`, `lib/firestore.ts`, `components/Datos.tsx`.

### Out of Scope
- Cloud Functions, parseo server-side, IA/Gemini.
- Extractos escaneados como imagen.
- Conciliación, reportes, dashboards (ya excluidos en `bancos`).
- Bancos adicionales a los 3 analizados.

## Capabilities

### New Capabilities
- `bank-statement-parsing`: detección de banco, parseo PDF→movimientos, reconciliación, duplicados.

### Modified Capabilities
- `bank-accounts`: `ExtractoBancario` gana estado de error de parseo; carga dispara parseo automático.

## Approach

1. Extraer texto del PDF (`pdfjs-dist`); `detectarBanco(texto)` aplica las 3 firmas, usuario confirma/corrige.
2. `ExtractoParser { parse(texto): MovimientoBancarioInput[] }`, implementación por banco en `lib/parsers/` (años por rango en Bancolombia, regex ancla en Bancoomeva, celdas multilínea en Global66).
3. Reconciliar saldo fila a fila → `requiereRevision`; deduplicar por huella → `posibleDuplicado`.
4. Persistir en batch (`writeBatch`, máx. 500) en subcolección `movimientos`.
5. UI en `Datos.tsx`: confirmación de banco, tabla con badges, eliminar duplicados.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/types.ts` | Modified | `MovimientoBancario`, extiende `ExtractoEstado` |
| `lib/firestore.ts` | Modified | Subscribe/batch-add/delete `movimientos` |
| `lib/parsers/` (nuevo) | New | `ExtractoParser`, `detectarBanco`, reconciliación, dedup |
| `components/Datos.tsx` | Modified | Confirmación, tabla, revisión |
| `package.json` | Modified | `pdfjs-dist` |
| `firestore.rules` | Modified | Reglas `movimientos` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rediseño de formato rompe parser | Medium | Reconciliación detecta desalineación; fixtures de regresión |
| Banco no reconocido | Medium | Fallback de selección manual |
| Duplicados por re-subida/solape | Medium | Huella por fila, eliminación manual |
| Volumen de escritura (~150 filas) | Low | `writeBatch` (máx. 500) |

## Rollback Plan

Revert de commits en `lib/types.ts`, `lib/firestore.ts`, `lib/parsers/`, `components/Datos.tsx`, `firestore.rules`, `package.json`. `movimientos` es aditiva; datos ya escritos quedan inertes.

## Dependencies

- `pdfjs-dist`. Sin Cloud Functions ni IA externa.

## Success Criteria

- [ ] Los 3 PDFs de ejemplo parsean end-to-end con fixtures de regresión
- [ ] Banco detectado siempre se confirma; fallback manual funcional
- [ ] Filas no reconciliadas: `requiereRevision`, sin bloquear el resto
- [ ] Duplicados se detectan y eliminan manualmente
- [ ] Movimientos persisten en `.../movimientos` con `onSnapshot`
- [ ] `npm test` y `npm run lint` pasan
