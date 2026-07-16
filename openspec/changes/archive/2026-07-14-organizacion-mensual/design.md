# Design: Organización Mensual (Archivador Contable)

> Change: `organizacion-mensual` · Proposal: `openspec/changes/organizacion-mensual/proposal.md` · Spec: `openspec/changes/organizacion-mensual/specs/media/spec.md`

## 1. Resumen de Arquitectura

`MediaPage` se convierte de un componente monolítico (dropzone + upload + inbox grid) a un **contenedor de tabs** con dos modos de visualización: **Inbox** (documentos `por_clasificar` de inbox-upload) y **Archivador** (documentos `enlazado` agrupados por mes y categoría contable).

El contenido actual de MediaPage se extrae a un nuevo componente `InboxTab.tsx` sin cambios funcionales. `ArchivadorTab.tsx` es nuevo: usa una suscripción única con `where('periodo', '==', X).where('status', '==', 'enlazado')`, agrupa en el cliente por `tipoDocumento` (fallback `'otro'`), y renderiza 8 pestañas de categoría siempre visibles con badge de conteo.

Para preservar la selección entre cambios de tab, `activeTab`, `selectedPeriod` y `activeCategory` **viven en `MediaPage`** (state lifting). El desmonte usa render condicional (`{activeTab === 'inbox' ? <InboxTab /> : <ArchivadorTab />}`) — el componente inactivo se desmonta, cancelando listeners de Firestore.

El sidepanel de edición recibe un callback de post-save (`onDocumentoUpdated`) que permite a `MediaPage` detectar si el documento editado sigue matcheando el filtro activo y, si no, cerrar el panel con toast.

## 2. Flujo de Datos

### InboxTab (sin cambios funcionales)

```
MediaPage (mount)
  └─ subscribeDocumentos(companyId, { status: 'por_clasificar', source: 'inbox-upload' })
       └─ onSnapshot → setDocumentos(docs)
            └─ renderiza grid de cards "por clasificar"
```

Al hacer clic en un documento:
```
onNavigate({ type: 'entity', entity: 'documento', mode: 'view', record: doc })
  └─ Sidepanel → DocumentoEntity → DocumentoSidepanel (mode: view → pre-fill vacío para clasificar)
       └─ save → linkDocumentoToEntities(companyId, docId, { tipoDocumento, periodo, ... })
            └─ Transacción atómica:
                 1. Lee DocumentoMedio actual
                 2. Compute diff (added/kept/removed) vs current ejecucionIds
                 3. Para cada added: push a _linkedDocumentos en ejecución
                 4. Para cada removed: filter out de _linkedDocumentos
                 5. Para cada kept: update in-place
                 6. Update DocumentoMedio: status='enlazado', tipoDocumento, periodo, etc.
       └─ onClose → sidepanel se cierra
```

### ArchivadorTab (nuevo flujo)

```
MediaPage (state: activeTab='archivador', selectedPeriod='2026-07', activeCategory='factura_venta')
  └─ ArchivadorTab(companyId, selectedPeriod, activeCategory, onPeriodChange, onCategoryChange)
       └─ subscribeDocumentosEnlazados(companyId, '2026-07')  [nueva función]
            └─ onSnapshot(
                 query(
                   collection(`companies/${companyId}/documentos`),
                   where('periodo', '==', '2026-07'),
                   where('status', '==', 'enlazado')
                 )
               )
            └─ docs → agrupar por tipoDocumento (fallback 'otro')
                 └─ Map<TipoDocumentoMedio, DocumentoMedio[]>
                 └─ activeCategory determina qué grupo se muestra en la grilla

       BannerSinPeriodo (monto independiente)
         └─ getCountFromServer(
               query(
                 collection(`companies/${companyId}/documentos`),
                 where('periodo', '==', 'sin_periodo'),
                 where('status', '==', 'enlazado')
               )
             )
         └─ No onSnapshot — consulta única al montar

       Safe Sum (por categoría visible)
         └─ docs.filter(d => d.metadata?.montoTotal != null)
         └─ total = docsConMonto.reduce((acc, d) => {
               const m = Number(d.metadata!.montoTotal);
               return acc + (isNaN(m) ? 0 : m);
             }, 0)
         └─ indicador: "{X} de {Y} documentos con monto"
```

