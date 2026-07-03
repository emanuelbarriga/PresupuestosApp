# Design: Estado de Resultados (P&L)

## Technical Approach

New client component `EstadoResultados` that computes a 12-row P&L statement from existing `Budget`/`Ejecucion` arrays received as props. Calculation is a pure synchronous function (`computePnL`) — no additional Firestore reads. Manual F2/F7 fields live in React `useState`. The view integrates via additive changes to `ViewType`, `viewFromSegments`, `navigateTo`, and `Sidebar`.

## Architecture Decisions

| # | Decision | Alternatives | Rationale |
|---|----------|-------------|-----------|
| D1 | Pure `computePnL(budgets, ejecuciones, mode, year, dev, gfin)` function | Inline logic in JSX; class with methods | Trivially testable, memoizable, zero side-effects. Follows Dashboard's `buildTerceroGroups` pattern. |
| D2 | F2/F7 in `useState<number>`, NOT Firestore | Persist to Firestore collection | Scope explicit: "local state only". Avoids schema changes and writes. Simpler rollback. |
| D3 | Admin project via `name.trim().toLowerCase() === 'admin'` | Lookup by projectId, dedicated flag, settings config | No schema change. Matches current data where Admin is named "Admin"/"ADMIN"/"admin". Proposal explicitly defines this. |
| D4 | `startsWith(String(year))` on fecha field, exclude `archivado === true` | Parse to Date, month-level comparison | Identical to Dashboard.tsx L179-180 filtering. Consistent UX, handles missing fecha gracefully via empty-string fallback. |
| D5 | Reuse Dashboard header pattern (toggle pills + year nav) | Custom toggle, dropdown year selector | Visual consistency. Users already know this pattern. Same clsx + Tailwind tokens. |
| D6 | `formatCurrency` local to component | Shared lib utility, import from Dashboard | Each component defines its own — consistent with current codebase pattern in Datos.tsx L9 and Dashboard.tsx L10. |

## Data Flow

```
Firestore (page.tsx subscriptions)
  │
  ├─→ budgets: Budget[]  ──┐
  ├─→ ejecuciones: Ejecucion[] ─┤
  │                             ↓
  │              EstadoResultados (props)
  │                │
  │                ├── useMemo: filterByYear()
  │                │     (startsWith yearStr, archived excluded)
  │                │
  │                ├── useMemo: computePnL(filtered, mode, year, dev, gfin)
  │                │     ├─ F1 = Σ tipo=ingreso, all projects
  │                │     ├─ F4 = Σ tipo=egreso, non-Admin projects
  │                │     ├─ F6 = Σ tipo=egreso, Admin project (ci match)
  │                │     ├─ F3, F5, F8-F12 = derived via formula chain
  │                │     └─ → PnLRow[] (12 rows with id, label, value, editable, indent, bold)
  │                │
  │                └── JSX render
  │                      ├─ Header: title + year selector + mode toggle
  │                      └─ Table: Concepto | Valor
  │                            ├─ F2 row → <input type="number">
  │                            ├─ F7 row → <input type="number">
  │                            └─ All others → formatCurrency(row.value)
```

## Component Structure

```typescript
// Props (received from page.tsx)
interface EstadoResultadosProps {
  budgets: Budget[];
  ejecuciones: Ejecucion[];
  projects?: Project[];   // not used in P&L calc, kept for future drill-down
}

// Internal state
const [mode, setMode] = useState<'Presupuestado' | 'Ejecutado'>('Presupuestado');
const [selectedYear, setSelectedYear] = useState<number>(currentYear);
const [devoluciones, setDevoluciones] = useState<number>(0);       // F2
const [gastosFinancieros, setGastosFinancieros] = useState<number>(0); // F7

// Derived (useMemo)
const filteredRecords = useMemo(() => {
  const records = mode === 'Presupuestado' ? budgets : ejecuciones;
  return records.filter(r => {
    const fecha = mode === 'Presupuestado' ? (r as Budget).fechaPresupuestado : (r as Ejecucion).fechaEjecutado;
    return (fecha || '').startsWith(String(selectedYear)) && r.archivado !== true;
  });
}, [budgets, ejecuciones, mode, selectedYear]);

const rows = useMemo(() =>
  computePnL(filteredRecords, mode, devoluciones, gastosFinancieros),
  [filteredRecords, mode, devoluciones, gastosFinancieros]
);
```

