# Exploration: Optimizar rendimiento al cambiar de empresa

> **Fecha**: 2026-07-10
> **Tipo**: Rendimiento (refactor crítico del layout tree)
> **Cambio**: `optimizar-cambio-empresa`

---

## 1. Resumen Ejecutivo

Cambiar de empresa en la Sidebar (`/empresaA` → `/empresaB`) produce un remontado COMPLETO del subárbol `[company]` porque `CompanyProvider` y el membership guard están DENTRO de `app/[company]/layout.tsx`. Cuando Next.js detecta que el segmento dinámico `[company]` cambia, destruye y recrea todo — layout, contexto, y página con todas sus suscripciones. Esto causa: un flash de spinner en pantalla completa, pérdida del estado local (sidepanel navigation stack, sidebar collapsed state), y una cascada de desuscripciones/resuscripciones a Firestore. La doble fuente de verdad entre `CompanyContext.selectedCompany` y el `companyId` de la URL existe pero es transitoria y se resuelve sola al montar el nuevo provider. El análisis descubre 5 problemas adicionales que agravan la experiencia.

---

## 2. Arquitectura Actual

### 2.1 Árbol de Layouts

```
app/layout.tsx (server component)
  └── AuthProvider
       └── app/[company]/layout.tsx (client component)
            ├── Membership guard (useEffect + spinner)
            └── CompanyProvider (companyId prop desde useParams())
                 └── app/[company]/[[...segments]]/page.tsx
                      ├── Sidebar (usa useCompany())
                      ├── Dashboard / Datos / etc
                      └── Sidepanel (navStack local)
```

### 2.2 Flujo de cambio de empresa (Sidebar.tsx L23-27)

```typescript
const handleCompanySelect = (id: string) => {
  setCompany(id);
  const currentPath = window.location.pathname.replace(/^\/[^/]+/, `/${id}`);
  router.push(currentPath);
};
```

### 2.3 Archivos clave

| Archivo | Rol | Líneas |
|---------|-----|--------|
| `app/[company]/layout.tsx` | Membership guard + CompanyProvider wrapper | 112 |
| `app/layout.tsx` | Root layout (server, solo AuthProvider) | 20 |
| `context/CompanyContext.tsx` | Provider con subscriptions + `handleSetCompany` | 156 |
| `app/[company]/[[...segments]]/page.tsx` | App shell con todas las subs a Firestore | 541 |
| `components/Sidebar.tsx` | Sidebar con company selector + handleCompanySelect | 175 |

---

## 3. Evaluación de Hipótesis

### H1: Remontado total del Layout ✅ CONFIRMADO — Problema principal

**Qué pasa cuando el usuario hace clic en otra empresa en la Sidebar:**

1. `handleCompanySelect` llama `setCompany(id)` → actualiza `CompanyContext.selectedCompany` (en el provider VIEJO)
2. `router.push(currentPath)` → inicia navegación al nuevo `[company]`
3. **Next.js detecta cambio en segmento `[company]`** → desmonta TODO el subárbol:
   - `app/[company]/layout.tsx` se desmonta
   - `CompanyProvider` se desmonta → cleanup de `subscribeUserCompanies`
   - `page.tsx` se desmonta → cleanup de TODAS las subs (budgets, ejecuciones, projects)
4. **Next.js monta el nuevo subárbol**:
   - `app/[company]/layout.tsx` se monta con NUEVO `companyId`
   - `membershipState` se inicializa en `'loading'` → **spinner en pantalla completa**
   - Ejecuta `getUserCompaniesSnapshot` (one-time) + `getDoc(members/)`
   - Una vez verificado, monta `CompanyProvider` con nuevo `companyId`
   - `CompanyProvider` se monta → `ready=false` → **renderiza `null` (nada)**
   - `subscribeUserCompanies` arranca → cuando `ready=true`, recién ahí renderiza `children`
   - `page.tsx` se monta → `use(params)` resuelve nuevo companyId
   - TODOS los efectos se ejecutan: `subscribeBudgets`, `subscribeEjecuciones`, `subscribeProjects`

