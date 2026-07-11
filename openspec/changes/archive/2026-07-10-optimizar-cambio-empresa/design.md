# Design: Optimizar rendimiento al cambiar de empresa

> **Change**: `optimizar-cambio-empresa`
> **Date**: 2026-07-10
> **Status**: Draft

---

## 1. Architecture Decisions

| # | Opción | Tradeoff | Decisión |
|---|--------|----------|----------|
| D1 | **Fase 2**: Mover `CompanyProvider` al root layout vs. mantenerlo en `[company]/layout.tsx` | Sacarlo elimina el remontado completo al cambiar empresa pero expone el contexto a rutas sin companyId (login, select-company). | **Moverlo.** La ganancia UX (navStack preservado, sin spinner) justifica los guards condicionales. Usar `pathname === '/'` o `!pathname.includes('/all')` para desactivar el contexto en rutas no-empresa. |
| D2 | **Derivar `companyId`** de `usePathname()` vs. `useParams()` | `usePathname()` es más predecible y disponible también fuera de layouts anidados. `useParams()` está atado al segmento `[company]` y no existe fuera de él. | **`usePathname()`.** Extraer companyId como `pathname.split('/')[1]`. Es una línea, sin dependencias del layout tree. |
| D3 | **Membership guard** integrado en `CompanyProvider` vs. hook separado | Hook separado = composición más limpia pero un archivo más. Integrado = cohesivo pero más complejo de testear. | **Integrado como efecto dentro de `CompanyProvider`.** Minimiza archivos y evita un nuevo wrapper que podría reintroducir el remontado. |
| D4 | **Placeholder** en CompanyProvider: `opacity-0` div vs. spinner inline | Spinner es más informativo pero agrega movimiento visual. Div invisible es más suave pero el usuario no sabe que está cargando. | **Spinner inline pequeño** (no pantalla completa). Informa carga sin flash blanco. Fase 1 — luego queda reemplazado por la Fase 2. |
| D5 | **`usePathname()` en Sidebar** vs. seguir usando `window.location` | `usePathname()` es el API correcto de Next.js App Router, detecta cambios de ruta, no depende del DOM. `window.location` no se re-renderiza con el router. | **`usePathname()`.** Es un fix trivial que elimina un anti-patrón. |

---

## 2. Data Flow

### Árbol ANTES (hoy)

```
app/layout.tsx (server)
  └── AuthProvider (client)
       └── [company]/layout.tsx (client)  ← SE REMONTA AL CAMBIAR [company]
            ├── Membership guard (spinner + getDoc/redirect)
            └── CompanyProvider (recibe companyId como prop)
                 └── page.tsx  ← SE REMONTA TAMBIÉN
                      ├── Sidebar (useCompany)
                      ├── Dashboard / Datos / etc
                      └── Sidepanel (navStack local) ← SE PIERDE
```

### Árbol DESPUÉS (Fase 2)

```
app/layout.tsx (server)
  └── AuthProvider (client)
       └── CompanyProviderWrapper.tsx (client)  ← NUEVO
            └── CompanyProvider (deriva companyId de usePathname())
                 ├── Membership guard (efecto interno)
                 ├── [company]/layout.tsx (thin)  ← NO SE REMONTA
                 │    └── page.tsx  ← NO SE REMONTA
                 │         ├── Sidebar (usePathname + useCompany)
                 │         ├── Dashboard / Datos / etc
                 │         └── Sidepanel (navStack preservada)
                 │
                 └── (rutas sin companyId: login, select-company)
                      └── CompanyProvider detecta no-route → pasa children sin contexto
```

**Flujo de cambio de empresa (DESPUÉS)**:
1. Usuario hace clic en otra empresa en Sidebar
2. `handleCompanySelect(id)` → `router.push(currentPath)` **(sin `setCompany()` redundante)**
3. Next.js cambia el segmento `[company]` → **solo re-renderiza** `page.tsx`, no lo destruye
4. `CompanyProvider` ve el nuevo `companyId` via `usePathname()` → actualiza `selectedCompany`
5. `page.tsx` recibe el nuevo `companyId` en `use(params)` → resuscribe subscriptions
6. **NavStack y sidebarCollapsed NO se pierden** porque el estado React está arriba en el árbol

---

## 3. File Changes

### Fase 1 — Quick Wins (~1h)

