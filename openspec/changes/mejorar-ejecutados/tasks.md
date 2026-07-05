# Tasks: Mejorar Ejecutados — Implementation Breakdown

> Phase: tasks · Change: `mejorar-ejecutados` · Date: 2026-07-05

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| **Total estimated changed lines** | ~530 |
| **PR0** (delete-ejecuciones script) | ~30 lines |
| **PR1** (banco: cuentaId/cuentaName) | ~100 lines |
| **PR2** (comprobantes: pure function + badges + seed) | ~170 lines |
| **PR3** (budget link: junction + writeBatch + collectionGroup) | ~260 lines |
| **400-line budget risk — PR0** | No (30 lines) |
| **400-line budget risk — PR1** | No (100 lines) |
| **400-line budget risk — PR2** | No (170 lines) |
| **400-line budget risk — PR3** | No (260 lines, within budget) |
| **Chained PRs recommended** | Yes (already decided: force-chained + feature-branch-chain) |
| **Decision needed before apply** | No |

### Chain Topology

```
feature/mejorar-ejecutados  ←─ PR0 (base)
feature/mejorar-ejecutados  ←─ PR1 (base)
feature/mejorar-ejecutados/banco-con-cuentas  ←─ PR2 (from PR1 branch)
feature/mejorar-ejecutados/comprobantes-y-budget-links  ←─ PR3 (from PR2 branch)
```

PR0 and PR1 both target `feature/mejorar-ejecutados`. PR0 merges first (cleanup),
then PR1 (banco fields). PR2 targets the branch that already contains PR0+PR1.
PR3 targets the branch that already contains PR0+PR1+PR2.

Only `feature/mejorar-ejecutados` merges to `main` at the end.

---

## PR0 — Pre-work Cleanup

### PR0-T1: Create delete-ejecuciones script
- **PR**: 0
- **Depends on**: None
- **Files**: `scripts/delete-ejecuciones.ts` (create)
- **[x] Done**
- **Description**:
  Create a one-time TypeScript script (`npx tsx scripts/delete-ejecuciones.ts`) that
  iterates ALL documents in `companies/*/ejecuciones/*` and deletes them using
  Firestore batch deletes (500 at a time). Must handle the case where ejecuciones
  have comprobantes with Storage files — log file paths but do NOT delete Storage
  (orphaned files are acceptable for this cleanup).

  Script structure:
  - Initialize Firebase Admin SDK (same pattern as `scripts/seed.ts`)
  - Query all companies from `companies` collection
  - For each company, query `ejecuciones` subcollection
  - Batch delete up to 500 ejecucion docs at a time
  - Log count of deleted ejecuciones per company
  - Handle errors gracefully (continue on batch failure)

- **Verification**:
  1. Run `npx tsx scripts/delete-ejecuciones.ts --dry-run` (simulate if implemented)
  2. Run with `--adminUid=xxx` and check Firestore console — all ejecuciones gone
  3. Check that `companies/{id}/ejecuciones/` is empty after run
  4. Confirm script has `--dry-run` mode that logs what would be deleted without deleting

- **Risk**: low (one-time script, only affects dev/staging data)

---

## PR1 — Bank Account on Ejecucion (Banco)

### PR1-T1: Add cuentaId/cuentaName to Ejecucion type and deserializer
- **PR**: 1
- **Depends on**: PR0-T1 (ejecuciones must be deleted first)
- **Files**: `lib/types.ts` (modify), `lib/firestore.ts` (modify)
- **Description**:
  **`lib/types.ts`**: Add two optional fields to the `Ejecucion` interface:
  ```typescript
  cuentaId?: string;
  cuentaName?: string;
  ```

  **`lib/firestore.ts`**: In `subscribeEjecuciones` callback (lines ~211-228),
  add deserialization for the two new fields:
  ```typescript
  cuentaId: data.cuentaId ?? undefined,
  cuentaName: data.cuentaName ?? undefined,
  ```
  Also add `cuentaId` and `cuentaName` to the `addEjecucion` function — they
  will be `undefined` by default and simply spread from the data object via
  the existing `{ ...ejecucion }` pattern. No special handling needed.

- **Verification**:
  1. TypeScript compiles without errors
  2. `subscribeEjecuciones` snapshot callback correctly resolves `cuentaId` and `cuentaName`
  3. Legacy docs (without fields) show `undefined` (safe) after deserialization
  4. `makeEjecucion({})` in test files compiles without requiring the new fields

- **Risk**: low (simple additive schema change)

### PR1-T2: Add bank account SearchableSelect to FormPanel
- **PR**: 1
- **Depends on**: PR1-T1 (types must exist first)
- **Files**: `components/Sidepanel.tsx` (modify — FormPanel, ~line 1447 area)
- **Description**:
  Add a `subscribeCuentasBancarias(companyId)` subscription (import already exists
  in the file) to populate the bank account list. The subscription goes in the
  same `useEffect` as the existing subscriptions (line ~939).

  Add state variables:
  ```typescript
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  ```

  In the `ft === 'ejecucion'` branch (after the ComprobanteUploader section, around
  line 1474), add a `SearchableSelect` for bank account:
  ```typescript
  <SearchableSelect label="Cuenta bancaria (opcional)" value={f('cuentaId')} onChange={v => {
    set('cuentaId', v);
    const c = cuentas.find(c => c.id === v);
    if (c) set('cuentaName', `${c.banco} - ${c.nombre} (${c.tipo})`);
  }} options={cuentas.map(c => ({ value: c.id, label: `${c.banco} - ${c.nombre} (${c.tipo})` }))} placeholder="Buscar cuenta bancaria..." />
  ```

  The `cuentaName` is set from the selected account using the composite format
  `"{banco} - {nombre} ({tipo})"`. When no bank account is selected, both
  `cuentaId` and `cuentaName` remain empty strings (they are optional).

- **Verification**:
  1. Visual: Nueva Ejecución form shows "Cuenta bancaria (opcional)" after comprobantes
  2. Selecting a bank account populates both `cuentaId` and `cuentaName` in form state
  3. Submitting with bank account persists `cuentaId` + `cuentaName` in Firestore
  4. Submitting without bank account persists without those fields

- **Risk**: low