Al hacer clic en un documento del Archivador:
```
onNavigate({ type: 'entity', entity: 'documento', mode: 'edit', record: doc })
  └─ Sidepanel → DocumentoEntity → DocumentoSidepanel (mode: 'edit', documento pre-populado)
       └─ save → linkDocumentoToEntities(...) → onDocumentoUpdated(docId, newPeriodo, newTipo)
            └─ MediaPage compara:
                 - newPeriodo !== selectedPeriod → close + toast "Documento movido a {mes}"
                 - newTipo !== activeCategory → close + toast "Documento reclasificado a {tipo}"
                 - Igual → close normal sin toast
```

### Selector año-mes: construcción del valor `selectedPeriod`

```
Año select: [2020, 2021, ..., 2030]
Mes select: ['sin_periodo', '01', '02', ..., '12']
  └─ Si mes === 'sin_periodo' → selectedPeriod = 'sin_periodo'
  └─ Si no → selectedPeriod = `${año}-${mes}`

Default al montar: año = currentYear, mes = currentMonth → selectedPeriod = '2026-07'
```

## 3. Árbol de Componentes

```
MediaPage (state: activeTab, selectedPeriod, activeCategory)
├── <header> "Medios / Archivos"
│   └── TabBar
│       ├── <button> "Inbox" (active si activeTab === 'inbox')
│       └── <button> "Archivador" (active si activeTab === 'archivador')
│
├── {activeTab === 'inbox' ? <InboxTab /> : <ArchivadorTab />}
│
├── InboxTab (companyId, onNavigate)
│   ├── Dropzone (drag & drop + file input)
│   ├── UploadProgress (cards de subida activa)
│   └── InboxGrid (documentos por_clasificar + empty state)
│
└── ArchivadorTab (companyId, onNavigate, selectedPeriod, activeCategory,
                   onPeriodChange, onCategoryChange, onDocumentoUpdated)
    ├── BannerSinPeriodo (count from getCountFromServer, onClick → setFilter('sin_periodo'))
    ├── <div> SelectorMes
    │   ├── <select año> [2020..2030]
    │   └── <select mes> [Sin periodo, Enero..Diciembre]
    ├── <div> CategoryTabs (8 tabs siempre visibles con badge)
    │   ├── factura_venta (N)
    │   ├── factura_compra (N)
    │   ├── extracto_bancario (N)
    │   ├── comprobante_egreso (N)
    │   ├── comprobante_ingreso (N)
    │   ├── planilla (N)
    │   ├── contrato (N)
    │   └── otro (N)
    └── DocumentGrid (por categoría activa)
        ├── Card: fileName, proveedorTexto, proyecto, montoTotal, periodo
        ├── SafeSum: total + "X de Y documentos con monto"
        ├── onClick → onNavigate({ type: 'entity', entity: 'documento', mode: 'edit', record: doc })
        └── EmptyState → "No hay documentos de este tipo en {mes}"
```

## 4. State Management

| Estado | Vive en | Tipo | Default | Persiste al cambiar tab? |
|--------|---------|------|---------|--------------------------|
| `activeTab` | MediaPage | `'inbox' \| 'archivador'` | `'inbox'` | N/A |
| `selectedPeriod` | MediaPage | `string` (YYYY-MM \| `'sin_periodo'`) | `formatCurrentDate('YYYY-MM')` | Sí |
| `activeCategory` | MediaPage | `TipoDocumentoMedio` | `'factura_venta'` | Sí |

`ArchivadorTab` es **controlado** — recibe estos valores como props, no maneja estado propio para filtros. Cuando el usuario cambia el selector o la categoría, llama a `onPeriodChange` / `onCategoryChange` que actualizan el estado en `MediaPage`.

Internamente, `ArchivadorTab` maneja **estado local** para:
- `documentosAgrupados: Map<TipoDocumentoMedio, DocumentoMedio[]>` — resultado de agrupar la query
- `sinPeriodoCount: number` — resultado de `getCountFromServer`

## 5. Diseño del Sidepanel (Edit Mode)

### Estado actual del código

Actualmente `DocumentoSidepanel` inicializa todos sus campos a vacío:

```typescript
const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoMedio | ''>('');
const [periodo, setPeriodo] = useState('');
// ... todos los useState con default ''
```

