# Tasks: Organización Mensual (Archivador Contable)

> Change: `organizacion-mensual` · Spec: `openspec/changes/organizacion-mensual/spec.md` · Design: `openspec/changes/organizacion-mensual/design.md`

---

## Fase 1: Backend y Datos (preparación)

### T1: Schema defaults — periodo y tipoDocumento

- **Archivos**: `lib/schemas.ts`
- **Dependencias**: Ninguna
- **Descripción**: Crear `yearMonthOrSinSchema` que acepte `'sin_periodo'` además del formato `YYYY-MM`. Actualizar `documentoMedioSchema.periodo` de `yearMonthSchema.optional()` a `yearMonthOrSinSchema.optional()`. Agregar constante `PERIODO_SIN_ASIGNAR = 'sin_periodo'` y `TIPO_DOCUMENTO_DEFAULT = 'otro'`. No cambiar la semántica de `.optional()` — los campos siguen siendo opcionales en la validación. Los defaults se aplican en el save layer (ver T6).
- **Criterios de aceptación**:
  - [ ] `yearMonthOrSinSchema` acepta `'sin_periodo'` y cualquier `YYYY-MM` válido
  - [ ] `yearMonthOrSinSchema` rechaza strings inválidos como `'2026-13'` o `'foo'`
  - [ ] `documentoMedioSchema.periodo` usa `yearMonthOrSinSchema.optional()` — no rompe schemas existentes
  - [ ] Constantes `PERIODO_SIN_ASIGNAR` y `TIPO_DOCUMENTO_DEFAULT` exportadas
- **Estimación**: ~10 líneas

---

### T2: Nueva función subscribeDocumentosEnlazados (con error handling para índice en construcción)

- **Archivos**: `lib/mediaService.ts`
- **Dependencias**: Ninguna
- **Descripción**: Agregar función `subscribeDocumentosEnlazados(companyId, periodo, onData, onError)` que wrappee `subscribeDocumentos` con filtros `{ status: 'enlazado' }` y un constraint adicional de `periodo`. Internamente construye `where('periodo', '==', periodo).where('status', '==', 'enlazado')`. Retorna `Unsubscribe`. Reutiliza la lógica de `onSnapshot` y mapeo existente.
- **Criterios de aceptación**:
  - [ ] `subscribeDocumentosEnlazados('c1', '2026-07', onData)` llama a Firestore con `periodo == '2026-07' AND status == 'enlazado'`
  - [ ] Retorna función `Unsubscribe` que cancela el listener
  - [ ] No rompe llamadas existentes a `subscribeDocumentos`
  - [ ] Maneja `periodo === 'sin_periodo'` correctamente (lo pasa como constraint de igualdad)
  - [ ] **Error handling**: Captura error `failed-precondition` (índice en construcción) en el `onError` callback y propaga código de error para que la UI muestre mensaje amigable
- **Estimación**: ~20 líneas

---

### T3: Índice compuesto periodo + status

- **Archivos**: `firestore.indexes.json`
- **Dependencias**: Ninguna (crear antes del deploy)
- **Descripción**: Agregar índice compuesto para la colección `documentos` con campos `periodo ASC, status ASC`. Esto es requerido por Firestore para la query `where('periodo', '==', X).where('status', '==', 'enlazado')`. Scope de colección simple (no COLLECTION_GROUP).
- **Criterios de aceptación**:
  - [ ] Índice agregado al array `indexes` con `collectionGroup: "documentos"`
  - [ ] `queryScope` omitido o `"COLLECTION"` (índice simple, no collection group)
  - [ ] `fields`: `[{ fieldPath: "periodo", order: "ASCENDING" }, { fieldPath: "status", order: "ASCENDING" }]`
  - [ ] `fieldOverrides` sin cambios
- **Estimación**: ~5 líneas

---

### T4: Firestore rules — Hardening para enlazado

- **Archivos**: `firestore.rules`
- **Dependencias**: T5 (backfill DEBE correr ANTES de deployar estas rules)
- **Descripción**: Modificar la regla `allow update` de `/companies/{companyId}/documentos/{doc}`. La validación clave: usar `request.resource.data.status` (nuevo estado entrante) en vez de `resource.data.status` (viejo estado) para exigir campos en el destino `enlazado`. Esto cierra el loophole donde un doc `por_clasificar` podía transicionar a `enlazado` sin enviar `periodo`/`tipoDocumento`.