### PR1-T3: Show cuentaName in EjecucionView and Datos.tsx
- **PR**: 1
- **Depends on**: PR1-T1
- **Files**: `components/Sidepanel.tsx` (modify — EjecucionView), `components/Datos.tsx` (modify — ejecucion rows)
- **Description**:
  **`Sidepanel.tsx` — EjecucionView** (around line 2395): Add a read-only field
  showing bank account after the Fecha field:
  ```typescript
  <DF label="Cuenta bancaria" v={ejecucion.cuentaName || 'Sin cuenta bancaria'} />
  ```

  **`Datos.tsx`** (around line 422-446): In the ejecucion row, add a bank account
  indicator column. Add a new `<th>` after "Comp." and before "Monto":
  ```
  <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Banco</th>
  ```
  And in the `<td>` section, add:
  ```
  <td className="p-3 text-slate-500 max-w-[120px] truncate">
    {e.cuentaName || <span className="text-slate-300">—</span>}
  </td>
  ```
  Note: Adding a column changes all column offsets. Make sure monto and action
  columns stay aligned.

- **Verification**:
  1. EjecucionView shows "Cuenta bancaria: Banco de Bogotá - Corriente 1234"
  2. EjecucionView shows "Cuenta bancaria: Sin cuenta bancaria" when no account
  3. Datos.tsx ejecucion table shows bank name column with truncated text
  4. Datos.tsx shows "—" when no bank account

- **Risk**: low (UI-only, additive)

### PR1-T4: Tests for bank account on Ejecucion
- **PR**: 1
- **Depends on**: PR1-T1, PR1-T2, PR1-T3
- **Files**: `lib/__tests__/firestore.test.ts` (modify), `components/__tests__/Sidepanel.test.tsx` (modify), possibly new test file `lib/__tests__/comprobantes.test.ts` (for future use)
- **Description**:
  **`lib/__tests__/firestore.test.ts`**: Add tests:
  - `addEjecucion` includes `cuentaId` and `cuentaName` when provided
  - `addEjecucion` omits `cuentaId`/`cuentaName` when not provided (optional)
  - `subscribeEjecuciones` deserializer handles docs with/without the new fields

  **`components/__tests__/Sidepanel.test.tsx`**: Add tests:
  - `type=ejecucion` form shows "Cuenta bancaria (opcional)" label
  - Bank account selection sets `cuentaId` and `cuentaName` in submit data
  - EjecucionView displays `cuentaName` when present

- **Verification**: `npx vitest run` passes all tests
- **Risk**: low

---

## PR2 — Comprobantes Capability

### PR2-T1: Create derivarEstadoComprobantes pure function
- **PR**: 2
- **Depends on**: PR1-T1 (types exist)
- **Files**: `lib/comprobantes.ts` (create)
- **[x] Done
- **Description**:
  Create `lib/comprobantes.ts` with the pure function and types for deriving
  comprobante state from an ejecucion's comprobantes array.

  Exports:
  ```typescript
  export type ComprobanteState = 'Completada' | 'Falta un comprobante' | 'Sin comprobantes';
  export type ComprobanteGranularity = 'falta_pago' | 'falta_cuenta_cobro' | null;

  export interface ComprobanteStateResult {
    estado: ComprobanteState;
    faltante?: ComprobanteGranularity;
  }

  export const REQUIRED_COMPROBANTE_TYPES = [
    { name: 'Comprobante de pago', code: 'falta_pago' },
    { name: 'Cuenta de Cobro', code: 'falta_cuenta_cobro' },
  ];
  ```

  Function:
  ```typescript
  export function derivarEstadoComprobantes(
    comprobantes: Comprobante[],
    requiredTypes?: { name: string; code: string }[],
  ): ComprobanteStateResult
  ```

  Logic (as per design.md Section 2A):
  1. Build a `Set` of present tipos from the comprobantes array (filtering out falsy)
  2. Filter required types to find which are missing
  3. All present → `{ estado: 'Completada' }`
  4. None present → `{ estado: 'Sin comprobantes' }`
  5. Exactly 1 missing → `{ estado: 'Falta un comprobante', faltante: code }`
  6. 2+ missing (future-proofing) → `{ estado: 'Falta un comprobante' }` with no granularity

  Default `requiredTypes` to `REQUIRED_COMPROBANTE_TYPES` when not provided.

- **Verification** (by unit test, see PR2-T6):
  1. `derivarEstadoComprobantes([{ tipo: 'Comprobante de pago' }, { tipo: 'Cuenta de Cobro' }])` → `{ estado: 'Completada' }`
  2. `derivarEstadoComprobantes([{ tipo: 'Comprobante de pago' }])` → `{ estado: 'Falta un comprobante', faltante: 'falta_cuenta_cobro' }`
  3. `derivarEstadoComprobantes([])` → `{ estado: 'Sin comprobantes' }`
  4. `derivarEstadoComprobantes([{ tipo: 'Factura' }])` → `{ estado: 'Sin comprobantes' }`

- **Risk**: low (pure function, no side effects)

### PR2-T2: Update seed with new tipoComprobante entries
- **PR**: 2
- **Depends on**: None (can run in parallel with PR2-T1)
- **Files**: `scripts/seed.ts` (modify)
- **[x] Done
- **Description**:
  In the `defaultSettings` object (lines ~78-83), add two new entries to the
  `tipoComprobante` array AFTER the existing `Efectivo` entry (order 3):

  ```typescript
  tipoComprobante: [
    { name: 'Factura', color: '#6366f1', order: 0 },
    { name: 'Recibo', color: '#22c55e', order: 1 },
    { name: 'Transferencia', color: '#f59e0b', order: 2 },
    { name: 'Efectivo', color: '#06b6d4', order: 3 },
    { name: 'Comprobante de pago', color: '#8b5cf6', order: 4 },
    { name: 'Cuenta de Cobro', color: '#f97316', order: 5 },
  ];
  ```

  Also ensure seed does NOT create ejecuciones with `budgetId` — the seed
  already creates ejecuciones via the `ejecuciones` array on transactions
  but `scripts/seed.ts` creates transactions (not budgets/ejecuciones in
  the current Firestore structure, see `transactions` collection). For ahora,
  no change needed to the ejecucion creation since seed only creates
  `transactions` (a separate legacy collection), not `budgets`/`ejecuciones`.
  The actual budget/ejecucion subcollections are managed through the app UI.

- **Verification**:
  1. Run seed, check settings/tipoComprobante — "Comprobante de pago" and "Cuenta de Cobro" appear
  2. Orders are 4 and 5 respectively
  3. Colors match design: `#8b5cf6` (purple) and `#f97316` (orange)

- **Risk**: low

