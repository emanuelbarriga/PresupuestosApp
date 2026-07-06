# Design: Movimientos Bancarios

## Technical Approach

Parseo client-side de extractos PDF a movimientos estructurados en Firestore, usando parsers determinísticos por banco (Strategy/Adapter), reconciliación de saldos fila a fila, y deduplicación por huella criptográfica. Sin Cloud Functions, sin IA. Persistencia batch en subcolección `movimientos` bajo cada extracto.

## Architecture Decisions

### Decision: hash de deduplicación via Web Crypto (SHA-256) vs MD5

| Option | Tradeoff | Decision |
|--------|----------|----------|
| MD5 via librería externa | Dep extra, overhead de bundle | ❌ |
| SHA-256 via `SubtleCrypto` | Nativo en browser, sin dep; usar primeros 16 bytes como huella | ✅ |

**Rationale**: `SubtleCrypto.digest('SHA-256', ...)` está disponible en todos los browsers modernos sin instalar nada. Usar los primeros 16 bytes del hash como huella compacta — colisión virtualmente imposible para ~150 filas.

### Decision: `moneda` heredada de `CuentaBancaria`, no detectada del extracto

**Choice**: Se toma `CuentaBancaria.moneda` como fuente de verdad; `MovimientoBancario.moneda` se replica por denormalización.
**Rationale**: La cuenta ya tiene moneda definida al crearla. El extracto puede no explicitarla en todas las filas (Bancolombia no la muestra por fila). Replicarla en cada movimiento evita joins.

### Decision: `ExtractoEstado` extendido con `'Error de parseo'`

**Choice**: Se añade `'Error de parseo'` al union type.
**Rationale**: El estado actual (`Pendiente | En revisión | Conciliado`) no contempla que el parseo falle (banco no reconocido, texto inesperado). Necesitamos persistir ese estado sin bloquear.

### Decision: `horaOriginal` en Global66 se preserva como string opcional

**Choice**: Se añade `horaOriginal?: string` a `MovimientoBancario` para preservar la hora cuando el banco la provee.
**Rationale**: Global66 incluye `HH:MM:SS` y movimientos intradía del mismo segundo (débito + comisión + IVA) perderían orden si se normaliza solo a fecha. El campo `ordinal` desempata pero `horaOriginal` preserva trazabilidad.

## Data Flow

```
Datos.tsx (tab Bancos → extracto expandido)
  │
  ├─ Usuario hace click "Parsear extracto"
  │     └─ Lazy import('pdfjs-dist') → extrae texto plano
  │
  ├─ detectarBanco(texto) → Banco | null
  │     └─ Modal: "Detectamos {Banco}. ¿Es correcto?"
  │           ├─ Sí → parser.parse(texto, context)
  │           └─ No / No detectado → Dropdown manual → parser.parse(texto, context)
  │
  ├─ parser.parse(texto, { anio }) → MovimientoBancarioInput[]
  │     └─ reconciliador.reconciliar(movs) → setea requiereRevision
  │
  ├─ detectorDuplicados(movs, extractoId, companyId, accountId)
  │     └─ Busca movs existentes por hash → marca posibleDuplicado
  │
  ├─ writeBatch: set() cada movimiento + updateDoc(extracto, metadata)
  │     └─ Si > 500 filas: múltiples batches secuenciales
  │
  └─ subscribeMovimientos(companyId, accountId, extractoId) → tabla en vivo
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/types.ts` | Modify | +`MovimientoBancario`, +`MovimientoBancarioInput`, +`Banco` enum, +`'Error de parseo'` en `ExtractoEstado`, +`ExtractoParser` interface, +`ParseResult` |
| `lib/firestore.ts` | Modify | +const `MOVIMIENTOS_COLLECTION`, +4 funciones (`subscribeMovimientos`, `batchAddMovimientos`, `deleteMovimiento`, `fetchMovimientoHashes`) |
| `lib/parsers/types.ts` | Create | Interfaces comunes: `ExtractoParser`, `ParseResult`, `Banco`, `ParseContext` |
| `lib/parsers/index.ts` | Create | `detectarBanco(texto): Banco \| null`, fábrica `getParser(banco): ExtractoParser`, registro de estrategias |
| `lib/parsers/strategies/bancolombia.ts` | Create | Parser: columnas `FECHA | DESCRIPCIÓN | VALOR | SALDO`, signo en VALOR, año inferido del encabezado |
| `lib/parsers/strategies/bancoomeva.ts` | Create | Parser: columnas `FECHA | DESCRIPCIÓN | DÉBITO | CRÉDITO | SALDO`, regex para columna OFICINA pegada |
| `lib/parsers/strategies/global66.ts` | Create | Parser: columnas `Fecha | Descripción | Débito | Abono | Saldo`, reconstrucción de celdas multi-línea |
| `lib/parsers/reconciliador.ts` | Create | `reconciliar(movs): void` — setea `requiereRevision` por fila |
| `lib/parsers/detectordup.ts` | Create | `detectarDuplicados(movs, hashesExistentes): void` — setea `posibleDuplicado` |
| `components/Datos.tsx` | Modify | +Sección expandible de movimientos por extracto, modal de confirmación de banco, tabla con badges, botones eliminar |
| `components/forms/FormExtracto.tsx` | Modify | +Botón "Parsear PDF" condicional a `estado !== 'Conciliado'` |
| `firestore.rules` | Modify | +`match /extractos/{extractoId}/movimientos/{doc}` bajo scope multi-tenant |
| `package.json` | Modify | +`pdfjs-dist` |