**Consecuencias**:
- **~500-2000ms de spinner en pantalla completa** en cada cambio de empresa
- **NavStack se pierde** — el sidepanel con formularios abiertos desaparece
- **Sidebar collapsed state se pierde** — resetea a expandido
- **Cascada de reads a Firestore**: 4+ reads secuenciales antes de mostrar datos
- **Desuscripción/resuscripción de todos los listeners** — innecesario si el usuario vuelve a la empresa anterior

### H2: Doble fuente de verdad ✅ CONFIRMADO (pero transitorio, no crítico)

**Cómo se manifiesta**:

| Fuente | Dónde se usa | Cómo se obtiene |
|--------|-------------|-----------------|
| `CompanyContext.selectedCompany` | Sidebar (resaltado visual), componentes entity | `handleSetCompany` local state |
| `companyId` de `use(params)` | page.tsx (subscriptions a Firestore) | Parámetro de URL |

**El momento de desincronización**:
- `handleCompanySelect` llama `setCompany(id)` ANTES de `router.push()`
- Durante ~100-300ms (latencia de navegación), **Sidebar muestra la nueva empresa resaltada** pero la página AÚN no se ha navegado (o está en el mounting phase)
- Cuando el nuevo `[company]/layout.tsx` monta, CompanyProvider se reconstruye desde cero con `companyId` prop → deriva `selectedCompany` del `companyId` → sincronizado de nuevo

**Riesgo real**: Muy bajo. No hay posibilidad de escribir datos en la empresa equivocada porque las operaciones de escritura usan `companyId` de `use(params)`, no del contexto. El peor caso es el Sidebar mostrando visual inconsistente durante la transición.

**Problema adicional en `setCompany`**: El `handleSetCompany` en CompanyContext.tsx (L86-92) solo actualiza estado local — NO navega. La navegación ocurre en `handleCompanySelect` del Sidebar. Si algún otro componente llama `setCompany()` sin navegar, el contexto queda desincronizado PERMANENTEMENTE hasta la próxima navegación.

### H3: Missing loading.tsx ✅ CONFIRMADO

- **No existe `app/[company]/loading.tsx`**
- El membership guard usa un spinner de pantalla completa (L86-92 de layout.tsx): `<div className="animate-spin h-10 w-10 border-4..." />`
- **CompanyProvider.tsx L103**: `if (!ready) return null;` — renderiza VACÍO durante la carga de `subscribeUserCompanies`
- **No hay Suspense boundaries** en page.tsx ni en los componentes de datos
- **Resultado**: Transición abrupta: contenido → spinner blanco → null → spinner → contenido

---

## 4. Problemas Adicionales Descubiertos

### P1: CompanyProvider retorna `null` mientras carga

**Archivo**: `context/CompanyContext.tsx` L103
```typescript
if (!ready) return null;
```
Cualquier componente que intente consumir `useCompany()` mientras `ready === false` se encuentra con que el Provider no renderiza sus hijos. Esto significa que el árbol de componentes se colapsa completamente durante la transición. No hay un "estado de carga" del contexto — o está listo o no existe.

### P2: Doble fetch de empresas por cambio de empresa

Cuando navegás a una nueva empresa:
1. **`[company]/layout.tsx`** (L38-69): ejecuta `getUserCompaniesSnapshot(user.uid)` — una lectura one-time
2. **`CompanyProvider`** (L56): ejecuta `subscribeUserCompanies(userId, ...)` — suscripción real-time

Ambos traen los mismos datos de `/companies/{id}/members/{userId}`. La snapshot en el layout solo se usa para el guard de membresía, pero la suscripción en CompanyProvider repite el mismo query.

### P3: Efectos con dependencias excesivas en page.tsx

```typescript
useEffect(() => { ... }, [companyId, isConjunto, companies]); // L138
useEffect(() => { ... }, [companyId, isConjunto]);             // L145
```
En modo conjunto (`companyId === 'all'`), la dependencia `companies` en L138 causa re-ejecución cada vez que `subscribeCompanies` emite nuevos datos, incluso si el usuario no cambió de empresa.

