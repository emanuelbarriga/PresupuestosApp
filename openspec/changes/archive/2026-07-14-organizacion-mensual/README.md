# Organización Mensual (Archivador Contable)

**Archive Date**: 2026-07-14
**Source Change**: `organizacion-mensual`
**Verdict**: PASS WITH WARNINGS

## Resumen

Se implementó el Archivador Contable Mensual como segunda tab dentro de `/media`. La vista permite revisar documentos clasificados (`status === 'enlazado'`) agrupados por mes y categoría contable, con selector año-mes personalizado (dos `<select>` con soporte para `'sin_periodo'`), query única con agrupación en cliente, 8 pestañas de categoría siempre visibles con badge de conteo, suma parcial segura, y banner de documentos sin periodo cargado con `getCountFromServer()`.

### Implementado

- **MediaPage** convertido a contenedor de tabs (Inbox | Archivador) con state lifting de `selectedPeriod` y `activeCategory`
- **InboxTab** extraído del contenido original de MediaPage sin cambios funcionales
- **ArchivadorTab** nuevo componente con selector año-mes, 8 category tabs, query única, grilla, safe sum, y banner sin periodo
- **Schema defaults**: `yearMonthOrSinSchema`, constantes `PERIODO_SIN_ASIGNAR` y `TIPO_DOCUMENTO_DEFAULT`
- **`subscribeDocumentosEnlazados`** con filtro `periodo + status == 'enlazado'` y error handling para índice en construcción
- **Índice compuesto** `periodo ASC, status ASC` en `firestore.indexes.json`
- **Firestore rules** hardening: validación de `periodo is string` y `tipoDocumento is string` para writes con `status == 'enlazado'`
- **Backfill script** (`scripts/backfill-documento-defaults.ts`) con Admin SDK, batch 500, y sincronización de `_linkedDocumentos`
- **DocumentoSidepanel** pre-fill desde documento existente + callback `onDocumentoUpdated` post-save
- **Elegant disappearance**: lógica implementada como `handleDocumentoUpdated` en MediaPage (dead code — no conectada al callback chain, ver issues conocidos)

## Issues Conocidos

1. **Elegant Disappearance no conectado** (CRITICAL): `MediaPage.handleDocumentoUpdated` es dead code — nunca se pasa al Sidepanel. `page.tsx` tiene su propio handler que siempre muestra "Documento actualizado" genérico, ignorando la lógica de comparación de filtro. Tasks T8 y T12 incompletas.

2. **Banner refresh post-save no implementado** (WARNING): `getCountFromServer()` solo se refresca cuando cambia `selectedPeriod`. Si un usuario guarda un documento en modo "sin_periodo", el conteo del banner queda desactualizado.

3. **`projectId` sin resolver** (WARNING): La grilla muestra `projectId` raw en vez del nombre del proyecto resuelto.

4. **Props faltantes en ArchivadorTab** (WARNING): `onDocumentoUpdated` y `onRefreshSinPeriodoCount` no están en la interfaz actual de `ArchivadorTabProps`, aunque se especifican en tasks.md.

## Próximos Pasos Recomendados

1. **Conectar elegant disappearance**: Hacer que `MediaPage` exponga `handleDocumentoUpdated` y page.tsx lo use en vez de su handler genérico, O hacer que MediaPage pase el callback al Sidepanel directamente.
2. **Implementar `onRefreshSinPeriodoCount`**: Agregar el prop a `ArchivadorTabProps`, pasar la función de refresco, y llamarla después de saves exitosos.
3. **Resolver `projectId`**: Agregar lookup de project name desde `projectId` en la grilla del Archivador.
4. **Backfill pre-deploy**: Ejecutar `npx tsx scripts/backfill-documento-defaults.ts` en producción ANTES de deployar las Firestore rules hardening.

## Specs Sincronizados

| Spec | Acción | Path |
|------|--------|------|
| `archivador-mensual` | Creado | `openspec/specs/archivador-mensual/spec.md` |
| `document-upload` | Sin cambios (InboxTab extraction es refactor interno sin nuevo contrato público) | — |

## Archivos del Archive

| Archivo | Descripción |
|---------|-------------|
| `proposal.md` | Propuesta original con intent, scope, approach, 10 decisiones arquitectónicas |
| `spec.md` | Delta spec con ADDED capability archivador-mensual + MODIFIED document-upload + schema defaults + rules |
| `design.md` | Diseño técnico: árbol de componentes, flujo de datos, state management, sidepanel design, rules, backfill |
| `tasks.md` | 12 tareas (T1–T12) con criterios de aceptación y review forecast |
| `verify-report.md` | Verificación: 10/12 tasks completas, 19/24 spec compliant, 798 tests pass |
| `README.md` | Este archivo — resumen de archive |
