# Bancolombia Columnar Parser — Archive Report

## Summary
Parser corregido con soporte para layout columnar y formato es-CO. Todos los tests unitarios (31/31) y de integración (7/7) pasan con 0 diferencias contra Python CSV.

## Tests
- **Unitarios**: 31 tests (30 originales + 1 nuevo: bank bug zero keep)
- **Integración**: 7 PDFs, 0 diferencias cada uno

## Files Changed
- `lib/parsers/strategies/bancolombia.ts` — Refactor mayor
- `lib/parsers/__tests__/bancolombia.test.ts` — Tests expandidos

## Mejora vs Estado Anterior
| PDF | Antes (diffs) | Después |
|-----|---------------|---------|
| 202601 | 15 diffs | ✅ 0 |
| 202602 | 46 diffs | ✅ 0 |
| 202603 | 52 diffs | ✅ 0 |
| 202604 | 56 diffs | ✅ 0 |
| 202605 | 83 diffs | ✅ 0 |
| 202606 | 0 (ya funcionaba) | ✅ 0 |
| Junio 02 | 0 (ya funcionaba) | ✅ 0 |

## Cambios principales

1. **parseMonto**: auto-detección es-CO vs en-US (del Python `parse_monto`)
2. **extractSaldos**: regex con ambos formatos numéricos vía `NUM_PATTERN`
3. **extractColumnar**: nuevo método privado que maneja layout columnar (fechas agrupadas → N valores → N saldos → descripciones por anclas)
4. **Parse pipeline**: itera secciones por `\n\n`, detecta columnar vs row-by-row
5. **Expansión de "0"**: columnar expande descripciones con "0" standalone para que coincidan con el conteo de filas
6. **Bank bug fix**: "0" descripción con valor != 0 se conserva (no se saltea)
