# Exploration: Mejorar Ejecutados (N:M + Comprobantes obligatorios + Banco)

> Phase: explore · Change: `mejorar-ejecutados` · Date: 2026-07-05
> Scope: EXPLORATION ONLY — no app code modified. Findings + tradeoffs + open questions.

## Current State

### 1. Relación Budget ↔ Ejecucion hoy: **1:N (no N:M)**

El modelo actual vive en `lib/types.ts` y `lib/firestore.ts`:

- `Ejecucion.budgetId?: string` — un **único** enlace opcional a un Budget (`lib/types.ts:117`).
- `Budget` **NO** tiene referencia a ejecuciones; la relación se **deriva** filtrando `ejecuciones.filter(e => e.budgetId === b.id)` (`components/Datos.tsx:383-384`, `components/Sidepanel.tsx:2700`).

Esto significa:
- **1 Budget → N Ejecuciones**: ya soportado (vía filter por `budgetId`).
- **1 Ejecucion → 1 Budget**: el límite real. Una ejecución **no puede** vincularse a varios presupuestos. **Este es el gap principal.**

UI del enlace:
- Formulario "Nueva ejecución": `SearchableSelect` "Vincular presupuesto (opcional)" en `components/Sidepanel.tsx:1450`. Al elegir, copia `projectId/entityId/tipo` del budget.
- Vista de detalle `EjecucionView` (`Sidepanel.tsx:2358+`): muestra el presupuesto vinculado y permite enlazar/desenlazar vía `updateEjecucion({ budgetId })` (`Sidepanel.tsx:2377-2381`).

**CRÍTICO — Cómo se calculan los totales**: En `Dashboard.tsx` y `Datos.tsx`, los totales se calculan agregando `e.montoEjecutado` por `projectId` + `tipo` + mes — **NO** por `budgetId`. El `budgetId` se usa **solo para display de enlace**, no para totales de proyecto/tercero. Por tanto, pasar a N:M **no rompe los totales globales** siempre que no se introduzcan montos parciales (split). Sí afecta el "ejecutado por presupuesto" a nivel de detalle.

### 2. Comprobantes hoy: **infraestructura EXISTE, falta obligatoriedad + estados derivados**

Ya implementado (change `comprobantes-ejecutado`, código presente):

- `Comprobante` interface con `tipo?: string` (`lib/types.ts:39-49`).
- `comprobantes: Comprobante[]` embebido en `Ejecucion` (`lib/types.ts:118`).
- `ComprobanteUploader` (`Sidepanel.tsx:2120`) con selección de `tipo` via chips desde `settings.tipoComprobante`.
- `lib/fileUpload.ts`: upload a Storage path `{companyId}/ejecuciones/{ejecucionId}/{uuid}-{name}`, validate (PDF/JPG/PNG, 5MB), delete.
- `settings.tipoComprobante` en `SettingsCategorias` (`lib/types.ts:14`), seed: **Factura, Recibo, Transferencia, Efectivo** (`scripts/seed.ts:78-83`).

**Falta (lo que pide el usuario)**:
- Mínimo 2 comprobantes obligatorios: **Cuenta de cobro** + **Comprobante de pago**. Hoy no hay validación de mínimo ni de tipos requeridos.
- Estados derivados: **"falta factura"** (solo pago), **"falta pago"** (solo factura), **"completo"** (ambos). Hoy no existe ningún campo de estado de comprobantes.
- Los tipos del seed **no coinciden** con la terminología del usuario ("Cuenta de cobro", "Comprobante de pago").

### 3. Banco/Cuenta bancaria hoy: **modelo EXISTE, falta enlace a Ejecucion**

Ya implementado (change `bancos`, código presente):

- `CuentaBancaria` interface completa: `banco, tipo (AccountType), numero, moneda, saldoInicial, saldoActual` (`lib/types.ts:125-134`).
- Firestore: `subscribeCuentasBancarias`, `addCuentaBancaria`, `updateCuentaBancaria` (`lib/firestore.ts:327-383`).
- Tab "Bancos" en `Datos.tsx` (`TabType` incluye `'Bancos'`, `Datos.tsx:11,28,552+`).
- `firestore.rules` para `cuentasBancarias` y `extractos` (`firestore.rules:39-40`).

**Falta**: `Ejecucion` **NO** tiene `cuentaId` ni referencia a cuenta bancaria (confirmado: grep `cuentaId|accountId` en `Ejecucion` no encuentra nada). La propuesta `bancos` **explícitamente** dejó fuera "Vinculación automática de extractos con presupuestos o ejecuciones" (Out of Scope). Este cambio cubre exactamente ese enlace para ejecuciones.

## Affected Areas

