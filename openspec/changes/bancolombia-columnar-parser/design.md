# Bancolombia Columnar Parser — Spec & Design

## Formatos numéricos (de Python `parse_monto`)
El parser debe auto-detectar el formato:

- **en-US**: coma = separador de miles, punto = decimal → `25,906,412.00`
- **es-CO**: punto = separador de miles, coma = decimal → `25.906.412,00`

Regla: si el último separador es una coma → es-CO; si es un punto → en-US.

## Columnar layout (de Python `extract_columnar`)
Una sección columnar se detecta por 4+ fechas consecutivas separadas solo por whitespace:
```regex
\d{1,2}/\d{1,2}\s+\d{1,2}/\d{1,2}\s+\d{1,2}/\d{1,2}\s+\d{1,2}/\d{1,2}
```

En secciones columnares:
1. Extraer N fechas con `\b(\d{1,2}/\d{1,2})\b`
2. Remover fechas del texto, quedan descripciones + números
3. Extraer todos los números del texto restante
4. Primeros N números = VALORES, últimos N números = SALDOS
5. Descripciones: extraer por anclas de palabras clave (ABONO|AJUSTE|COBRO|COMPRA|CUOTA|IMPTO|PAGO|SERVICIO|TRANSFERENCIA|INTERBANC)

## Row-by-row layout
El layout existente (una fecha + descripción + dos números) funciona correctamente para páginas con filas individuales. Se mantiene igual, solo se corrige `parseMonto`.

## Pipeline de parse
```
parse(texto):
  extractDateRange(texto)     — igual
  extractSaldos(texto)        — regex ahora con ambos formatos
  cleanedText = cleanText(texto)
  sections = cleanedText.split('\n\n')
  for section in sections:
    if es columnar → extractColumnar(section)
    else → extractRows(section)  — el mismo row-by-row actual
  validaciones: sort + chain
```

## Cambios al archivo `bancolombia.ts`

### `parseMonto` (función standalone)
- Reemplazar `text.replace(/[$,\s]/g,'')` con auto-detección de formato

### `extractSaldos`
- `num` pattern: `[\d,]+\.\d{2}|[\d.]+\,\d{2}` (ambos formatos)
- Pasar por `parseMonto` reformateado

### `extractColumnar` (nuevo método privado)
- Recibe: section text, year, dateRange
- Retorna: `Omit<MovimientoBancarioInput, 'ordinal'>[]`
- Algoritmo: fechas → números → split valor/saldo → descripciones por ancla

### `parse` (refactor)
- Iterar secciones (`\n\n`), detectar columnar vs row-by-row
- Manejar fechas duplicadas con `seen` Set (fecha+salt)
- Sort final por fecha

### `cleanText`
- Se mantiene igual pero no colapsar `\n\n` — preservar separación de páginas

## Archivos afectados
- `lib/parsers/strategies/bancolombia.ts` — el parser en sí (modificar)
- `lib/parsers/__tests__/bancolombia.test.ts` — tests unitarios (expandir)