Estructura de la regla:
```
allow update: if isMember(companyId) && (
  // 1. Si el nuevo estado es enlazado (venga de donde venga), requiere strings
  (request.resource.data.status == 'enlazado'
    && request.resource.data.periodo is string
    && request.resource.data.tipoDocumento is string)
  ||
  // 2. Enlazado → por_clasificar (unlinking)
  (resource.data.status == 'enlazado'
    && request.resource.data.status == 'por_clasificar'
    && request.resource.data.ejecucionIds.size() == 0)
  ||
  // 3. Modificaciones internas dentro de por_clasificar
  (resource.data.status == 'por_clasificar'
    && request.resource.data.status == 'por_clasificar')
);
```
- **Criterios de aceptación**:
  - [ ] Write transicionando `por_clasificar → enlazado` con `periodo` y `tipoDocumento` → permitido
  - [ ] Write transicionando `por_clasificar → enlazado` SIN `periodo` → **denegado** (loophole cerrado)
  - [ ] Write transicionando `por_clasificar → enlazado` SIN `tipoDocumento` → **denegado**
  - [ ] Write manteniendo `enlazado → enlazado` con `periodo` y `tipoDocumento` → permitido
  - [ ] Write manteniendo `enlazado → enlazado` SIN `periodo` → denegado
  - [ ] Transición `enlazado → por_clasificar` con `ejecucionIds.size() == 0` → permitido
  - [ ] Docs manteniéndose en `por_clasificar` → permitido (sin cambios en reglas existentes)
  - [ ] Admin SDK escribe sin restricciones (bypass natural de rules)
- **Estimación**: ~15 líneas

---

### T5: Backfill script — Documentos existentes + sincronización _linkedDocumentos

- **Archivos**: `scripts/backfill-documento-defaults.ts` (nuevo)
- **Dependencias**: Ninguna (pero debe ejecutarse ANTES de T4)
- **Descripción**: Script one-time usando Admin SDK (`firebase-admin`) que recorre todas las empresas (o una específica vía CLI), consulta documentos con `status == 'enlazado'`, y para aquellos que falten `periodo` o `tipoDocumento`, los setea a `'sin_periodo'` y `'otro'` respectivamente. **Además**, para cada documento actualizado, también sincroniza `_linkedDocumentos` en las ejecuciones vinculadas: lee `ejecucionIds`, busca el entry correspondiente en `_linkedDocumentos` y le setea `periodo: 'sin_periodo'` y `tipoDocumento: 'otro'`. Usa `writeBatch` en batches de 500. Logea conteo por batch y total final.
- **Criterios de aceptación**:
  - [ ] Script ejecutable via `npx tsx scripts/backfill-documento-defaults.ts [companyId]`
  - [ ] Query: `where('status', '==', 'enlazado')` en `companies/{cId}/documentos`
  - [ ] Si falta `periodo` → setea `'sin_periodo'`; si falta `tipoDocumento` → setea `'otro'`
  - [ ] **Sync _linkedDocumentos**: Para cada ejecucionId vinculada, lee el array `_linkedDocumentos`, encuentra el entry con `documentoId` coincidente, y setea `periodo`/`tipoDocumento`
  - [ ] Usa `writeBatch` con commits cada 500 operaciones
  - [ ] Logea: "Batch committed: N ops (companyId)" y "Total documentos actualizados: N" y "Total ejecuciones sincronizadas: N"
  - [ ] Si se pasa `companyId` como argumento, solo procesa esa empresa
  - [ ] No modifica documentos que ya tienen ambos campos
- **Estimación**: ~60 líneas

---

## Fase 2: Sidepanel Edit Mode

### T6: DocumentoSidepanel — Pre-fill desde documento existente + onDocumentoUpdated