### PR2-T3: Wire derivarEstadoComprobantes into Datos filter state
- **PR**: 2
- **Depends on**: PR2-T1
- **Files**: `components/Datos.tsx` (modify), `lib/comprobantes.ts` (already created)
- **[x] Done
- **Description**:
  Import `derivarEstadoComprobantes` and `REQUIRED_COMPROBANTE_TYPES` into Datos.tsx:

  ```typescript
  import { derivarEstadoComprobantes, REQUIRED_COMPROBANTE_TYPES } from '@/lib/comprobantes';
  ```

  The existing `filterEstado` state (line 50) is NOT repurposed for this — we need
  a NEW filter state for comprobante state. Add a new state variable:

  ```typescript
  const [filterComprobante, setFilterComprobante] = useState('');
  ```

  Add a comprobante state filter dropdown to the filter bar (in the Ejecuciones
  tab section, around line 309-322), after the date range filters:

  ```tsx
  <div className="flex items-center gap-1.5">
    <span className="text-[10px] font-medium text-slate-400 uppercase">Comp.</span>
    <select value={filterComprobante} onChange={e => { setFilterComprobante(e.target.value); setCurrentPage(1); }}
      className="border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors cursor-pointer bg-white">
      <option value="">Todos</option>
      <option value="Sin comprobantes">Sin comprobantes</option>
      <option value="Falta un comprobante">Falta un comprobante</option>
      <option value="Completada">Completada</option>
    </select>
  </div>
  ```

  Modify `filteredEjecuciones` useMemo (lines 138-148) to apply the comprobante filter:
  After the existing filters, add:
  ```typescript
  if (filterComprobante) {
    data = data.filter(e => {
      const result = derivarEstadoComprobantes(e.comprobantes || [], REQUIRED_COMPROBANTE_TYPES);
      return result.estado === filterComprobante;
    });
  }
  ```

  Update `hasActiveFilters` (line 180) to include `filterComprobante`:
  ```typescript
  const hasActiveFilters = searchQuery || filterTipo || filterMonth || filterDateFrom || filterDateTo || filterMontoMin || filterMontoMax || filterEstado || filterComprobante;
  ```

  Update `clearFilters` (line 182) to reset `filterComprobante`:
  ```typescript
  setFilterComprobante('');
  ```

- **Verification**:
  1. Filter dropdown appears in Ejecuciones tab with 4 options
  2. Selecting "Completada" filters correctly
  3. Selecting "Sin comprobantes" shows only ejecuciones with 0/2 required types
  4. Clear filters resets to all
  5. `hasActiveFilters` includes comprobante filter

- **Risk**: low

### PR2-T4: Add state badge column to Datos ejecucion rows
- **PR**: 2
- **Depends on**: PR2-T3
- **Files**: `components/Datos.tsx` (modify)
- **[x] Done
- **Description**:
  Replace the current comprobante count display (Paperclip icon + count, lines ~433-441)
  with a state badge that calls `derivarEstadoComprobantes`.

  Remove the existing comprobante column (`<th>Comp.</th>` and its `<td>`). Add a
  new comprobante state column:

  ```tsx
  <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Estado</th>
  ```

  In the `<td>` (replacing lines ~433-441):
  ```tsx
  <td className="p-3 text-center">
    {(() => {
      const result = derivarEstadoComprobantes(e.comprobantes || [], REQUIRED_COMPROBANTE_TYPES);
      if (result.estado === 'Completada') {
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">Completada</span>;
      }
      if (result.estado === 'Falta un comprobante') {
        const label = result.faltante === 'falta_pago' ? 'Falta pago' : 'Falta cuenta de cobro';
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">{label}</span>;
      }
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500">Sin comprobantes</span>;
    })()}
  </td>
  ```

  Note: Adding a column changes layout. Verify column alignment with PR1-T3's
  bank account column.

- **Verification**:
  1. Ejecucion row shows colored badge (green/amber/gray) per state
  2. "Falta un comprobante" shows specific granularity ("Falta pago" / "Falta cuenta de cobro")
  3. Badge matches design colors (emerald/amber/slate)
  4. Paperclip icon removed, state badge takes its place

- **Risk**: low

### PR2-T5: Add requiredTypes to ComprobanteUploader + state in EjecucionView
- **PR**: 2
- **Depends on**: PR2-T1
- **Files**: `components/Sidepanel.tsx` (modify — ComprobanteUploader, EjecucionView)
- **[x] Done
- **Description**:
  **ComprobanteUploader**: Add an optional `requiredTypes` prop (`string[]`).
  When provided:
  - Mark the matching tipo chips with a visual indicator (e.g., `*` suffix or
    different styling). Use the existing chip buttons (lines ~2259-2265) — add
    a star/badge or change the background color for required types.
  - Add a non-blocking inline validation message: "Se requieren: Comprobante de
    pago, Cuenta de Cobro" shown below the tipo chips.
  - The validation is informational only — does NOT block upload or form submit.

  Update the `ComprobanteUploader` component signature:
  ```typescript
  requiredTypes?: string[];
  ```

  In the tipo chips rendering:
  ```tsx
  {tiposComprobante.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(t => (
    <button key={t.name} type="button" onClick={() => setNewTipo(newTipo === t.name ? '' : t.name)}
      className={clsx("px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors",
        newTipo === t.name ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300',
        requiredTypes?.includes(t.name) && 'ring-1 ring-indigo-300')}>
      {t.name}{requiredTypes?.includes(t.name) ? ' *' : ''}
    </button>
  ))}
  ```

  Pass `requiredTypes` in FormPanel usage (line ~1464-1473):
  ```typescript
  requiredTypes={['Comprobante de pago', 'Cuenta de Cobro']}
  ```
  Also import `REQUIRED_COMPROBANTE_TYPES` at the top and derive the names:
  ```typescript
  requiredTypes={REQUIRED_COMPROBANTE_TYPES.map(r => r.name)}
  ```

  **EjecucionView** (around line 2403, after the "Presupuesto vinculado" section):
  Add a comprobante state section header showing the derived state:

  After the `</div>` closing the presupuesto section (line ~2446), before the
  existing comprobantes viewer section (line ~2448):

  ```typescript
  {(() => {
    const stateResult = derivarEstadoComprobantes(ejecucion.comprobantes || [], REQUIRED_COMPROBANTE_TYPES);
    if (stateResult.estado !== 'Completada' || (ejecucion.comprobantes?.length ?? 0) > 0) {
      return (
        <div className="border-t border-slate-100 pt-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
            <FileText size={12} /> Estado de comprobantes: {stateResult.estado}
            {stateResult.faltante && <span className="text-amber-600">({stateResult.faltante === 'falta_pago' ? 'falta pago' : 'falta cuenta de cobro'})</span>}
          </p>
        </div>
      );
    }
    return null;
  })()}
  ```

