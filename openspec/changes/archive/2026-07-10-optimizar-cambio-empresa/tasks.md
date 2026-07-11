# Tasks: optimizar-cambio-empresa

> **Delivery**: force-chained
> **Chain strategy**: stacked-to-main
> **Review budget**: 400 lines

---

## Fase 1 — Quick Wins (~60-100 líneas)

- [x] **1.1** Crear `app/[company]/loading.tsx` con skeleton: sidebar placeholder (64px gris) + content skeleton (3 rectángulos apilados). Sin lógica, solo JSX.
- [x] **1.2** En `context/CompanyContext.tsx` L103: reemplazar `if (!ready) return null;` por spinner inline que mantenga el árbol React vivo (usando el mismo patrón de spinner del layout existente).
- [x] **1.3** En `components/Sidebar.tsx`: reemplazar `window.location.pathname` por `usePathname()` de `next/navigation`. Eliminar `setCompany(id);` antes de `router.push(currentPath)` — el provider deriva selectedCompany del pathname.
- [x] **1.4** Tests: verificar que tests existentes siguen pasando y que CompanyProvider no retorna `null` durante carga.

## Fase 2 — Refactor Estructural (~150-250 líneas)

- [x] **2.1** Crear `app/CompanyProviderWrapper.tsx` — client component. Importa `useAuth()`, renderiza `<CompanyProvider userId={user?.uid ?? null}>`. No recibe props del server.
- [x] **2.2** Modificar `app/layout.tsx`: agregar `<CompanyProviderWrapper>` envolviendo `children` dentro de `<AuthProvider>`.
- [x] **2.3** Modificar `context/CompanyContext.tsx`: eliminar props `companyId` y `userRole`. Derivar `companyId` de `usePathname()` como `pathname.split('/')[1]`. Detectar rutas sin companyId (`/login`, `/select-company`) y renderizar children sin contexto.
- [x] **2.4** Extraer lógica de membership guard de `[company]/layout.tsx` (L20-71) e integrarla como efecto condicional dentro de `CompanyProvider`. Manejar estados: `granted`, `denied` (blocked), `denied` (no member), redirect con setTimeout.
- [x] **2.5** Simplificar `app/[company]/layout.tsx`: eliminar imports de `CompanyProvider`, `getUserCompaniesSnapshot`, `getDoc`, `useParams`. Reducir a `{children}`. Convertir a server component.
- [x] **2.6** Verificar `components/Sidebar.tsx`: `handleCompanySelect` usa `router.push()` sin `setCompany()`. `usePathname()` funciona con el nuevo árbol. Sin cambios necesarios.
- [x] **2.7** Tests: `CompanyProvider` no rompe en rutas sin companyId (`/login`, `/select-company`, `/register`, `/onboarding`, `/pending-approval`, `/`). 3 tests agregados: render children, no subscribe, valores default.
- [x] **2.8** Tests: membership guard migrado — 5 tests: granted, denied-no-member, denied-blocked, conjunto-all, loading spinner.

---

## Forecast

| Métrica | F1 | F2 | Total |
|---------|----|----|-------|
| Estimated changed lines | ~60-100 | ~150-250 | ~210-350 |
| 400-line budget risk | **Low** | **Low** | **Medium** (ambas fases juntas) |
| Decision needed before apply | **No** | **No** | **No** |
| Chained PRs recommended | **Yes** | **Yes** | **Yes** |
| Chain strategy | stacked-to-main | stacked-to-main | stacked-to-main |

**Work units**: PR 1 = Fase 1 (quick wins, low risk); PR 2 = Fase 2 (refactor estructural, requiere revisión de membership guard).