## computePnL Pseudocode

```
function computePnL(records, mode, devoluciones, gastosFinancieros) → PnLRow[]
  getMonto(r) = mode === 'Presupuestado' ? r.montoPresupuestado : r.montoEjecutado
  isAdmin = name → name.trim().toLowerCase() === 'admin'

  F1 = Σ getMonto(r) for r in records where r.tipo === 'ingreso'
  F4 = Σ getMonto(r) for r in records where r.tipo === 'egreso' AND NOT isAdmin(r.projectName)
  F6 = Σ getMonto(r) for r in records where r.tipo === 'egreso' AND isAdmin(r.projectName)

  F2 = devoluciones
  F3 = F1 - F2
  F5 = F3 - F4
  F7 = gastosFinancieros
  F8 = (F4 + F6 + F7) × 0.004
  F9 = F5 - F6 - F7 - F8
  F10 = F1 × 0.081
  F11 = min(F8, F10)
  F12 = F9 - F10 + F11

  return [
    {id:'F1', label:'Ingresos Brutos',             value:F1,  editable:false, indent:0, bold:false},
    {id:'F2', label:'Devoluciones, rebajas y desc.',value:F2,  editable:true,  indent:1, bold:false},
    {id:'F3', label:'Ingresos Netos',               value:F3,  editable:false, indent:1, bold:true},
    {id:'F4', label:'Costos de Operación',          value:F4,  editable:false, indent:0, bold:false},
    {id:'F5', label:'Utilidad Bruta',               value:F5,  editable:false, indent:1, bold:true},
    {id:'F6', label:'Gastos Administrativos',       value:F6,  editable:false, indent:0, bold:false},
    {id:'F7', label:'Gastos Financieros',           value:F7,  editable:true,  indent:1, bold:false},
    {id:'F8', label:'GMF (4×1000)',                  value:F8,  editable:false, indent:1, bold:false},
    {id:'F9', label:'Utilidad Operacional',         value:F9,  editable:false, indent:1, bold:true},
    {id:'F10',label:'Impuesto SIMPLE (8.1%)',       value:F10, editable:false, indent:0, bold:false},
    {id:'F11',label:'Descuento Tributario GMF',      value:F11, editable:false, indent:1, bold:false},
    {id:'F12',label:'Utilidad Neta',                 value:F12, editable:false, indent:0, bold:true},
  ]
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/types.ts` L122 | Modify | Add `'EstadoResultados'` to `ViewType` union |
| `app/[company]/[[...segments]]/page.tsx` | Modify | L38-46: add `estado-resultados` → `'EstadoResultados'`; L161: add path in `navigateTo`; ~L352: render `<EstadoResultados>` branch |
| `components/Sidebar.tsx` | Modify | L5: import `TrendingUp` from lucide-react; L37-44: add menu item `{ id:'EstadoResultados', label:'Estado de Resultados', icon: TrendingUp, path }` |
| `components/EstadoResultados.tsx` | Create | New client component (~200 LOC) with header, toggle, year selector, P&L table |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `computePnL` function | vitest: verify F1-F12 with known inputs (mixed projects, zero data, Admin case-insensitive). Edge cases: empty arrays, archived records, missing fecha. |
| Integration | `EstadoResultados` component | @testing-library/react: render with mock budgets/ejecuciones, toggle mode, change year, edit F2/F7, verify F3/F5/F8/F9/F12 recalculate. |
| Manual | Sidebar navigation, route URL | Verify click navigates to `/{company}/estado-resultados`, active state renders, existing views unchanged. |

## Migration / Rollout

No migration required. No data writes. Rollback: revert 4 files.

## Open Questions

- [ ] Should we show a KPI summary row (Ingresos Netos, Utilidad Bruta, Utilidad Neta) above the table like Dashboard does? Not in spec — defer to implementer.
- [ ] Should F2/F7 manual values persist across view changes? Current design resets them (React state unmounts). Could lift to page.tsx but adds complexity without clear user need.