## Interfaces / Contracts

### Nuevos tipos en `lib/parsers/types.ts`

```ts
export enum Banco {
  Bancolombia = 'bancolombia',
  Bancoomeva = 'bancoomeva',
  Global66 = 'global66',
}

export interface ParseContext {
  anio: number;          // año del extracto (para Bancolombia que no trae año en filas)
  moneda: string;        // heredado de CuentaBancaria
  bancoOrigen: Banco;
}

export interface ParseResult {
  movimientos: MovimientoBancarioInput[];
  errores: string[];      // advertencias de parseo, no bloqueantes
}

export interface ExtractoParser {
  readonly banco: Banco;
  parse(texto: string, ctx: ParseContext): ParseResult;
}
```

### Nuevo tipo en `lib/types.ts`

```ts
export interface MovimientoBancario {
  id: string;
  fecha: string;            // YYYY-MM-DD
  horaOriginal?: string;    // HH:MM:SS (solo Global66)
  descripcion: string;
  referencia?: string;
  debito?: number;          // positivo, salida
  credito?: number;         // positivo, entrada
  saldo: number;
  moneda: string;           // denormalizado de CuentaBancaria
  ordinal: number;
  bancoOrigen: Banco;
  requiereRevision?: boolean;
  posibleDuplicado?: boolean;
  hash: string;             // SHA-256 primeros 16 bytes hex
  createdAt: Timestamp;
}

// Input antes de asignar id/createdAt
export type MovimientoBancarioInput = Omit<MovimientoBancario, 'id' | 'createdAt'>;
```

### Extensión de `ExtractoEstado`

```ts
export type ExtractoEstado = 'Pendiente' | 'En revisión' | 'Conciliado' | 'Error de parseo';
```

### Extensiones en `ExtractoBancario` (campos opcionales nuevos)

```ts
// Se añaden a la interfaz existente:
totalMovimientosParseados?: number;
errorParseo?: string;        // mensaje de error si estado = 'Error de parseo'
```

### Funciones Firestore nuevas

```ts
// Suscripción reactiva a movimientos de un extracto
subscribeMovimientos(
  companyId: string, accountId: string, extractoId: string,
  onData: (movs: MovimientoBancario[]) => void,
  onError?: (err: Error) => void
): Unsubscribe;

// Batch persist: writeBatch, máx 500 por batch
batchAddMovimientos(
  companyId: string, accountId: string, extractoId: string,
  movimientos: MovimientoBancarioInput[]
): Promise<void>;

// Eliminar un movimiento individual
deleteMovimiento(
  companyId: string, accountId: string, extractoId: string, movimientoId: string
): Promise<void>;

// Obtener hashes existentes para dedup (solo hashes, no todo el doc)
fetchMovimientoHashes(
  companyId: string, accountId: string, extractoId: string
): Promise<Set<string>>;
```

