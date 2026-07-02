# Design: Sidepanel Navigation Stack

## Technical Approach

Replace three mutually-exclusive state vars (`sidepanelData`, `recordDetail`, `activeForm`) in `page.tsx` with a `NavScreen[]` stack. The active screen is derived from `stack[length-1]`, enabling LIFO navigation. Internal toggles in `BudgetView` (`viewEj`) and `EjecucionView` (`viewBudget`) are replaced by `onNavigate` callback calls, pushing new screens onto the stack. `MiniEjecucionView` is deleted — its content lives on via nav stack screens. All sub-panels (DataPanel, ViewPanel, FormPanel) share a unified header with conditional back arrow.

## Architecture Decisions

| Decision | Alternatives | Rationale |
|---|---|---|
| **Stack array in page.tsx** (not a reducer/context) | useReducer, zustand, context | Three derived vars and two helpers (push/pop) is minimal complexity. A reducer would add ceremony with no benefit for 2-direction nav. Context is unnecessary — only one consumer (Sidepanel). |
| **Helper functions over raw setState** | Spread + slice inline in event handlers | `pushScreen` / `popScreen` / `clearScreens` encapsulate the slice/spread pattern. Reduces copy-paste errors (e.g. forgetting to setSidebarCollapsed). |
| **`onNavigate` for forward nav** (not passing setState down) | Pass `setNavStack` to sub-components | Keeps sub-components decoupled from the stack shape. `onNavigate` accepts a `NavScreen` and callers don't need to know about push vs replace semantics. |
| **Unified header in Sidepanel.tsx** (not per-panel) | Each panel keeps its own header | Removes duplicated header markup in DataPanel, ViewPanel, and all FormPanel branches. Props `canGoBack` + `onBack` flow from parent, panels become pure content. |
| **FormPanel receives `onBack` via props** | Call `onNavigate` after submit | After form submit, the panel itself calls `onBack` (pop). This avoids leaking stack logic into `handleFormSubmit` in page.tsx, keeping the submit handler as a pure data mutation. |
| **Type discriminant via `type` field on NavScreen** | Separate arrays per type | Single array with discriminant keeps ordering implicit (index = position), matching UI semantics. |

## Data Flow

```
page.tsx                           Sidepanel.tsx
┌──────────────────┐               ┌──────────────────────────┐
│ navStack          │────props────▶│ onNavigate, onBack,      │
│ current = stack[-1]│             │ canGoBack                │
│ pushScreen()      │              │                          │
│ popScreen()       │              │  ┌──────────────────┐    │
│ clearScreens()    │◀─callback───  │  │ DataPanel        │    │
└──────────────────┘              │  │  → onNavigate    │    │
        │                         │  │  → onNavigate     │    │
        │ pushScreen(...)          │  └──────────────────┘    │
        │ from:                   │  ┌──────────────────┐    │
        │  handleCellClick        │  │ ViewPanel         │    │
        │  handleViewRecord       │  │  BudgetView       │    │
        │  handleEditRecord       │  │  → onNavigate     │    │
        │  handleFormSubmit       │  │  EjecucionView    │    │
        │                         │  │  → onNavigate     │    │
        │                         │  │  ProjectView      │    │
        │                         │  │  → onNavigate     │    │
        │                         │  └──────────────────┘    │
        │                         │  ┌──────────────────┐    │
        │                         │  │ FormPanel         │    │
        │                         │  │  → onBack (post-  │    │
        │                         │  │    submit)        │    │
        │                         │  └──────────────────┘    │
        │                         └──────────────────────────┘
```

### Navigation flows

```
1) Cell click → DataPanel → "Ver" budget → ViewPanel(budget)
2) ViewPanel(budget) → click ejecucion → ViewPanel(ejecucion) → back → ViewPanel(budget)
3) DataPanel → "Editar" → FormPanel(edit) → submit → pop → DataPanel
4) DataPanel → "+ Ingreso" → FormPanel(add) → submit → pop → DataPanel
5) Any → "✕" → clears all → sidebar uncollapses
```

## File Changes

| File | Action | Description |
|---|---|---|
| `app/[company]/[[...segments]]/page.tsx` | Modify | Replace 3 state vars + 5 handlers with `navStack` + `pushScreen`/`popScreen`/`clearScreens`. Remove `onViewRecord`, `onEditCellRecord`, `onEditProject`, `onEditTercero` from Sidepanel usage. Add `canGoBack`, `onBack`, `onNavigate`. |
| `components/Sidepanel.tsx` | Modify | New `SidepanelProps` interface (add `canGoBack`, `onBack`, `onNavigate`; remove `onViewRecord`, `onEditCellRecord`, `onEditProject`, `onEditTercero`). Unified header component used by all three panels. BudgetView: remove `viewEj` state, click ejecucion → `onNavigate`. EjecucionView: remove `viewBudget` state, click linked budget → `onNavigate`. Remove `MiniEjecucionView`. FormPanel: call `onBack` after submit. |
| `lib/types.ts` | Modify | Add `NavScreen` type export. |
| `components/__tests__/Sidepanel.test.tsx` | Modify | Update mocks for new props, remove MiniEjecucionView tests, add nav stack scenarios (back, forward, pop after submit). |

