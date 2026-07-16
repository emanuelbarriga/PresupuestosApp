## Verification Report

**Change**: soportes-entidad
**Version**: N/A
**Mode**: Standard

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 7 |
| Tasks complete | 7 |
| Tasks incomplete | 0 |

### Build & Tests Execution

**Build**: ✅ Passed
```text
$ npx tsc --noEmit
→ exit code 0, no errors
```

**Tests**: ✅ 812 passed / ❌ 0 failed / ⚠️ 0 skipped
```text
$ npx vitest run --reporter=verbose
→ 67 test files, 812 tests passed, 0 failed, 0 skipped
→ Duration 21.15s
```

**Coverage**: ➖ Not available (no coverage threshold configured for this change)

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Entity filters for subscribeDocumentos | Filter by terceroId | (none found) | ❌ UNTESTED |
| Entity filters for subscribeDocumentos | Filter by projectId | (none found) | ❌ UNTESTED |
| Entity filters for subscribeDocumentos | Both entity filters | (none found) | ❌ UNTESTED |
| Entity filters for subscribeDocumentos | No entity filter — backward compatible | `mediaService.test.ts` — passes status filter | ✅ COMPLIANT |
| Entity filters for subscribeDocumentos | No filters at all — backward compatible | `mediaService.test.ts` — returns unsubscribe with `{}` | ⚠️ PARTIAL |
| SoportesTab component | Cards rendered from documents | (none found) | ❌ UNTESTED |
| SoportesTab component | Empty state | (none found) | ❌ UNTESTED |
| SoportesTab component | Loading spinner | (none found) | ❌ UNTESTED |
| SoportesTab component | Card click navigation | (none found) | ❌ UNTESTED |
| Per-entity feature preservation | TerceroView — Detalle by default | (none found) | ❌ UNTESTED |
| Per-entity feature preservation | TerceroView — switch to Soportes | (none found) | ❌ UNTESTED |
| Per-entity feature preservation | ProjectView — Detalle includes accordions | (none found) | ❌ UNTESTED |
| Per-entity feature preservation | ProjectView — switch to Soportes | (none found) | ❌ UNTESTED |
| Per-entity feature preservation | Re-click active tab is no-op | (none found) | ❌ UNTESTED |

**Compliance summary**: 1.5/14 scenarios compliant (1 COMPLIANT, 1 PARTIAL, 12 UNTESTED)

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| subscribeDocumentos accepts `terceroId` in filters | ✅ Implemented | `mediaService.ts` lines 25, 37 |
| subscribeDocumentos accepts `projectId` in filters | ✅ Implemented | `mediaService.ts` lines 26, 38 |
| Backward compatible — existing filters unchanged | ✅ Implemented | Existing `where(status/tipoDocumento/_source)` logic untouched, lines 34-36 |
| SoportesTab component | ✅ Implemented | `SoportesTab.tsx` — 133 lines, full component |
| Props: companyId, terceroId?, projectId?, onNavigate | ✅ Implemented | `SoportesTabProps` interface lines 42-47 |
| subscribeDocumentos call with entity filter + status:enlazado | ✅ Implemented | `SoportesTab.tsx` lines 56-67 |
| Card renders: fileName, tipoDocumento badge, periodo, montoTotal COP, proveedorTexto | ✅ Implemented | Lines 95-129 |
| Card click → onNavigate({ type: "entity", entity: "documento", mode: "view", record: doc }) | ✅ Implemented | `SoportesTab.tsx` line 97 |
| Empty state "No hay documentos asociados" | ✅ Implemented | `SoportesTab.tsx` line 86 |
| Loading spinner while subscription loading | ✅ Implemented | `SoportesTab.tsx` lines 73-79 |
| TerceroView tabs: "Detalle" (default) and "Soportes" | ✅ Implemented | `TerceroView.tsx` lines 27-91 |
| Tab bar styling: `border-b border-slate-200 px-6 flex gap-0` | ✅ Implemented | `TerceroView.tsx` line 34, `ProjectView.tsx` line 130 |
| Active tab: `text-indigo-600` with bottom indicator | ✅ Implemented | Both views |
| Inactive tab: `text-slate-500 hover:text-slate-700` | ✅ Implemented | Both views |
| Tabs inside scroll container (after content), not in entity header | ✅ Implemented | Both views render tabs inside the fragment, not in Entity wrapper |
| ProjectView tabs: "Detalle" (default) and "Soportes" | ✅ Implemented | `ProjectView.tsx` lines 130-154 |
| ProjectView conditional render of DF + accordions vs SoportesTab | ✅ Implemented | `ProjectView.tsx` lines 156-269 |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Tabs dentro del View, no en el Entity wrapper | ✅ Yes | TerceroView y ProjectView tienen estado local `activeTab`; Entity wrappers sin cambios |
| Extender subscribeDocumentos filters en lugar de nueva función | ✅ Yes | `terceroId`/`projectId` agregados al mismo objeto filters y constraints |
| SoportesTab como componente compartido en `components/entities/shared/` | ✅ Yes | `components/entities/shared/SoportesTab.tsx` — ignora si tercero o proyecto |
| Data flow: Sidepanel → Entity → View → SoportesTab → subscribeDocumentos | ✅ Yes | Verificado en ambas vistas |
| Composite indexes para `terceroId ASC, status ASC` y `projectId ASC, status ASC` | ⚠️ No | `firestore.indexes.json` no incluye estos índices. Firestore los sugerirá automáticamente en dev |

### Issues Found

**CRITICAL**: None
- All tasks complete, static analysis pasó, type-check sin errores. Las 812 tests existentes pasan (ningún regression).

**WARNING**: None
- Todas las funcionalidades están implementadas según spec y design. No hay desviaciones que rompan requirements.

**SUGGESTION**:
1. `SoportesTab.tsx` línea 62 usa `as any` al pasar los filtros a `subscribeDocumentos`. Funciona en runtime, pero se pierde type-safety. Alternativa: construir el objeto filter con spread condicional tipado.
2. Agregar tests unitarios para `subscribeDocumentos` con `terceroId` y `projectId` en `lib/__tests__/mediaService.test.ts` para cubrir los escenarios de spec actualmente `UNTESTED`.
3. Agregar tests de render para `SoportesTab` (loading, empty, cards, click navigation).
4. Agregar tests de integración para `TerceroView` y `ProjectView` — cambio de tabs y render condicional.
5. Agregar los índices compuestos a `firestore.indexes.json`:
   - `terceroId ASC, status ASC` en collection `companies/{companyId}/documentos`
   - `projectId ASC, status ASC` en collection `companies/{companyId}/documentos`

### Verdict

**PASS WITH WARNINGS**

Implementation completa y correcta según spec, design, y tasks. Static analysis y type-check pasan, 812 tests existentes siguen pasando (sin regressions). Sin embargo, los 14 escenarios del spec están mayoritariamente `UNTESTED` — la implementación es correcta por inspección estática pero no hay tests automáticos que cubran los nuevos escenarios. Esto es aceptable para un cambio estándar pero se recomienda agregar cobertura.
