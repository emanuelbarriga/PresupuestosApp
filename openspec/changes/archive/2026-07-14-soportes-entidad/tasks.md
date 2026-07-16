# Tasks: Pestaña Soportes en Tercero y Proyecto

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~210 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

```
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low
```

## Phase 1: Foundation — Extender subscribeDocumentos

- [x] 1.1 Agregar `terceroId?: string` y `projectId?: string` al type del parámetro `filters` en `lib/mediaService.ts`
- [x] 1.2 Agregar `where('terceroId', '==', ...)` condicional si `terceroId` presente; igual para `projectId`

## Phase 2: Core — SoportesTab component

- [x] 2.1 Crear `components/entities/shared/SoportesTab.tsx` con props `{ companyId, terceroId?, projectId?, onNavigate }`
- [x] 2.2 Llamar `subscribeDocumentos` con filtro entity + `status: 'enlazado'` y renderizar cards (fileName, tipoDocumento badge, periodo, montoTotal COP, proveedorTexto)
- [x] 2.3 Agregar empty state ("No hay documentos asociados") y loading state (spinner)
- [x] 2.4 Agregar `onClick` en card → `onNavigate({ type: 'entity', entity: 'documento', mode: 'view', record: doc })`

## Phase 3: Integración — Tabs en vistas

- [x] 3.1 En `TerceroView.tsx`: agregar `activeTab: 'detalle' | 'soportes'` + tab bar (mismo estilo que MediaPage: `border-b border-slate-200 px-6`, `text-indigo-600`) + render condicional del contenido actual y `<SoportesTab>`
- [x] 3.2 En `ProjectView.tsx`: mismo patrón de tabs + render condicional con `<SoportesTab projectId={record.id} />`

---

**Archived**: 2026-07-14 · 7/7 tasks complete · Verdict: PASS WITH WARNINGS
