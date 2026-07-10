# Bancolombia Columnar Parser — Tasks

## T1: Fix `parseMonto` para auto-detectar es-CO y en-US
- [x] **Archivo**: `lib/parsers/strategies/bancolombia.ts` (función standalone)
- **Cambio**: Reemplazar implementación actual con auto-detección
  - Si `s.rfind(',') > s.rfind('.')` → es-CO (reemplazar puntos, cambiar última coma a punto)
  - Si no → en-US (reemplazar comas)
- **Tests**: parseMonto con "25,906,412.00", "25.906.412,00", "-1,478.29", "500.73", "0.00"

## T2: Fix `extractSaldos` para ambos formatos numéricos
- [x] **Archivo**: `lib/parsers/strategies/bancolombia.ts`
- **Cambio**: Usar pattern `[\d,]+\.\d{2}|[\d.]+\,\d{2}` para capturar ambos formatos
- **Tests**: Y-grouping con "SALDO ANTERIOR $ 1,478.29", flat-mode con "$ $ $ $ 1,478.29 140,961,765.20"

## T3: Agregar `extractColumnar` (método privado)
- [x] **Archivo**: `lib/parsers/strategies/bancolombia.ts` (en la clase)
- **Algoritmo**: clon del Python `extract_columnar`
  - Extraer fechas con `\b(\d{1,2}/\d{1,2})\b`
  - Extraer números del texto sin fechas
  - N números → N fechas → split: primeros N = valores, últimos N = saldos
  - Descripciones por anclas de palabras clave
  - Padding si descripciones < N o números < N*2

## T4: Detectar columnar en `parse()` y bifurcar
- [x] **Archivo**: `lib/parsers/strategies/bancolombia.ts`
- **Cambio**: parse() itera secciones por `\n\n`, detecta columnar con regex de 4+ fechas consecutivas
- Columnar → `extractColumnar()`, row-by-row → `extractRows()`
- Set `seen` para dedup (fecha + saldo)

## T5: Tests unitarios para columnares
- [x] **Archivo**: `lib/parsers/__tests__/bancolombia.test.ts`
- Columnar page con fechas agrupadas: 5+ fechas, descripciones, valores, saldos
- Row-by-row existente no se rompe
- Mixed: row-by-row seguido de columnar

## T6: Ejecutar tests de integración
- [x] `npx vitest run lib/parsers/__tests__/bancolombia-integration.test.ts`
- Verificar reducción de diffs contra Python CSV