### P4: `window.location.pathname` en la Sidebar (anti-patrón Next.js)

```typescript
// Sidebar.tsx L25
const currentPath = window.location.pathname.replace(/^\/[^/]+/, `/${id}`);
```
Usar `window.location` en un client component de Next.js es frágil:
- No detecta cambios de ruta del router
- El regex `^\/[^/]+` asume que el path SIEMPRE empieza con `/{companyId}` — si hay un segmento antes, falla
- Debería usar `usePathname()` de `next/navigation`

### P5: No existe `usePathname()` en todo el proyecto

La app no importa `usePathname()` en ningún archivo. El acceso al path actual se hace mediante `window.location.pathname` en Sidebar (P4) o no se necesita en otros componentes. Esto indica que el proyecto no tiene una necesidad previa de leer la ruta actual desde el tree de React, lo que es otro síntoma de que la navegación entre empresas no fue diseñada como un cambio de contexto dentro del árbol, sino como una navegación completa.

---

## 5. Enfoques de Solución

### Enfoque 1: Mínimo — loading.tsx + Suspense boundaries + evitar `null` en CompanyProvider

**Descripción**: Agregar `app/[company]/loading.tsx` con un skeleton que mantenga la estructura visual (sidebar esqueleto + área de contenido placeholder), envolver secciones de page.tsx en `<Suspense>`, y que CompanyProvider renderice un placeholder en lugar de `null` mientras carga.

**Archivos afectados**:
- `app/[company]/loading.tsx` (nuevo) — skeleton con sidebar placeholder + content skeleton
- `context/CompanyContext.tsx` — cambiar `if (!ready) return null` por un placeholder visible
- `app/[company]/[[...segments]]/page.tsx` — posiblemente agregar Suspense boundaries

**Pros**:
- ⚡ **Bajo esfuerzo**: ~50-80 líneas de código nuevas
- ✅ **UX mejora inmediatamente**: skeleton en lugar de flash blanco
- ✅ **Sin riesgo de regresión**: no cambia la arquitectura

**Cons**:
- ❌ **No resuelve el remontado**: el layout y CompanyProvider siguen destruyéndose
- ❌ **NavStack y sidebarCollapsed se pierden igual**
- ❌ **Sigue siendo una navegación lenta** (~500-2000ms)
- ❌ **No resuelve la cascada de subs**

**Effort**: Low

---

### Enfoque 2: Estructural — Mover CompanyProvider al root layout (estabilizar el árbol)

**Descripción**: Mover `CompanyProvider` del `[company]/layout.tsx` al root layout `app/layout.tsx` (vía un client wrapper). CompanyProvider pasa a recibir `companyId` desde `usePathname()` en lugar de props. El membership guard también migra al CompanyProvider. El `[company]/layout.tsx` se convierte en un layout delgado que solo renderiza children (o se elimina si no es necesario).

**Cambios clave**:
- Crear `app/CompanyProviderWrapper.tsx` (client component) que envuelve children
- CompanyProvider deriva `companyId` de `usePathname()` → `pathname.split('/')[1]`
- Membership guard se integra dentro de CompanyProvider o en un hook separado
- `[company]/layout.tsx` se simplifica: solo `{children}` sin providers ni guards
- Sidebar usa `usePathname()` en lugar de `window.location.pathname`

**Árbol resultante**:
```
app/layout.tsx (server)
  └── AuthProvider
       └── CompanyProviderWrapper (client) ← NUEVO
            └── CompanyProvider (deriva companyId de usePathname)
                 └── [company]/layout.tsx (delgado, sin lógica)
                      └── page.tsx (no se remonta al cambiar empresa!)
```

