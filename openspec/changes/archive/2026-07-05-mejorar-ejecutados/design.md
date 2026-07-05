# Design: Mejorar Ejecutados (N:M + Comprobantes + Banco)

> Change: `mejorar-ejecutados` · Phase: design · Date: 2026-07-05

## Technical Approach

Three independent capabilities that extend the `Ejecucion` model. All three touch
`lib/types.ts`, `components/Sidepanel.tsx`, and `firestore.rules`. The approach
is incremental via chained PRs to stay within 400-line review budget.

**Why not subcollection for comprobantes?** The spec evaluated array vs subcollection
and chose embedded array — the existing pattern works, reads stay single-doc, and
state derivation is a pure client-side function. No structural migration needed.

---

## 1. ejecucion-budget-link — N:M Junction

### 1A. Data Model

```typescript
// NEW — lib/types.ts
export interface EjecucionBudgetLink {
  id: string;
  companyId: string;   // ← ADDED: enables safe collectionGroup queries with multi-tenant isolation
  budgetId: string;
  monto: number;
  createdAt?: Timestamp;
}

// MODIFIED — Ejecucion interface
export interface Ejecucion {
  // ... existing fields ...
  // REMOVE: budgetId?: string;
  // ADD:
  cuentaId?: string;     // from cuentasBancarias (capability 3)
  cuentaName?: string;   // denormalized (capability 3)
}
```

**Collection structure:**
```
companies/{companyId}/ejecuciones/{ejecucionId}/
  ├── (Ejecucion doc — no more budgetId field)
  └── budgetLinks/{linkId}          ← NEW subcollection
        ├── companyId: string       ← denormalized for safe collectionGroup queries
        ├── budgetId: string
        ├── monto: number
        └── createdAt: Timestamp
```

**Indexes** (in `firestore.indexes.json`):
```json
{
  "collectionGroup": "budgetLinks",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "budgetId", "order": "ASCENDING" }
  ]
}
```

**New Firestore functions** (`lib/firestore.ts`):
| Function | Method | Purpose |
|----------|--------|---------|
| `subscribeBudgetLinks(companyId, ejecucionId, cb)` | `onSnapshot` subcollection | Budgets of an ejecucion (real-time) |
| `addBudgetLink(companyId, ejecucionId, data)` | `addDoc` to subcollection | Create link |
| `removeBudgetLink(companyId, ejecucionId, linkId)` | `deleteDoc` | Remove link |
| `subscribeEjecucionesByBudget(companyId, budgetId, cb)` | `collectionGroup('budgetLinks').where('companyId','==',companyId).where('budgetId','==',budgetId)` | Ejecuciones of a budget (scoped to company) |

**Modified:** `addEjecucion` now accepts budgetLinks in the payload (written
after the ejecucion doc is created).

### 1B. Component Changes

| Component | Change |
|-----------|--------|
| `FormPanel` (Sidepanel.tsx ~1450) | Replace single `SearchableSelect` "Vincular presupuesto" with **multi-budget selector** + per-link `monto` input |
| `EjecucionView` (Sidepanel.tsx ~2375) | Replace `linkedBudget` single display with **budgetLink list** (read subcollection, fetch budget names) |
| `BudgetView` (Sidepanel.tsx ~2000) | Replace local filter `ejecuciones.filter(e => e.budgetId === b.id)` with **collectionGroup subscription** to budgetLinks |
| `Datos.tsx` (~383-427) | Remove `e.budgetId` / `hasLink` dot indicator; add **budget chips** column for linked budgets |
| `page.tsx` (~388-391) | Remove auto-link logic setting `defaults.budgetId`; no auto-link with junction |
| Nav screen defaults (~2719-2727) | Remove `budgetId` default from "Ejecutar" button in Dashboard detail view |

**Form UI — multi-budget selector:**
```
┌─────────────────────────────────────┐
│ Presupuestos vinculados          ─┐ │
│ ┌─ Presupuesto A ──────────┐      │ │
│ │ [Buscar y agregar...]    │      │ │
│ └──────────────────────────┘      │ │
│ ┌─ P1 ($300k) ──────────────────┐ │ │
│ │ Monto: [____150000____]  ✕    │ │ │
│ ├─ P2 ($500k) ──────────────────┤ │ │
│ │ Monto: [____450000____]  ✕    │ │ │
│ └────────────────────────────────┘ │
│ Total asignado: $600k / $600k  ✅ │
│ Faltante: $0                      │
└─────────────────────────────────────┘
```

### 1C. Data Flow

