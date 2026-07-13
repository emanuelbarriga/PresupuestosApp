# Design: ER Config System

## Technical Approach

Extend the existing entity sidepanel pattern to support per-company P&L formula configuration. A single Firestore document at `companies/{companyId}/settings/er` stores the config, upserted via `setDoc`. `computePnL` gains an optional `erConfig` parameter — when absent/undefined, `DEFAULT_ER_CONFIG` preserves today's exact hardcoded behavior. The config screen (`ErConfigPanel`) follows the `CustomizePanel` layout pattern and reuses `PanelHeader`.

Architecture decisions table:

| Decision | Option | Tradeoff | Chosen |
|----------|--------|----------|--------|
| Nav model | New screen type vs. reuse entity | New type = more types; entity = fits existing routing | `{type:'entity', entity:'er-config', mode:'edit'}` — reuses switch in Sidepanel |
| Config storage | Subcollection doc vs. field on company | Field = no extra read; doc = cleaner boundary | `settings/er` subcollection doc (consistent with existing `settings/categorias` pattern) |
| API pattern | `getDoc/setDoc` vs. `onSnapshot` | Snapshot = real-time, extra cost; getDoc = simpler, enough for this | `getDoc`/`setDoc` — config changes are manual, no real-time need |
| computePnL param | Optional with default vs. required | Required = breaks callers; optional = zero migration | Optional `ErConfig` with `DEFAULT_ER_CONFIG` fallback |

## Data Flow

```
EstadoResultados                  ErConfigPanel               Firestore
    │                                 │                          │
    ├── mount ──────────────────────► getErConfig(companyId) ──► getDoc()
    │                                 │                          │
    │◄─── ErConfig (or null) ────────┤                          │
    │                                 │                          │
    │ computePnL(records, mode,       │                          │
    │   devoluciones, GF, erConfig)   │                          │
    │                                 │                          │
    │ [config button click]           │                          │
    │ ──► pushScreen({entity:'er-config'})                       │
    │                                 │                          │
    │                     ErConfigPanel renders                  │
    │                                 │                          │
    │                    [user edits + clicks Save]              │
    │                                 ├── saveErConfig() ──────► setDoc()
    │◄──── popScreen() ───────────────┤                          │
    │                                 │                          │
    │ computePnL(..., newConfig) ─────┤                          │
```

## File Changes

| File | Action | Est. LOC | Description |
|------|--------|----------|-------------|
| `lib/types.ts` | Modify | +20 | Add `ErConfig`, `ErFormulaConfig`, `ErTaxRegime`, `ErFormulaType`, +`'er-config'` to EntityType |
| `lib/firestore.ts` | Modify | +25 | Add `getErConfig`, `saveErConfig` with setDoc pattern |
| `components/EstadoResultados.tsx` | Modify | +60 | Refactor `computePnL` to accept optional `ErConfig`, add `onErConfigClick` prop + gear button |
| `components/panels/ErConfigPanel.tsx` | **Create** | ~180 | Config form panel following CustomizePanel pattern |
| `components/Sidepanel.tsx` | Modify | +5 | Import ErConfigPanel, add case for `'er-config'` entity |
| `app/[company]/[[...segments]]/page.tsx` | Modify | +12 | Import `getErConfig`/`saveErConfig`, add `handleErConfigClick`, pass to EstadoResultados, load config |
| `lib/er-config-defaults.ts` | **Create** | ~10 | Export `DEFAULT_ER_CONFIG` constant |

## Interfaces / Contracts

### New Types (`lib/types.ts`)

```typescript
export type ErTaxRegime = 'simple' | 'comun';
export type ErFormulaType =
  | 'all-ingresos' | 'all-egresos' | 'all-egresos-no-admin'
  | 'project-name' | 'projects' | 'manual';

export interface ErFormulaConfig {
  type: ErFormulaType;
  projectName?: string;   // for 'project-name'
  projectIds?: string[];  // for 'projects'
}

export interface ErConfig {
  id?: string;
  taxRegime: ErTaxRegime;
  formulas: {
    ingresos: ErFormulaConfig;          // F1
    devoluciones: ErFormulaConfig;      // F2
    costos: ErFormulaConfig;            // F4
    gastosAdmin: ErFormulaConfig;       // F6
    gastosFinancieros: ErFormulaConfig; // F7
  };
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

Add `'er-config'` to the EntityType union at line 279.

### Firestore Functions (`lib/firestore.ts`)

```typescript
const ER_CONFIG_PATH = 'settings/er';

