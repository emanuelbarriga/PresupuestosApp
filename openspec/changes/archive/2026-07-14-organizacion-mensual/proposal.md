# Proposal: Organización Mensual (Archivador Contable)

## Intent

Agregar una vista de archivador contable mensual que permita a la contadora revisar todos los documentos clasificados de un mes, organizados por las 8 categorías contables, para facilitar el cierre mensual.

Actualmente `/media` es solo un inbox de documentos `por_clasificar`. No hay forma de ver los documentos ya clasificados (`enlazado`) agrupados por mes y categoría.

## Scope

### In Scope

- Convertir `/media` en vista con dos tabs internas: **Inbox** (funcionalidad actual) y **Archivador** (nuevo)
- Selector año-mes en el Archivador para filtrar documentos por `periodo`
- 8 pestañas de categorías dentro del Archivador (una por `TipoDocumentoMedio`), con query única que agrupa en cliente
- Grilla de documentos por categoría con fileName, proveedor, proyecto, monto, fecha
- Suma parcial de `montoTotal` con indicador "X de Y documentos con monto"
- Banner de advertencia para documentos `enlazado` con `periodo === 'sin_periodo'` o sin `tipoDocumento`
- Cerrar sidepanel automáticamente + toast si al editar un documento ya no pertenece al filtro actual
- Default value `'sin_periodo'` para periodo faltante y `'otro'` para tipo faltante (en save/update)

### Out of Scope

- Editar documentos desde la vista Archivador (se editan desde el sidepanel, que ya existe)
- Arrastrar documentos entre categorías
- Exportar a PDF/Excel
- OCR o extracción automática de datos
- Modificaciones al sidebar o al routing global de la app

## Decisiones Arquitectónicas

1. **Query única por mes**: Una sola suscripción con `where('periodo', '==', '2026-07').where('status', '==', 'enlazado')`, agrupar por `tipoDocumento` en el cliente. Un índice compuesto. Cambio de pestaña instantáneo.

2. **Default value strategy**: `periodo` por defecto `'sin_periodo'`, `tipoDocumento` por defecto `'otro'`. Esto permite queries eficientes para el banner de advertencia sin escanear toda la colección.

3. **Dentro de /media como tab**: No se agrega entrada al sidebar. Media pasa a tener tabs Inbox | Archivador. Esto mantiene todo el ciclo de vida del documento en una sola ruta.

4. **Suma parcial segura**: Se muestra el total de `montoTotal` con indicador "X de Y documentos con monto" y safe sum pattern (`Number()` + `isNaN()` guard) para evitar concatenación por tipos string. No se bloquea el enlazado por falta de monto.

5. **Desaparición elegante**: El callback del sidepanel detecta si el documento modificado ya no pertenece al filtro actual y cierra el panel con un toast.

6. **Firestore Rules hardening**: Validar que `enlazado` exija `periodo is string` y `tipoDocumento is string` en `request.resource.data`, impidiendo bypass de default values desde fuera del frontend.

7. **Tab switch con desmonte real + state lifting**: Usar `{activeTab === 'inbox' ? <InboxTab /> : <ArchivadorTab />}` para desmonte real y cierre de listeners. Pero `selectedPeriod` y `activeCategory` viven en `MediaPage` (padre), no en `ArchivadorTab`. Al volver del Inbox se restaura el mismo mes y categoría. Nada de `display: none`.

8. **Selector personalizado (no `<input type="month">`)**: Dos `<select>` (año + mes) con opción "Sin periodo" en el dropdown de meses. El nativo no acepta `'sin_periodo'` como valor válido.

9. **8 pestañas siempre visibles**: Con badge de conteo. Las vacías muestran "(0)" y un empty state. No ocultar categorías sin documentos — mantiene el modelo mental del archivador contable.

10. **Backfill pre-rules**: Script que setea `periodo: 'sin_periodo'` y `tipoDocumento: 'otro'` en todos los `enlazado` existentes antes de deployar las rules hardening. Sin backfill, los documentos migrados sin esos campos quedarían inmutables.

## Capabilities

### New Capabilities

- `archivador-mensual`: Vista de documentos clasificados agrupados por mes y categoría contable, con selector año-mes y 8 pestañas de TipoDocumentoMedio. Accesible como segunda tab dentro de `/media`.

### Modified Capabilities

- `media-page`: Se convierte en contenedor con tabs Inbox | Archivador. El contenido actual del inbox se extrae a `InboxTab`.

## Approach

1. **Refactor MediaPage**: Convertir en contenedor con tabs. Extraer lógica de inbox a `InboxTab.tsx`. Agregar `ArchivadorTab.tsx`.
2. **InboxTab.tsx**: Mover todo el contenido actual de MediaPage (dropzone, upload tasks, inbox grid) a este componente. Sin cambios funcionales.
3. **ArchivadorTab.tsx**: Nuevo componente con:
   - Selector año-mes (YYYY-MM)
   - 8 pestañas de categoría factura_venta / factura_compra / extracto_bancario / comprobante_egreso / comprobante_ingreso / planilla / contrato / otro
   - Query única `where('periodo', '==', X).where('status', '==', 'enlazado')`
   - Agrupación en cliente por `tipoDocumento` (fallback a `'otro'` si es undefined)
   - Grilla de documentos por categoría con metadata
   - Suma parcial segura de montoTotal con indicador "X de Y" (safe sum: `Number()` + `isNaN()` guard)
   - Banner de documentos sin periodo usando **`getCountFromServer()`** al montar (no `onSnapshot` — evita suscripción ociosa)