- **Archivos**: `components/entities/documento/DocumentoSidepanel.tsx`
- **Dependencias**: T1 (yearMonthOrSinSchema para validar `'sin_periodo'`)
- **Descripción**: Modificar `DocumentoSidepanel` para que inicialice los `useState` desde `documento` (pre-poblar campos cuando existe). Agregar `useEffect` con dependencia `documento.id` para re-inicializar cuando cambia el documento. Agregar prop opcional `onDocumentoUpdated?: (docId: string, periodo: string, tipoDocumento: TipoDocumentoMedio) => void` y llamarlo después de `onSave` exitoso. Relajar validación de `periodo` para aceptar `'sin_periodo'` además de `YYYY-MM`. Aplicar defaults `periodo: 'sin_periodo'` y `tipoDocumento: 'otro'` en el save layer si los campos están vacíos.
- **Criterios de aceptación**:
  - [x] Al abrir sidepanel con un documento `enlazado`, `tipoDocumento`, `periodo`, `terceroId`, `projectId`, `ejecucionIds`, `proveedorTexto`, `montoTotal` se pre-poblan desde `documento`
  - [x] Si document.id cambia (otro documento clickeado), todos los campos se re-inicializan
  - [x] `onDocumentoUpdated` se llama después de `onSave` exitoso con `docId`, `periodo`, `tipoDocumento`
  - [x] Validación de periodo acepta `'sin_periodo'` además de `YYYY-MM`
  - [x] Si `periodo` no se provee → se setea `'sin_periodo'` en el save data
  - [x] Si `tipoDocumento` no se provee → se setea `'otro'` en el save data
  - [x] Props existentes intactos, componente retrocompatible
- **Estimación**: ~40 líneas

---

### T7: DocumentoEntity — Forwarding de onDocumentoUpdated

- **Archivos**: `components/entities/documento/DocumentoEntity.tsx`
- **Dependencias**: T6
- **Descripción**: Agregar prop `onDocumentoUpdated` a `DocumentoEntity` (tipo: función opcional). Forwardearlo a `DocumentoSidepanel`. No requiere cambios en `EntityProps` — se declara como prop adicional al desestructurar (o se extiende con una interfaz local `DocumentoEntityProps`).
- **Criterios de aceptación**:
  - [x] `DocumentoEntity` acepta `onDocumentoUpdated` como prop opcional
  - [x] Forwardea el callback a `<DocumentoSidepanel onDocumentoUpdated={onDocumentoUpdated} />`
  - [x] No rompe existentes: llamadas sin `onDocumentoUpdated` siguen funcionando
- **Estimación**: ~15 líneas

---

### T8: Elegant disappearance callback — Propagación vía Sidepanel

- **Archivos**: `components/Sidepanel.tsx`, `components/media/MediaPage.tsx`
- **Dependencias**: T7
- **Descripción**: Agregar prop `onDocumentoUpdated` a `Sidepanel.tsx`. Pasarlo como prop explícito a `<DocumentoEntity>` en el switch case de `renderEntityScreen`. En `MediaPage.tsx`, implementar `handleDocumentoUpdated` que compara `newPeriodo` vs `selectedPeriod` y `newTipo` vs `activeCategory`; si no matchea, cierra sidepanel (via `onClose`) y muestra toast con "Documento movido a {mes}" o "Documento reclasificado a {tipo}".
- **Criterios de aceptación**:
  - [x] `SidepanelProps` incluye `onDocumentoUpdated?: (docId: string, periodo: string, tipoDocumento: TipoDocumentoMedio) => void`
  - [x] En `renderEntityScreen`, el case `'documento'` pasa `onDocumentoUpdated` a DocumentoEntity (además de `{...entityProps}`)
  - [x] `MediaPage.handleDocumentoUpdated` existe como `useCallback`
  - [x] Si `newPeriodo !== selectedPeriod` → toast "Documento movido a {newPeriodo}" + sidepanel se cierra
  - [x] Si `newTipo !== activeCategory` → toast "Documento reclasificado a {newTipo}" + sidepanel se cierra
  - [x] Si ambos matchean → no hay toast, sidepanel cierra normalmente
  - [x] Si `activeTab !== 'archivador'` → no hace nada (callback solo relevante en Archivador)
  - [ ] Si `newPeriodo === 'sin_periodo'` y estaba en un mes normal → banner debe refrescar su conteo via `getCountFromServer()` — banner y refresco son parte de T11 (ArchivadorTab), se implementan en PR 3
  - [ ] Después de cerrar sidepanel (cualquier caso), se refresca el banner de documentos sin periodo via `onRefreshSinPeriodoCount` — banner es parte de T11, se implementa en PR 3
