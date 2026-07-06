# Exploration: Parseo de movimientos de extractos bancarios (PDF → datos consultables)

## Contexto

La feature `bancos` (ya implementada, ver `openspec/changes/bancos/`) agrega `CuentaBancaria` y
`ExtractoBancario` a `lib/types.ts` y CRUD en `lib/firestore.ts`, pero `ExtractoBancario` solo
guarda metadatos del archivo (`archivo: {url, name, uploadedAt}`), saldo inicial/final y estado.
El proposal original de `bancos` excluyó explícitamente conciliación automatizada, reportes y
vinculación con presupuestos/ejecuciones — este documento NO reabre esas exclusiones, se limita a
evaluar cómo extraer los movimientos línea por línea del PDF.

Esta es una capability nueva y distinta de `bancos`: `movimientos-bancarios`.

## Current State

- `lib/types.ts` (~137-161): `CuentaBancaria`, `ExtractoBancario`, `AccountType`, `ExtractoEstado`.
  `ExtractoEstado = 'Pendiente' | 'En revisión' | 'Conciliado'`.
- `lib/firestore.ts`: colecciones `companies/{companyId}/cuentasBancarias` y `.../extractos`,
  patrón `onSnapshot`/`addDoc`/`updateDoc` con `serverTimestamp`. Sin subcolección de movimientos.
- `firebase.json`: solo declara `firestore` y `storage` — **no hay Cloud Functions en el
  proyecto**. Toda la lógica hoy vive en el cliente (Next.js SPA + Firestore SDK directo).
- No hay ninguna librería de parseo de PDF instalada (`package.json` no referencia `pdf-parse`,
  `pdfjs-dist`, etc.).
- 3 PDFs de ejemplo analizados en `datos/extractos/ejemplos/`, cada uno de un banco/fintech
  distinto, con maquetación propia.

## Análisis por banco

### 1. Bancolombia (`82900017677_202602_4342786396.pdf`)

- **Estructura**: `FECHA | DESCRIPCIÓN | SUCURSAL | DCTO. | VALOR | SALDO`. Una sola columna
  `VALOR` con signo (negativo = cargo/débito, positivo = abono/crédito) — **no** hay columnas
  separadas de débito/crédito.
- **Páginas**: 3. Header de tabla y bloque de identificación de cuenta se repiten en cada página;
  el resumen (`SALDO ANTERIOR`, `TOTAL ABONOS`, `TOTAL CARGOS`, `SALDO ACTUAL`) solo aparece en la
  página 1.
- **Fechas**: formato `D/M` **sin año** (ej. `2/02`) — el año debe inferirse del rango
  `DESDE/HASTA` del encabezado (`2026/01/31` a `2026/02/28`), con cuidado en el borde de mes/año.
- **Montos**: `1,234,567.89` con coma de miles y punto decimal; sin símbolo de moneda en las filas
  (sí en el resumen: `$`). Moneda implícita COP.
- **Saldo**: columna `SALDO` con saldo corriente por fila (running balance) — útil para
  reconciliar/validar el parseo (saldo[i] = saldo[i-1] + valor[i]).