4. **Sidepanel integration**: 
   - El sidepanel debe **pre-popular** los campos desde el documento existente (modo edición), no arrancar vacío. El `linkDocumentoToEntities` ya sincroniza `_linkedDocumentos` en ejecuciones linked/kept/removed — no hay "metadato fantasma".
   - Al cerrar el sidepanel, verificar si el documento editado aún pertenece al filtro activo. Si no, cerrar y mostrar toast.
5. **mediaService.ts**: Agregar `subscribeDocumentosEnlazados(companyId, periodo)` para suscripción con filtro `periodo + status === 'enlazado'`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/media/MediaPage.tsx` | Modified | Se convierte en contenedor de tabs. Renderiza InboxTab o ArchivadorTab según activeTab |
| `components/media/InboxTab.tsx` | New | Dropzone + upload + inbox grid (extraído de MediaPage actual) |
| `components/media/ArchivadorTab.tsx` | New | Selector mes + 8 pestañas + query única + grilla por categoría |
| `lib/mediaService.ts` | Modified | Agregar `subscribeDocumentosEnlazados(companyId, periodo)` para query por periodo + status |
| `lib/types.ts` | Modified | Agregar tipo `'sin_periodo'` a `TipoDocumentoMedio` (NO — usar solo como valor default, no como tipo). Agregar constante `PERIODO_SIN_ASIGNAR` en schemas.ts |
| `lib/schemas.ts` | Modified | Default values: `periodo: 'sin_periodo'` si no se provee, `tipoDocumento: 'otro'` si no se provee |
| `components/entities/documento/DocumentoSidepanel.tsx` | Modified | Callback `onDocumentoUpdated` para que el padre detecte cambios que sacan al documento del filtro actual |
| `components/Sidepanel.tsx` | Modified | Pasar callback al DocumentoEntity para notificar cambios |
| `firestore.rules` | Modified | Validar que documentos `enlazado` tengan `periodo is string` y `tipoDocumento is string` en writes |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Índice compuesto faltante para `periodo + status` | Medium | Agregar a `firestore.indexes.json` antes del deploy |
| Documentos migrados sin `periodo` y sin `tipoDocumento` | High | Default values al escribir + banner de advertencia |
| Rendimiento con muchos documentos en un mes | Low | Query única con índice, agrupación O(n) en cliente |
| Race condition al cerrar sidepanel antes de que Firestore actualice | Low | Callback optimista: cerramos al confirmar la escritura, no al recibir el snapshot |
| Firestore rules nuevas bloquean escrituras legítimas de GC scripts | Low | Los scripts usan Admin SDK que bypasses rules (solo aplican a client SDK) |

## Rollback Plan

Revertir los archivos modificados y eliminar los nuevos. El cambio es puramente aditivo para `/media` — no afecta otras vistas ni datos existentes. Los documentos con `periodo: 'sin_periodo'` seguirían existiendo pero sin banner (se verían si el usuario elige ese valor manualmente en el selector, pero no es ideal — requeriría un rollback consciente).

Para rollback completo: `git revert` del PR. Sin migración de datos.

## Dependencies

- `subscribeDocumentos` en `mediaService.ts` — crear `subscribeDocumentosEnlazados(companyId, periodo)`
- `DocumentoSidepanel` — necesita exponer callback `onDocumentoUpdated` y soportar pre-fill desde documento existente
- Índice compuesto: `collection: documentos, fields: periodo ASC, status ASC` (crear en Firebase Console o `firestore.indexes.json`)
- Firestore rules actualizadas para validar `periodo` y `tipoDocumento` en documentos `enlazado`

## Success Criteria

- [ ] `/media` muestra tabs Inbox | Archivador en el header, con Inbox como default
- [ ] InboxTab funciona exactamente como MediaPage actual (dropzone, upload, grilla de no clasificados)
- [ ] ArchivadorTab tiene selector año-mes que filtra documentos por `periodo`
- [ ] ArchivadorTab muestra 8 pestañas de categoría con documentos agrupados
- [ ] Cambiar de pestaña de categoría es instantáneo (sin nueva query)
- [ ] Cada categoría muestra suma parcial de `montoTotal` con indicador "X de Y documentos con monto" (safe sum: sin NaN ni concatenación)
- [ ] Banner de advertencia visible cuando hay documentos `enlazado` con `periodo: 'sin_periodo'` (cargado con `getCountFromServer()`, sin suscripción en tiempo real)
- [ ] DocumentoSidepanel pre-popula campos al editar un documento existente (`enlazado`)
- [ ] DocumentoSidepanel guarda correctamente y `linkDocumentoToEntities` sincroniza `_linkedDocumentos` en ejecuciones linked/kept/removed
- [ ] Firestore rules rechazan escrituras que pongan `status: 'enlazado'` sin `periodo` o `tipoDocumento` string
- [ ] Cambiar de tab Inbox/Archivador desmonta el componente anterior y cierra sus listeners Firestore
- [ ] Al editar un documento desde el Archivador, si el nuevo `periodo` o `tipoDocumento` lo saca del filtro, el sidepanel se cierra con toast
- [ ] Sidebar sin cambios, ruteo sin cambios
- [ ] Todos los tests existentes pasan