`DocumentoEntity` pasa el `record` como `documento` a `DocumentoSidepanel` pero el sidepanel **ignora** los valores del documento para pre-poblar.

### Cambios necesarios

#### DocumentoSidepanel — pre-fill desde documento existente

```typescript
// Nuevo prop
export interface DocumentoSidepanelProps {
  // ... props existentes ...
  onDocumentoUpdated?: (
    docId: string,
    periodo: string,
    tipoDocumento: TipoDocumentoMedio
  ) => void;
}

// En el componente, inicializar desde documento (si tiene valores)
const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoMedio | ''>(
  documento.tipoDocumento ?? ''
);
const [periodo, setPeriodo] = useState(
  documento.periodo ?? ''
);
const [terceroId, setTerceroId] = useState(
  documento.terceroId ?? ''
);
const [projectId, setProjectId] = useState(
  documento.projectId ?? ''
);
const [ejecucionIds, setEjecucionIds] = useState<string[]>(
  documento.ejecucionIds ?? []
);
const [proveedorTexto, setProveedorTexto] = useState(
  documento.metadata?.proveedorTexto ?? ''
);
const [montoTotal, setMontoTotal] = useState(
  documento.metadata?.montoTotal?.toString() ?? ''
);

// Re-inicializar cuando cambia el documento (ej: otro card clickeado)
useEffect(() => {
  setTipoDocumento(documento.tipoDocumento ?? '');
  setPeriodo(documento.periodo ?? '');
  setTerceroId(documento.terceroId ?? '');
  setProjectId(documento.projectId ?? '');
  setEjecucionIds(documento.ejecucionIds ?? []);
  setProveedorTexto(documento.metadata?.proveedorTexto ?? '');
  setMontoTotal(documento.metadata?.montoTotal?.toString() ?? '');
}, [documento.id]); // Solo re-inicializar cuando cambia el doc ID
```

#### DocumentoSidepanel — onDocumentoUpdated después del save

```typescript
const handleSave = async () => {
  // ... validación existente ...
  setInternalSaving(true);
  try {
    await onSave({ ... });
    // Llamar al callback de post-save con los valores nuevos
    onDocumentoUpdated?.(documento.id, periodo, tipoDocumento as TipoDocumentoMedio);
  } catch {
    // ... manejo de error existente ...
  } finally {
    setInternalSaving(false);
  }
};
```

#### DocumentoEntity — forwarding del callback

```typescript
// Nuevo prop opcional
interface DocumentoEntityProps extends EntityProps {
  onDocumentoUpdated?: (docId: string, periodo: string, tipoDocumento: TipoDocumentoMedio) => void;
}

// Pasar a DocumentoSidepanel
<DocumentoSidepanel
  {...existingProps}
  onDocumentoUpdated={onDocumentoUpdated}
/>
```

#### Sidepanel.tsx — forwarding desde MediaPage

`Sidepanel` recibe un nuevo prop opcional `onDocumentoUpdated` que pasa a `DocumentoEntity`:

```typescript
// En SidepanelProps
onDocumentoUpdated?: (docId: string, periodo: string, tipoDocumento: TipoDocumentoMedio) => void;

// En renderEntityScreen, cuando entity === 'documento'
case 'documento':
  return (
    <DocumentoEntity
      key={key}
      {...entityProps}
      onDocumentoUpdated={onDocumentoUpdated}
    />
  );
```

#### MediaPage — handler del callback

```typescript
const handleDocumentoUpdated = useCallback((
  docId: string,
  newPeriodo: string,
  newTipo: TipoDocumentoMedio,
) => {
  if (activeTab !== 'archivador') return;

  const matchesFilter = newPeriodo === selectedPeriod && newTipo === activeCategory;
  if (!matchesFilter) {
    // El documento ya no pertenece al filtro actual
    if (newPeriodo !== selectedPeriod) {
      toast(`Documento movido a ${newPeriodo}`);
    } else {
      toast(`Documento reclasificado a ${newTipo}`);
    }
    // El sidepanel se cierra (onClose ya fue llamado)
    // El documento desaparecerá en el próximo snapshot
  }
}, [activeTab, selectedPeriod, activeCategory]);
```

## 6. Firestore Rules (endurecimiento del path documentos)

