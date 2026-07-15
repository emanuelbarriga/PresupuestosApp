# Tasks: Explorador por Terceros

> Change: `explorador-terceros` (2026-07-14)
> Review Workload: ~200 líneas, single PR, under 400 budget.

---

### T1: MediaPage — agregar tab "Por Tercero"

- **File**: `components/media/MediaPage.tsx`
- **Change**: Modify — agregar tercer tab en la barra y render condicional
- **Details**:
  - Agregar `'explorador'` al tipo de `activeTab` → `'inbox' | 'archivador' | 'explorador'`
  - Agregar botón en tab bar con icono `Users` de `lucide-react` y label "Por Tercero"
  - Render condicional: `{activeTab === 'explorador' && <ExploradorTercerosTab companyId={...} onNavigate={...} />}`
- **Lines**: ~20

---

### T2: ExploradorTercerosTab — componente completo

- **File**: `components/media/ExploradorTercerosTab.tsx` (CREATE)
- **Props**: `{ companyId: string; onNavigate: (screen: NavScreen) => void }`
- **Details**:
  - `subscribeDocumentos(companyId, { status: 'enlazado' })` — todos los documentos enlazados sin filtro de entidad
  - `subscribeTerceros()` — resolver nombre por `terceroId`
  - Agrupar con `useMemo` → `Map<terceroId, DocumentoMedio[]>`, null/undefined → key `"__sintercero__"`
  - Mapa de nombres de terceros (`nameMap: Map<string, string>`)
  - Estado `expandedTerceros: Set<string>` — collapsed por defecto, toggle con click en header
  - Cada grupo: header con nombre del tercero + count badge `(N)` + chevron rotado al expandir
  - Cards de documentos dentro del grupo expandido: fileName, tipoDocumento badge, periodo, montoTotal (COP)
  - Card click → `onNavigate({ type: 'entity', entity: 'documento', mode: 'view', record: doc })`
  - Loading state: spinner mientras no hay datos
  - Empty state: "No hay documentos enlazados" cuando `documentos.length === 0`
  - Constantes inline `TIPO_LABELS`, `TIPO_COLORS`, `formatCOP` (mismo patrón duplicado que SoportesTab y ArchivadorTab)
- **Lines**: ~180