- **Retos particulares**:
  - Filas con descripción literal `"0"` (bug reconocido por el propio banco: *"algunas compras o
    retiros pueden verse con un cero (0)"*) — movimientos válidos con descripción vacía/basura.
  - Texto de marketing/disclaimer intercalado antes de la tabla en la página 1 (imagen, banner,
    aviso) que debe descartarse como ruido.
  - Marca lateral rotada `VIGILADO` (Superintendencia Financiera) que puede interferir si se usa
    extracción posicional por coordenadas.
  - Columnas `SUCURSAL` y `DCTO.` casi siempre vacías, salvo excepciones puntuales.
  - Sin columna de referencia/ID transaccional individual.

### 2. Bancoomeva (`Extracto Bancoomeva Enero  2026.pdf`)

- **Estructura**: `FECHA | OFICINA | DESCRIPCION | VALOR DEBITO | VALOR CREDITO | SALDO`. Sí tiene
  columnas separadas de débito y crédito.
- **Páginas**: 3. El bloque resumen (`SALDO INICIAL`, `RENDIMIENTOS`, `TOTAL DEBITO`,
  `TOTAL CREDITO`, `SALDO FINAL`) se repite en cada página (redundante — no indica corte real de
  datos, hay que deduplicarlo).
- **Fechas**: `DD-MM-YYYY` completo, sin ambigüedad de año.
- **Montos**: prefijo `$` + espacio, coma de miles, punto decimal. Columna moneda explícita en
  encabezado (`MONEDA: Pesos`).
- **Reto particular más importante**: en la extracción de texto plano, la columna `OFICINA`
  (siempre `"OFICINA UNICENTRO BOGOTA"`) y el inicio de `DESCRIPCION` quedan **pegados sin espacio**
  en muchas filas (ej. `"OFICINA UNICENTRO BOGOTAN/DND COBRO GMF-PAGO EMANUEL"`), porque ambas
  columnas están muy próximas en el layout y el extractor de texto no siempre inserta el espacio
  de columna. Un split ingenuo por espacios rompe la fila. Se necesita una regex que ancle el
  patrón fijo `OFICINA UNICENTRO BOGOTA` (o el nombre de oficina que sea) y todo lo que sigue
  tratarlo como inicio de descripción, en vez de confiar en whitespace.
  - Grandes bloques de texto legal/disclaimer repetidos en cada página (pueden confundirse con
    filas de datos si no se filtran por patrón de fecha al inicio de línea).
  - Muchas transacciones son sub-líneas de una misma operación PSE (cobro + GMF + comisión + IVA
    encadenados) — no hay agrupación/relación explícita entre ellas más que la cercanía temporal y
    referencia embebida en el texto (`PSE-2059995393`).

### 3. Global66 (`extracto_movimientos_start=01-05-2026_end=31-05-2026.pdf`)

- No es un banco tradicional sino una fintech/wallet multi-moneda; el usuario la incluye como
  "extracto bancario" igual, así que el diseño debe ser agnóstico a "banco" vs. "cuenta financiera".
- **Estructura**: `Fecha | Descripción | Movimiento (ref) | Tarjeta | Débito | Abono | Saldo` — un
  orden y nombres de columna totalmente distintos a los otros dos bancos.
- **Páginas**: 2, con fila de `Totales` al final.
- **Fechas**: `YYYY-MM-DD HH:MM:SS` — incluye **hora**, a diferencia de los otros dos que solo dan
  fecha. Si se normaliza a fecha sola se pierde el orden intra-día entre movimientos de la misma
  transacción (débito + costo tipo de cambio + comisión ocurren al mismo segundo).
- **Reto particular más importante**: por el ancho de columna angosto, los montos se **envuelven
  en dos líneas dentro de la misma celda** en el texto extraído (ej. `"$2,208,017"` en una línea y
  `".00"` en la siguiente; `"$40,830,09"` + `"2.81"` para el saldo). Un parser por líneas ingenuo
  produce números truncados/incorrectos si no reconstruye la celda multi-línea antes de parsear.
  Esto es más grave que en los otros 2 bancos porque afecta el **valor numérico**, no solo texto
  descriptivo.
  - Columna `Tarjeta` en este extracto siempre `0.0` (aparentemente no aplica al tipo de
    movimiento, pero el nombre de columna sugiere que en otros períodos podría traer datos reales
    de tarjeta — no confirmado con esta única muestra).
  - Solo hay columna `Débito` poblada en este período (todo el extracto es salida de fondos); no
    valida por sí solo el manejo de la columna `Abono`.

### Comparativa rápida

| Aspecto | Bancolombia | Bancoomeva | Global66 |
|---|---|---|---|
| Débito/Crédito | 1 columna con signo | 2 columnas separadas | 2 columnas separadas |
| Fecha | `D/M` sin año | `DD-MM-YYYY` | `YYYY-MM-DD HH:MM:SS` |
| Referencia por fila | No | Parcial (embebida en descripción) | Sí (columna `Movimiento`) |
| Reto dominante | Descripciones `"0"`, ruido de marketing | Columnas pegadas sin espacio | Montos envueltos en 2 líneas |
| Páginas | 3 | 3 | 2 |
| Resumen repetido | Solo pág. 1 | Repetido cada página | Solo al final (Totales) |

## Approaches (estrategias de extracción)

1. **Parseo determinístico de texto plano por línea (regex/heurísticas por banco)** —
   `pdfjs-dist` o `pdf-parse` para extraer texto plano, y un parser dedicado por banco (patrón
   Strategy/Adapter: `interface ExtractoParser { parse(text: string): MovimientoBancario[] }`,
   una implementación por banco seleccionada por algún identificador de `CuentaBancaria.banco`).
   - Pros: sin dependencia externa ni costo por documento, 100% determinístico y testeable
     (fixtures de regresión con los mismos 3 PDFs), no envía datos financieros a terceros, rápido.
   - Cons: frágil ante cualquier cambio de formato del banco (silencioso o con excepción), cada
     banco nuevo = nuevo parser a mano, y ya vimos 2 retos "no triviales" en los ejemplos
     (columnas pegadas en Bancoomeva, montos envueltos en Global66) que exigen heurísticas
     específicas por banco, no un parser genérico.
   - Effort: Medio-Alto (por banco), pero costo marginal ~0 en runtime.

2. **Extracción posicional/por tabla (bounding boxes de texto vía `pdfjs-dist` con coordenadas
   x/y, o librerías de extracción de tablas)** — reconstruir columnas agrupando fragmentos de
   texto por rango de coordenada X y agrupando filas por proximidad de Y, en vez de depender del
   orden lineal del texto extraído.
   - Pros: resolvería de raíz el problema de columnas pegadas (Bancoomeva) y celdas envueltas
     (Global66), porque la posición geométrica no depende de si el extractor de texto insertó o
     no un espacio.
   - Cons: el ecosistema de extracción de tablas por posición es mucho más maduro en Python
     (`camelot`, `tabula-py`) que en Node — en Node hay que construir la lógica de columnas a mano
     sobre `pdfjs-dist` (más trabajo de ingeniería), sigue necesitando un mapeo de rangos de
     columna por banco (config específica), y elementos como la marca de agua rotada `VIGILADO`
     de Bancolombia pueden ensuciar coordenadas si no se filtran por rotación/ángulo del texto.
   - Effort: Alto.

3. **IA multimodal (Gemini vía Firebase AI Logic)** — enviar el PDF como `inlineData` (o por URL
   si supera 20MB) a Gemini con un `responseSchema` estructurado pidiendo directamente
   `MovimientoBancario[]`.
   - Pros: layout-agnóstico — el mismo prompt/schema funciona para los 3 bancos y para bancos
     futuros sin escribir un parser nuevo por banco; maneja de forma nativa columnas pegadas,
     celdas envueltas, ruido de marketing/disclaimers y (a futuro) extractos escaneados como
     imagen que un parser de texto no puede leer en absoluto. Onboarding de un banco nuevo = 0
     código.
   - Cons: costo por documento (llamadas a la API), latencia, riesgo de alucinación en cifras
     financieras (un dígito mal interpretado en un monto es grave y no es un error "silencioso"
     detectable a simple vista), requiere validación posterior (ej. reconciliar
     saldo_inicial + Σ(créditos) − Σ(débitos) == saldo_final), exige App Check para no exponer
     cuota/API a abuso (según `firebase-ai-logic-basics`), y supone enviar estados de cuenta
     financieros completos a un proveedor externo (a evaluar con el usuario si es aceptable para
     este tipo de dato).
   - Effort: Bajo-Medio para el caso feliz, Medio-Alto si se suma la capa de validación necesaria
     para confiar en cifras.

4. **Híbrido (recomendación preliminar, no definitiva): parser determinístico por banco +
   reconciliación automática, con IA como red de contención, no como camino primario.**
   Ejecutar el parser determinístico (opción 1) como estrategia principal, validar cada extracto
   con la regla de reconciliación de saldos; si el parser falla o la reconciliación no cuadra,
   marcar el extracto como `Error de parseo` para revisión manual (posible acción futura: reintentar
   con Gemini como fallback puntual, no como pipeline default). Esto evita el costo y el riesgo de
   alucinación en el camino feliz (que es la mayoría de los casos) y reserva el gasto de IA a los
   casos realmente difíciles.
   - Pros: costo/latencia bajo en el camino feliz, auditable, determinístico donde más importa
     (los números), y aun así con un plan de escape para bancos nuevos o formatos que rompan el
     parser.
   - Cons: más piezas de arquitectura (detección de fallos + fallback), sigue exigiendo el patrón
     Strategy/Adapter por banco para el camino determinístico.

## Modelo de datos de salida (bosquejo, no definitivo)

```ts
interface MovimientoBancario {
  id: string;
  fecha: string;          // ISO YYYY-MM-DD (fecha calendario, normalizada)
  horaOriginal?: string;  // HH:MM:SS si el banco la provee (ej. Global66) — preserva orden intradía
  descripcion: string;    // texto crudo tal cual viene del extracto
  referencia?: string;    // ref/ID de transacción si el banco la expone (Global66 "Movimiento", PSE-xxxx en Bancoomeva)
  sucursal?: string;      // "oficina"/"sucursal" si aplica
  debito?: number;        // salida de fondos (positivo)
  credito?: number;       // entrada de fondos (positivo)
  saldo: number;          // saldo corriente después del movimiento, tal cual reportado por el banco
  moneda: string;         // "COP" por defecto
  ordinal: number;        // orden original dentro del extracto (para desempatar incluso con misma fecha/hora)
  bancoOrigen: string;    // identificador del parser/banco que lo produjo, para trazabilidad
}
```

### Dónde vive en Firestore

`ExtractoBancario` ya existe en `companies/{companyId}/cuentasBancarias/{accountId}/extractos/{extractoId}`.
Dos alternativas:

- **A. Subcolección `movimientos`** bajo cada extracto:
  `.../extractos/{extractoId}/movimientos/{movimientoId}`.
  - Sigue el mismo patrón anidado que el proyecto ya usa (`cuentasBancarias` → `extractos`).
  - Evita por completo el límite de 1MB por documento — el extracto de Bancolombia de un solo mes
    ya trae ~130 filas; cuentas con más movimiento mensual podrían escalar más.
  - Permite `collectionGroup('movimientos')` para consultas transversales (ej. "todos los
    movimientos de una cuenta en un rango de fechas" sin cargar extractos completos).
  - Costo: N escrituras por importación (usar *batched writes*, máx. 500 por batch — un extracto
    típico de ~100-150 filas cabe holgado en un solo batch).
- **B. Array embebido** `ExtractoBancario.movimientos: MovimientoBancario[]`.
  - Más simple de leer (un solo `get()`), pero arriesga el límite de 1MB en cuentas con volumen
    alto, no permite queries por campo dentro del array (Firestore no indexa profundamente
    arrays de objetos para filtros de rango como `fecha between X and Y`), y cualquier cambio
    dispara resincronización de todo el array vía `onSnapshot`.

**Recomendación preliminar**: opción A (subcolección), consistente con el patrón ya usado en el
proyecto y más segura a largo plazo, aunque implica más escrituras en la importación.

## Risks

- El proyecto **no tiene Cloud Functions** hoy (`firebase.json` solo declara `firestore` y
  `storage`); si el parseo (sobre todo la variante con Gemini) debe ejecutarse server-side por
  costo/seguridad de API keys, esto implica introducir Cloud Functions como pieza nueva de
  infraestructura — no es un cambio trivial de alcance.
- Riesgo de alucinación numérica si se usa IA sin una capa de reconciliación de saldos.
- Fragilidad de parsers determinísticos ante rediseños de extracto por parte del banco (sin aviso).
- Sin mecanismo de deduplicación aún definido: re-subir el mismo PDF (o un PDF traslapado en
  fechas) podría duplicar movimientos si no se define una idempotency key (ej. hash de
  `extractoId + ordinal + fecha + monto + descripcion`).
- El campo `ExtractoEstado` actual (`'Pendiente' | 'En revisión' | 'Conciliado'`) no contempla un
  estado de fallo de parseo — probablemente haga falta extenderlo (ej. `'Error de parseo'`).

## Preguntas abiertas para el usuario (antes de `/sdd-propose`)

1. **¿Dónde se dispara el parseo?** ¿Client-side al subir el PDF (simple pero expone cualquier
   librería/API key en el navegador), Cloud Function `onFinalize` de Storage (requiere introducir
   Functions al proyecto), o un script manual/administrativo corrido por el usuario? Esto define
   si "movimientos-bancarios" trae consigo la primera Cloud Function del proyecto.
2. **¿Cuántos bancos más se esperan a futuro?** Si son 3-5 en total, un parser determinístico por
   banco es razonable. Si se prevén muchos bancos/fintechs distintos (o extractos escaneados como
   imagen), la balanza se inclina hacia IA multimodal o un híbrido más agresivo.
3. **¿Es aceptable enviar el contenido de un extracto bancario (datos financieros de la empresa) a
   un proveedor de IA externo (Gemini)** si se elige esa estrategia, o hay una restricción de
   compliance/privacidad que lo descarta de entrada?
4. **¿Qué pasa si el parser falla o detecta que la reconciliación de saldos no cuadra?** ¿Bloquea
   la carga del extracto, lo marca para revisión manual, permite edición manual de movimientos
   en la UI?
5. **¿Se espera deduplicación entre extractos con fechas traslapadas** (ej. si el usuario sube dos
   veces el mismo PDF, o un extracto que se superpone en días con el anterior)?
6. **¿La hora (Global66) importa para el negocio**, o alcanza con normalizar todo a fecha-día como
   hacen los otros dos bancos?

## Ready for Proposal

**Parcial** — hay suficiente evidencia técnica de los 3 formatos y una recomendación preliminar
(estrategia híbrida: parser determinístico por banco + reconciliación de saldos, IA como
contención puntual, no como pipeline default), pero las preguntas 1-3 (dónde corre el parseo, cuántos
bancos se esperan, y si enviar datos a IA externa es aceptable) cambian materialmente el diseño y
deberían resolverse con el usuario antes de escribir el proposal.
