# Proposal: Explorador por Terceros

## Intent

Agregar una pestaña "Por Tercero" en MediaPage que muestre todos los documentos enlazados agrupados por tercero (proveedor/cliente), permitiendo explorar rápidamente qué documentos tiene cada tercero sin salir de la vista de medios.

## Scope

### In Scope
- Tercera pestaña "Por Tercero" en MediaPage (junto a Inbox y Archivador)
- Query de todos los documentos `enlazado` de la empresa (sin filtro de periodo)
- Carga de terceros via `subscribeTerceros` para resolver nombres
- Agrupación en cliente por `terceroId` usando Map
- Lista expandible de terceros con count badge
- Cada tercero expandido muestra sus documentos (reusa patrón de cards)
- Click en documento → sidepanel mode view

### Out of Scope
- Bulk edit desde el explorador
- Filtros adicionales (por tipo de documento, periodo)
- Editar documentos desde el explorador

## Approach
1. Agregar `'explorador'` al tipo `activeTab` en MediaPage + botón en tab bar
2. Crear `ExploradorTercerosTab` con:
   - `subscribeDocumentos(companyId, { status: 'enlazado' })` para todos los docs
   - `subscribeTerceros()` para resolver nombres
   - Grouping por `terceroId` con Map
   - Lista expandible tipo acordeón
3. Reusar patrón de cards de SoportesTab para docs dentro de cada tercero

## Affected Areas
| Area | Impact |
|------|--------|
| `components/media/MediaPage.tsx` | Modified — agregar tab + render condicional |
| `components/media/ExploradorTercerosTab.tsx` | New — lógica de grouping + UI |

## Risks
Bajo. Sin cambios en data layer. ~200 líneas.