- **Verification**:
  1. ComprobanteUploader shows `*` next to required types
  2. Required types have a visual ring/border indicator
  3. EjecucionView shows "Estado de comprobantes: Completada" when both present
  4. EjecucionView shows "Estado de comprobantes: Falta un comprobante (falta pago)"
  5. Non-required comprobantes (Factura, etc.) do NOT affect state

- **Risk**: low

### PR2-T6: Tests for derivarEstadoComprobantes + state display
- **PR**: 2
- **Depends on**: PR2-T1, PR2-T4, PR2-T5
- **[x] Done
- **Files**: `lib/__tests__/comprobantes.test.ts` (create), `components/__tests__/Datos.test.tsx` (modify)
- **Description**:
  **`lib/__tests__/comprobantes.test.ts`**: Unit tests for the pure function:
  - `derivarEstadoComprobantes` returns Completada when both required types present
  - Returns Falta un comprobante + faltante=falta_cuenta_cobro when only pago present
  - Returns Falta un comprobante + faltante=falta_pago when only cuenta de cobro present
  - Returns Sin comprobantes for empty array
  - Returns Sin comprobantes when only non-required types present (e.g. Factura)
  - Optional comprobantes do not affect state
  - Works with default REQUIRED_COMPROBANTE_TYPES when second arg omitted
  - Edge: exactly 1 missing → granularity present; 2+ missing → no granularity

  **`components/__tests__/Datos.test.tsx`**: Add tests:
  - Badge shows "Completada" (green) when both required comprobantes present
  - Badge shows "Falta cuenta de cobro" (amber) when only pago present
  - Badge shows "Sin comprobantes" (gray) when array empty
  - Filter by estado works (only matching rows visible)

- **Verification**: `npx vitest run` passes all tests
- **Risk**: low

---

## PR3 — Budget Link (N:M Junction)

### PR3-T1: Add EjecucionBudgetLink type, remove budgetId from Ejecucion
- **PR**: 3
- **Depends on**: PR1-T1 (cuentaId/cuentaName already in Ejecucion)
- **Files**: `lib/types.ts` (modify)
- **Description**:
  Add a new interface:
  ```typescript
  export interface EjecucionBudgetLink {
    id: string;
    companyId: string;   // denormalized for safe collectionGroup queries
    budgetId: string;
    monto: number;
    createdAt?: Timestamp;
  }
  ```

  Remove `budgetId?: string;` from the `Ejecucion` interface (line 117).
  The `cuentaId?` and `cuentaName?` fields stay — they were added in PR1.

  Also add `EjecucionBudgetLink` to the imports where needed in `firestore.ts`
  and other files (handled in subsequent tasks).

- **Verification**:
  1. TypeScript compiles without errors
  2. `budgetId` no longer present in `Ejecucion` type
  3. `EjecucionBudgetLink` is a valid type with all required fields
  4. Cannot assign `budgetId` to `Ejecucion` objects anymore

- **Risk**: medium (type change ripples to all Ejecucion usage)

### PR3-T2: Remove budgetId from subscribeEjecuciones deserializer
- **PR**: 3
- **Depends on**: PR3-T1
- **Files**: `lib/firestore.ts` (modify)
- **Description**:
  In `subscribeEjecuciones` (lines ~211-228), remove the `budgetId` deserialization line:
  ```typescript
  // REMOVE this line:
  budgetId: data.budgetId ?? undefined,
  ```

  The rest of the deserializer stays unchanged. The `cuentaId` and `cuentaName`
  fields (added in PR1) remain.

  Also in `addEjecucion` (line ~245), ensure no changes needed — the function
  spreads `{ ...ejecucion }` which will no longer include `budgetId` since it's
  removed from the type.

- **Verification**:
  1. TypeScript compiles without errors
  2. `subscribeEjecuciones` callback produces `Ejecucion` objects without `budgetId`
  3. `addEjecucion` works without `budgetId` in the payload

- **Risk**: low

### PR3-T3: Add Firestore functions for budgetLinks CRUD + collectionGroup query
- **PR**: 3
- **Depends on**: PR3-T1 (type exists)
- **Files**: `lib/firestore.ts` (modify)
- **Description**:
  Add new constants and functions for budgetLinks CRUD:

  ```typescript
  const BUDGET_LINKS_COLLECTION = 'budgetLinks';
  ```

  New functions:
  ```typescript
  // Subscribe to links of an ejecucion (budgets of an ejecucion)
  export function subscribeBudgetLinks(
    companyId: string,
    ejecucionId: string,
    onData: (links: EjecucionBudgetLink[]) => void,
    onError?: (err: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      collection(db, COMPANIES_COLLECTION, companyId, EJECUCIONES_COLLECTION, ejecucionId, BUDGET_LINKS_COLLECTION),
      (snapshot) => {
        onData(snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            companyId: data.companyId ?? companyId,
            budgetId: data.budgetId ?? '',
            monto: data.monto ?? 0,
            createdAt: data.createdAt,
          } as EjecucionBudgetLink;
        }));
      },
      onError,
    );
  }

  // Add a single budgetLink
  export async function addBudgetLink(
    companyId: string,
    ejecucionId: string,
    data: Omit<EjecucionBudgetLink, 'id' | 'createdAt'>,
  ): Promise<string> {
    const docRef = await addDoc(
      collection(db, COMPANIES_COLLECTION, companyId, EJECUCIONES_COLLECTION, ejecucionId, BUDGET_LINKS_COLLECTION),
      { ...data, createdAt: serverTimestamp() },
    );
    return docRef.id;
  }

  // Remove a single budgetLink
  export async function removeBudgetLink(
    companyId: string,
    ejecucionId: string,
    linkId: string,
  ): Promise<void> {
    await deleteDoc(
      doc(db, COMPANIES_COLLECTION, companyId, EJECUCIONES_COLLECTION, ejecucionId, BUDGET_LINKS_COLLECTION, linkId),
    );
  }

  // Subscribe to ejecuciones linked to a budget (via collectionGroup)
  export function subscribeEjecucionesByBudget(
    companyId: string,
    budgetId: string,
    onData: (links: EjecucionBudgetLink[]) => void,
    onError?: (err: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(
        collectionGroup(db, BUDGET_LINKS_COLLECTION),
        where('companyId', '==', companyId),
        where('budgetId', '==', budgetId),
      ),
      (snapshot) => {
        onData(snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            companyId: data.companyId ?? companyId,
            budgetId: data.budgetId ?? '',
            monto: data.monto ?? 0,
            createdAt: data.createdAt,
            // Extract ejecucionId from path: companies/{cid}/ejecuciones/{eid}/budgetLinks/{id}
            _ejecucionId: d.ref.path.split('/')[3],
          } as EjecucionBudgetLink & { _ejecucionId: string };
        }));
      },
      onError,
    );
  }
  ```

  Import the needed Firestore functions at the top (add `deleteDoc` to the existing
  import if not already there — check line 1-15).