Reglas actuales (solo validan transición `enlazado` → `por_clasificar`):

```
allow update: if isMember(companyId) && (
  resource.data.status != 'enlazado'
  || (request.resource.data.status == 'por_clasificar'
      && request.resource.data.ejecucionIds.size() == 0)
);
```

Reglas modificadas — validan `request.resource.data.status` (nuevo estado) para exigir campos, cerrando el loophole de transición `por_clasificar → enlazado` sin datos:

```
allow update: if isMember(companyId) && (
  // 1. Si el nuevo estado es enlazado (venga de donde venga), requiere strings
  (request.resource.data.status == 'enlazado'
    && request.resource.data.periodo is string
    && request.resource.data.tipoDocumento is string)
  ||
  // 2. Enlazado → por_clasificar (unlinking — clearing ejecucionIds)
  (resource.data.status == 'enlazado'
    && request.resource.data.status == 'por_clasificar'
    && request.resource.data.ejecucionIds.size() == 0)
  ||
  // 3. Modificaciones internas dentro de por_clasificar
  (resource.data.status == 'por_clasificar'
    && request.resource.data.status == 'por_clasificar')
);
```

## 7. Backfill Script

`scripts/backfill-documento-defaults.ts`:

```typescript
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function backfillDocumentoDefaults(companyId?: string) {
  const db = getFirestore();

  // Query all companies or specific one
  const companiesSnap = companyId
    ? await db.collection('companies').doc(companyId).get().then(d => d.exists ? [d] : [])
    : await db.collection('companies').get();

  let totalDocumentosUpdated = 0;
  let totalEjecucionesUpdated = 0;

  for (const companyDoc of companiesSnap) {
    const cId = companyDoc.id;
    const docsSnap = await db.collection(`companies/${cId}/documentos`)
      .where('status', '==', 'enlazado')
      .get();

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of docsSnap.docs) {
      const data = doc.data();
      const docUpdates: Record<string, string> = {};
      const needsPeriodo = !data.periodo;
      const needsTipoDoc = !data.tipoDocumento;

      if (needsPeriodo) docUpdates.periodo = 'sin_periodo';
      if (needsTipoDoc) docUpdates.tipoDocumento = 'otro';

      if (Object.keys(docUpdates).length > 0) {
        // 1. Actualizar el documento mismo
        batch.update(doc.ref, docUpdates);
        totalDocumentosUpdated++;

        // 2. Sincronizar _linkedDocumentos en todas las ejecuciones vinculadas
        const ejecucionIds: string[] = data.ejecucionIds ?? [];
        for (const ejId of ejecucionIds) {
          const ejRef = db.collection(`companies/${cId}/ejecuciones`).doc(ejId);
          const ejSnap = await ejRef.get();
          if (!ejSnap.exists) continue;

          const ejData = ejSnap.data();
          const linkedDocs = ejData?._linkedDocumentos ?? [];
          const updatedLinked = linkedDocs.map((l: any) =>
            l.documentoId === doc.id
              ? {
                  ...l,
                  periodo: needsPeriodo ? 'sin_periodo' : (l.periodo ?? 'sin_periodo'),
                  tipoDocumento: needsTipoDoc ? 'otro' : (l.tipoDocumento ?? 'otro'),
                }
              : l,
          );
          batch.update(ejRef, { _linkedDocumentos: updatedLinked });
          totalEjecucionesUpdated++;
        }
      }

      if (batchCount >= 500) {
        await batch.commit();
        console.log(`Batch committed: ${batchCount} ops (${cId})`);
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      console.log(`Final batch: ${batchCount} ops (${cId})`);
    }
  }

  console.log(`Total documentos actualizados: ${totalDocumentosUpdated}`);
  console.log(`Total ejecuciones con _linkedDocumentos sincronizados: ${totalEjecucionesUpdated}`);
}

// CLI entry: npx tsx scripts/backfill-documento-defaults.ts [companyId]
const targetCompany = process.argv[2];
backfillDocumentoDefaults(targetCompany).catch(console.error);
```

**Nota**: El script usa Admin SDK que bypasses Firestore rules, por lo que puede leer _linkedDocumentos aunque las entries tengan datos incompletos.

