# Tasks: Sidepanel Navigation Stack

```yaml
strict_tdd: true
test_command: npm test
```

> **Strict TDD**: within each task, write/update tests BEFORE implementation code. Each task starts with red (compiling test changes that capture the desired behavior), then green (implementation that makes them pass). The `verify` column says what to check after implementation.

---

## Overview

Replace 3 mutually-exclusive state vars (`sidepanelData`, `recordDetail`, `activeForm`) with a `NavScreen[]` stack. Add back-navigation via the stack. Remove internal `viewEj`/`viewBudget` toggles in BudgetView/EjecucionView — use `onNavigate` instead. Remove `MiniEjecucionView` — navigation uses stack. Add unified header with `← Volver` + `✕`.

**Total: 9 tasks, ordered by dependency.**

---

## Task 1: Add `NavScreen` type to `lib/types.ts`

| Field | Value |
|-------|-------|
| **Depends on** | None |
| **Strict TDD** | No test needed — pure type addition, no behavior change |
| **Risk** | None |

### Files to modify
- `lib/types.ts`

### What to do
Add the `NavScreen` discriminated union type **after the existing types** (before the `Budget`/`Ejecucion`/etc. concrete types is fine, but after `ActiveForm` since it references it):

```typescript
export type NavScreen =
  | { id: string; type: 'data'; data: SidepanelData }
  | { id: string; type: 'view'; detail: RecordDetail }
  | { id: string; type: 'form'; form: ActiveForm };
```

### Verify
- `npx tsc --noEmit` passes with no errors related to `NavScreen`
- `npm test` still passes (no behavior change)

---

## Task 2: Update page.tsx — navStack state + handlers

| Field | Value |
|-------|-------|
| **Depends on** | Task 1 (NavScreen type) |
| **Strict TDD** | No direct tests for page.tsx. Pure implementation work. |
| **Risk** | Medium — page.tsx will pass new props (`canGoBack`, `onBack`, `onNavigate`) that Sidepanel doesn't accept yet. App will not compile until Task 4. This is expected — the tasks are ordered for dependency, not sequential compilation. |

### Files to modify
- `app/[company]/[[...segments]]/page.tsx`

### What to do

#### 1. Replace state vars (lines 54–56)

**Remove:**
```typescript
const [sidepanelData, setSidepanelData] = useState<SidepanelData | null>(null);
const [recordDetail, setRecordDetail] = useState<RecordDetail | null>(null);
const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
```

**Add:**
```typescript
const [navStack, setNavStack] = useState<NavScreen[]>([]);
```

#### 2. Add derived vars (after state declarations)

```typescript
const current = navStack[navStack.length - 1];
const sidepanelData = current?.type === 'data' ? current.data : null;
const recordDetail = current?.type === 'view' ? current.detail : null;
const activeForm = current?.type === 'form' ? current.form : null;
const canGoBack = navStack.length > 1;
```

Import `NavScreen` from `@/lib/types`.

#### 3. Add push/pop/clear helpers (before `closePanel`)

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

Import `useCallback` from `react` (add to existing import: `import { useState, useEffect, use, useCallback } from 'react'`).

#### 4. Update `closePanel` (line 129)

Replace 3 null-assignments with `clearScreens()`:

```typescript
const closePanel = () => {
  clearScreens();
};
```

#### 5. Update `handleCellClick` (line 151)

Replace:
```typescript
const handleCellClick = (data: SidepanelData) => {
  setRecordDetail(null);
  setActiveForm(null);
  setSidepanelData(data);
  setSidebarCollapsed(true);
};
```

With:
```typescript
const handleCellClick = (data: SidepanelData) => {
  pushScreen({ id: crypto.randomUUID(), type: 'data', data });
};
```

#### 6. Update `handleProjectClick` (line 158)

Replace the 4 setState calls with:
```typescript
pushScreen({ id: crypto.randomUUID(), type: 'view', detail });
```

Remove lines that set `sidepanelData`/`activeForm`/`recordDetail` individually.

#### 7. Update `handleEmptyCellClick` (line 182)

Replace 3 setState calls with:
```typescript
pushScreen({ id: crypto.randomUUID(), type: 'form', form: { mode: 'add', type: formType, defaults } });
```

