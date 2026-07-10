# Bancolombia Columnar Parser — Proposal

## Intent
Corregir el parser `bancolombia.ts` para que maneje correctamente extractos PDF con páginas columnares (formato donde fechas, descripciones, valores y saldos aparecen en columnas separadas en lugar de filas individuales), y para que soporte formato de números es-CO (puntos como separador de miles, coma decimal) además del formato en-US actual.

## Problemática
La integración contra 7 PDFs reales muestra:
- `82900017677_202601`: 11/26 fecha diffs, 13/26 desc diffs, 14/26 valor diffs, 15/26 saldo diffs
- `82900017677_202602`: 17/105 fecha diffs, 40/105 desc diffs, 46/105 valor diffs, 46/26 saldo diffs
- `82900017677_202605`: 42/90 fecha diffs, 72/90 desc diffs, 83/90 valor diffs, 83/90 saldo diffs
- Sólo `Extracto Bancolombia Saman Junio 2026 02.pdf` y `82900022091_202606` tienen 0 diferencias

Los diffs muestran desalineamiento sistemático: descripciones, valores y saldos están corridos entre filas. El Python (`bancolombia.py`) resuelve esto con `extract_columnar()` que procesa páginas donde las fechas están agrupadas, luego descripciones, luego montos.

## Scope
1. Fix `parseMonto()` — auto-detectar formato es-CO vs en-US
2. Fix `extractSaldos()` — regexes que capturen ambos formatos numéricos
3. Agregar `extractColumnar()` — manejar páginas columnares (Python `extract_columnar` equivalent)
4. Mejorar `cleanText()` — preservar la estructura de secciones (separación por `\n\n`) para detectar columnares
5. Integrar detección de layout columnar en `parse()`
6. Tests unitarios: parseMonto ambos formatos, extractSaldos, columnar extraction, row-by-row
7. Ejecutar integración para verificar reducción de diffs