export async function getErConfig(companyId: string): Promise<ErConfig | null> {
  const snap = await getDoc(doc(db, COMPANIES_COLLECTION, companyId, ER_CONFIG_PATH));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ErConfig;
}

export async function saveErConfig(companyId: string, config: ErConfig): Promise<void> {
  await setDoc(doc(db, COMPANIES_COLLECTION, companyId, ER_CONFIG_PATH), {
    ...config,
    updatedAt: serverTimestamp(),
  });
}
```

### Default Config (`lib/er-config-defaults.ts`)

```typescript
import { ErConfig } from '@/lib/types';

export const DEFAULT_ER_CONFIG: ErConfig = {
  taxRegime: 'simple',
  formulas: {
    ingresos: { type: 'all-ingresos' },
    devoluciones: { type: 'manual' },
    costos: { type: 'all-egresos-no-admin' },
    gastosAdmin: { type: 'project-name', projectName: 'Admin' },
    gastosFinancieros: { type: 'manual' },
  },
};
```

This matches today's hardcoded behavior exactly — backward compatibility is implicit.

## computePnL Refactoring Plan

### Before (current hardcoded)

```typescript
// F1
const ingresosRecords = records.filter(r => r.tipo === 'ingreso');
// F4
const costosRecords = records.filter(r => r.tipo === 'egreso' && !isAdminProject(r.projectName));
// F6
const adminRecords = records.filter(r => r.tipo === 'egreso' && isAdminProject(r.projectName));
// F8
const F8 = (F4 + F6 + F7) * 0.004;
// F10
const F10 = F1 * 0.081;
// F11
const F11 = Math.min(F8, F10);
```

### After (config-driven)

```typescript
export function computePnL(
  records: PnLRecord[],
  mode: 'Presupuestado' | 'Ejecutado',
  devoluciones: number,
  gastosFinancieros: number,
  erConfig: ErConfig = DEFAULT_ER_CONFIG,
): PnLRow[] {
  const isPresupuestado = mode === 'Presupuestado';
  const getMonto = (r: PnLRecord): number =>
    isPresupuestado ? r.montoPresupuestado : r.montoEjecutado;

  // Helper: resolve ErFormulaConfig → filtered records
  const filterByFormula = (formula: ErFormulaConfig, base: PnLRecord[]): PnLRecord[] => {
    switch (formula.type) {
      case 'all-ingresos':     return base.filter(r => r.tipo === 'ingreso');
      case 'all-egresos':      return base.filter(r => r.tipo === 'egreso');
      case 'all-egresos-no-admin':
        return base.filter(r => r.tipo === 'egreso' && !isAdminProject(r.projectName));
      case 'project-name':
        return base.filter(r => r.projectName.trim().toLowerCase() === formula.projectName?.trim().toLowerCase());
      case 'projects':
        if (!formula.projectIds?.length) return [];
        return base.filter(r => r.projectId && formula.projectIds!.includes(r.projectId));
      case 'manual':
        return [];
    }
  };

  // F1
  const ingresosRecords = filterByFormula(erConfig.formulas.ingresos, records);
  const F1 = ingresosRecords.reduce((sum, r) => sum + getMonto(r), 0);
  const F1Children = groupByProject(ingresosRecords, getMonto);

  // F2 — manual when type='manual', else computed
  const F2 = erConfig.formulas.devoluciones.type === 'manual'
    ? devoluciones
    : filterByFormula(erConfig.formulas.devoluciones, records)
        .reduce((sum, r) => sum + getMonto(r), 0);

  // ... same pattern for F4, F6, F7 ...

  // Tax regime logic
  const isSimple = erConfig.taxRegime === 'simple';
  const F8 = isSimple ? (F4 + F6 + F7) * 0.004 : 0;
  const F9 = F5 - F6 - F7 - F8;
  const F10 = isSimple ? F1 * 0.081 : F9 * 0.35;
  const F11 = isSimple ? Math.min(F8, F10) : 0;
  const F12 = F9 - F10 + F11;

  // Dynamic label for F10
  const f10Label = isSimple ? 'Impuesto SIMPLE (8.1%)' : 'Impuesto Renta (35%)';
  // ...
}
```

Key design choice: the label for F10 is dynamic based on regime. The row labels array must move inside the function body (post-computation) instead of being a static return.

## ErConfigPanel Component Design

```
ErConfigPanel
├── PanelHeader title="Configuración ER"
├── Regime Selector (Dropdown)
│   ├── "Régimen Simple" → taxRegime = 'simple'
│   └── "Régimen Común"  → taxRegime = 'comun'
├── Formula Sections (5 sections, one per P&L line)
│   ├── Ingresos (F1)
│   │   └── Type selector: all-ingresos | project-name | projects | manual
│   ├── Devoluciones (F2)
│   │   └── Type selector: manual | all-ingresos | ...
│   ├── Costos (F4)
│   │   └── Type selector: all-egresos-no-admin | all-egresos | project-name | projects | manual
│   ├── Gastos Admin (F6)
│   │   └── Type selector: project-name(default:'Admin') | all-egresos | ...
│   └── Gastos Financieros (F7)
│       └── Type selector: manual | ...
├── Project Selector (reuses searchable dropdown from CustomizePanel pattern)
│   └── Appears when type is 'project-name' or 'projects'
└── Save Button → calls onSave(ErConfig)
```

Props:
```typescript
interface ErConfigPanelProps {
  config: ErConfig;
  projects: Project[];
  onSave: (config: ErConfig) => Promise<void>;
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
}
```

## Sidepanel Wiring

Add to `Sidepanel.tsx`:

```typescript
import { ErConfigPanel } from '@/components/panels/ErConfigPanel';