- **Verification**:
  1. TypeScript compiles
  2. `subscribeBudgetLinks` sets up correct subcollection path
  3. `subscribeEjecucionesByBudget` sets up collectionGroup query with company filter
  4. `addBudgetLink` / `removeBudgetLink` work correctly
  5. The `_ejecucionId` extraction from path works for collectionGroup results

- **Risk**: medium (new Firestore query patterns)

### PR3-T4: Multi-budget selector in FormPanel (budgetLinks data on submit)
- **PR**: 3
- **Depends on**: PR3-T1 (type), PR3-T3 (firestore functions)
- **Files**: `components/Sidepanel.tsx` (modify — FormPanel)
- **Description**:
  Add state for multi-budget selection:
  ```typescript
  const [selectedBudgetLinks, setSelectedBudgetLinks] = useState<Array<{ budgetId: string; budgetName: string; monto: string }>>([]);
  ```

  Replace the existing single `SearchableSelect` for "Vincular presupuesto (opcional)"
  (lines ~1450-1461) with a multi-budget selector UI:

  ```tsx
  <div className="border-t border-slate-100 pt-4">
    <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Presupuestos vinculados</p>

    {/* Add budget button + search */}
    <div className="mb-3">
      <SearchableSelect label="Agregar presupuesto" value="" onChange={v => {
        const b = allBudgets.find(b => b.id === v);
        if (b && !selectedBudgetLinks.find(sl => sl.budgetId === b.id)) {
          setSelectedBudgetLinks(prev => [...prev, { budgetId: b.id, budgetName: b.descripcion, monto: '' }]);
        }
      }} options={allBudgets.map(b => ({
        value: b.id,
        label: `${b.descripcion} (${formatCurrency(b.montoPresupuestado)}) - ${b.projectName}`,
      }))} placeholder="Buscar y agregar presupuesto..." />
    </div>

    {/* Selected budgets with monto inputs */}
    {selectedBudgetLinks.map((sl, idx) => (
      <div key={sl.budgetId} className="flex items-center gap-2 bg-slate-50 rounded-lg p-3 border border-slate-200 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-700 truncate">{sl.budgetName}</p>
          <input type="text" inputMode="numeric" value={sl.monto}
            onChange={e => {
              const updated = [...selectedBudgetLinks];
              updated[idx] = { ...updated[idx], monto: e.target.value };
              setSelectedBudgetLinks(updated);
            }}
            placeholder="Monto parcial"
            className="w-full border border-slate-200 rounded-lg p-1.5 text-xs mt-1 focus:border-indigo-500 outline-none text-right bg-white" />
        </div>
        <button onClick={() => setSelectedBudgetLinks(prev => prev.filter((_, i) => i !== idx))}
          className="text-slate-400 hover:text-rose-500 shrink-0">
          <X size={14} />
        </button>
      </div>
    ))}

    {/* Total sum validation */}
    {selectedBudgetLinks.length > 0 && (
      <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2">
        <span>Total asignado: {formatCurrency(selectedBudgetLinks.reduce((s, sl) => s + (Number(sl.monto) || 0), 0))}</span>
        <span className={Math.abs((Number(f('montoEjecutado')) || 0) - selectedBudgetLinks.reduce((s, sl) => s + (Number(sl.monto) || 0), 0)) <= 1 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
          {Math.abs((Number(f('montoEjecutado')) || 0) - selectedBudgetLinks.reduce((s, sl) => s + (Number(sl.monto) || 0), 0)) <= 1 ? '✅' : '⚠️'} Monto ejecutado: {formatCurrency(Number(f('montoEjecutado')) || 0)}
        </span>
      </div>
    )}
  </div>
  ```

  In `handleSubmit` (around line 1092-1098), after setting `montoEjecutado`, add
  budgetLinks to the submission data:
  ```typescript
  if (selectedBudgetLinks.length > 0) {
    // VALIDATE: |montoEjecutado - Σ links.monto| ≤ 1
    const totalLinked = selectedBudgetLinks.reduce((s, sl) => s + (Number(sl.monto) || 0), 0);
    const diff = Math.abs(data.montoEjecutado - totalLinked);
    if (diff > 1) {
      setValidationError('La suma de los montos vinculados debe coincidir con el monto ejecutado');
      setSaving(false);
      return;
    }
    data._budgetLinks = selectedBudgetLinks.map(sl => ({
      budgetId: sl.budgetId,
      monto: Number(sl.monto) || 0,
    }));
  }
  ```

  Also add a `validationError` state if not already present (reuse existing or add):
  ```typescript
  const [validationError, setValidationError] = useState('');
  ```
  And display it in the form (below the submit button or above it):
  ```tsx
  {validationError && (
    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-3">
      <p className="text-xs font-medium text-rose-700">{validationError}</p>
    </div>
  )}
  ```

  Also import `X` icon if not already imported (it is — line 8).

  When editing an ejecucion (`form.mode === 'edit'`), load existing budgetLinks
  from the subcollection via `subscribeBudgetLinks` — for now, editing existing
  links is deferred (edit mode shows read-only list, not re-selectable). This is
  acceptable per the design: "edit mode reads links but does not allow re-linking".
  For add mode, the multi-budget selector is fully functional.

- **Verification**:
  1. Form shows multi-budget selector (not single SearchableSelect)
  2. Can add multiple budgets with partial monto
  3. Validation blocks submit when Σ ≠ montoEjecutado (>1 diff)
  4. Validation shows green checkmark when Σ matches
  5. Submit passes `_budgetLinks` array in data payload
  6. Old "Vincular presupuesto" label no longer present

- **Risk**: medium (significant form UI change, validation logic)