**Write (create ejecucion with links):**
```
Form submit
  → handleSubmit creates data with _budgetLinks: [{budgetId, monto}, ...]

  → **VALIDATE** before any write:
     |montoEjecutado - Σ(links.monto)| ≤ 1
     If mismatch → block submission, show validation error in form

  → handleFormSubmit in page.tsx:
     1. Create a Firestore **writeBatch** (atomic — all or nothing)
     2. Create Ejecucion doc ref (addDoc → docRef)
     3. For each _budgetLink: addDoc to budgetLinks subcollection
     4. Commit the batch with batch.commit()
     5. Upload pending comprobantes (existing flow — independent of batch)
```
**Rationale:** writeBatch guarantees atomicity — the ejecucion and ALL its budget links
are written in a single atomic operation. No orphaned ejecuciones, no partial state.
The monto validation runs BEFORE the batch, in the form submit handler.

**Read (budgets of an ejecucion):**
```
EjecucionView mounts
  → subscribeBudgetLinks(companyId, ejecucionId, cb)  → linkId[]
  → For each link, fetch budget doc (or filter from already-subscribed budgets)
  → Display: budget name + link.monto
```

**Read (ejecuciones of a budget):**
```
BudgetView mounts
  → subscribeEjecucionesByBudget(companyId, budgetId, cb)  → budgetLinks[]
  → Extract parent doc IDs from link doc paths
  → Filter subscribed ejecuciones by those IDs
  → Display: each linked ejecucion with link.monto (not ejecucion.montoEjecutado)
```

**Consistency:** Client-side validation at form level (pre-submit). Σ link.monto
must be within rounding tolerance (≤1) of ejecucion.montoEjecutado — enforced
before the writeBatch is created. The writeBatch provides atomicity: either the
ejecucion AND all links are written, or none are. No orphaned ejecuciones.

### 1D. Security Rules

```javascript
// Add inside the /companies/{companyId} match block:
match /ejecuciones/{ejecucionId}/budgetLinks/{linkId} {
  allow read, write: if isMember(companyId);
}
```

---

## 2. comprobantes-ejecucion — Required Comprobantes + States

### 2A. Data Model

**No schema changes.** Comprobantes stay as embedded `Comprobante[]` array on
Ejecucion. The existing `Comprobante.tipo?: string` field is used to match
against required types from settings.

**New pure function** — location: `lib/comprobantes.ts` (new file):

```typescript
export type ComprobanteState = 'Completada' | 'Falta un comprobante' | 'Sin comprobantes';
export type ComprobanteGranularity = 'falta_pago' | 'falta_cuenta_cobro' | null;

export interface ComprobanteStateResult {
  estado: ComprobanteState;
  faltante?: ComprobanteGranularity;
}

/**
 * Derive comprobante state from an ejecucion's comprobantes array.
 * @param comprobantes - The comprobantes array from an Ejecucion
 * @param requiredTypes - The names of required types (from settings.tipoComprobante)
 */
export function derivarEstadoComprobantes(
  comprobantes: Comprobante[],
  requiredTypes: { name: string; code: string }[]
): ComprobanteStateResult {
  const present = new Set(comprobantes.map(c => c.tipo).filter(Boolean));
  const missing = requiredTypes.filter(r => !present.has(r.name));

  if (missing.length === 0) return { estado: 'Completada' };
  if (missing.length === requiredTypes.length) return { estado: 'Sin comprobantes' };
  if (missing.length === 1) {
    // Exactly one missing — surface granularity
    const code = missing[0].code;
    return { estado: 'Falta un comprobante', faltante: code as ComprobanteGranularity };
  }
  // Edge case: 2+ missing required types (future-proofing if requiredTypes grows beyond 2)
  return { estado: 'Falta un comprobante' };
}
```

**Seed change** (`scripts/seed.ts`): Add 2 new tipoComprobante entries:

```typescript
tipoComprobante: [
  { name: 'Factura', color: '#6366f1', order: 0 },
  { name: 'Recibo', color: '#22c55e', order: 1 },
  { name: 'Transferencia', color: '#f59e0b', order: 2 },
  { name: 'Efectivo', color: '#06b6d4', order: 3 },
  // NEW — required for ejecuciones
  { name: 'Comprobante de pago', color: '#8b5cf6', order: 4 },
  { name: 'Cuenta de Cobro', color: '#f97316', order: 5 },
];
```

The `requiredTypes` mapping is hardcoded in the application:
```typescript
const REQUIRED_COMPROBANTE_TYPES = [
  { name: 'Comprobante de pago', code: 'falta_pago' },
  { name: 'Cuenta de Cobro', code: 'falta_cuenta_cobro' },
];
```

### 2B. Component Changes

| Component | Change |
|-----------|--------|
| `ComprobanteUploader` (Sidepanel.tsx ~2120) | New optional prop `requiredTypes: string[]`; mark required types with `*` in the tipo chips; inline validation message (non-blocking) |
| `Datos.tsx` (~433-442) | Replace simple paperclip count with **state badge column** calling `derivarEstadoComprobantes`; add **filter dropdown** above table (Todos/Sin comprobantes/Falta/Completada) |
| `EjecucionView` (Sidepanel.tsx ~2448) | Show comprobante state in section header with granularity |
| Test factories | `makeEjecucion` keeps `comprobantes: []` — no change needed |

