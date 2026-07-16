# Design: Explorador por Terceros

## Technical Approach

Add a third tab `'explorador'` to `MediaPage` alongside Inbox and Archivador. Create a new `ExploradorTercerosTab` component that subscribes to all `enlazado` documents (no entity/period filter), subscribes to all terceros via `subscribeTerceros()`, groups documents client-side by `terceroId`, and renders an accordion list reusing the same card pattern as `SoportesTab`. Document click navigates via `onNavigate({ type: 'entity', entity: 'documento', mode: 'view', record: doc })`.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Group on client vs. Firestore query per tercero | Client grouping = 2 subscriptions (docs + terceros), no composite indexes needed. Server grouping would require N queries per tercero. | **Client-side `useMemo` Map** |
| Inline TIPO_LABELS/TIPO_COLORS/formatCOP vs. extract shared util | They already exist in `SoportesTab.tsx` and `ArchivadorTab.tsx` as duplicates. Extracting is out of scope — duplicate here too for consistency. | **Inline constants** within `ExploradorTercerosTab` |
| Single subscription for all docs vs. paginated | Data set is small (hundreds, not thousands). Real-time snapshot is the existing pattern. | **`subscribeDocumentos(companyId, { status: 'enlazado' })`** |

## Data Flow

```
MediaPage (activeTab: 'inbox' | 'archivador' | 'explorador')
  │
  └── activeTab === 'explorador' → <ExploradorTercerosTab />
        │
        ├── subscribeDocumentos(companyId, { status: 'enlazado' })
        │     → documentos: DocumentoMedio[] (todos los enlazados)
        │
        ├── subscribeTerceros()
        │     → terceros: Tercero[] (todos no archivados)
        │
        └── useMemo(() => {
              // groupBy terceroId
              const map = new Map<string, DocumentoMedio[]>();
              docs.forEach(doc => {
                const key = doc.terceroId ?? '__sintercero__';
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(doc);
              });
              return map;
            }, [documentos])
            →
            Map<terceroId, DocumentoMedio[]>  (groups)
            +
            Map<terceroId, string>           (names from terceros)

            Accordion renders:
              ┌─ Tercero Name (5 docs) ────── [expand ▾]
              │  [DocumentCard] [DocumentCard] [DocumentCard]
              ├─ Otro Tercero (2 docs) ────── [expand ▾]
              └─ Sin tercero (1 doc) ──────── [expand ▾]
```

## Component Tree

```
MediaPage
├── InboxTab
├── ArchivadorTab
└── ExploradorTercerosTab (NEW)
    ├── state: documentos → subscribeDocumentos(enlazado)
    ├── state: terceros → subscribeTerceros()
    ├── state: expandedTerceros → Set<string>
    ├── grouped: Map<terceroId, docs[]> + nameMap: Map<terceroId, name>
    ├── Loading state (spinner)
    ├── Empty state ("No hay documentos enlazados")
    └── TerceroGroupList
        └── TerceroGroup (per key)
            ├── Header: name + (N) badge + chevron
            └── Expanded: DocumentCard (reuse card pattern from SoportesTab)
```

## Expand/Collapse Algorithm

- `expandedTerceros: Set<string>` — initialized empty (all collapsed)
- `toggleExpand(id)` — if present delete it, else add it (toggle)
- Renders only expanded groups' cards

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `components/media/MediaPage.tsx` | Modify | Add `'explorador'` to `activeTab` union type, add 3rd tab button, render `ExploradorTercerosTab` conditionally |
| `components/media/ExploradorTercerosTab.tsx` | Create | ~200 lines: subscriptions, grouping, accordion, document cards |

## Interfaces / Contracts

```
Props:
  companyId: string
  onNavigate: (screen: NavScreen) => void

activeTab union (MediaPage):
  'inbox' | 'archivador' | 'explorador'

Group key:
  "__sintercero__"  // for null/undefined terceroId
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Grouping logic (Map construction, null key) | Pure function test with mocked DocumentoMedio[] |
| Unit | Expand/collapse toggle | Test `expandedTerceros` Set behavior |
| Integration | ExploradorTercerosTab renders, subscriptions fire | @testing-library/react + vi.mock on subscribeDocumentos/subscribeTerceros |
| Type | `npx tsc --noEmit` | Must pass without new errors |

## Migration / Rollout

No migration required. New tab renders data already in Firestore; existing documents are unaffected.

## Open Questions

None.