- `lib/types.ts` — `Ejecucion` (N:M + cuentaId + estado comprobantes), posiblemente `Comprobante` (rol obligatorio), `SettingsItem` (flag obligatorio).
- `lib/firestore.ts` — `subscribeEjecuciones` deserialización (nuevos campos), posibles queries `array-contains`.
- `components/Sidepanel.tsx` — formulario ejecución (selector banco + multi-presupuesto + validación mínimos), `EjecucionView` (mostrar estado + presupuestos vinculados), `ComprobanteUploader` (validación tipos obligatorios).
- `components/Datos.tsx` — badges/estado de comprobantes en lista de ejecuciones, posible indicador de cuenta.
- `components/Dashboard.tsx` — si se introduce split-amount, afecta agregación por presupuesto (no por proyecto).
- `app/[company]/[[...segments]]/page.tsx` — `handleFormSubmit` para persistir nuevos campos.
- `firestore.rules` — sin cambios funcionales (cuentasBancarias ya tiene reglas); posiblemente reglas si se usa subcolección de links.
- `scripts/seed.ts` — añadir tipos "Cuenta de cobro" y "Comprobante de pago".
- Tests: `components/__tests__/Sidepanel.test.tsx`, `Datos.test.tsx`, `lib/__tests__/firestore.test.ts` — factories `makeEjecucion` usan `budgetId` y `comprobantes: []`.

## Approaches

### A. N:M presupuestados ↔ ejecutados

#### A1. Array de IDs en Ejecucion (`budgetIds: string[]` reemplazando `budgetId`)
- **Pros**: Simple, sin colección nueva, lee en un solo doc, migración trivial (`budgetId` → `budgetIds: [budgetId]`), coherente con patrón de arrays embebidos del codebase.
- **Cons**: Query "qué ejecuciones tocan el presupuesto X" requiere `where('budgetIds', 'array-contains', budgetId)` (composite indexes al combinar con otros filtros); **no permite metadata por enlace** (monto parcial, fecha de imputación).
- **Esfuerzo**: Bajo-Medio.

#### A2. Subcolección junction `companies/{companyId}/ejecucionBudgetLinks/{id}` con `{ budgetId, ejecucionId, monto?: number }`
- **Pros**: N:M puro, soporta **montos parciales** (split) por enlace, queryable desde ambos lados, metadata por enlace.
- **Cons**: Colección extra, lecturas extra, escrituras complejas (transacción para consistencia al crear/editar/eliminar), migración más pesada.
- **Esfuerzo**: Alto.

#### A3. Subcolección dentro de ejecucion `companies/{companyId}/ejecuciones/{ejId}/budgetLinks/{budgetId}`
- **Pros**: Jerárquico, los enlaces viven con la ejecución.
- **Cons**: Query "todas las ejecuciones de un presupuesto X" requiere `collectionGroup` (más costoso y complejo), inconsistente con el patrón plano actual.
- **Esfuerzo**: Medio-Alto.

#### A4. Híbrido: mantener `budgetId` single + añadir `secondaryBudgetIds: string[]`
- **Pros**: Backward compatible, cambio mínimo.
- **Cons**: Dos campos para el mismo concepto, confuso, lógica duplicada en UI/queries.
- **Esfuerzo**: Bajo.

**Recomendación preliminar**: **A1** (array de IDs) para v1, salvo que el usuario requiera **split de monto** por presupuesto — en cuyo caso **A2** (junction con monto). Decisión pendiente de la pregunta abierta #1.

### B. Comprobantes obligatorios + estados derivados

#### B1. Extender `tipoComprobante` en settings + flag `obligatorio` + derivar estado
- **Cómo**: Añadir 2 tipos al seed ("Cuenta de cobro", "Comprobante de pago") con `obligatorio: true` en `SettingsItem`. Función pura `derivarEstadoComprobantes(comprobantes, tiposObligatorios)` → `'falta factura' | 'falta pago' | 'completo' | 'sin comprobantes'`.
- **Pros**: Reusa infraestructura existente (tipo chips ya funcionan), configurable por empresa, sin cambio de esquema en `Comprobante`.
- **Cons**: Depende del usuario etiquetar correctamente el `tipo` de cada comprobante; datos legacy sin `tipo` se tratan como "sin comprobantes obligatorios".
- **Esfuerzo**: Bajo-Medio.

#### B2. Campos booleanos explícitos en Ejecucion (`tieneCuentaCobro`, `tieneComprobantePago`)
- **Pros**: Queryable, claro.
- **Cons**: Redundante con el array `comprobantes`, requiere sincronización en cada add/remove.
- **Esfuerzo**: Medio.

#### B3. Modelo de slots estructurados: `comprobantesObligatorios: { cuentaCobro?, comprobantePago? }` + `comprobantesAdicionales: Comprobante[]`
- **Pros**: Estructurado, explícito, valida a nivel de schema.
- **Cons**: **Breaking change** del array `comprobantes` actual, migración de datos existentes.
- **Esfuerzo**: Alto.

