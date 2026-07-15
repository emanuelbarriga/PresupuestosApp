# Design: Pestaña Soportes en Tercero y Proyecto

## Technical Approach

Tabs locales en TerceroView y ProjectView ("Detalle" | "Soportes") con un componente `SoportesTab` compartido que consulta documentos vinculados vía `subscribeDocumentos`. Sin cambios en routing, Entity wrappers, ni Sidepanel.

## Architecture Decisions

### Decision: Tabs dentro del View, no en el Entity wrapper

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Tabs en TerceroEntity/ProjectEntity | Requeriría pasar `activeTab` como prop y duplicar lógica en dos wrappers | ❌ |
| Tabs en TerceroView/ProjectView | Cada View controla su estado local; cero impacto en Entity wrappers o Sidepanel | ✅ |

**Rationale**: El Entity wrapper renderiza View o Form según mode. Los tabs solo aplican en mode `view`. Meterlos en el View mantiene el cambio acotado y evita propagar estado hacia arriba.

### Decision: Extender subscribeDocumentos filters en lugar de crear nueva función

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Nueva función subscribeDocumentosPorEntidad | Duplicación de boilerplate onSnapshot | ❌ |
| Agregar `terceroId` y `projectId` a filters existente | Un solo punto de cambio, backward compatible | ✅ |

**Rationale**: `subscribeDocumentos` ya acepta un objeto `filters` con `status`, `tipoDocumento`, `source`. Agregar `terceroId?: string` y `projectId?: string` es aditivo — todos los callsites existentes siguen funcionando sin cambios.

### Decision: SoportesTab como componente compartido en `components/entities/shared/`

**Rationale**: Misma jerarquía que otros shared components. Recibe `companyId`, `terceroId | projectId`, y `onNavigate`. No conoce si está siendo usado por TerceroView o ProjectView.

## Data Flow

```
Sidepanel → TerceroEntity/ProjectEntity (unchanged)
  └── TerceroView | ProjectView (mode=view)
        ├── state: activeTab = 'detalle' | 'soportes'
        ├── activeTab === 'detalle' → contenido actual (DF + Edit / estado + acordeones)
        └── activeTab === 'soportes' → <SoportesTab
              companyId={companyId}
              terceroId={record.id}    // TerceroView
              projectId={record.id}    // ProjectView
              onNavigate={onNavigate}
            />
              └── subscribeDocumentos(companyId, { terceroId / projectId, status: 'enlazado' })
                    → DocumentoMedio[]
                    → renderiza cards con fileName, tipoDocumento, periodo, montoTotal, proveedorTexto
                    → onClick → onNavigate({ type: 'entity', entity: 'documento', mode: 'view', record: doc })
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/mediaService.ts` | Modify | Agregar `terceroId` y `projectId` a `Filters` type y al armado de constraints |
| `components/entities/shared/SoportesTab.tsx` | Create | Cards con docs vinculados + loading/empty states |
| `components/entities/tercero/TerceroView.tsx` | Modify | Agregar state `activeTab` + tab bar + render condicional |
| `components/entities/project/ProjectView.tsx` | Modify | Agregar state `activeTab` + tab bar + render condicional |

## Interfaces / Contracts

```typescript
// Extensión en lib/mediaService.ts
interface DocumentoFilters {
  status?: DocumentoStatus;
  tipoDocumento?: TipoDocumentoMedio;
  source?: DocumentSource;
  terceroId?: string;    // ← nuevo
  projectId?: string;    // ← nuevo
}

// Nuevo componente en components/entities/shared/SoportesTab.tsx
interface SoportesTabProps {
  companyId: string;
  terceroId?: string;
  projectId?: string;
  onNavigate: (screen: NavScreen) => void;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit — mediaService | Filtros `terceroId`/`projectId` generan constraints correctos | Mock Firestore, verificar query constraints |
| Integration | SoportesTab recibe docs y renderiza cards | Render con mock data, verificar fileName/monto |
| Integration | Empty state y loading spinner | Render sin datos / con undefined |
| E2E (manual) | Click en card navega a DocumentoEntity view | Verificar onNavigate llamado con entity: 'documento', mode: 'view' |

## Migration / Rollout

No migration required. Los documentos en Firestore ya tienen los campos `terceroId` y `projectId` (`DocumentoMedio` type los incluye). La query con `where('status', '==', 'enlazado') + where('terceroId', '==', ...)` necesita un composite index compuesto (`terceroId ASC, status ASC` y `projectId ASC, status ASC`) que Firestore sugerirá automáticamente en dev — agregar a `firestore.indexes.json`.

## Indexes Required

```
- collection: companies/{companyId}/documentos
  fields: terceroId ASC, status ASC
- collection: companies/{companyId}/documentos
  fields: projectId ASC, status ASC
```

## Open Questions

None.