## 8. Archivos a modificar/crear

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `components/media/MediaPage.tsx` | **Modificado** | Se convierte en contenedor de tabs con state lifting. Renderiza `<InboxTab />` o `<ArchivadorTab />`. Agrega `onDocumentoUpdated` que verifica filtro post-save. |
| `components/media/InboxTab.tsx` | **Nuevo** | Contenido actual de MediaPage extraído: dropzone, upload progress, inbox grid, firestore subscription. Props: `companyId`, `onNavigate`. |
| `components/media/ArchivadorTab.tsx` | **Nuevo** | Selector año-mes (dos `<select>`), 8 category tabs con badge, query única via `subscribeDocumentosEnlazados`, agrupación en cliente, grilla por categoría, `BannerSinPeriodo`, safe sum. |
| `lib/mediaService.ts` | **Modificado** | Nueva función `subscribeDocumentosEnlazados(companyId, periodo, onError)` que wrappea `subscribeDocumentos` con `status: 'enlazado'` + filtro `periodo`. Debe capturar errores de índice en construcción (código `failed-precondition`) y propagarlos para mostrar UI amigable. |
| `lib/schemas.ts` | **Modificado** | `yearMonthSchema` debe aceptar `'sin_periodo'` además del regex YYYY-MM. Default values en save layer: `periodo: 'sin_periodo'`, `tipoDocumento: 'otro'`. |
| `components/entities/documento/DocumentoSidepanel.tsx` | **Modificado** | Pre-poblar campos desde `documento` (useState con valores iniciales). `useEffect` para re-inicializar cuando cambia `documento.id`. Agregar `onDocumentoUpdated` callback prop. Llamarlo después de `onSave` exitoso. Relax validación de `periodo` para aceptar `'sin_periodo'`. |
| `components/entities/documento/DocumentoEntity.tsx` | **Modificado** | Agregar prop `onDocumentoUpdated` y forward a `DocumentoSidepanel`. |
| `components/Sidepanel.tsx` | **Modificado** | Agregar prop `onDocumentoUpdated` y pasarlo a `DocumentoEntity` en el switch case. |
| `firestore.rules` | **Modificado** | Hardening: agregar validación de `periodo is string` y `tipoDocumento is string` para writes con `status === 'enlazado'`. |
| `scripts/backfill-documento-defaults.ts` | **Nuevo** | Script one-time que setea `periodo: 'sin_periodo'` y `tipoDocumento: 'otro'` en todos los `enlazado` existentes que falten esos campos. Usa `writeBatch` de Admin SDK. |
| `firestore.indexes.json` | **Modificado** | Agregar índice compuesto: `collection: documentos, fields: periodo ASC, status ASC`. |

## 9. Decisiones Técnicas