### PR3-T5: EjecucionView budgetLinks list (replace single linkedBudget)
- **PR**: 3
- **Depends on**: PR3-T1 (type), PR3-T3 (firestore functions)
- **Files**: `components/Sidepanel.tsx` (modify — EjecucionView)
- **Description**:
  In `EjecucionView` (lines ~2358-2455), replace the single-budget linking logic
  with a subcollection-based budgetLinks list.

  Add state:
  ```typescript
  const [budgetLinks, setBudgetLinks] = useState<EjecucionBudgetLink[]>([]);
  ```

  Add subscription effect:
  ```typescript
  useEffect(() => {
    const unsub = subscribeBudgetLinks(companyId, ejecucion.id, setBudgetLinks);
    return () => unsub();
  }, [companyId, ejecucion.id]);
  ```

  Replace the entire "Presupuesto vinculado" section (lines ~2404-2446) with:
  ```tsx
  <div className="border-t border-slate-100 pt-4">
    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
      <Link2 size={12} /> Presupuestos vinculados ({budgetLinks.length})
    </p>
    {budgetLinks.length === 0 ? (
      <p className="text-xs text-slate-500 italic">Sin presupuestos vinculados</p>
    ) : (
      <div className="space-y-2">
        {budgetLinks.map(link => {
          const linkedBudget = budgets.find(b => b.id === link.budgetId);
          return (
            <div key={link.id} className="flex items-center justify-between bg-indigo-50 hover:bg-indigo-100 rounded-lg p-3 cursor-pointer transition-colors"
              onClick={() => linkedBudget && onNavigate({ id: crypto.randomUUID(), type: 'view', detail: { type: 'budget', budget: linkedBudget, ejecuciones: [] } })}>
              <div className="flex-1 min-w-0 mr-2">
                <p className="text-xs font-semibold text-indigo-700 truncate">{linkedBudget?.descripcion || link.budgetId}</p>
                <p className="text-[10px] text-indigo-500">{linkedBudget?.projectName} • {formatCurrency(linkedBudget?.montoPresupuestado ?? 0)}</p>
              </div>
              <span className="text-xs font-bold text-indigo-700 shrink-0">{formatCurrency(link.monto)}</span>
            </div>
          );
        })}
      </div>
    )}
  </div>
  ```

  Remove `handleLink`, `handleUnlink`, `linking`, `search`, `filtered` state
  and the related UI — these are no longer needed since budget linking is done
  exclusively in the form (via multi-budget selector + writeBatch).

  Import `subscribeBudgetLinks` from `@/lib/firestore` and `EjecucionBudgetLink`
  from `@/lib/types` (or use inline type).

- **Verification**:
  1. EjecucionView shows list of linked budgets with name and monto
  2. Clicking a linked budget navigates to its BudgetView
  3. "Sin presupuestos vinculados" shown when no links
  4. No more "Buscar presupuesto" button or inline search
  5. No more single "Presupuesto vinculado" with unlink button

- **Risk**: medium (replaces core view logic)

### PR3-T6: BudgetView collectionGroup query for linked ejecuciones
- **PR**: 3
- **Depends on**: PR3-T3 (firestore functions), PR3-T1 (type)
- **Files**: `components/Sidepanel.tsx` (modify — BudgetView)
- **Description**:
  In `BudgetView` (lines ~1962-2028), replace the `ejecuciones` prop-based filtering
  with a collectionGroup subscription.

  The current BudgetView receives `ejecuciones` as a prop and filters client-side
  via `ejecuciones.filter(e => e.budgetId === b.id)` (line 384 in page.tsx, and
  `budgetId` matching in BudgetView).

  Add state:
  ```typescript
  const [linkedLinks, setLinkedLinks] = useState<(EjecucionBudgetLink & { _ejecucionId: string })[]>([]);
  const [linkedEjecuciones, setLinkedEjecuciones] = useState<Ejecucion[]>([]);
  ```

  Add subscription:
  ```typescript
  useEffect(() => {
    const unsub = subscribeEjecucionesByBudget(companyId, budget.id, (links) => {
      setLinkedLinks(links);
      // Filter from available ejecuciones by extracting parent IDs from link paths
      const ejecucionIds = new Set(links.map(l => l._ejecucionId));
      // The BudgetView already receives ejecuciones prop — filter those by _ejecucionId
      // Or better: subscribe to ejecuciones here directly to show ejecuciones
      // Since the BudgetView receives ejecuciones as a prop from page.tsx, we can
      // use the already-subscribed ejecuciones (available in the parent component)
    });
    return () => unsub();
  }, [companyId, budget.id]);
  ```

  However, `BudgetView` currently receives `ejecuciones` as a prop from the parent
  (`ViewPanel` → `recordDetail.ejecuciones`). To make this reactive to budgetLinks,
  we need to change how BudgetView resolves its linked ejecuciones.

  Best approach: Keep the prop-based approach but derive linked ejecuciones from
  the collectionGroup query. The `ViewPanel` (line ~1749) passes `recordDetail.ejecuciones`
  which is already computed in page.tsx. For the N:M case, we need to change the
  parent to query budgetLinks instead of filtering by `budgetId`.

  Actually, looking at page.tsx lines 383-393:
  ```typescript
  const matchBudget = entityId
    ? budgets.find(b => b.projectId === projectId && b.entityId === entityId && b.mesPresupuestado === month && b.tipo === tipo)
    : budgets.filter(b => b.projectId === projectId && b.mesPresupuestado === month && b.tipo === tipo);
  const matched = Array.isArray(matchBudget) ? (matchBudget.length === 1 ? matchBudget[0] : null) : matchBudget;
  if (matched) defaults.budgetId = matched.id;
  ```
  This is `handleEmptyCellClick` — the `defaults.budgetId` here will be removed
  in PR3-T9.

  For BudgetView, the simplest approach: subscribe to ejecuciones of a budget
  directly inside BudgetView using the collectionGroup query. Load ejecuciones
  by ID from the existing ejecuciones subscription (via a callback to the parent
  or by subscribing locally).

  **Simpler approach**: BudgetView receives `ejecuciones` prop (all ejecuciones).
  Subscribe to budgetLinks collectionGroup and filter ejecuciones by matched IDs:

  ```typescript
  useEffect(() => {
    if (!budget.id) return;
    const unsub = subscribeEjecucionesByBudget(companyId, budget.id, (links) => {
      const ejecucionIds = new Set(links.map(l => l._ejecucionId));
      const filtered = (ejecucionesProp || []).filter(e => ejecucionIds.has(e.id));
      setLinkedEjecuciones(filtered);
    });
    return () => unsub();
  }, [companyId, budget.id, ejecucionesProp]);
  ```

  Replace the `ejecuciones` prop usage inside BudgetView with `linkedEjecuciones` state.

  Also update the "Agregar" inline form (line ~1969-1988) — remove `budgetId: budget.id`
  from the default data (line 1983) since budgetId no longer exists on Ejecucion.
  The inline form should instead be enhanced to create a budgetLink, but for now
  remove the budgetId line and log a TODO to add budgetLink creation later:
  ```typescript
  // TODO: budget link will be created via writeBatch in separate PR or enhancement
  // budgetId removed — links are created via the multi-budget selector in the form
  ```