## Interfaces / Contracts

```typescript
// lib/types.ts — NEW
export type NavScreen =
  | { id: string; type: 'data'; data: SidepanelData }
  | { id: string; type: 'view'; detail: RecordDetail }
  | { id: string; type: 'form'; form: ActiveForm };

// components/Sidepanel.tsx — MODIFIED
interface SidepanelProps {
  data: SidepanelData | null;
  recordDetail: RecordDetail | null;
  activeForm: ActiveForm | null;
  companyId: string;
  onClose: () => void;
  onFormSubmit: (form: ActiveForm, data: Record<string, any>) => Promise<void>;
  onCellClick?: (data: SidepanelData) => void;
  projects?: Project[];

  // NEW
  canGoBack: boolean;
  onBack: () => void;
  onNavigate: (screen: NavScreen) => void;
}

// page.tsx — NEW state + derived vars
const [navStack, setNavStack] = useState<NavScreen[]>([]);

const current = navStack[navStack.length - 1];
const sidepanelData = current?.type === 'data' ? current.data : null;
const recordDetail = current?.type === 'view' ? current.detail : null;
const activeForm = current?.type === 'form' ? current.form : null;
const canGoBack = navStack.length > 1;
```

### Push/pop/clear helpers

```typescript
const pushScreen = useCallback((screen: NavScreen) => {
  setNavStack(prev => [...prev, screen]);
  setSidebarCollapsed(true);
}, []);

const popScreen = useCallback(() => {
  setNavStack(prev => prev.slice(0, -1));
}, []);

const clearScreens = useCallback(() => {
  setNavStack([]);
  setSidebarCollapsed(false);
}, []);
```

### Callback mapping

| Old handler | New call |
|---|---|
| `onViewRecord?.(detail)` | `onNavigate?.({ id: crypto.randomUUID(), type: 'view', detail })` |
| `onEditCellRecord?.(form)` | `onNavigate?.({ id: crypto.randomUUID(), type: 'form', form })` |
| `onEditProject?.(project)` | `onNavigate?.({ id: crypto.randomUUID(), type: 'form', form: { mode: 'edit', type: 'project', record: project } })` |
| `onEditTercero?.(tercero)` | removed (currently unused in ViewPanel) |
| BudgetView `setViewEj(ej)` | `onNavigate?.({ id: crypto.randomUUID(), type: 'view', detail: { type: 'ejecucion', ejecucion: ej } })` |
| EjecucionView `setViewBudget(b)` | `onNavigate?.({ id: crypto.randomUUID(), type: 'view', detail: { type: 'budget', budget: b, ejecuciones: [] } })` |

### Unified header component

```tsx
function PanelHeader({ title, canGoBack, onBack, onClose }: {
  title: string; canGoBack: boolean; onBack: () => void; onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {canGoBack && (
          <button onClick={onBack}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <ArrowLeft size={18} />
          </button>
        )}
        <h3 className="text-sm font-bold text-slate-800 truncate">{title}</h3>
      </div>
      <button onClick={onClose}
        className="p-1 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
        <X size={20} className="text-slate-400" />
      </button>
    </div>
  );
}
```

Dynamic titles per panel type: DataPanel → `"Detalle de {tipo} {mode}"`, ViewPanel → type name (e.g. "Presupuesto", "Ejecución"), FormPanel → `"{mode === 'add' ? 'Nuevo' : 'Editar'} {typeLabel}"`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `NavScreen` discriminant resolution (`current.type` mapping to null/not-null) | Type-level tests via ts-expect-error + runtime discriminant checks |
| Unit | push/pop/clear logic | Pure function tests on `pushScreen`, `popScreen`, `clearScreens` (extract helpers or test via render+fireEvent) |
| Integration | BudgetView click ejecucion → `onNavigate` called with correct `NavScreen` | Render BudgetView, mock `onNavigate`, click row, assert call args |
| Integration | EjecucionView click linked budget → `onNavigate` called | Mock `onNavigate`, stub `subscribeBudgets`, click linked row |
| Integration | Form submit → `onBack` called (not `onClose`) | Mock both callbacks, submit, assert `onBack` was called |
| Integration | Header renders "← Volver" when `canGoBack=true` | Render each panel type with `canGoBack=true/false`, assert DOM presence/absence |
| E2E | Multi-step navigation flow (DataPanel → View → Form → back → back → close) | Manual testing via browser |

## Migration / Rollout

No migration required. Pure client-side refactor — no data schema changes. Rollback via `git revert <commit>`.

## Open Questions

- [ ] **Screen ID strategy**: should IDs use `crypto.randomUUID()` or a more meaningful key (e.g. `${type}-${budgetId}`) to prevent duplicate pushes? For now `randomUUID()` is simplest — risk of duplicate is negligible and cosmetic only (no key-based dedup needed).
- [ ] **FormPanel submit → pop**: current plan calls `onBack` from inside FormPanel's `handleSubmit`. This couples FormPanel to nav semantics. Alternative: return a result from `onFormSubmit` and pop in the parent. The `onBack` approach is simpler but adds a prop. Vote: `onBack` inside FormPanel (less indirection).
