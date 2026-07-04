# Tasks: Estado de Resultados (P&L)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~290 (200 new + 8 router + 3 sidebar + 80 tests) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Foundation

- [x] 1.1 Add `'EstadoResultados'` to ViewType union in `lib/types.ts` L122

## Phase 2: Core Logic — computePnL

- [x] 2.1 RED: Write unit tests for `computePnL` in `__tests__/estado-resultados.test.ts` — F1–F12 with mixed projects (spec scenario), zero data, Admin case-insensitive match, archived exclusion, missing fecha fallback
- [x] 2.2 GREEN: Implement `computePnL(records, mode, devoluciones, gastosFinancieros)` pure function in `components/EstadoResultados.tsx` — `isAdmin` via `name.trim().toLowerCase() === 'admin'`, `getMonto` via mode-switched field, F1–F12 formula chain per design pseudocode
- [x] 2.3 REFACTOR: Verify full branch coverage; inline helpers if no duplication

## Phase 3: Component

- [x] 3.1 RED: Write integration tests for `EstadoResultados` component in `__tests__/estado-resultados.test.tsx` — render with mock budgets/ejecuciones, toggle Presupuestado/Ejecutado, change year selector, edit F2/F7 inputs, assert F3/F5/F8/F9/F12 recalculate
- [x] 3.2 GREEN: Build `components/EstadoResultados.tsx` — header with year selector + mode toggle pills (Dashboard pattern), P&L table with 12 rows (label + valor), editable `<input>` for F2/F7, `formatCurrency` for COP display, `useMemo` for `filteredRecords` and `rows`
- [x] 3.3 REFACTOR: Match Dashboard visual tokens — clsx + Tailwind, truncated year nav, toggle pill styling

## Phase 4: Integration

- [x] 4.1 Add `estado-resultados` → `'EstadoResultados'` mapping in `viewFromSegments` (`page.tsx` ~L40)
- [x] 4.2 Add path for `'EstadoResultados'` in `navigateTo` (`page.tsx` ~L161)
- [x] 4.3 Render `<EstadoResultados budgets={budgets} ejecuciones={ejecuciones} />` branch in JSX (`page.tsx` ~L352)
- [x] 4.4 Import `TrendingUp` from lucide-react in `components/Sidebar.tsx` L5
- [x] 4.5 Add menu item `{ id:'EstadoResultados', label:'Estado de Resultados', icon:TrendingUp }` in Sidebar `menuItems` array

## Phase 5: Verification

- [x] 5.1 Run `npx tsc --noEmit` — zero errors
- [x] 5.2 Run `npm run lint` — zero warnings (on new files; pre-existing issues in Datos/Sidepanel unchanged)
- [x] 5.3 Run `npm test` — new tests pass, existing tests show zero regressions