| Decisión | Opciones | Tradeoffs | Elección |
|----------|----------|-----------|----------|
| **Selector mes personalizado** | `<input type="month">` vs dos `<select>` | El nativo no acepta `'sin_periodo'` como valor. Select personalizado es más verboso pero compatible con el dominio. | **Dos `<select>`** (año + mes), con opción "Sin periodo" en el dropdown de meses. |
| **8 categorías siempre visibles vs dinámicas** | Solo mostrar tabs con documentos vs siempre renderizar 8 | Dinámicas ahorran espacio pero rompen el modelo mental de archivador contable. | **Siempre visibles** con badge "(0)" y empty state. |
| **State lifting vs URL params** | Estado en MediaPage vs `${periodo}&categoria=` en URL | URL permite compartir/bookmark pero no hay necesidad en SPA. State lifting es más simple. | **State lifting** en MediaPage. |
| **Query única vs query por categoría** | Una query con `where periodo + status` + agrupación cliente vs 8 queries | Query única = 1 read, cambio de tab instantáneo. O(n) en cliente. | **Query única**. Un índice compuesto. |
| **Banner: getCountFromServer vs onSnapshot** | `getCountFromServer` (1 read) vs `onSnapshot` (suscrito) | Banner no necesita tiempo real — solo saber si hay docs sin periodo al abrir. | **`getCountFromServer`** al montar. Se refresca llamando `fetchSinPeriodoCount()` después de cada `onDocumentoUpdated`. |
| **Banner refresh post-save** | Refrescar con `getCountFromServer` vs mantener suscripción | Un `getCountFromServer` extra por save es ~1 documento leído vs una suscripción permanente. | **`getCountFromServer`** en el callback de `onDocumentoUpdated`. |
| **Safe sum pattern** | `Number()` + `isNaN()` vs librería de sumas | Patrón manual es simple y no requiere dependencias. | **`Number()` + `isNaN()` guard** + **`Math.round()`** antes de formatear a COP. |
| **Hydration mismatch** | Inicializar en servidor vs cliente | Next.js SSR usa UTC, cliente usa timezone local. Mismatch si la fecha cruza medianoche. | **`selectedPeriod` arranca como `''`** y se setea vía `useEffect(() => setSelectedPeriod(formatCurrentMonth()), [])` solo en cliente. |
| **Selector year deshabilitado en sin_periodo** | Año visible + "Sin periodo" seleccionado vs ocultar año | Mostrar año con "Sin periodo" es confuso (parece que filtra año + sin periodo). | **Deshabilitar año y mostrar "—"** cuando el mes es "Sin periodo". La query ignora el año. |
| **Índice en construcción** | Capturar error vs dejar que Firestore lance excepción | Firestore rechaza queries sin índice, tarda 5-15 min en construirlo. Primera vez en prod puede romper. | **Capturar error en `onSnapshot`** y mostrar estado amigable "Estamos preparando tu archivador..." con retry automático. |
| **Backfill: Admin SDK vs client SDK** | Admin SDK bypasses rules vs client SDK necesita reglas flexibles | Admin SDK es directo, no requiere cambiar reglas temporalmente. | **Admin SDK** (`firebase-admin`). También sincroniza `_linkedDocumentos` en ejecuciones. |

Schema de periodo — `yearMonthSchema` actual:

```typescript
export const yearMonthSchema = z.string().regex(
  /^\d{4}-(0[1-9]|1[0-2])$/, 'debe tener formato YYYY-MM'
);
```

Se modifica para aceptar `'sin_periodo'`:

```typescript
export const yearMonthOrSinSchema = z.string().refine(
  (val) => val === 'sin_periodo' || /^\d{4}-(0[1-9]|1[0-2])$/.test(val),
  { message: 'debe ser YYYY-MM o "sin_periodo"' }
);
```

Y `documentoMedioSchema.periodo` pasa de `yearMonthSchema.optional()` a `yearMonthOrSinSchema.optional()`.

## 10. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Índice compuesto `periodo ASC, status ASC` faltante | Media | Crear en `firestore.indexes.json` ANTES del deploy. Firestore rechaza la query sin índice. |
| Backfill incompleto — documentos migrados sin `periodo`/`tipoDocumento` | Alta | El script logea cada batch y el conteo final. Correr con `companyId` específico para verificar. Verificar antes de deployar rules hardening. |
| `yearMonthSchema` rechaza `'sin_periodo'` | Alta | Modificar schema explícitamente para aceptar el valor literal. |
| Sidepanel pre-fill con datos inconsistentes (ej: documento cambia durante edición) | Baja | `useEffect` con dependencia `documento.id` para re-inicializar todos los campos. |
| Evento de cierre del sidepanel compite con el snapshot de Firestore | Baja | El callback `onDocumentoUpdated` se dispara después de `onSave` exitoso (antes de que llegue el snapshot). Si cae fuera del filtro, se cierra el panel + toast. Si queda dentro, el snapshot refrescará el grid. |
| Reglas de Firestore nuevas bloquean escrituras legítimas | Baja | El Admin SDK de GC scripts bypassa rules. Solo afecta client SDK. |
| `sin_periodo` como default rompe queries existentes de inbox | Baja | Los documentos `por_clasificar` no usan `periodo`. Solo afecta documentos `enlazado` — que es exactamente lo que queremos. |
| Hydration mismatch por diferencia UTC/cliente | Media | `selectedPeriod` inicializado como `''` + `useEffect` para setear valor en cliente. SSR renderiza vacío, cliente completa. |
| Índice compuesto en construcción al primer deploy | Media | Capturar error en `onSnapshot` y mostrar loader amigable con mensaje. Estado de UI graceful. |
| Suma COP con decimales por punto flotante | Baja | `Math.round()` antes de formatear. COP no usa centavos en la práctica. |