Remove the `setSidepanelData(null)`, `setRecordDetail(null)`, `setActiveForm(...)` calls.

#### 8. Update `handleViewRecord` (line 210)

Replace with:
```typescript
const handleViewRecord = (detail: RecordDetail) => {
  pushScreen({ id: crypto.randomUUID(), type: 'view', detail });
};
```

#### 9. Update `handleAddNew` (line 217)

Replace with:
```typescript
const handleAddNew = (type: FormType) => {
  pushScreen({ id: crypto.randomUUID(), type: 'form', form: { mode: 'add', type } });
};
```

#### 10. Update `handleEditRecord` (line 224)

Replace with:
```typescript
const handleEditRecord = (form: ActiveForm) => {
  pushScreen({ id: crypto.randomUUID(), type: 'form', form });
};
```

#### 11. Update `handleTerceroClick` (line 231)

Replace with:
```typescript
const handleTerceroClick = (detail: RecordDetail) => {
  if (isConjunto) return;
  pushScreen({ id: crypto.randomUUID(), type: 'view', detail });
};
```

#### 12. Update `handleFormSubmit` (line 239)

**Critical change**: replace `closePanel()` at line 320 with `popScreen()`:

```typescript
// After the switch cases
popScreen();
```

#### 13. Add `handleSidepanelBack` handler

```typescript
const handleSidepanelBack = () => popScreen();
```

#### 14. Update `<Sidepanel>` usage (line 346)

Replace old callbacks with new nav-stack props:

```typescript
<Sidepanel data={sidepanelData} recordDetail={recordDetail} activeForm={activeForm}
  companyId={companyId} onClose={handleSidepanelClose} onFormSubmit={handleFormSubmit}
  onCellClick={handleCellClick}
  canGoBack={canGoBack}
  onBack={handleSidepanelBack}
  onNavigate={pushScreen}
  projects={projectsForCompany} />
```

Remove `onViewRecord`, `onEditProject`, `onEditTercero`, `onEditCellRecord` from the `<Sidepanel>` element.

#### 15. Remove unused imports (after all changes compile)