| Acción | Archivo | Detalle |
|--------|---------|---------|
| **CREATE** | `app/[company]/loading.tsx` | Skeleton con sidebar placeholder (bloque gris de 64px) + content skeleton (3 rectángulos apilados). Sin lógica, solo JSX. |
| **MODIFY** | `context/CompanyContext.tsx` | L103: cambiar `if (!ready) return null;` por `<div className="flex h-screen items-center justify-center"><Spinner /></div>`. Mantener árbol vivo. |
| **MODIFY** | `components/Sidebar.tsx` | L25: reemplazar `window.location.pathname` por `usePathname()` de `next/navigation`. Importar en L3. |

### Fase 2 — Refactor Estructural (~4-6h)

| Acción | Archivo | Detalle |
|--------|---------|---------|
| **CREATE** | `app/CompanyProviderWrapper.tsx` | Client component. Renderiza `<CompanyProvider>` con `userId` del `useAuth()`. No recibe props de layout. |
| **MODIFY** | `context/CompanyContext.tsx` | Eliminar props `companyId`, `userRole`. Deriva de `usePathname()`. Integrar membership guard (efecto que verifica `getUserCompaniesSnapshot` + blocked check). Exportar `useCompany()` sin cambios de firma. |
| **MODIFY** | `app/layout.tsx` | Agregar `<CompanyProviderWrapper>` dentro de `<AuthProvider>` envolviendo `children`. |
| **MODIFY** | `app/[company]/layout.tsx` | Reducir a solo `{children}`. Eliminar imports de CompanyProvider, membership guard, getDoc, getUserCompaniesSnapshot. Mantener solo `'use client'` si es necesario o convertir a server component. |
| **MODIFY** | `app/[company]/[[...segments]]/page.tsx` | Verificar que `use(params)` sigue funcionando. Los efectos que dependen de `companyId` se re-ejecutarán normalmente. Sin cambios estructurales, solo verificar. |
| **UPDATE** | `context/__tests__/CompanyContext.test.tsx` | Adaptar tests: provider ya no recibe `companyId` como prop, simular `usePathname()`. Agregar tests para membership guard. |

---

## 4. Testing Strategy

| Capa | Fase | Qué testear | Cómo |
|------|------|-------------|------|
| Unit | F1 | Loading skeleton renderiza sin error | Render `app/[company]/loading.tsx` — test visual/snapshot |
| Unit | F2 | `CompanyProvider` deriva companyId de mock pathname | Mockear `usePathname()` para devolver `/empresa-a/dashboard` → verificar `selectedCompany` |
| Unit | F2 | Membership guard: granted, denied, blocked | Mockear `getUserCompaniesSnapshot` y `getDoc` para cada caso |
| Unit | F2 | Consumidores sin companyId (login) | Mockear `usePathname()` → `/login` → verificar que provider pasa children sin error |
| Unit | F2 | `sidebarCollapsed` se preserva | Render page con collapsed=true, simular cambio de empresa via router, verificar que collapsed sigue true |
| Integración | F2 | NavStack se preserva al cambiar empresa | Test e2e: push screens, cambiar empresa, volver, verificar screens intactas |
| Existing | F1+F2 | Tests existentes en `CompanyContext.test.tsx` | Actualizar mocks para nueva firma, asegurar que todos siguen pasando |

---

## 5. Open Questions

| # | Pregunta | Resolución esperada |
|---|----------|---------------------|
| Q1 | **Membership guard**: en la arquitectura actual, el layout chequea membresía ANTES de montar CompanyProvider. En la nueva, CompanyProvider se monta siempre. ¿Qué renderiza el provider mientras chequea membresía? | Renderizar un spinner inline (no pantalla completa). El layout `[company]` ya no hace el guard, el provider lo maneja internamente y puede mostrar un estado de carga suave. |
| Q2 | **Modo conjunto (`all`)**: `pathname.split('/')[1]` devuelve `'all'`. ¿El provider lo trata correctamente? | Sí, el modo conjunto ya existe en la lógica de CompanyProvider (L67-69). Solo verificar que `mode` se setea a `'conjunto'` cuando companyId === 'all'. |
| Q3 | **Sidebar y `selectedCompany`**: hoy `handleCompanySelect` llama `setCompany()` ANTES de `router.push()`. Con la nueva arquitectura, `selectedCompany` se deriva del pathname. ¿Necesita el Sidebar llamar `setCompany()` todavía? | **No.** El provider deriva `selectedCompany` del pathname automáticamente. `handleCompanySelect` solo necesita `router.push()`. El `setCompany()` local queda obsoleto — considerar eliminarlo del contexto. |
| Q4 | **Rutas sin empresa**: ¿qué pasa cuando el path es `/login` o `/select-company`? | `pathname.split('/')[1]` devuelve `'login'`. CompanyProvider debe detectar que no es un companyId válido y renderizar children sin contexto (o con contexto vacío/degradado). |