**Pros**:
- ✅ **ELIMINA el remontado completo**: cambiar `[company]` solo re-renderiza page.tsx, no lo destruye
- ✅ **NavStack y sidebarCollapsed persisten** entre cambios de empresa
- ✅ **CompanyProvider no se desmonta** → la subscripción a `subscribeUserCompanies` es continua
- ✅ **Cascada de subs reducida**: budgets/ejecuciones se resuscriben pero el provider no
- ✅ **Sin flash de membership spinner**: el guard puede hacerse async sin mostrar pantalla completa
- ✅ **Sincroniza la fuente de verdad**: `selectedCompany` deriva del pathname, no de props

**Cons**:
- ❌ **Cambio arquitectónico grande**: toca 4-5 archivos core
- ❌ **Riesgo de regresión**: el membership guard actual tiene edge cases (blocked users, conjunto mode)
- ❌ **CompanyProvider necesita manejar el caso `pathname === '/'`** (no hay empresa en la ruta)
- ❌ **Posible re-render excesivo**: si el provider se actualiza en cada cambio de pathname
- ❌ **Requiere revisar todos los consumidores de `useCompany()`** para asegurar que funcionan sin companyId en pantallas de login/select-company

**Effort**: High

---

### Enfoque 3: Híbrido — Optimistic UI + transiciones + layout key strategy

**Descripción**: Mantener CompanyProvider en `[company]/layout.tsx` pero:
1. Agregar `app/[company]/loading.tsx` con skeleton sidebar + content
2. Reemplazar el membership spinner full-screen por un skeleton que mantenga la UI
3. Implementar "pre-warming": interceptar `handleCompanySelect` para prefetchear datos de la empresa destino ANTES de navegar
4. CompanyProvider.render placeholder en lugar de `null`
5. Agregar `React.startTransition` en `handleCompanySelect` para evitar transiciones abruptas
6. Sidebar: reemplazar `window.location.pathname` por `usePathname()`
7. Membership guard paralelo: ejecutar `getUserCompaniesSnapshot` y `subscribeUserCompanies` en paralelo (no secuencial)

**Archivos afectados**:
- `app/[company]/loading.tsx` (nuevo)
- `components/Sidebar.tsx` — pre-warm + usePathname + startTransition
- `context/CompanyContext.tsx` — placeholder en lugar de `null`
- `app/[company]/layout.tsx` — membership guard paralelo, skeleton en lugar de spinner
- `app/[company]/[[...segments]]/page.tsx` — posible refactor de dependencias

**Pros**:
- ✅ **Esfuerzo medio**: ~150-200 líneas de cambio total
- ✅ **Mejora UX significativa**: sin flash blanco, sin null render
- ✅ **Riesgo moderado**: no cambia la arquitectura fundamental
- ✅ **NavStack y sidebarCollapsed se pueden preservar** con un layout cache (localStorage + rehidratación)
- ✅ **Menos re-suscriptions**: el pre-warming cachea datos para reducir latencia percibida

**Cons**:
- ❌ **No resuelve el remontado completo**: el layout y page.tsx siguen remontándose
- ❌ **El membership spinner todavía existe** (aunque ahora es un skeleton)
- ❌ **NavStack necesita persistencia externa** (localStorage o estado global) para sobrevivir al remontado
- ❌ **La cascada de subs a Firestore sigue ocurriendo** (solo se oculta visualmente)

**Effort**: Medium

---

## 6. Comparación de Enfoques

| Aspecto | Enfoque 1 (loading.tsx) | Enfoque 2 (estructural) | Enfoque 3 (híbrido) |
|---------|------------------------|------------------------|-------------------|
| Elimina remontado | ❌ | ✅ | ❌ |
| Preserva navStack | ❌ | ✅ | ± (con persistencia) |
| Elimina flash blanco | ✅ | ✅ | ✅ |
| Sin cascada de subs | ❌ | ± (menos) | ❌ |
| Riesgo de regresión | Bajo | Alto | Medio |
| Esfuerzo | Bajo (~1h) | Alto (~4-6h) | Medio (~2-3h) |
| Mantenibilidad futura | Baja (parche) | Alta (arquitectura correcta) | Media |

---

## 7. Recomendación

**Enfoque 2 (Estructural)** como objetivo principal, pero implementado en 2 fases:

### Fase 1 — Quick wins (Enfoque 1 + parches urgentes)
- Agregar `app/[company]/loading.tsx` con skeleton
- Reemplazar `CompanyProvider`'s `return null` por un placeholder
- Reemplazar `window.location.pathname` por `usePathname()` en Sidebar
- ~~Preserva navStack: persistir en sessionStorage~~ (esperar a Fase 2)

### Fase 2 — Refactor estructural (Enfoque 2)
- Mover CompanyProvider arriba de `[company]` (root layout vía client wrapper)
- CompanyProvider deriva `companyId` de `usePathname()`
- Membership guard integrado como efecto dentro del provider
- Simplificar `[company]/layout.tsx`
- NavStack vive en CompanyContext o en un contexto aparte

**Razones**:
1. El Enfoque 1 solo es un parche cosmético — no soluciona la causa raíz
2. El Enfoque 2 elimina el problema de raíz y habilita mejoras futuras (transiciones suaves, multi-tab, navegación sin pérdida de estado)
3. Dividir en fases reduce el riesgo: Fase 1 se puede deployar en horas, Fase 2 requiere más planificación y testing
4. El dolor actual (cambiar de empresa es lento y pierde estado) justifica el esfuerzo del refactor

---

## 8. Riesgos

- **R1 (Fase 2)**: Mover CompanyProvider arriba de `[company]` significa que los componentes de login/register/select-company también tendrán acceso al contexto. Asegurarse de que `useCompany()` en esas pantallas no falle ni muestre datos incorrectos. Implementar un provider wrapper con guards condicionales.
- **R2 (Fase 2)**: `usePathname()` se ejecuta en cada render. Si CompanyProvider se vuelve caro (muchas computaciones por render), podría causar performance issues. Evaluar uso de `useMemo` o `React.memo`.
- **R3 (Ambas fases)**: El membership guard actual tiene 4 estados (authLoading, !user, loading, denied, granted). Cualquier cambio en ese flujo puede romper el acceso a empresas legítimas.
- **R4 (Fase 2)**: Si hay middleware en el futuro, el guard de membresía podría duplicarse entre middleware y layout. Decidir quién es responsable de qué.
- **R5 (Ambas fases)**: El modo conjunto (`companyId === 'all'`) tiene dependencias cíclicas en page.tsx (`companies` en el array de dependencias del efecto). Podría causar loops de suscripción si no se maneja con cuidado.

---

## 9. Archivos Relevantes

| Archivo | Rol en este cambio |
|---------|-------------------|
| `app/[company]/layout.tsx` | Membership guard + CompanyProvider wrapper — simplificar/eliminar en Fase 2 |
| `app/layout.tsx` | Root layout — agregar CompanyProviderWrapper en Fase 2 |
| `context/CompanyContext.tsx` | Provider — derivar companyId de pathname, no de props. No retornar null. |
| `app/[company]/[[...segments]]/page.tsx` | App shell — optimizar dependencias de efectos, envolver en Suspense |
| `components/Sidebar.tsx` | Reemplazar `window.location.pathname` por `usePathname()` |
| `components/entities/colaborador/ColaboradorEntity.tsx` | Consumidor de `useCompany()` — verificar compatibilidad |
| `components/entities/invitacion/InvitacionEntity.tsx` | Consumidor de `useCompany()` — verificar compatibilidad |
| `context/__tests__/CompanyContext.test.tsx` | Actualizar tests para nuevo funcionamiento |

### Archivos nuevos
- `app/CompanyProviderWrapper.tsx` — Client wrapper para root layout (Fase 2)
- `app/[company]/loading.tsx` — Skeleton loading (Fase 1)

---

## 10. Ready for Proposal

**Sí**. El análisis confirma las 3 hipótesis y descubre 5 problemas adicionales. Hay 3 enfoques claros con tradeoffs documentados. Recomiendo Fase 1 + Fase 2 con el Enfoque 2 como destino final y el Enfoque 1 como quick win inmediato. El `sdd-propose` puede refinar el alcance exacto de cada fase.
