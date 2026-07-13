# Tasks: ER Config System

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350–410 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

## Phase 1: Foundation

- [x] 1.1 **`lib/types.ts`** — Add `ErTaxRegime`, `ErFormulaType`, `ErFormulaConfig`, `ErConfig` types before EntityType. Append `'er-config'` to the EntityType union.
- [x] 1.2 **`lib/er-config-defaults.ts`** — Create new file exporting `DEFAULT_ER_CONFIG` with `taxRegime: 'simple'` and formulas matching today's hardcoded logic.

## Phase 2: Core Implementation

- [x] 2.1 **`lib/firestore.ts`** — Add `getErConfig(companyId): Promise<ErConfig | null>` reading `companies/{companyId}/settings/er` via `getDoc`. Add `saveErConfig(companyId, config)` via `setDoc` with `serverTimestamp()`.
- [x] 2.2 **`components/EstadoResultados.tsx`** — Refactor `computePnL` to accept optional `erConfig: ErConfig = DEFAULT_ER_CONFIG`. Add `filterByFormula` helper. Replace hardcoded project filtering with config-driven logic. Add dual tax regime: `simple` → F10=F1×0.081, GMF active; `comun` → F10=F9×0.35, GMF=0, descuento=0. Make F10 label dynamic.
- [x] 2.3 **`components/panels/ErConfigPanel.tsx`** — Create new panel following `CustomizePanel` pattern (PanelHeader, searchable project selector). Regime radio (simple/comun). 5 formula sections (Ingresos, Devoluciones, Costos, Gastos Admin, Gastos Financieros) each with type selector and project picker. Save button.

## Phase 3: Integration / Wiring

- [x] 3.1 **`components/Sidepanel.tsx`** — Import `ErConfigPanel`, add `case 'er-config':` in `renderEntityScreen` switch. Pass through `projects` (already in SidepanelProps).
- [x] 3.2 **`app/[company]/[[...segments]]/page.tsx` + `EstadoResultados.tsx`** — Add `getErConfig`/`saveErConfig` import + `erConfig` state. Load config on mount. Add `onErConfigClick` prop + gear button in EstadoResultados header. `handleErConfigClick` pushes `{type:'entity', entity:'er-config', mode:'edit', record: loadedConfig}`. Pass `handleErConfigSave` that persists, updates state, and pops screen.

## Phase 4: Testing / Verification

- [x] 4.1 **`components/__tests__/estado-resultados.test.ts`** — Add test: default config produces identical output to today. Add test: régimen común (F10=F9×0.35, F8=0, F11=0). Add test: project-name filter for gastosAdmin. Add test: projects filter using projectIds. Add test: manual type returns 0.
- [~] 4.2 **`components/__tests__/er-config.test.tsx`** — New integration test: render ErConfigPanel with mock projects, change regime, verify onSave payload shape. *(Deferred — ErConfigPanel has 11.42% coverage, flagged as follow-up in verify report)*
- [x] 4.3 **Verify** — `npx tsc --noEmit`: 0 new errors. `npm test`: all existing + new tests pass.