- **Estimación**: ~25 líneas (15 en Sidepanel.tsx + 10 en MediaPage.tsx)

---

## Fase 3: ArchivadorTab (nuevo componente)

### T9: MediaPage — Refactor a tab container con state lifting

- **Archivos**: `components/media/MediaPage.tsx`
- **Dependencias**: T10 (InboxTab debe existir), T8 (para handleDocumentoUpdated)
- **Descripción**: Convertir `MediaPage` de componente monolítico a contenedor de tabs con state lifting. Agregar estado `activeTab: 'inbox' | 'archivador'` (default `'inbox'`), `selectedPeriod: string` (default `''` — **vacío, no calcular en servidor** para evitar hydration mismatch por diferencia UTC/cliente), `activeCategory: TipoDocumentoMedio` (default `'factura_venta'`). Usar `useEffect(() => setSelectedPeriod(formatCurrentMonth()), [])` para setear el mes actual SOLO en el cliente. Renderizar header con TabBar (botones "Inbox" y "Archivador" con estilo `border-b border-slate-200` y texto `text-indigo-600` para activo). Render condicional: `{activeTab === 'inbox' ? <InboxTab /> : <ArchivadorTab />}`. Pasar `selectedPeriod`, `activeCategory`, `onPeriodChange`, `onCategoryChange` a ArchivadorTab. Incluir `handleDocumentoUpdated` de T8. Incluir `fetchSinPeriodoCount` en MediaPage y exponerlo para refrescar banner tras saves.
- **Criterios de aceptación**:
  - [ ] Header de MediaPage muestra dos tabs: "Inbox" (default activo) y "Archivador"
  - [ ] `activeTab` hace render condicional — componente inactivo se desmonta
  - [ ] `selectedPeriod` arranca como `''` (vacío) para evitar hydration mismatch SSR/cliente
  - [ ] `useEffect` setea `selectedPeriod` al mes actual solo en el cliente
  - [ ] `selectedPeriod` y `activeCategory` viven en MediaPage, se pasan como props
  - [ ] `onPeriodChange` actualiza `selectedPeriod` en MediaPage
  - [ ] `onCategoryChange` actualiza `activeCategory` en MediaPage
  - [ ] Al volver de Inbox a Archivador, se restaura el mismo mes y categoría
  - [ ] `handleDocumentoUpdated` se pasa como callback a Sidepanel (via prop `onDocumentoUpdated`)
  - [ ] Código original de inbox (dropzone + upload + grid) eliminado de MediaPage — extraído a InboxTab
- **Estimación**: ~80 líneas

---

### T10: InboxTab — Extracción del contenido actual de MediaPage

- **Archivos**: `components/media/InboxTab.tsx` (nuevo)
- **Dependencias**: Ninguna (extracción pura, sin cambios funcionales)
- **Descripción**: Crear `InboxTab.tsx` con el contenido actual de MediaPage: dropzone, upload progress cards, inbox grid con documentos `por_clasificar`, Firestore subscription via `subscribeDocumentos`. Props: `companyId`, `onNavigate`. Sin cambios funcionales. Sin dropzone ni upload logic modificada.
- **Criterios de aceptación**:
  - [ ] `InboxTab` recibe `companyId: string` y `onNavigate?: (screen: NavScreen) => void`
  - [ ] Dropzone se renderiza exactamente igual que en MediaPage actual
  - [ ] Upload progress cards funcionan (subiendo/exito/error/cancelar/reintentar)
  - [ ] Inbox grid muestra documentos `por_clasificar` con source `inbox-upload`
  - [ ] Empty state se muestra cuando no hay documentos
  - [ ] Cancelación de uploads en unmount (`activeTasksRef`)
  - [ ] Todos los tests de MediaPage actual pasan (los de InboxTab son funcionalmente idénticos)
- **Estimación**: ~200 líneas (extraído)

---

### T11: ArchivadorTab — Nuevo componente completo