**Recomendación preliminar**: **B1** — menor disrupción, reusa lo existente, derivación de estado como función pura testeable. Pendiente pregunta #2 (mapeo de términos).

### C. Selección de banco en Nueva ejecución

#### C1. `cuentaId?: string` + `cuentaName?: string` en Ejecucion (denormalizado)
- **Cómo**: Siguiendo el patrón `entityId/entityName` existente. Selector `SearchableSelect` en form usando `subscribeCuentasBancarias`. Persistir ambos.
- **Pros**: Consistente con denormalización del codebase, display sin lectura extra, cambio mínimo.
- **Cons**: Dos campos a mantener.
- **Esfuerzo**: Bajo.

#### C2. Solo `cuentaId?: string` (sin denormalizar)
- **Pros**: Un campo.
- **Cons**: Requiere lookup de `cuentaName` para display; inconsistente con el patrón actual.
- **Esfuerzo**: Bajo.

**Recomendación preliminar**: **C1** — seguir el patrón de denormalización del codebase. Pendiente pregunta #5 (¿solo egresos o también ingresos?).

## Recommendation (preliminar, no vinculante)

1. **N:M**: **A1** (`budgetIds: string[]`) — a menos que se requiera split de monto, entonces **A2**.
2. **Comprobantes**: **B1** (extender settings + flag obligatorio + función derivar estado).
3. **Banco**: **C1** (`cuentaId` + `cuentaName` denormalizado en `Ejecucion`).

Combinado, este cambio extiende dos features ya implementadas (`comprobantes-ejecutado`, `bancos`) y añade la relación N:M. Es un cambio **grande** que con alta probabilidad **excede el budget de revisión de 400 líneas** → requiere **chained PRs** (estrategia ask-always: parar y consultar si el forecast supera 400).

## Risks

- **Migración de datos existentes**: ejecuciones con `budgetId` single deben migrarse a `budgetIds` (o mantener backward-compat leyendo ambos). Comprobantes legacy sin `tipo` no tendrán estado derivado válido.
- **Doble conteo en totales por presupuesto**: si una ejecución con `montoEjecutado = X` se vincula a 2 presupuestos, el "ejecutado por presupuesto" suma X en cada uno (¿es correcto?). Los totales por **proyecto** no se ven afectados (siguen sumando por `projectId`). Resuelto solo con split-amount (A2).
- **Indexes de Firestore**: `where('budgetIds', 'array-contains', id)` combinado con otros filtros requiere composite indexes.
- **Consistencia de comprobantes obligatorios**: la validación debe ser en cliente (form) + idealmente en `firestore.rules` (difícil validar arrays embebidos con tipos dinámicos desde settings).
- **Tamaño del cambio vs budget 400 líneas**: alta probabilidad de exceder → chained PRs obligatorio (ask-always).
- **Terminología "falta factura" vs "falta cuenta de cobro"**: el usuario usa ambos términos; hay que confirmar sinónimo.
- **Banco en ingresos**: "de qué banco salió el dinero" sugiere egresos, pero ¿ingresos也需要 cuenta receptora?

## Open Questions (needs-clarification)

1. **Split de monto en N:M**: cuando 1 ejecución paga varios presupuestos, ¿el `montoEjecutado` completo cuenta para **cada** presupuesto, o el usuario debe **repartir** el monto entre los presupuestos vinculados? (Define A1 vs A2.)
2. **Mapeo de tipos de comprobante**: ¿"Cuenta de cobro" y "Comprobante de pago" son **nuevos** tipos a añadir al seed, o se mapean a existentes (Factura/Recibo/Transferencia/Efectivo)? ¿"Cuenta de cobro" = "Factura"?
3. **Semántica de estados**: confirmar que "falta factura" ≡ "falta cuenta de cobro" (el usuario usa ambos términos). ¿`completo` requiere exactamente los 2 obligatorios, o al menos los 2?
4. **Migración de ejecuciones existentes**: ¿preservar `budgetId` legacy (backward-compat) o migrar a `budgetIds`?
5. **Banco en ingresos vs egresos**: ¿la selección de banco aplica solo a egresos ("de qué banco salió"), o también a ingresos (banco receptor)?
6. **Comprobantes obligatorios en budgets**: el usuario dice "cada presupuestado mínimo debe tener 2 comprobantes". Hoy los comprobantes viven en `Ejecucion`, no en `Budget`. ¿Los comprobantes obligatorios van en la **ejecución** o en el **presupuesto**? (Redacción ambigua.)

## Ready for Proposal

**No — needs-clarification.** Hay 6 preguntas abiertas; las #1, #2 y #6 son **bloqueantes** para escribir el proposal y los specs. Recomendar al orquestador: resolver #1, #2, #6 con el usuario antes de `sdd-propose`. Las #3, #4, #5 pueden asumirse con default y confirmarse en propose.