- Remove `onEditProject`/`onEditTercero`/`onEditCellRecord` inline handler functions if they are no longer referenced elsewhere (they aren't — they were only passed to `<Sidepanel>`).

### Verify
- `npx tsc --noEmit` — may fail until Task 4 is done
- `npm test` — may fail until Task 3 is done
- Verify manually that the new structure compiles conceptually (no `NavScreen` type errors)

---

## Task 3: Update test mocks to use new Sidepanel props

| Field | Value |
|-------|-------|
| **Depends on** | Task 2 (conceptual — we know what new props look like) |
| **Strict TDD** | **YES** — tests first. Update all Sidepanel renders in test file to add new props. No implementation change yet. |
| **Risk** | Low — existing tests should continue passing once SidepanelProps is updated in Task 4 |

### Files to modify
- `components/__tests__/Sidepanel.test.tsx`

### What to do

#### 1. Add imports (top of test file)

Add `NavScreen` to the type imports from `@/lib/types`:
```typescript
import type { ..., NavScreen } from '@/lib/types';
```

#### 2. Update ALL `<Sidepanel>` render calls

Every `<Sidepanel>` render in the test file needs these new required props:
```typescript
canGoBack={false}
onBack={vi.fn()}
onNavigate={vi.fn()}
```

There are ~40+ renders. Add them to every occurrence where `<Sidepanel>` is rendered. Example pattern:
```typescript
<Sidepanel
  data={null}
  recordDetail={null}
  activeForm={...}
  companyId="c1"
  onClose={vi.fn()}
  onFormSubmit={vi.fn().mockResolvedValue(undefined)}
  canGoBack={false}
  onBack={vi.fn()}
  onNavigate={vi.fn()}
/>
```

No old props need to be removed from tests since no tests currently pass `onViewRecord`, `onEditCellRecord`, `onEditProject`, `onEditTercero`.

#### 3. Update imports for `ArrowLeft` icon

The `PanelHeader` component will use `ArrowLeft` from `lucide-react`. Add an import expectation:
- Not needed in tests directly — `ArrowLeft` is only used in Sidepanel.tsx implementation

### Verify
- `npm test` — will fail (red) because `SidepanelProps` doesn't accept `canGoBack`, `onBack`, `onNavigate` yet. This is expected — Task 4 makes them green.

---

## Task 4: Update SidepanelProps + add PanelHeader

| Field | Value |
|-------|-------|
| **Depends on** | Task 3 (test mocks updated — this task makes them pass) |
| **Strict TDD** | **YES** — tests are already red from Task 3. This implementation makes them green. |
| **Risk** | Low — pure interface change + new sub-component. No behavior change to existing panels yet. |

### Files to modify
- `components/Sidepanel.tsx`

### What to do

#### 1. Modify `SidepanelProps` interface (lines 29–42)

Add new props, remove old ones:
```typescript
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
```

Remove: `onEditProject`, `onEditTercero`, `onEditCellRecord`, `onViewRecord`.

Update the function signature to destructure new props and not old ones.

#### 2. Import `ArrowLeft` from `lucide-react`

Add `ArrowLeft` to the lucide-react import (line 8):
```typescript
import { X, FileText, Bell, Settings, Filter, ChevronDown, ChevronUp, Plus, Search, Link2, Unlink, Save, Trash2, Download, Upload, Paperclip, ArrowLeft } from 'lucide-react';
```

#### 3. Add `PanelHeader` component

Add before the `Sidepanel` function (or after the `formatFileSize` helper, around line 17):

```typescript
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

#### 4. Wire PanelHeader into Sidepanel dispatch (lines 56–62)

The `Sidepanel` component renders panels conditionally. Replace the current per-panel header rendering with a unified approach:

For **FormPanel** (all branches):
- Currently each FormPanel branch (project, client/provider/tercero, budget/ejecucion) has its own `<div className="p-6 border-b ...">` with title + close button.
- These must be **removed** from inside FormPanel (Task 8 handles this properly by passing `onBack`).
- For now, the Sidepanel component wraps FormPanel with PanelHeader. But FormPanel's internal headers will still render... 

Actually, this is tricky. The FormPanel renders its own header in 3 places. We need to either:
(a) Remove FormPanel internal headers now and add PanelHeader at the Sidepanel level, or
(b) Add PanelHeader at the Sidepanel level AND keep FormPanel headers temporarily, removing them later.

Approach (b) creates double headers. So approach (a) is better — but it means modifying FormPanel in this task.

Let me reconsider. The PanelHeader should wrap panels at the Sidepanel dispatch level. The Sidepanel currently renders panels directly — each panel function returns a full `div.flex.flex-col.h-full.w-\[360px\]` container with its own header.

**Better approach**: Keep each panel's wrapper div but replace the per-panel header with `<PanelHeader>` at the panel level. This means modifying each panel's internal header, which is what Tasks 5-8 do incrementally.

**Even better approach for this task**: Just update the Sidepanel dispatch to pass `canGoBack`, `onBack`, `onNavigate` down to the panels. Then each panel uses PanelHeader in its own task. This task is minimal — just interface changes.

So for this task:

#### 4. Update Sidepanel dispatch to pass new props

No behavior change to panels yet. Just update the `Sidepanel` return block to pass new props:

```typescript
export function Sidepanel({ data, recordDetail, activeForm, companyId, onClose, onFormSubmit, onCellClick, projects, canGoBack, onBack, onNavigate }: SidepanelProps) {
  const visible = data || recordDetail || activeForm;

  return (
    <aside className={...}>
      {!visible ? (
        // toolbar — unchanged
      ) : activeForm ? (
        <FormPanel form={activeForm} companyId={companyId} onClose={onClose} onSubmit={onFormSubmit}
          projects={projects} onBack={onBack} />
      ) : recordDetail ? (
        <ViewPanel recordDetail={recordDetail} companyId={companyId} onClose={onClose}
          onFormSubmit={onFormSubmit} onCellClick={onCellClick} projects={projects}
          onNavigate={onNavigate} />
      ) : data ? (
        <DataPanel data={data} onClose={onClose} projects={projects}
          onNavigate={onNavigate} />
      ) : null}
    </aside>
  );
}
```

Note:
- `FormPanel` receives new prop `onBack`
- `ViewPanel` receives `onNavigate` (replaces `onEditProject`, `onEditTercero`)
- `DataPanel` receives `onNavigate` (replaces `onEditCellRecord`, `onViewRecord`)
- These panels don't have these props in their interfaces yet — that happens in Tasks 5–8

### Verify
- `npm test` passes (green) — tests compile and render with new props
- `npx tsc --noEmit` — may still fail on FormPanel/ViewPanel/DataPanel internal prop references (those are fixed in later tasks)

---

## Task 5: DataPanel — replace `onViewRecord`/`onEditCellRecord` with `onNavigate`

| Field | Value |
|-------|-------|
| **Depends on** | Task 4 (new SidepanelProps interface exists) |
| **Strict TDD** | **YES** — write a test first that asserts `onNavigate` is called with correct `NavScreen` when user clicks "Ver" or "Editar" in DataPanel |
| **Risk** | Low — pure callback replacement. The shape of the NavScreen is determined by the existing `onViewRecord`/`onEditCellRecord` calls. |

### Test changes first (red)
In `components/__tests__/Sidepanel.test.tsx` — **add new tests** in a new describe block (e.g., describe('R13 — DataPanel navigation via onNavigate')):

```typescript
describe('DataPanel navigation via onNavigate', () => {
  it('click "Ver" on a budget calls onNavigate with type="view" and budget detail', () => {
    const onNavigate = vi.fn();
    // render Sidepanel with data (Presupuestado mode, with budgets), canGoBack, onBack, onNavigate mocks
    // find "Ver" button on a budget row, click it
    // expect onNavigate to have been called with:
    //   expect.objectContaining({ type: 'view', detail: expect.objectContaining({ type: 'budget' }) })
  });

  it('click "Editar" on a budget calls onNavigate with type="form" and edit form', () => {
    const onNavigate = vi.fn();
    // render Sidepanel with data, click "Editar" button
    // expect onNavigate to have been called with:
    //   expect.objectContaining({ type: 'form', form: expect.objectContaining({ mode: 'edit', type: 'budget' }) })
  });

  it('click "+ Ingreso Presupuestado" calls onNavigate with type="form" and add form', () => {
    const onNavigate = vi.fn();
    // render Sidepanel with data that has cell-level project name and month
    // click "+ Ingreso Presupuestado" button
    // expect onNavigate with type="form", mode="add"
  });
});
```

### Implementation (green)

#### Modify `DataPanel` interface (line 1621)

Replace `onEditCellRecord` and `onViewRecord` with `onNavigate`:

```typescript
function DataPanel({ data, onClose, onNavigate, projects }: {
  data: SidepanelData; onClose: () => void; onNavigate: (screen: NavScreen) => void; projects?: Project[];
}) {
```

Add `NavScreen` to import from `@/lib/types`.

#### Replace internal callback calls

**Line 1649**: `onEditCellRecord?.({ mode: 'add', type: formType, defaults })` → `onNavigate?.({ id: crypto.randomUUID(), type: 'form', form: { mode: 'add', type: formType, defaults } })`

**Line 1694**: `onViewRecord?.({ type: 'budget', budget: b, ejecuciones: ejbs })` → `onNavigate?.({ id: crypto.randomUUID(), type: 'view', detail: { type: 'budget', budget: b, ejecuciones: ejbs } })`

**Line 1698**: `onEditCellRecord?.({ mode: 'edit', type: 'budget', record: b })` → `onNavigate?.({ id: crypto.randomUUID(), type: 'form', form: { mode: 'edit', type: 'budget', record: b } })`

**Line 1702**: `onEditCellRecord?.({ mode: 'add', type: 'ejecucion', defaults: {...} })` → `onNavigate?.({ id: crypto.randomUUID(), type: 'form', form: { mode: 'add', type: 'ejecucion', defaults: {...} } })`

**Line 1733**: `onViewRecord?.({ type: 'ejecucion', ejecucion: e })` → `onNavigate?.({ id: crypto.randomUUID(), type: 'view', detail: { type: 'ejecucion', ejecucion: e } })`

**Line 1737**: `onEditCellRecord?.({ mode: 'edit', type: 'ejecucion', record: e })` → `onNavigate?.({ id: crypto.randomUUID(), type: 'form', form: { mode: 'edit', type: 'ejecucion', record: e } })`

#### Replace header section

Replace DataPanel's internal `<div className="p-6 border-b ...">` header (lines 1654–1677) with `<PanelHeader>`. The title should be `Detalle de {tipo} {mode}` where tipo is `'Ingreso' | 'Egreso'` and mode is `'Presupuestado' | 'Ejecutado'`.

```typescript
<PanelHeader
  title={`Detalle de ${data.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} ${data.mode === 'Presupuestado' ? 'Presupuestado' : 'Ejecutado'}`}
  canGoBack={false}  // will be updated when parent passes it
  onBack={() => {}}
  onClose={onClose}
/>
```

**Important**: `PanelHeader` needs `canGoBack` and `onBack` props. DataPanel doesn't receive these from Sidepanel dispatch yet. Either:
- Pass them through from Sidepanel (add `canGoBack` and `onBack` to DataPanel props), or
- Pass them from the parent Sidepanel dispatch directly

The cleanest approach: DataPanel receives `canGoBack` and `onBack` from Sidepanel dispatch:

```typescript
// In Sidepanel dispatch:
{data ? (
  <DataPanel data={data} onClose={onClose} projects={projects}
    onNavigate={onNavigate} canGoBack={canGoBack} onBack={onBack} />
) : null}
```

Update DataPanel interface accordingly.

### Verify
- `npm test` — new tests pass (green)
- All existing tests still pass
- `npx tsc --noEmit` — no type errors in DataPanel

---

## Task 6: BudgetView — remove `viewEj`/`MiniEjecucionView`, use `onNavigate`

| Field | Value |
|-------|-------|
| **Depends on** | Task 4 (ViewPanel receives `onNavigate`) |
| **Strict TDD** | **YES** — update the existing MiniEjecucionView test (3.4c) to assert `onNavigate` is called, and remove the MiniEjecucionView rendering test |
| **Risk** | Medium — BudgetView's `viewEj` is an internal toggle that switches the entire render. Replacing it with `onNavigate` means the MiniEjecucionView content is now rendered via the nav stack (as a separate ViewPanel screen). |

### Test changes first (red)

#### 1. Remove test `3.4c MiniEjecucionView (via BudgetView) muestra comprobantes` (lines 1754–1777)

Delete this test block. It clicks an ejecucion row and expects `MiniEjecucionView` content to appear.

#### 2. Update the existing `R7 — BudgetView` tests

The test at line 1023 (`click en ejecucion row dentro de BudgetView...` in the old tests) — there's no existing test for clicking an ejecucion row in BudgetView (the old test 3.4c is the only one). But the test at line 1023 doesn't click ejecucion, it just renders the BudgetView.

**Add new test** in R7 describe block:

```typescript
it('click ejecucion row calls onNavigate with view detail', () => {
  const onNavigate = vi.fn();
  render(
    <Sidepanel
      data={null}
      recordDetail={{ type: 'budget', budget: makeBudget(), ejecuciones: [makeEjecucion()] }}
      activeForm={null}
      companyId="c1"
      onClose={vi.fn()}
      onFormSubmit={vi.fn().mockResolvedValue(undefined)}
      canGoBack={false}
      onBack={vi.fn()}
      onNavigate={onNavigate}
    />,
  );

  fireEvent.click(screen.getByText(/Ejecucion Test/));

  expect(onNavigate).toHaveBeenCalledTimes(1);
  expect(onNavigate).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'view',
      detail: expect.objectContaining({ type: 'ejecucion' }),
    }),
  );
});
```

#### 3. Update `PendingComprobante` / interface concerns

No change needed — BudgetView already receives `companyId`.

### Implementation (green)

#### 1. Modify `BudgetView` function (line 967)

**Remove:**
- `viewEj` state (line 973)
- The `if (viewEj) { return (... MiniEjecucionView ...) }` block (lines 996–1003)
- Import/usage of `MiniEjecucionView` function call

**Add:**
- `onNavigate` to BudgetView props
- Update the ejecucion row click handler to call `onNavigate` instead of `setViewEj`

#### 2. Replace setViewEj with onNavigate

Line 1023:
```typescript
// OLD:
<div key={e.id} onClick={() => setViewEj(e)} ...>
// NEW:
<div key={e.id} onClick={() => onNavigate?.({ id: crypto.randomUUID(), type: 'view', detail: { type: 'ejecucion', ejecucion: e } })} ...>
```

#### 3. Add PanelHeader

BudgetView is rendered inside ViewPanel which has its own header. The BudgetView's internal content (currently has no header — it relies on ViewPanel's header) should now use `PanelHeader` **at the ViewPanel level** instead. ViewPanel already renders a header (lines 807–810) — replace it with `<PanelHeader>`:

```typescript
// In ViewPanel (this should be done as part of this task since we're touching ViewPanel):
<PanelHeader
  title={title}
  canGoBack={canGoBack}
  onBack={onBack}
  onClose={onClose}