- **Archivos**: `components/media/ArchivadorTab.tsx` (nuevo)
- **Dependencias**: T2 (subscribeDocumentosEnlazados), T3 (índice compuesto)
- **Descripción**: Nuevo componente controlado que recibe `companyId`, `selectedPeriod`, `activeCategory`, `onPeriodChange`, `onCategoryChange`, `onNavigate`, `onDocumentoUpdated`, `onRefreshSinPeriodoCount`. Incluye:
  - **BannerSinPeriodo**: `getCountFromServer()` al montar para contar docs `enlazado` con `periodo == 'sin_periodo'`. Banner onClick → setea `onPeriodChange('sin_periodo')`. **Se refresca** llamando `onRefreshSinPeriodoCount()` después de cada `onDocumentoUpdated` exitoso (evita conteo desactualizado sin usar `onSnapshot`).
  - **Selector año-mes**: Dos `<select>` (año 2020–2030, mes con "Sin periodo" + Enero–Diciembre). Construye `selectedPeriod = año-mes` o `'sin_periodo'`. **Cuando el mes es "Sin periodo", el año se deshabilita y muestra "—"** para evitar el estado confuso "año 2026 + sin periodo".
  - **Index-building state**: Manejar error de Firestore `failed-precondition` (índice en construcción) y mostrar mensaje amigable "Estamos preparando tu archivador por primera vez, esto tomará un par de minutos..." con botón de reintento.
  - **8 category tabs**: Siempre visibles con badge `(N)`. Vacías muestran `"(0)"` y empty state.
  - **Query única**: `subscribeDocumentosEnlazados(companyId, selectedPeriod, onError)` → agrupa en `Map<TipoDocumentoMedio, DocumentoMedio[]>` (fallback `'otro'` si undefined).
  - **DocumentGrid**: Cards con fileName, proveedorTexto (o "—"), projectName resuelto, montoTotal (formato COP con `Math.round()` antes de formatear para evitar decimales por punto flotante), periodo. onClick → `onNavigate({ type: 'entity', entity: 'documento', mode: 'edit', record: doc })`.
  - **SafeSum**: `Number()` + `isNaN()` guard en reduce + `Math.round()` antes de formatear. Indicador "X de Y documentos con monto".
- **Criterios de aceptación**:
  - [ ] BannerSinPeriodo usa `getCountFromServer()` (no `onSnapshot`) al montar
  - [ ] Banner se refresca con `getCountFromServer()` después de cada `onDocumentoUpdated` exitoso
  - [ ] Banner oculto si count === 0, visible con "{N} documentos sin periodo asignado" si count > 0
  - [ ] Click en banner cambia selector a "Sin periodo"
  - [ ] Selector año: options 2020–2030; selector mes: "Sin periodo", "Enero"–"Diciembre"
  - [ ] **Cuando mes es "Sin periodo", año se deshabilita y muestra "—"** (evita estado confuso)
  - [ ] Default al montar: año actual, mes actual → `selectedPeriod = '2026-07'`
  - [ ] Al cambiar selector, se llama `onPeriodChange` con el nuevo valor
  - [ ] **Error de índice en construcción**: Se captura `failed-precondition`, se muestra loader con mensaje amigable y botón reintentar
  - [ ] 8 tabs siempre visibles: factura_venta, factura_compra, extracto_bancario, comprobante_egreso, comprobante_ingreso, planilla, contrato, otro
  - [ ] Cada tab muestra badge con count de documentos en ese grupo
  - [ ] Tabs vacías: badge "(0)", grid muestra empty state "No hay documentos de este tipo en {mes}"
  - [ ] Query única: `subscribeDocumentosEnlazados(companyId, selectedPeriod, onError)` con agrupación cliente
  - [ ] Documentos sin `tipoDocumento` caen en categoría "otro"
  - [ ] Cambiar de tab de categoría es instantáneo (sin nueva query)
  - [ ] Grid de documentos muestra fileName (truncado), proveedorTexto (o "—"), projectName, montoTotal (COP con `Math.round()`), periodo
  - [ ] SafeSum: `Number(montoTotal)` + `isNaN()` guard + `Math.round()`, muestra total + "X de Y documentos con monto"
  - [ ] Click en card → abre sidepanel con `mode: 'edit'`
  - [ ] Al cambiar `selectedPeriod` (nuevo mes), se desuscribe del listener anterior y crea uno nuevo
  - [ ] Cleanup de Firestore listener en unmount
  - [ ] Props: `companyId`, `selectedPeriod`, `activeCategory`, `onPeriodChange`, `onCategoryChange`, `onNavigate`
