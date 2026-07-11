# Proposal: Optimizar rendimiento al cambiar de empresa

> **Change**: `optimizar-cambio-empresa`
> **Date**: 2026-07-10
> **Source**: [exploration.md](../exploration.md)

## Intent

Eliminar el remontado completo del árbol al cambiar de empresa en la Sidebar. Hoy `CompanyProvider` y el membership guard están dentro de `app/[company]/layout.tsx`, por lo que cambiar `[company]` destruye TODO el subárbol: contexto, suscripciones Firestore, navStack del sidepanel, sidebar collapsed state. Resultado: flash blanco + ~500-2000ms de spinner + pérdida de estado local.

## Scope

2 fases independientes, deployables por separado:

| Fase | Qué | Esfuerzo | Impacto UX |
|------|-----|----------|------------|
| **1** | quick wins: loading.tsx, placeholder en CompanyProvider, usePathname() en Sidebar | ~1h | Elimina flash blanco |
| **2** | mover CompanyProvider al root layout derivando companyId de usePathname() | ~4-6h | Preserva navStack, sidebar collapsed, sin remontado |

## Capabilities

**None** — refactor estructural puro. No cambia comportamiento observable de ninguna spec existente. No se modifican contratos de datos, validaciones, ni flujos de usuario.

## Approach

### Fase 1 — Quick Wins
1. Crear `app/[company]/loading.tsx` con skeleton (sidebar placeholder + content skeleton)
2. CompanyProvider: cambiar `if (!ready) return null` por un placeholder que mantenga el árbol vivo
3. Sidebar: reemplazar `window.location.pathname` por `usePathname()` de `next/navigation`

### Fase 2 — Refactor Estructural
1. Crear `app/CompanyProviderWrapper.tsx` (client component) para insertar en root layout
2. CompanyProvider deriva `companyId` de `usePathname()` en vez de props
3. Membership guard migra como efecto dentro del provider
4. `app/[company]/layout.tsx` se simplifica a `{children}` sin providers ni guards
5. Sidebar usa `usePathname()` consistentemente (ya hecho en Fase 1)

Árbol resultante:
```
app/layout.tsx
  └── AuthProvider
       └── CompanyProviderWrapper (client)
            └── CompanyProvider (companyId de usePathname)
                 └── [company]/layout.tsx (delgado)
                      └── page.tsx ← NO se remonta al cambiar empresa
```

## Affected Areas

| Archivo | Fase | Cambio |
|---------|------|--------|
| `app/[company]/loading.tsx` | 1 | **Nuevo** — skeleton loading |
| `context/CompanyContext.tsx` | 1, 2 | F1: placeholder en vez de null. F2: derivar companyId de pathname |
| `components/Sidebar.tsx` | 1 | `usePathname()` en vez de `window.location` |
| `app/CompanyProviderWrapper.tsx` | 2 | **Nuevo** — client wrapper |
| `app/[company]/layout.tsx` | 2 | Simplificar: quitar CompanyProvider + membership guard |
| `app/layout.tsx` | 2 | Agregar CompanyProviderWrapper |
| `app/[company]/[[...segments]]/page.tsx` | 2 | Limpiar dependencias de efectos |
| Consumidores de `useCompany()` | 2 | Verificar modo sin companyId (login/select-company) |

## Risks

| Riesgo | Fase | Severidad | Mitigación |
|--------|------|-----------|------------|
| Regresión en membership guard (4 estados) | 2 | Alta | Tests específicos + QA manual en conjunto, denied, granted |
| `useCompany()` en pantallas sin companyId (login, select-company) | 2 | Alta | Provider wrapper con guards condicionales |
| Modo conjunto (`companyId === 'all'`) con efectos cíclicos | 2 | Media | Revisar dependencias de efectos en page.tsx |
| Re-renders excesivos por `usePathname()` en cada render | 2 | Baja | `useMemo`/`React.memo` si es necesario |

## Rollback Plan

Por fase: `git revert <commit>` de la fase completa. No hay migraciones de datos ni cambios en Firestore — rollback inmediato sin side effects.

## Dependencies

Ninguna externa. Solo refactor de componentes React + Next.js App Router.

## Success Criteria

- ✅ Cambiar de empresa NO muestra spinner ni flash blanco
- ✅ NavStack del sidepanel se preserva al cambiar de empresa y volver
- ✅ Sidebar collapsed state se preserva
- ✅ `selectedCompany` siempre sincronizado con `companyId` de la URL
- ✅ Sin regresiones en membership guard
- ✅ Tests existentes siguen pasando