- **Verification**:
  1. BudgetView shows linked ejecuciones via collectionGroup query
  2. Adding a new ejecucion with a budget link to this budget shows up in real-time
  3. Removing a budget link removes the ejecucion from the list
  4. "Agregar" inline form still works without budgetId

- **Risk**: medium-high (collectionGroup query is new pattern in this codebase)

### PR3-T7: Datos.tsx budget chips + remove budgetId dot indicator
- **PR**: 3
- **Depends on**: PR3-T1 (type changed), PR3-T3 (firestore functions)
- **Files**: `components/Datos.tsx` (modify)
- **Description**:
  **Remove budgetId dot indicator** (lines ~423-427): Replace `hasLink` logic
  (currently `!!e.budgetId`) with a budgetLink subscription or remove the dot
  entirely. Since Datos doesn't subscribe to budgetLinks per ejecucion (too
  many queries), the dot indicator becomes `false` (no dot) for all rows.

  Change line ~423:
  ```typescript
  const hasLink = false; // budgetId removed; budgetLink subscription is per-ejecucion view
  ```

  The dot color becomes irrelevant — remove the conditional styling or keep
  a neutral dot. Simpler: remove the dot entirely and the `hasLink` variable:
  ```typescript
  // Remove hasLink — budget links are shown per-ejecucion in the detail view
  ```

  Remove the `hasLink`-based conditional from the row class (line ~424):
  ```typescript
  className="cursor-pointer transition-colors hover:bg-slate-50"
  ```

  **Add budget links display** (future enhancement): For ahora, show a simple
  indicator that the ejecucion has budget links. This would require subscribing
  to budgetLinks per ejecucion in Datos which is too expensive with N rows.
  Accept that Datos won't show budget link count in the table view. Budget
  links are visible in EjecucionView detail.

- **Verification**:
  1. Datos ejecucion rows no longer show the green/amber dot
  2. All rows have the same hover style
  3. No TypeScript errors from removed `budgetId`
  4. Row click still navigates to EjecucionView (where budgetLinks are visible)

- **Risk**: low (removes visual indicator, no functional change)

### PR3-T8: page.tsx writeBatch for budgetLinks + validation
- **PR**: 3
- **Depends on**: PR3-T1 (type), PR3-T4 (form passes _budgetLinks)
- **Files**: `app/[company]/[[...segments]]/page.tsx` (modify)
- **Description**:
  In `handleFormSubmit` (lines ~413-507), modify the `case 'ejecucion'` branch
  for add mode (lines ~427-451) to use writeBatch for atomic ejecucion +
  budgetLinks creation.

  Import `writeBatch` from firebase/firestore:
  ```typescript
  import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
  ```

  Replace the current add-ejecucion logic:

  ```typescript
  case 'ejecucion': {
    const pendingFiles = data._pendingComprobantes as ... | undefined;
    const budgetLinksData = data._budgetLinks as Array<{ budgetId: string; monto: number }> | undefined;
    delete data._pendingComprobantes;
    delete data._budgetLinks;

    // Create writeBatch for atomic write
    const batch = writeBatch(db);
    const ejecucionRef = doc(collection(db, 'companies', companyId, 'ejecuciones'));
    batch.set(ejecucionRef, { ...data, createdAt: serverTimestamp() });

    // Add budgetLinks in the same batch
    if (budgetLinksData && budgetLinksData.length > 0) {
      for (const link of budgetLinksData) {
        const linkRef = doc(collection(db, 'companies', companyId, 'ejecuciones', ejecucionRef.id, 'budgetLinks'));
        batch.set(linkRef, {
          companyId,
          budgetId: link.budgetId,
          monto: link.monto,
          createdAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
    const docId = ejecucionRef.id;

    // Handle comprobantes uploads (existing flow — after batch commit)
    if (pendingFiles && pendingFiles.length > 0) {
      const comprobantes: Comprobante[] = await Promise.all(
        pendingFiles.map(async (pf) => {
          // ... same logic as existing lines 432-448
        }),
      );
      await updateEjecucion(companyId, docId, { comprobantes: JSON.parse(JSON.stringify(comprobantes)) });
    }
    break;
  }
  ```

  Also import `serverTimestamp` if not already imported (it is in firestore.ts
  but page.tsx imports from firebase/firestore directly — line 8). Add it:
  ```typescript
  import { collection, getDocs, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
  ```

  Remove the old `addEjecucion` call:
  ```typescript
  // REMOVE these lines:
  // const docId = await addEjecucion(companyId, data as Omit<Ejecucion, 'id'>);
  ```

- **Verification**:
  1. Creating an ejecucion with 2 budgetLinks creates 1 ejecucion doc + 2 link docs atomically
  2. If any write in the batch fails, ALL writes roll back (no orphaned docs)
  3. Creating an ejecucion without budgetLinks creates just the ejecucion doc
  4. Comprobantes upload still works after batch commit
  5. Existing edit mode (updateEjecucion) is unchanged

- **Risk**: high (changes core write path, atomicity critical)

### PR3-T9: Remove auto-link budgetId from Dashboard/DataPanel defaults
- **PR**: 3
- **Depends on**: PR3-T1 (budgetId removed from type)
- **Files**: `app/[company]/[[...segments]]/page.tsx` (modify — handleEmptyCellClick, DataPanel), `components/Sidepanel.tsx` (modify — DataPanel)
- **Description**:
  **page.tsx** `handleEmptyCellClick` (lines ~359-393):
  - Remove lines 386-392 that auto-link budgetId:
  ```typescript
  // REMOVE these lines:
  // Auto-link to matching budget
  // const matchBudget = ...
  // if (matched) defaults.budgetId = matched.id;
  ```

  Keep the rest of the function — proyecto, entity, month pre-fill stays.

  **page.tsx** line 2726 (DataPanel "Ejecutar" button defaults):
  - Remove `budgetId: b.id` from the default values:
  ```typescript
  // In the "Ejecutar" button (around line 2719-2727), remove:
  // budgetId: b.id,
  // Replace with just the other fields
  ```

  Actually the DataPanel "Ejecutar" button is in `Sidepanel.tsx` DataPanel function
  (around line 2719). Find and remove the `budgetId: b.id` line.

  **Sidepanel.tsx** DataPanel (lines ~2719-2727): Remove the `budgetId` default:
  ```typescript
  onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'add', type: 'ejecucion', defaults: {
    projectId: b.projectId || '',
    projectName: b.projectName || '',
    entityId: b.entityId || '',
    entityName: b.entityName || '',
    entityType: b.entityType || 'client',
    tipo: b.tipo,
    // budgetId: b.id, ← REMOVE THIS LINE
  } } })}
  ```