- **Estimación**: ~250 líneas (nuevo)

---

### T12: Sidepanel forwarding — Conexión del callback de filtro

- **Archivos**: `components/media/MediaPage.tsx` (conexión final)
- **Dependencias**: T11, T8, T9
- **Descripción**: Verificar que el callback `onDocumentoUpdated` fluye correctamente desde MediaPage → Sidepanel → DocumentoEntity → DocumentoSidepanel, y que `handleDocumentoUpdated` en MediaPage compara correctamente el resultado post-save con el filtro activo (`selectedPeriod`, `activeCategory`). Asegurar que `ArchivadorTab` recibe `onNavigate` y que al hacer clic en un documento del grid, el sidepanel se abre con `mode: 'edit'` y pre-fill. Verificar que al guardar un documento cuyo nuevo `periodo` o `tipoDocumento` no matchea el filtro, el sidepanel se cierra y el toast aparece. Verificar que al guardar sin cambios de filtro, no hay toast falso.
- **Criterios de aceptación**:
  - [ ] Documento clickeado en ArchivadorTab abre sidepanel con `mode: 'edit'` y documento pre-poblado
  - [ ] Guardar documento con mismo periodo y tipo → sidepanel cierra, sin toast, documento permanece en grilla
  - [ ] Guardar documento cambiando periodo a otro mes → sidepanel cierra, toast "Documento movido a {mes}", documento desaparece de grilla
  - [ ] Guardar documento cambiando tipoDocumento → sidepanel cierra, toast "Documento reclasificado a {tipo}", documento desaparece de categoría actual
  - [ ] Callback se llama UNA SOLA VEZ por save (sin duplicados)
  - [ ] Error en save → no se llama onDocumentoUpdated, sidepanel permanece abierto
- **Estimación**: ~10 líneas (verificación de conexiones existentes, ajustes menores)

---

## Review Workload Forecast

| Archivo | Acción | Líneas estimadas |
|---------|--------|------------------|
| `lib/schemas.ts` | Modificado | ~10 |
| `lib/mediaService.ts` | Modificado | ~15 |
| `firestore.indexes.json` | Modificado | ~5 |
| `firestore.rules` | Modificado | ~15 |
| `scripts/backfill-documento-defaults.ts` | Nuevo | ~60 |
| `components/entities/documento/DocumentoSidepanel.tsx` | Modificado | ~40 |
| `components/entities/documento/DocumentoEntity.tsx` | Modificado | ~15 |
| `components/Sidepanel.tsx` | Modificado | ~15 |
| `components/media/MediaPage.tsx` | Modificado | ~80 |
| `components/media/InboxTab.tsx` | Nuevo (extraído) | ~200 |
| `components/media/ArchivadorTab.tsx` | Nuevo | ~250 |
| **Total** | | **~705** |

**Chained PRs recommended**: Yes (400-line budget exceeded — ~705 líneas totales)

**Desglose sugerido para splits**:

| PR | Foco | Archivos | Líneas estimadas |
|----|------|----------|------------------|
| **PR 1** | Backend + Data (Fase 1) | schemas, mediaService, indexes, rules, backfill script | ~105 |
| **PR 2** | Sidepanel Edit Mode (Fase 2) | DocumentoSidepanel, DocumentoEntity, Sidepanel | ~70 |
| **PR 3** | ArchivadorTab + MediaPage (Fase 3) | MediaPage, InboxTab, ArchivadorTab | ~530 |

PR 3 es grande (~530 líneas) pero es un solo feature cohesivo. Alternativa: dividir PR 3 en dos:

| PR | Foco | Archivos | Líneas |
|----|------|----------|--------|
| **PR 3a** | Refactor MediaPage → InboxTab | MediaPage, InboxTab | ~280 |
| **PR 3b** | ArchivadorTab + callback | ArchivadorTab, MediaPage (state lifting) | ~250 |

**Decision needed before apply**: Yes — definir estrategia de splitting. Si se hace single PR con `size:exception`, requiere approval extra.

**Budget risk**: HIGH — ~705 líneas supera ampliamente el umbral de 400 líneas. Chained PRs strongly recommended.