// In renderEntityScreen switch, after the existing cases:
case 'er-config':
  return (
    <ErConfigPanel
      config={screen.record as ErConfig}
      projects={[]}  // passed via props
      onSave={async (config) => {
        // handled by page.tsx callback
      }}
      canGoBack={canGoBack}
      onBack={onBack}
      onClose={onClose}
    />
  );
```

Pass `projects` through `SidepanelProps` (already exists) and relay `ErConfig` via a new callback `onErConfigSave` on the sidepanel.

Actually, simpler: the `onSubmit` pattern already handles entity submissions. We add a handler in `page.tsx`:

```typescript
const handleErConfigSave = async (config: ErConfig) => {
  await saveErConfig(companyId, config);
  setErConfig(config);  // triggers computePnL re-render
  popScreen();
};
```

## Navigation Flow

```
EstadoResultados header: ⚙ button
  ↓ onClick → handleErConfigClick()
  ↓ pushScreen({ type: 'entity', entity: 'er-config', mode: 'edit', record: loadedConfig })
  ↓
Sidepanel renders ErConfigPanel
  ↓ User edits regime + formulas
  ↓ Clicks "Guardar"
  ↓ saveErConfig(companyId, config) + setErConfig(config) + popScreen()
  ↓
EstadoResultados re-renders with new config → computePnL uses it
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit (computePnL) | Default config produces identical output | Existing 240-line test file — add 1 test that passes `DEFAULT_ER_CONFIG` and asserts same results as no-arg call |
| Unit (computePnL) | Régimen Común tax formula | F10 = F9 * 0.35, F8 = 0, F11 = 0 |
| Unit (computePnL) | Project-name filter for F6 | Config with `gastosAdmin: {type:'project-name', projectName:'Oficina'}` filters correctly |
| Unit (computePnL) | Projects filter using projectIds | Multiple projects selected for F1 |
| Unit (computePnL) | Manual type returns 0 for computed lines | `all-ingresos` returns 0 for F1 when no matching records |
| Integration | ErConfigPanel renders + saves | Render with mock projects, change regime, verify onSave payload |
| Unit (firestore) | getErConfig / saveErConfig | Mock getDoc/setDoc, verify path and data shape |

No E2E tests — the component already lacks them, and the change is entirely behind existing routing patterns.

## Migration / Rollout

No migration required. `getErConfig` returns `null` for existing companies → `computePnL` uses `DEFAULT_ER_CONFIG` → identical output. Existing tests pass without changes. When a user first saves config via the panel, the document is created. No data backfill needed.

## Open Questions

- [ ] Should `ErConfigPanel` load the config itself (via props from parent) or fetch independently? **Decision**: Parent fetches via `getErConfig` and passes as prop — consistent with how other entity panels work.
- [ ] The F10 label changes dynamically — should the row IDs remain F10/F11/F12? Yes — only the label text changes, structure is stable.