/>
```

ViewPanel needs to receive `canGoBack` and `onBack` props. Update the Sidepanel dispatch to pass them:

```typescript
// In Sidepanel dispatch:
{recordDetail ? (
  <ViewPanel recordDetail={recordDetail} companyId={companyId} onClose={onClose}
    onFormSubmit={onFormSubmit} onCellClick={onCellClick} projects={projects}
    onNavigate={onNavigate} canGoBack={canGoBack} onBack={onBack} />
) : null}
```

#### 4. Clean up MiniEjecucionView

Remove the `MiniEjecucionView` function (lines 1046–1064). Its content is dead code once BudgetView no longer references it.

### Verify
- `npm test` — new test passes, old MiniEjecucionView test removed, existing R7 tests still pass
- `npx tsc --noEmit` — no reference to MiniEjecucionView

---

## Task 7: EjecucionView — remove `viewBudget`, use `onNavigate`

| Field | Value |
|-------|-------|
| **Depends on** | Task 4 (ViewPanel receives `onNavigate`) |
| **Strict TDD** | **YES** — update the existing linked-budget click behavior test to assert `onNavigate` is called |
| **Risk** | Low — same pattern as Task 6. The `viewBudget` internal toggle to `onNavigate` replacement. |

### Test changes first (red)

#### 1. Update the linked budget test (lines 999–1015)

Currently the test at line 999 renders EjecucionView with `budgetId: 'b1'` and emits budgets, then checks the linked budget name appears. **Add a new interaction test** that clicks the linked budget and checks `onNavigate` was called:

```typescript
it('click linked budget calls onNavigate with view detail', async () => {
  const onNavigate = vi.fn();
  render(
    <Sidepanel
      data={null}
      recordDetail={{ type: 'ejecucion', ejecucion: makeEjecucion({ budgetId: 'b1' }) }}
      activeForm={null}
      companyId="c1"
      onClose={vi.fn()}
      onFormSubmit={vi.fn().mockResolvedValue(undefined)}
      canGoBack={false}
      onBack={vi.fn()}
      onNavigate={onNavigate}
    />,
  );

  await emitBudgets([makeBudget({ id: 'b1', descripcion: 'Presupuesto Vinculado' })]);

  // Click the linked budget area
  fireEvent.click(screen.getByText('Presupuesto Vinculado'));

  expect(onNavigate).toHaveBeenCalledTimes(1);
  expect(onNavigate).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'view',
      detail: expect.objectContaining({ type: 'budget' }),
    }),
  );
});
```

### Implementation (green)

#### 1. Modify `EjecucionView` function (line 1375)

**Remove:**
- `viewBudget` state (line 1379)
- The `if (viewBudget) { return (... budget detail ...) }` block (lines 1396–1410)

**Add:**
- `onNavigate` to EjecucionView props

#### 2. Replace setViewBudget with onNavigate

Line 1426:
```typescript
// OLD:
<div onClick={() => setViewBudget(linkedBudget)} ...>
// NEW:
<div onClick={() => onNavigate?.({ id: crypto.randomUUID(), type: 'view', detail: { type: 'budget', budget: linkedBudget, ejecuciones: [] } })} ...>
```

Note: `ejecuciones: []` because when navigating from EjecucionView to a linked budget, we don't have the budget's ejecuciones readily available. The nav screen will push a new `NavScreen` with the linked budget and empty ejecuciones. The existing `subscribeBudgets` is already used in ViewPanel/BudgetView so the data will refresh.

#### 3. Header

EjecucionView already uses ViewPanel's header (replaced with PanelHeader in Task 6). No additional header changes needed.

### Verify
- `npm test` — new test passes, existing R8 tests still pass
- `npx tsc --noEmit` — no type errors

---

## Task 8: Form submit — pop instead of close, FormPanel header

| Field | Value |
|-------|-------|
| **Depends on** | Task 4 (FormPanel receives `onBack`) |
| **Strict TDD** | **YES** — add test that after form submit, `onBack` is called (not `onClose`) |
| **Risk** | Medium — changing FormPanel's submit behavior from `onClose` to `onBack` changes the navigation flow. Previously form submit closed everything; now it pops back. |

### Test changes first (red)

#### 1. Update the `onBack` import

The `ArrowLeft` icon is already imported from Task 4.

#### 2. Add test for form submit pop behavior

In the `R2 — handleSubmit field normalization` describe block (or a new `FormPanel navigation` block):

```typescript
describe('FormPanel submit pops back', () => {
  it('successful submit calls onBack (not onClose)', async () => {
    const onClose = vi.fn();
    const onBack = vi.fn();
    const onFormSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <Sidepanel
        data={null}
        recordDetail={null}
        activeForm={{ mode: 'add', type: 'budget' }}
        companyId="c1"
        onClose={onClose}
        onFormSubmit={onFormSubmit}
        canGoBack={true}
        onBack={onBack}
        onNavigate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Crear'));
    await waitFor(() => {
      expect(onFormSubmit).toHaveBeenCalled();
    });

    // onBack should be called, not onClose
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
```

### Implementation (green)

#### 1. Modify `FormPanel` to accept `onBack` prop

```typescript
function FormPanel({ form, companyId, onClose, onSubmit, projects, onBack }: {
  form: ActiveForm; companyId: string; onClose: () => void; onSubmit: (f: ActiveForm, d: Record<string, any>) => Promise<void>; projects?: Project[]; onBack: () => void;
}) {
```

#### 2. Replace `onClose` with `onBack` after submit

In the `handleSubmit` function (line 186), after all entries are submitted:

```typescript
// After the for loop and setSaving(false)
setSaving(false);
onBack();  // POP back instead of closing all
```

**Do NOT** call `onClose()` — that clears the entire stack. The `popScreen` in page.tsx (Task 2) will remove the form screen from the stack, revealing the previous screen.

#### 3. Replace internal headers with PanelHeader

FormPanel has 3 different header blocks (project form at line 313, client/provider form at line 394, budget/ejecucion form at line 446). Each has:
```typescript
<div className="p-6 border-b border-slate-100 shrink-0 flex items-center justify-between">
  <h2 className="font-bold text-slate-800">{title}</h2>
  <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
</div>
```

Replace each one with:
```typescript
<PanelHeader
  title={title}
  canGoBack={true}  // always true when form is in nav stack
  onBack={onBack}
  onClose={onClose}
/>
```

Note: `canGoBack` is always true when a form is in the stack (stack.length > 1), but FormPanel doesn't know the stack depth. It receives `onBack` which it calls — if the stack is empty (single screen), `onBack` is a no-op in page.tsx. For simplicity, always show back — the parent controls `canGoBack` at the Sidepanel level, not per-panel.

Actually, looking at the design again: `canGoBack` is derived from `navStack.length > 1` at the page level and passed to Sidepanel. For the PanelHeader inside FormPanel, we need to pass `canGoBack` from Sidepanel to FormPanel. Update Sidepanel dispatch:

```typescript
{activeForm ? (
  <FormPanel form={activeForm} companyId={companyId} onClose={onClose} onSubmit={onFormSubmit}
    projects={projects} onBack={onBack} canGoBack={canGoBack} />
) : null}
```

Add `canGoBack` to FormPanel props.

### Verify
- `npm test` — new form-pop test passes, all existing form tests still pass
- `npx tsc --noEmit` — no errors

---

## Task 9: Final cleanup — remove dead code, verify all tests pass

| Field | Value |
|-------|-------|
| **Depends on** | Tasks 1–8 |
| **Strict TDD** | No new tests — verification only |
| **Risk** | Low — pure cleanup. Watch for unused import errors. |

### Files to modify
- `components/Sidepanel.tsx`
- `app/[company]/[[...segments]]/page.tsx`
- `components/__tests__/Sidepanel.test.tsx`

### What to do

#### 1. Sidepanel.tsx — remove dead imports

Remove from the `@/lib/types` import:
- No types should need removal if we already removed them in previous tasks

Remove from the `lucide-react` import:
- Check which icons are still used. `ArrowLeft` was added, nothing else changed.

#### 2. Sidepanel.tsx — verify no old prop references

Ensure:
- `SidepanelProps` interface has only new props (no `onViewRecord`, `onEditCellRecord`, `onEditProject`, `onEditTercero`)
- `DataPanel` interface and function use only `onNavigate`, `canGoBack`, `onBack`
- `ViewPanel` interface and function use only `onNavigate`, `canGoBack`, `onBack`
- `BudgetView` has no `viewEj` state
- `EjecucionView` has no `viewBudget` state
- `MiniEjecucionView` function is removed
- `FormPanel` interface has `onBack` and `canGoBack`

#### 3. page.tsx — remove dead imports

Check `import ... from '@/lib/types'` — remove unused imports (specifically check if `FormType` is still used after `handleAddNew` is refactored — yes, it's still used by `handleAddNew` parameter type). Remove `onEditProject`/`onEditTercero` inline handler functions if they still exist.

#### 4. Test file — verify MiniEjecucionView test removed

The test `3.4c MiniEjecucionView (via BudgetView) muestra comprobantes` (lines 1754–1777) should be gone.

#### 5. Full test run

```bash
npm test
```

Expected: all tests pass (green).

#### 6. Type check

```bash
npx tsc --noEmit
```

Expected: zero errors.

#### 7. Lint

```bash
npm run lint
```

Expected: zero warnings/errors.

---

## Dependency graph

```
Task 1 (NavScreen type)
  └─▶ Task 2 (page.tsx navStack)
  └─▶ Task 4 (SidepanelProps) ◀─ Task 3 (test mocks) [TDD cycle]
        ├─▶ Task 5 (DataPanel → onNavigate)
        ├─▶ Task 6 (BudgetView → onNavigate, remove MiniEjecucionView)
        ├─▶ Task 7 (EjecucionView → onNavigate)
        └─▶ Task 8 (FormPanel → onBack)
              └─▶ Task 9 (cleanup, verify)
```

**TDD flow within each behavioral task (5–8):**
1. Update/add tests with new behavior expectations → tests fail (red)
2. Implement the behavior change → tests pass (green)

---

## Appendix: Callback mapping reference

| Context | Old call | New call |
|---------|---------|----------|
| DataPanel "Ver" on budget | `onViewRecord?.({ type: 'budget', budget, ejecuciones })` | `onNavigate({ id: crypto.randomUUID(), type: 'view', detail: { type: 'budget', budget, ejecuciones } })` |
| DataPanel "Editar" on budget | `onEditCellRecord?.({ mode: 'edit', type: 'budget', record })` | `onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'edit', type: 'budget', record } })` |
| DataPanel "+ Ejecutar" | `onEditCellRecord?.({ mode: 'add', type: 'ejecucion', defaults })` | `onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'add', type: 'ejecucion', defaults } })` |
| DataPanel "Ver" on ejecucion | `onViewRecord?.({ type: 'ejecucion', ejecucion })` | `onNavigate({ id: crypto.randomUUID(), type: 'view', detail: { type: 'ejecucion', ejecucion } })` |
| DataPanel "+ Ingreso/Egreso" | `onEditCellRecord?.({ mode: 'add', type, defaults })` | `onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'add', type, defaults } })` |
| BudgetView click ejecucion row | `setViewEj(ejecucion)` | `onNavigate({ id: crypto.randomUUID(), type: 'view', detail: { type: 'ejecucion', ejecucion } })` |
| EjecucionView click linked budget | `setViewBudget(linkedBudget)` | `onNavigate({ id: crypto.randomUUID(), type: 'view', detail: { type: 'budget', budget: linkedBudget, ejecuciones: [] } })` |
| FormPanel submit done | `onClose()` | `onBack()` |