**State badge colors:**
- Completada: `bg-emerald-100 text-emerald-700` (#22c55e)
- Falta un comprobante: `bg-amber-100 text-amber-700` (#f59e0b)
- Sin comprobantes: `bg-slate-100 text-slate-500` (#94a3b8)

**Filter dropdown UI (in Datos.tsx, above ejecuciones table):**
```
┌─────────────────────────────────────────────────────────┐
│ [Comprobantes: Todos ▼]                                 │
│  ▸ Todos                                                │
│  ▸ Sin comprobantes                                     │
│  ▸ Falta un comprobante                                 │
│  ▸ Completada                                           │
└─────────────────────────────────────────────────────────┘
```

### 2C. Data Flow

**State computation: ALWAYS on read, NEVER stored.**

```
subscribeEjecuciones callback → for each ejecucion:
  estadoComprobantes = derivarEstadoComprobantes(ej.comprobantes, REQUIRED_TYPES)
  
Datos.tsx render loop:
  filter by selected estado (client-side array filter)
  display badge with estado/faltante
```

**Filtering:** The filter operates on the in-memory array. The subscription is
unchanged — all ejecuciones load, filter is applied client-side. This is
acceptable because the total ejecuciones per company is bounded (hundreds, not
millions).

### 2D. Security Rules

No changes. The `comprobantes` array is part of the ejecucion document, already
covered by `match /ejecuciones/{doc}`.

### 2E. Indexes

None needed. Client-side filter only.

---

## 3. cuenta-bancaria-ejecucion — Bank Account on Ejecucion

### 3A. Data Model

```typescript
// ADD to Ejecucion interface (lib/types.ts)
export interface Ejecucion {
  // ... existing fields ...
  cuentaId?: string;    // Ref to companies/{companyId}/cuentasBancarias/{cuentaId}
  cuentaName?: string;  // Denormalized: "{banco} - {nombre} ({tipo})"
}
```

Both fields are optional. Set together at write time. Never auto-updated if the
bank account name changes.

### 3B. Component Changes

| Component | Change |
|-----------|--------|
| `FormPanel` (Sidepanel.tsx, after comprobantes section) | Add `SearchableSelect` labeled "Cuenta bancaria (opcional)". Populated from `subscribeCuentasBancarias`. Options format: `{banco} - {nombre} ({tipo})`. Setting `cuentaId` also sets `cuentaName` from selected option |
| `EjecucionView` (Sidepanel.tsx) | Add read-only field "Cuenta bancaria" showing `cuentaName` or "Sin cuenta bancaria" |
| `Datos.tsx` (~424 ejecucion row) | Add optional bank indicator (small text or icon showing `cuentaName`) |

**Form selector UI:**
```
┌─────────────────────────────────────┐
│ Cuenta bancaria (opcional)          │
│ ┌─ Buscar cuenta bancaria... ──────┐│
│ │ Bancolombia - Ahorros 5678 (Aho) ││
│ │ Banco de Bogotá - Corriente 1234 ││
│ │ Davivienda - Corriente 9999      ││
│ └──────────────────────────────────┘│
└─────────────────────────────────────┘
```

### 3C. Data Flow

**Write:**
```
Form: select bank account
  → set('cuentaId', selected.id)
  → set('cuentaName', `${selected.banco} - ${selected.nombre} (${selected.tipo})`)
  → handleSubmit passes fields to addEjecucion/updateEjecucion
  → Firestore doc has cuentaId + cuentaName
```

**Read:**
```
subscribeEjecuciones deserializer:
  cuentaId: data.cuentaId ?? undefined,
  cuentaName: data.cuentaName ?? undefined,

Datos.tsx row display:
  ejecucion.cuentaName
    ? <span>🏦 {ejecucion.cuentaName}</span>
    : <span class="text-slate-300">—</span>
```

### 3D. Security Rules

No changes. `cuentaId`/`cuentaName` are fields on the ejecucion doc, already
covered by existing rules.

### 3E. Indexes

None needed.

---

## 4. Security Rules — Consolidated Changes

```javascript
// ADD inside /companies/{companyId} match block:
match /ejecuciones/{ejecucionId}/budgetLinks/{linkId} {
  allow read, write: if isMember(companyId);
}
```

No other rule changes needed.

---

## 5. Migration / No-Migration

**Explicit: NO migration.** All existing ejecuciones with the old `budgetId`
field will be deleted as part of this change.

**Plan:**
1. Before deploying any PRs, a one-time script (`scripts/delete-ejecuciones.ts`)
   deletes ALL documents in `companies/*/ejecuciones/*`.
2. The seed script (`scripts/seed.ts`) is updated to NOT include ejecuciones
   (or include them without `budgetId`, with comprobantes, and with bank accounts)
   so dev/staging environments re-seed cleanly.
3. After deletion, deploy PR1 (banco) → PR2 (comprobantes) → PR3 (budget links)
   in sequence. No backward-compat code is needed because there is no legacy data.

**Why delete instead of migrate?** The user explicitly confirmed. The `budgetId`
field is purely relational — deleting and recreating ejecuciones is simpler and
safer than migrating to N:M with split amounts.

---

## 6. PR Sizing Recommendation

### Line Estimates

| Capability | Lines | Breakdown |
|------------|-------|-----------|
| Banco (cap3) | ~100 | types: 5, Sidepanel Form: 35, EjecucionView: 10, Datos: 15, tests: 35 |
| Comprobantes (cap2) | ~170 | lib/comprobantes.ts: 40, ComprobanteUploader: 35, Datos badge+filter: 55, EjecucionView: 10, seed: 10, tests: 20 |
| Budget Link (cap1) | ~260 | types: 15, firestore.ts: 65, Sidepanel Form: 60, EjecucionView: 40, BudgetView: 30, Datos: 20, rules/indexes: 10, tests: 20 |
| **Total** | **~530** | Exceeds 400-line budget |

### Recommendation: 3 Chained PRs

```
PR1 (Banco)          → targets feature/mejorar-ejecutados   (~100 lines)
PR2 (Comprobantes)   → targets PR1 branch                     (~170 lines)
PR3 (Budget Link)    → targets PR2 branch                     (~260 lines)
```

**PR order rationale:**
1. **PR1 — Banco**: Smallest, lowest risk, no data model breakage. Establishes
   the pattern for adding optional fields to Ejecucion.
2. **PR2 — Comprobantes**: Medium size. Pure function + UI changes. No Firestore
   structural changes. Builds on PR1's form area.
3. **PR3 — Budget Link**: Largest. Removes `budgetId`, adds subcollection,
   changes queries. Must come last because it changes the relationship model
   and requires the data deletion.

**No PR needs to be a single oversized PR.** Each is reviewable independently.

---

## 7. Files Changed Summary

| File | Action | PR |
|------|--------|----|
| `lib/types.ts` | Remove `budgetId`, add `cuentaId`/`cuentaName` | 1, 3 |
| `lib/comprobantes.ts` | **Create** — state derivation function | 2 |
| `lib/firestore.ts` | Add CRUD for budgetLinks, collectionGroup query; remove budgetId deser | 1, 3 |
| `components/Sidepanel.tsx` | Form multi-budget selector, bank selector, comprobante state, EjecucionView link list | 1, 2, 3 |
| `components/Datos.tsx` | State badge, filter dropdown, bank indicator, budget chips | 1, 2, 3 |
| `app/[company]/[[...segments]]/page.tsx` | Add budgetLinks write in handleFormSubmit; remove auto-link budgetId default | 3 |
| `firestore.rules` | Add budgetLinks subcollection rule | 3 |
| `firestore.indexes.json` | Add collectionGroup index for budgetLinks | 3 |
| `scripts/seed.ts` | Add "Comprobante de pago" + "Cuenta de Cobro"; remove ejecuciones with budgetId | 2 |
| `scripts/delete-ejecuciones.ts` | **Create** — one-time cleanup script | PR0 (pre-PR1) |
| Test files (3×) | Update `makeEjecucion` factories (remove budgetId from overrides logic) | 3 |

---

## 8. Design Decisions (Resolved)

### 8A. Seed Script Update
**Decision:** Add "Comprobante de pago" and "Cuenta de Cobro" to `scripts/seed.ts`
(orders 4 and 5 respectively, after Factura/Recibo/Transferencia/Efectivo). This
ensures dev/staging/CI environments have the same configuration as production.

Already reflected in Section 2A (seed change).

### 8B. Bank Account Name Format
**Decision:** Composite format `"{banco} - {nombre} ({tipo})"`. This disambiguates
when the same bank has multiple accounts (e.g., two Global66 accounts of different
types). Already reflected in Sections 3A-3C.

### 8C. Data Deletion Timing
**Decision:** Pre-work before PR1. A one-time script `scripts/delete-ejecuciones.ts`
runs before ANY PR is deployed:
1. Delete all `companies/*/ejecuciones/*` docs
2. Update seed to not include ejecuciones with old `budgetId`
3. Then deploy PR1 → PR2 → PR3 sequentially

This prevents rendering issues from legacy data during the PR window. The script
is tracked separately as "PR0" in the files changed summary.