- **Verification**:
  1. Clicking "Ejecutar" on a budget from DataPanel no longer sets budgetId default
  2. Empty cell click no longer auto-calculates budgetId
  3. TypeScript compiles without references to budgetId
  4. The nuevo ejecucion form opens with correct defaults (project, entity, tipo, date)

- **Risk**: low (removal of auto-link feature, no new logic)

### PR3-T10: Add budgetLinks security rules + collectionGroup index
- **PR**: 3
- **Depends on**: PR3-T1
- **Files**: `firestore.rules` (modify), `firestore.indexes.json` (modify)
- **Description**:
  **`firestore.rules`**: Add budgetLinks subcollection rule inside the
  `/companies/{companyId}` match block, after existing `ejecuciones` rule (line 37):

  ```
  match /ejecuciones/{ejecucionId}/budgetLinks/{linkId} {
    allow read, write: if isMember(companyId);
  }
  ```

  This must be INSIDE the `/companies/{companyId}` block to inherit the
  `companyId` variable.

  **`firestore.indexes.json`**: Add a collection group index for budgetLinks:

  ```json
  {
    "indexes": [
      {
        "collectionGroup": "budgetLinks",
        "queryScope": "COLLECTION_GROUP",
        "fields": [
          { "fieldPath": "companyId", "order": "ASCENDING" },
          { "fieldPath": "budgetId", "order": "ASCENDING" }
        ]
      }
    ],
    "fieldOverrides": []
  }
  ```

- **Verification**:
  1. `firestore.rules` syntax is valid (no parsing errors)
  2. The budgetLinks subcollection rule is nested under `/companies/{companyId}`
  3. `firestore.indexes.json` has the collectionGroup index
  4. Deploy rules: `npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes`
  5. Verify no collision with existing indexes

- **Risk**: low (standard Firestore index + rule)

### PR3-T11: Tests for budgetLinks CRUD + validation + collectionGroup
- **PR**: 3
- **Depends on**: All PR3 tasks
- **Files**: `lib/__tests__/firestore.test.ts` (modify), `components/__tests__/Sidepanel.test.tsx` (modify), `app/[company]/[[...segments]]/page.tsx` (tests for writeBatch)
- **Description**:
  **`lib/__tests__/firestore.test.ts`**: Add tests:
  - `addBudgetLink` creates doc at correct subcollection path
  - `removeBudgetLink` deletes doc at correct path
  - `subscribeBudgetLinks` reads from correct subcollection
  - `subscribeEjecucionesByBudget` uses collectionGroup with companyId + budgetId filters
  - `EjecucionBudgetLink` type accepts all required fields

  **`components/__tests__/Sidepanel.test.tsx`**: Add tests:
  - Ejecucion form shows multi-budget selector (not single linking)
  - Adding 2 budgets with matching monto sum submits successfully
  - Adding budgets with mismatched monto sum shows validation error (no submit)
  - EjecucionView shows linked budgets list
  - BudgetView subscription works (mock collectionGroup query)

  **Test factories update**: Update `makeEjecucion` in test files to remove
  `budgetId` from overrides logic (if any tests use `budgetId`).
  Check `Sidepanel.test.tsx` line 167 — `budgetId` is not in the factory but
  tests may reference it. Same for `Datos.test.tsx` line 58.
  Update `lib/__tests__/firestore.test.ts` line 274 — remove `budgetId` assertion:
  ```typescript
  // REMOVE: expect(payload.budgetId).toBeUndefined();
  ```
  Budget links are now a separate collection, not a field on Ejecucion.

- **Verification**:
  1. `npx vitest run` passes all tests
  2. All `budgetId` references removed from test files
  3. New tests cover budgetLinks creation and query

- **Risk**: medium (test coverage for writeBatch needs mocking)

---

## Dependency Graph

```
PR0-T1 (delete script)
  ↓
PR1-T1 (types + deser)         ──┐
  ├── PR1-T2 (form selector)     │
  ├── PR1-T3 (view display)      │
  └── PR1-T4 (tests)             │
                                 │
PR2-T2 (seed) ←──────── independent
  ↓
PR2-T1 (pure function)           │
  ├── PR2-T3 (data filter)       │
  ├── PR2-T4 (badge column)      │
  └── PR2-T5 (uploader + view)   │
  └── PR2-T6 (tests)             │
                                 │
PR3-T1 (types - budgetId removed)
  ├── PR3-T2 (deser cleanup)
  ├── PR3-T3 (firestore CRUD)
  │   ├── PR3-T4 (form multi-budget)
  │   ├── PR3-T5 (view budgetLinks list)
  │   ├── PR3-T6 (BudgetView collectionGroup)
  │   └── PR3-T7 (Datos chips)
  ├── PR3-T8 (writeBatch in page.tsx)
  ├── PR3-T9 (remove auto-link)
  ├── PR3-T10 (rules + indexes)
  └── PR3-T11 (tests)
```

## Key Design Decisions Embedded in Tasks

1. **writeBatch atomic**: ALL budgetLinks created in same batch as ejecucion doc (PR3-T8)
2. **companyId denormalized** in BudgetLink for safe collectionGroup queries (PR3-T3)
3. **Validation pre-submit**: |montoEjecutado - Σ links.monto| ≤ 1 before batch (PR3-T4)
4. **Derived state on read**: derivarEstadoComprobantes never stored, pure function (PR2-T1)
5. **Códigos unificados**: granularity uses `falta_pago` / `falta_cuenta_cobro` (PR2-T1)
6. **cuentaName compuesto**: `"{banco} - {nombre} ({tipo})"` (PR1-T2)
7. **Tipos en seed**: Comprobante de pago (order 4) + Cuenta de Cobro (order 5) (PR2-T2)
8. **PR0 pre-work**: delete-ejecuciones script BEFORE any code PR (PR0-T1)
9. **feature-branch-chain**: all PRs target sequential branches (chain topology above)