### Reglas Firestore

```firebase
match /extractos/{extractoId}/movimientos/{doc} {
  allow read, write: if isMember(companyId);
}
```
(Dentro del bloque `match /companies/{companyId}` existente.)

## Reconciliación y Deduplicación

### Algoritmo de reconciliación

```
Para cada movimiento i (ordenado por ordinal):
  Si i == 0:
    Comparar mov[i].saldo con extracto.saldoInicial ± mov[i].valor
  Si i > 0:
    saldoEsperado = mov[i-1].saldo ± mov[i].valor (débito suma, crédito resta)
    si saldoEsperado !== mov[i].saldo → mov[i].requiereRevision = true
```

### Algoritmo de deduplicación

```
hash = SHA-256(`${fecha}|${descripcion}|${valor}|${saldo}`)
  → primeros 16 bytes como hex string (32 chars)
Si hash ∈ Set(hashesExistentes) → posibleDuplicado = true
```

## Firestore Specifics

### Índices

| Colección | Campos | Tipo | Query que soporta |
|-----------|--------|------|-------------------|
| `movimientos` | `fecha ASC, requiereRevision ASC` | Composite | "movs de un mes, revisiones primero" |
| `movimientos` | `posibleDuplicado ASC` | Single | "solo duplicados" |

### Batch writes

- `batchAddMovimientos`: `writeBatch` con `set()` por movimiento + `updateDoc(extracto, { totalMovimientosParseados, estado })`.
- Si `movimientos.length > 500`: dividir en chunks de 500, ejecutar batches secuenciales con `Promise.all` de a uno (respetar el límite de operaciones por commit).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Cada parser por banco con texto real de fixture | Texto extraído de PDFs de ejemplo como string literal, verificar `ParseResult.movimientos` completo |
| Unit | `reconciliador.reconciliar()` con matriz de casos (ok, falla, borde) | Datos fabricados, verificar flags por fila |
| Unit | `detectarBanco()` con textos conocidos y ruido | Banner de Bancolombia, disclaimer de Bancoomeva, header de Global66 |
| Unit | `detectordup` con hashes precomputados | Simular colisión y no-colisión |
| Unit | `batchAddMovimientos` con <500 y >500 filas | Mock `writeBatch`, verificar número de commits |
| Integration | Parseo end-to-end sobre fixtures reales | Extraer texto de PDFs → `detectarBanco` → `parser.parse` → `reconciliador` → `detectordup`, verificar salidas |
| Integration | Firestore flow: mock `addDoc`/`writeBatch`, verificar args | Mismo patrón `vi.mock('firebase/firestore')` que `firestore.test.ts` |

## Migration / Rollout

No se requiere migración de datos. La subcolección `movimientos` se crea bajo demanda al primer batch persist. Los extractos existentes se quedan con `totalMovimientosParseados: undefined`. Rollback: revertir commits de los archivos modificados + eliminar documentos de prueba en `movimientos`.

## Open Questions / PREGUNTAS PENDIENTES

- [ ] **EXTENSIÓN DEL SCOPE**: El diseño asume que `pdfjs-dist` se instala como dependencia runtime y se usa client-side via dynamic import. Esto implica que el bundle del cliente puede crecer ~2-3MB (pdfjs-dist es grande). Alternativa: parsear server-side en una ruta API de Next.js (App Router Route Handler) — pero la decisión cerrada dice "client-side". Si el bundle size es preocupante, necesitamos decidir si aceptamos el peso o reconsideramos server-side. **No la resuelvo porque la decisión cerrada dice client-side**.
- [ ] **FUENTE DE TEXTOS FIXTURE**: Los PDFs de ejemplo referidos en `explore.md` existen en `datos/extractos/ejemplos/` pero no en el repo actual. Los tests unitarios necesitan texto extraído de esos PDFs como string literales o archivos `.txt` de fixture. ¿Se incluyen los PDFs mismos o solo el texto extraído? Asumo texto extraído pre-procesado como fixtures `.txt` en `lib/parsers/__fixtures__/`.
