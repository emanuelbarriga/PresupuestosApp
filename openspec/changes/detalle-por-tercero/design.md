# Design: Detalle por Tercero

## Technical Approach

Add a "Detalle por Tercero" button in the Dashboard header that, on click, groups the current year's `filteredBudgets`/`filteredEjecuciones` by `entityId` per project and opens a new `TerceroGroupPanel` inside the sidepanel's `ViewPanel`. Tercero row drill-down constructs a `SidepanelData` and opens `DataPanel`.

The grouping runs once on button click (snapshot at open time), matching the spec's static-data requirement.

## Architecture Decisions

### Decision: New `RecordDetail` variant vs. separate sidepanel mode

| Option | Tradeoff | Decision |
|--------|----------|----------|
| New var. `type: 'detalle-tercero'` in `RecordDetail` | Follows existing `ViewPanel` dispatch pattern; no new state in page.tsx | **Chosen** |
| Separate `sidepanelData`-like state | Would add third parallel state path; more wiring for no gain | Rejected |

**Rationale**: Every entity view already uses `RecordDetail` → `ViewPanel`. Adding the grouped view as a new variant keeps the dispatch pattern uniform.

### Decision: Grouping logic lives in Dashboard.tsx

**Choice**: Pure function exported from `Dashboard.tsx`, called inside the button's `onClick`.
**Alternatives**: Utility file (`lib/grouping.ts`), Sidepanel component.
**Rationale**: `filteredBudgets`/`filteredEjecuciones` are already computed in Dashboard. A pure function is trivially testable. Keeping it in `Dashboard.tsx` avoids a one-function file.

### Decision: Drill-down from group to DataPanel via existing `onCellClick`

**Choice**: `TerceroGroupPanel` receives an `onCellClick?: (data: SidepanelData) => void` callback through `ViewPanel` → `Sidepanel` → `page.tsx`.
**Alternatives**: New drill-down callback type; internal state in TerceroGroupPanel.
**Rationale**: Reuses the existing `DataPanel` rendering path. The `SidepanelData` construction from a group's budgets/ejecuciones is identical to cell click data — same component, same edit support.

## Data Flow

```
Dashboard header
  │  Click "Detalle por Tercero"
  │  buildTerceroGroups(filteredBudgets, filteredEjecuciones)
  │  constructs RecordDetail { type: 'detalle-tercero', projects[], ... }
  │
  ▼
page.tsx.handleTerceroClick(detail)
  │  setRecordDetail(detail)
  │
  ▼
Sidepanel → ViewPanel
  │  dispatch on type === 'detalle-tercero'
  │
  ▼
TerceroGroupPanel
  │  renders project headers (collapsible)
  │    → tercero rows (entityName, totals)
  │
  ── Click tercero row ──→ onCellClick(SidepanelData)
                              │
                              ▼
                            page.tsx → setSidepanelData(data)
                              │
                              ▼
                            DataPanel (existing)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/types.ts` | Modify | Add `DetalleTerceroGroup` interface + `'detalle-tercero'` RecordDetail variant |
| `components/Dashboard.tsx` | Modify | Add button + `buildTerceroGroups()` function + `onTerceroClick` prop |
| `app/[company]/[[...segments]]/page.tsx` | Modify | Add `handleTerceroClick`; wire `onTerceroClick` to Dashboard + `onCellClick` to Sidepanel |
| `components/Sidepanel.tsx` | Modify | Add `TerceroGroupPanel` component + `onCellClick` prop to SidepanelProps/ViewPanel; wire dispatch |
| `components/__tests__/Sidepanel.test.tsx` | Modify | Add tests for grouping logic + TerceroGroupPanel rendering |

## Interfaces / Contracts

```typescript
// --- lib/types.ts additions ---

export interface DetalleTerceroGroup {
  entityId: string;
  entityName: string;
  entityType: 'client' | 'provider' | 'interno' | '';
  budgets: Budget[];
  ejecuciones: Ejecucion[];
  totalPresupuestado: number;
  totalEjecutado: number;
  diferencia: number;
}

// In RecordDetail union (discriminated by type):
| {
    type: 'detalle-tercero';
    projects: Array<{
      projectId: string;
      projectName: string;
      groups: DetalleTerceroGroup[];
      totalPresupuestado: number;
      totalEjecutado: number;
      diferencia: number;
    }>;
    totalPresupuestado: number;
    totalEjecutado: number;
    diferencia: number;
  }
```

```typescript
// --- Dashboard.tsx additions ---

// New prop:
interface DashboardProps {
  // ... existing props
  onTerceroClick?: (detail: RecordDetail) => void;
}

// Pure grouping function (exported):
export function buildTerceroGroups(
  budgets: Budget[],
  ejecuciones: Ejecucion[],
  mode: 'Presupuestado' | 'Ejecutado',
): Extract<RecordDetail, { type: 'detalle-tercero' }>['projects']
```

```typescript
// --- Sidepanel.tsx additions ---

// New optional prop on SidepanelProps:
interface SidepanelProps {
  // ... existing
  onCellClick?: (data: SidepanelData) => void;  // for tercero drill-down
}

// TerceroGroupPanel signature:
function TerceroGroupPanel({
  projects,
  onCellClick,
  mode,
}: {
  projects: DetalleTerceroProjectGroup[];
  onCellClick?: (data: SidepanelData) => void;
  mode: 'Presupuestado' | 'Ejecutado';
})
```

## Grouping Algorithm (in `Dashboard.tsx`)

```
buildTerceroGroups(budgets, ejecuciones):
  1. Map budgets → projectBudgets: Map<projectId, Budget[]>
  2. Map ejecuciones → projectEjecuciones: Map<projectId, Ejecucion[]>
  3. For each unique projectId:
     a. Group budgets/ejecuciones by entityId within project
     b. Compute totalPresupuestado/Ejecutado per group
     c. Skip groups where both totals === 0
  4. Return projects[] with nested groups

Complexity: O(n) — single pass grouping, no nested loops over data.
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `buildTerceroGroups()` | Pure function: verify correct grouping, aggregation, zero-activity filtering |
| Integration | TerceroGroupPanel rendering | Render with mock data: verify project headers, nested tercero rows, collapse/expand, COP formatting |
| Integration | Drill-down click | Verify `onCellClick` called with correct `SidepanelData` filtered by project+tercero |
| Integration | Dashboard button visibility | Button hidden when both filtered arrays empty; visible when data exists |
| E2E | Full flow | (Skipped — no e2e infra; manually verify) |

## Migration / Rollout

No migration required. New button is purely additive — no existing data or behavior changes. No feature flag needed (< 200 LOC change).

## Delivery Budget

- **Decision needed before apply**: No
- **Chained PRs recommended**: No
- **400-line budget risk**: Low (~165 LOC source + ~60 LOC tests)

## Open Questions

None. Design is fully scoped and consistent with codebase patterns.
