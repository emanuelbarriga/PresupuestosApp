# Proposal: Pestaña Soportes en Tercero y Proyecto

## Intent

Agregar una pestaña "Soportes" dentro de las vistas de Tercero (TerceroView) y Proyecto (ProjectView) que muestre los documentos vinculados a esa entidad, permitiendo visibilidad bidireccional sin salir del sidepanel.

## Scope

### In Scope
- Nueva pestaña "Soportes" en TerceroView y ProjectView (mismo estilo que Datos/Media tabs)
- Componente `SoportesTab` compartido que lista documentos vinculados por `terceroId` o `projectId`
- Cada documento muestra: fileName, tipoDocumento, periodo, montoTotal, proveedor
- Click en documento → abre DocumentoSidepanel en modo view (no edit)
- Extender `subscribeDocumentos` en mediaService.ts para aceptar filtros `terceroId` y `projectId`

### Out of Scope
- Subir documentos desde la pestaña Soportes
- Editar documentos desde Soportes (solo vista)
- Arrastrar documentos entre entidades
- Modificar el routing global o sidebar

## Approach

1. **Extender subscribeDocumentos**: Agregar `terceroId` y `projectId` a los filters de `subscribeDocumentos`. Crear el `where()` correspondiente si están presentes.
2. **SoportesTab**: Componente compartido que recibe `companyId`, `terceroId` o `projectId`, y `onNavigate`. Usa `subscribeDocumentos` con filtro de entidad. Renderiza lista de documentos con formato tipo card.
3. **TerceroView**: Agregar pestañas "Detalle" | "Soportes". La pestaña Detalle tiene el contenido actual. Soportes renderiza `<SoportesTab terceroId={record.id} ... />`.
4. **ProjectView**: Agregar pestañas "Detalle" | "Soportes". Mismo patrón.

## Affected Areas

| Area | Impact |
|------|--------|
| `lib/mediaService.ts` | Modified — agregar `terceroId` y `projectId` a filters |
| `components/entities/tercero/TerceroView.tsx` | Modified — agregar tabs + SoportesTab |
| `components/entities/project/ProjectView.tsx` | Modified — agregar tabs + SoportesTab |
| `components/entities/shared/SoportesTab.tsx` | New — componente de lista de documentos |

## Risks

Bajo. Cambio puramente aditivo. No toca data layer, no modifica rules. ~270 líneas estimadas.
