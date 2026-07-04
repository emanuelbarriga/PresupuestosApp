# Exploration: Autenticación, Roles y Multi-Tenant para PresupuestosApp

> **Fecha**: 2026-07-04
> **Tipo**: Arquitectura (feature + seguridad + migración)
> **Cambio**: `autenticacion-usuarios`

---

## 1. Resumen Ejecutivo

La app no tiene capa de autenticación — `firestore.rules` usa `allow read, write: if true;` en TODAS las subcolecciones, cualquier persona con acceso a Firebase puede leer/escribir. El plan del usuario es sólido en su dirección general pero subestima la complejidad real de la migración: hay colecciones globales compartidas (`/terceros`, `/stateProject`, `/settings`) que no están bajo `/companies/{companyId}`, el enrutamiento actual usa un redirect hardcodeado (`/` → `/saman/dashboard`), `CompanyProvider` está instanciado dentro de `[[...segments]]/page.tsx` y no en un layout, el Sidebar muestra TODAS las empresas sin filtro de membresía, y no existe ningún `middleware.ts`. La implementación requerirá cambios estructurales en al menos 8 archivos core más la creación de ~6 archivos nuevos, con un riesgo alto de regresión si no se planifica en fases.

---

## 2. Arquitectura Actual

### 2.1 Capa de autenticación: INEXISTENTE

| Archivo | Estado |
|---------|--------|
| `lib/firebase.ts` | Solo exporta `db` y `storage`. No hay `getAuth`, `onAuthStateChanged`, ni import de `firebase/auth`. |
| `firestore.rules` | `allow read, write: if true;` en TODAS las rutas. Sin verificación de identidad. |
| `middleware.ts` | **No existe.** No hay protección de rutas a nivel de servidor ni cliente. |
| `app/layout.tsx` | Root layout mínimo (15 líneas). Sin providers, sin auth wrapper. |
| `package.json` | `firebase: ^12.15.0` incluye `@firebase/auth` como dependencia transitiva. `firebase-admin: ^14.1.0` está disponible para server-side. |

### 2.2 Estructura de datos en Firestore

```
/companies/{companyId}                    ← Doc global (solo name)
  ├── /budgets/{budgetId}                 ← Subcolección
  ├── /ejecuciones/{ejecucionId}          ← Subcolección
  ├── /projects/{projectId}               ← Subcolección
  ├── /cuentasBancarias/{cuentaId}        ← Subcolección
  └── /extractos/{extractoId}             ← Subcolección
/terceros/{terceroId}                     ← Colección GLOBAL (compartida entre empresas)
/stateProject/{stateId}                   ← Colección GLOBAL
/settings/categorias                      ← Doc GLOBAL único
```

**Problema clave**: `/terceros`, `/stateProject` y `/settings/categorias` son globales. Bajo un modelo multi-tenant real con auth, estas colecciones también deberían estar bajo `/companies/{companyId}` o tener reglas de acceso granular. El plan del usuario no las menciona.

### 2.3 Enrutamiento actual

```
/                                         → app/page.tsx: redirect hardcodeado a /saman/dashboard
/[company]/[[...segments]]/page.tsx       → App shell (540 líneas). Aquí se instancia CompanyProvider.
  /saman/dashboard                        → Dashboard
  /saman/estado-resultados                → EstadoResultados
  /saman/proyectos                        → Construction (placeholder)
  /saman/proveedores                      → Construction (placeholder)
  /saman/clientes                         → Construction (placeholder)
  /saman/extractos                        → Construction (placeholder)
  /saman/datos[/tab]                      → Datos (Presupuestos/Ejecuciones/Proyectos/Terceros/Settings/Bancos)
  /all/dashboard                          → Modo conjunto (todas las empresas)
```

- **No existe `[company]/layout.tsx`**. `CompanyProvider` se monta dentro de `[[...segments]]/page.tsx`, no en un layout. Esto es crítico para auth: un guard de autenticación en layout cubriría todas las sub-rutas; sin layout hay que ponerlo en cada page o en middleware.
- `ViewType` incluye `'Configuración'` pero **no está en los menuItems del Sidebar ni se renderiza en el switch de page.tsx**. Es una vista declarada pero no implementada.

### 2.4 CompanyContext (context/CompanyContext.tsx)

```typescript
interface CompanyContextValue {
  selectedCompany: Company | null;
  companies: Company[];           // ← TODAS las empresas, sin filtrar por usuario
  mode: CompanyMode;              // 'individual' | 'conjunto'
  setCompany: (id: string) => void;
  setMode: (mode: CompanyMode) => void;
  isConjunto: boolean;
}
```

- `subscribeCompanies()` retorna TODAS las empresas de `/companies` sin filtrar.
- `CompanyProvider` requiere `companyId` prop. Se monta por cada page render.
- No hay concepto de usuario, rol, ni membresía en el contexto.

### 2.5 Sidebar (components/Sidebar.tsx)

- Muestra TODAS las empresas como botones + opción "Todas las empresas" (modo conjunto).
- Navegación: Dashboard, EstadoResultados, Proyectos, Proveedores, Clientes, Extractos, Datos. **No incluye Configuración.**
- Cambio de empresa hace `router.push()` a la nueva ruta.
- Placeholder de avatar estático al final (círculo gris). No muestra usuario logueado.

### 2.6 Componentes principales

| Componente | Líneas | Rol |
|-----------|--------|-----|
| `Dashboard.tsx` | 828 | Matriz de presupuestos vs ejecutados. Sin auth checks. |
| `Datos.tsx` | 762 | Tablas CRUD. Sin auth checks. |
| `Sidepanel.tsx` | 2149 | Panel lateral con DataPanel, ViewPanel, FormPanel, CustomizePanel. Sin auth. |
| `EstadoResultados.tsx` | ~? | Vista financiera. Sin auth. |
| `Construction.tsx` | 25 | Placeholder para vistas no implementadas. |

---

## 3. Evaluación Punto por Punto del Plan del Usuario

### 3.1 Database & Security Rules

#### ✅ Lo que funciona bien
- La estructura `/companies/{companyId}/users/{userId}` es correcta y se alinea con el patrón de subcolecciones que ya usa el proyecto.
- La regla `exists(/databases/$(database)/documents/companies/$(companyId)/users/$(request.auth.uid))` es la forma idiomática de Firestore para membresía.
- La colección global `invitations/` tiene sentido porque las invitaciones existen antes de que el usuario tenga membresía a alguna empresa.

#### ⚠️ Lo que necesita ajustes
- **Colecciones globales no abordadas**: `/terceros`, `/stateProject`, `/settings/categorias` están fuera de `/companies/{companyId}`. El plan no explica cómo protegerlas. ¿Siguen siendo globales con acceso a cualquier miembro autenticado de cualquier empresa? ¿O se mueven bajo `/companies/{companyId}`?
- **Reglas para crear empresa**: ¿Quién puede crear un doc en `/companies/`? El primer admin durante onboarding. La regla `allow read: if true;` en `/companies/{doc}` debe cambiarse para permitir creación.
- **Reglas de escritura en el doc de empresa**: Si un admin quiere editar el nombre de la empresa, necesita write en `/companies/{companyId}`.
- **Reglas para `invitations/`**: Solo el invitedBy (admin) puede crear, solo el usuario con el email coincidente puede leer/aceptar.

#### 🔴 Riesgos identificados
- **Riesgo de data leak entre empresas**: Actualmente `/terceros` es global. Si dos empresas comparten el mismo tercero (ej: mismo proveedor), al moverlo bajo empresa se duplica. Si se mantiene global, cualquier miembro de cualquier empresa puede ver terceros de otras. **Decisión arquitectónica pendiente.**
- **Reglas de delete**: Ni el plan ni el código actual contemplan eliminación de documentos. ¿Un admin puede eliminar budgets? ¿Eliminar un usuario de la empresa?
- **Firestore rules tienen límite de 10 `exists()` por request**: Si se anidan muchas reglas, se puede exceder. Para este caso, una sola verificación de membresía debería ser suficiente.

### 3.2 Data Model

#### ✅ Lo que funciona bien
- `UsuarioEmpresa` con `email`, `role`, `joinedAt` es suficiente para el MVP.
- `Invitacion` con `companyId`, `companyName`, `role`, `status`, `invitedBy`, `createdAt` cubre el flujo básico.
- El uso de `WriteBatch` para la aceptación de invitación es correcto (atomicidad entre users doc + invitation status).

#### ⚠️ Lo que necesita ajustes
- **Falta `createdBy` en `Company`**: Para saber quién es el admin fundador y quién puede gestionar usuarios.
- **Flujo del primer usuario**: El plan dice "admin invites → collaborator registers" pero no explica cómo se registra el PRIMER admin. El onboarding debe permitir: registrarse → crear empresa → automáticamente ser admin de esa empresa. Esto requiere un `WriteBatch` que cree el doc de empresa Y el doc de usuario en una sola operación atómica.
- **Invitación sin Cloud Function**: `aceptarInvitacion` con `WriteBatch` requiere que el cliente tenga permisos de escritura en `/companies/{companyId}/users/{userId}` ANTES de ser miembro. Esto es una paradoja: el usuario necesita crear su doc de membresía pero las reglas dicen que solo miembros pueden escribir. **Solución**: o se usa una Cloud Function (recomendado) o se agrega una regla temporal que permita creación de `/companies/{companyId}/users/{userId}` si existe una invitación pendiente con el email del usuario.

#### 🔴 Riesgos identificados
- **Email mismatch**: Un usuario podría registrarse con un email diferente al de la invitación. La verificación debe hacerse comparando `request.auth.token.email` con el campo `email` de la invitación.
- **Invitación no encriptada**: El `email` en la invitación es texto plano. Si las reglas permiten listar invitaciones, cualquier usuario autenticado podría ver emails de otros. Las reglas deben restringir lectura a: `invitedBy == request.auth.uid` (admin que invitó) o `email == request.auth.token.email` (invitado).

### 3.3 Navigation & Routes

#### ✅ Lo que funciona bien
- La estructura de rutas propuesta (`/login`, `/register`, `/onboarding`, `/select-company`) es estándar y adecuada para Next.js App Router.
- Los flujos A (admin) y B (colaborador) son lógicos y cubren los dos casos principales.
- La idea de sidebar restringido por rol es correcta.

#### ⚠️ Lo que necesita ajustes
- **Falta `[company]/layout.tsx`**: Actualmente `CompanyProvider` está en `[[...segments]]/page.tsx`. Para auth, NECESITÁS un layout que envuelva todas las rutas de empresa y ejecute la verificación de membresía. Sin layout, cada page individual tendría que verificar auth — código duplicado y frágil.
- **`/select-company` debe filtrar**: Actualmente `subscribeCompanies()` retorna TODAS las empresas. Después de auth, debe retornar SOLO las empresas donde el usuario es miembro + invitaciones pendientes.
- **Configuración no está en el Sidebar**: El plan menciona "Sidebar → Configuración → Gestión de Usuarios" pero `'Configuración'` no está en `menuItems` del Sidebar (línea 37-45 de Sidebar.tsx). Debe agregarse.
- **El redirect hardcodeado**: `app/page.tsx` hace `router.replace('/saman/dashboard')`. Debe cambiarse para: si hay sesión → `/select-company`, si no → `/login`.
- **Estado de carga**: Entre que Firebase Auth inicializa y determina si hay sesión, la app muestra un flash de contenido. Necesitás un loading state global.

#### 🔴 Riesgos identificados
- **Middleware vs Layout guards**: En Next.js App Router, el middleware corre en el edge runtime y no tiene acceso a Firebase Admin SDK (solo a `firebase-admin/auth` vía `verifyIdToken`). Si usás middleware, necesitás verificar el token manualmente. Si usás un layout guard con `onAuthStateChanged`, es más simple pero solo protege rutas de cliente (no API routes). **Recomiendo layout guard + AuthProvider para el MVP.**
- **Rutas no existentes**: `/onboarding` no existe en la estructura actual. Debe crearse como `app/onboarding/page.tsx`.
- **Deep linking**: Si un usuario logueado intenta acceder a `/[company]/dashboard` de una empresa a la que NO pertenece, debe ser redirigido a `/select-company` con un mensaje de error, no mostrar datos.

### 3.4 Implementation Steps

#### ✅ Lo que funciona bien
- El orden general (habilitar auth → tipos → export → reglas → funciones → páginas → guards → contexto → sidebar → UI de admin) es lógico.
- Reconoce la necesidad de modificar `CompanyContext` y el Sidebar.

#### ⚠️ Lo que necesita ajustes
- **Paso 3 "Export auth from lib/firebase.ts" es insuficiente**: Necesitás un `AuthProvider` completo con `onAuthStateChanged` que envuelva la app. Solo exportar `getAuth()` no alcanza.
- **Paso 5 "Create functions: crearInvitacion, aceptarInvitacion" falta especificar dónde**: ¿Cloud Functions? ¿API Routes? ¿Cliente directo? Para `aceptarInvitacion` con WriteBatch atómico, necesitás server-side o una regla de seguridad especial.
- **Paso 7 "Add auth guards/middleware" es demasiado vago**: ¿Qué tipo de guard? ¿Dónde? ¿Qué comportamiento en cada caso?
- **Paso 8 "Update CompanyContext to store user role"**: CompanyContext actualmente solo maneja empresas. Agregar user/role lo convierte en un `AppContext`. Evaluar si crear un `AuthContext` separado es mejor (separation of concerns).
- **Falta paso crítico**: Actualizar `subscribeCompanies` para filtrar por membresía del usuario. Actualmente retorna TODAS las empresas.

#### 🔴 Riesgos identificados
- **Sin plan de testing**: Las reglas de Firestore deben probarse con el emulador (`@firebase/rules-unit-testing` ya está en devDependencies). Los guards de auth deben probarse.
- **Sin plan de migración**: Si ya hay datos en producción (empresas reales con budgets), ¿cómo se migran los datos existentes a tener dueño? ¿Se asume que hay un admin predefinido?
- **Sin plan de rollback**: Si la implementación de auth bloquea el acceso a usuarios legítimos, ¿cómo se revierte?
- **Subestimación de cambios en Sidepanel**: El Sidepanel (2149 líneas) hace operaciones directas contra Firestore. Si las reglas cambian, TODAS las operaciones de escritura van a fallar para usuarios no autorizados. Debe manejarse con mensajes de error apropiados.

---

## 4. Plan Reescribo (orden cronológico, adaptado al codebase real)

### Fase 0: Preparación y habilitación de Auth en Firebase Console
1. Habilitar Email/Password en Firebase Authentication (consola)
2. Verificar que `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` esté en `.env.local`
3. Agregar el dominio de la app en Authorized Domains (Firebase Console → Auth → Settings)

### Fase 1: Capa de autenticación (core infrastructure)
1. **Crear `lib/auth.ts`**: Inicializar `getAuth(app)`, exportar `auth`.
2. **Crear `context/AuthContext.tsx`** (nuevo archivo):
   - `AuthProvider` con `onAuthStateChanged`
   - Estados: `loading` | `authenticated` | `unauthenticated`
   - Exponer: `user`, `loading`, `signIn`, `signUp`, `signOut`
   - Envolver la app en `app/layout.tsx`
3. **Actualizar `app/layout.tsx`**: Envolver children con `AuthProvider`.

### Fase 2: Tipos y reglas de seguridad (contrato de datos)
4. **Agregar tipos en `lib/types.ts`**:
   ```typescript
   export type UserRole = 'admin' | 'colaborador';
   export interface UsuarioEmpresa { id: string; email: string; role: UserRole; joinedAt: string; }
   export interface Invitacion { id: string; companyId: string; companyName: string; email: string; role: UserRole; status: 'pendiente' | 'aceptada'; invitedBy: string; createdAt: string; }
   ```
5. **Reescribir `firestore.rules`**:
   - Función `isMember(companyId)` que verifique membresía
   - `/companies/{companyId}` — allow read, create con auth; allow update si isMember y admin
   - `/companies/{companyId}/users/{userId}` — allow read si isMember; allow create si (isMember && admin) o (es el propio userId + existe invitación pendiente); allow delete si admin
   - `/companies/{companyId}/budgets`, `ejecuciones`, etc — allow read/write si isMember
   - `/invitations/{invitationId}` — allow create si admin; allow read si es el invitedBy o el email coincide; allow update a 'aceptada' si es el invited email
   - `/terceros/`, `/stateProject/`, `/settings/categorias` — allow read si `request.auth != null` (o mover bajo empresa — decidir)
   - Catch-all: `allow read, write: if false;`

### Fase 3: Funciones de acceso a datos
6. **Agregar funciones en `lib/firestore.ts`**:
   - `subscribeUserCompanies(userId)` — query a `/companies` donde existe `/companies/{id}/users/{userId}`
   - `subscribeCompanyUsers(companyId)` — subcolección `/companies/{companyId}/users`
   - `createInvitation(invitation)` — `addDoc` en `/invitations`
   - `subscribeInvitations(email)` — `onSnapshot` con query `where('email', '==', email)` y `where('status', '==', 'pendiente')`
   - `acceptInvitation(invitationId, companyId, userId, email, role)` — **Server-side (API route o Cloud Function)** con WriteBatch

### Fase 4: Crear API route para aceptar invitación
7. **Crear `app/api/invitations/accept/route.ts`**:
   - Usa `firebase-admin` para inicializar app con service account
   - Verifica que el usuario autenticado (token ID) coincida con el email de la invitación
   - Ejecuta WriteBatch: crea doc en `/companies/{companyId}/users/{userId}` + actualiza `invitation.status = 'aceptada'`

### Fase 5: Páginas de autenticación
8. **Crear `app/login/page.tsx`**:
   - Formulario: email + password
   - Llama a `signInWithEmailAndPassword(auth, email, password)` de `lib/auth.ts`
   - On success → `router.push('/select-company')`
   - On error → mostrar mensaje
9. **Crear `app/register/page.tsx`**:
   - Formulario: email + password + confirmación
   - Llama a `createUserWithEmailAndPassword(auth, email, password)`
   - On success → verificar si hay invitaciones pendientes → si sí, ir a `/select-company`; si no, ir a `/onboarding`
10. **Crear `app/onboarding/page.tsx`** (solo accesible sin empresa):
    - Formulario: nombre de la empresa
    - Llama a API route que crea `/companies/{newId}` + `/companies/{newId}/users/{userId}` como admin
    - On success → `router.push('/{newId}/dashboard')`

### Fase 6: Select Company y Layout protegido
11. **Actualizar `app/page.tsx`**:
    - Si `user` (de AuthContext) → `router.replace('/select-company')`
    - Si no → `router.replace('/login')`
12. **Crear `app/select-company/page.tsx`**:
    - Muestra empresas del usuario (`subscribeUserCompanies(user.uid)`)
    - Muestra invitaciones pendientes (`subscribeInvitations(user.email)`)
    - Botón "Crear nueva empresa" → `/onboarding`
    - Botón "Aceptar" en invitaciones → llama a API route
13. **Crear `app/[company]/layout.tsx`** (protege todas las rutas de empresa):
    - Verifica `user` de AuthContext
    - Si no autenticado → redirect a `/login`
    - Verifica membresía en la empresa (usando `subscribeUserCompanies`)
    - Si no es miembro → redirect a `/select-company` con mensaje
    - Proporciona `CompanyProvider` con `companyId`
    - Pasa `userRole` al contexto

### Fase 7: Adaptar CompanyContext para roles
14. **Extender `context/CompanyContext.tsx`**:
    - Agregar `userRole: UserRole | null` al contexto
    - Recibir `userRole` como prop del Provider
    - Exponer en `useCompany()`

### Fase 8: Sidebar con roles y Configuración
15. **Actualizar `components/Sidebar.tsx`**:
    - Reemplazar `subscribeCompanies()` por `subscribeUserCompanies(userId)` — solo muestra empresas del usuario
    - Agregar `Configuración` a `menuItems` (solo visible si `userRole === 'admin'`)
    - Agregar avatar/botón de logout en la parte inferior (reemplazar el círculo gris estático)
    - Mostrar email del usuario en hover o tooltip
16. **Crear `components/Configuracion.tsx`**:
    - Sección "Gestión de Usuarios": formulario para invitar (email + role)
    - Lista de usuarios de la empresa (de `subscribeCompanyUsers`)
    - Botón para eliminar usuario (solo admin)
17. **Actualizar `app/[company]/[[...segments]]/page.tsx`**:
    - Renderizar `Configuración` cuando `activeView === 'Configuración'`
    - Agregar `viewFromSegments` el mapeo `'configuracion'` → `'Configuración'`

### Fase 9: Testing
18. **Testear firestore.rules** con `@firebase/rules-unit-testing`
19. **Testear AuthContext** con vitest + testing-library
20. **Testear flujos críticos**: login → select-company → dashboard → create budget (permisos), colaborador restringido

---

## 5. Decisiones de Arquitectura Pendientes

### DA-1: ¿Colecciones globales o por empresa?
`/terceros`, `/stateProject`, `/settings/categorias` son globales hoy. Opciones:
- **A) Mantenerlas globales**: acceso a cualquier usuario autenticado de cualquier empresa. Simple pero sin aislamiento real entre empresas.
- **B) Mover bajo `/companies/{companyId}`**: aislamiento total, pero requiere migrar datos existentes y duplicar terceros compartidos.
- **C) Híbrido**: `/terceros` global con reglas de lectura para cualquier autenticado, `/settings` por empresa.

**Recomendación**: **Opción C** para MVP. Los terceros suelen ser compartidos entre empresas del mismo grupo. Settings y stateProject pueden ser por empresa a futuro.

### DA-2: ¿Dónde ejecutar `aceptarInvitacion`?
- **A) API Route (Next.js)**: `app/api/invitations/accept/route.ts`. Simple, no requiere deploy de Cloud Functions. Usa `firebase-admin` para WriteBatch atómico.
- **B) Cloud Function**: Más escalable pero requiere configurar Firebase Cloud Functions, emulador, y deploy separado.
- **C) Cliente directo con reglas especiales**: Agregar regla temporal que permita a un usuario crear su propio doc de membresía si existe invitación pendiente. Menos seguro.

**Recomendación**: **Opción A** para MVP. Ya tenés `firebase-admin` instalado. Una API route es suficiente para la operación atómica.

### DA-3: ¿AuthContext separado o integrado en CompanyContext?
- **A) AuthContext separado**: `useAuth()` para usuario/sesión, `useCompany()` para empresa/rol. Separation of concerns.
- **B) Unificado en CompanyContext**: Un solo provider, menos wrappers. Pero CompanyContext se instancia por ruta de empresa (recibe `companyId`), mientras que Auth aplica globalmente.

**Recomendación**: **Opción A**. AuthContext envuelve toda la app en `app/layout.tsx`. CompanyContext se mantiene en `[company]/layout.tsx` y recibe `userRole` como prop.

### DA-4: ¿Middleware o Layout Guards?
- **A) `middleware.ts`**: Protege rutas a nivel de servidor (edge). Pero no tiene acceso a Firestore para verificar membresía — solo puede verificar el token de auth.
- **B) Layout Guards**: `[company]/layout.tsx` con `AuthContext`. Puede verificar membresía contra Firestore. Solo protege rutas cliente.

**Recomendación**: **Opción B para MVP**. Un `middleware.ts` básico para redirect de no autenticados + layout guard para membresía detallada.

---

## 6. Estimación de Complejidad

| Fase | Paso | Archivos afectados | Líneas estimadas | Complejidad | Riesgo |
|------|------|-------------------|-----------------|-------------|--------|
| 0 | Firebase Console setup | 0 | 0 | Baja | Bajo |
| 1 | Auth core infra | `lib/auth.ts` (nuevo), `context/AuthContext.tsx` (nuevo), `app/layout.tsx` (mod) | ~150 | Media | Bajo |
| 2 | Tipos + Rules | `lib/types.ts` (+20), `firestore.rules` (reescritura) | ~80 | Media | **Alto** — reglas mal escritas bloquean toda la app |
| 3 | Funciones firestore | `lib/firestore.ts` (+80) | ~80 | Media | Medio |
| 4 | API route invitación | `app/api/invitations/accept/route.ts` (nuevo) | ~60 | Media-Alta | **Alto** — operación atómica crítica |
| 5 | Páginas auth | `app/login/`, `app/register/`, `app/onboarding/` (3 nuevos) | ~300 | Media | Medio |
| 6 | Select + Layout | `app/page.tsx` (mod), `app/select-company/` (nuevo), `app/[company]/layout.tsx` (nuevo) | ~200 | Alta | **Alto** — cambia el flujo de entrada de la app |
| 7 | CompanyContext | `context/CompanyContext.tsx` (+30) | ~30 | Baja | Bajo |
| 8 | Sidebar + Config | `Sidebar.tsx` (+60), `Configuracion.tsx` (nuevo), `page.tsx` (+20) | ~300 | Media | Medio |
| 9 | Testing | Test files nuevos (~5) | ~400 | Media | Bajo |
| **Total** | | **~8 archivos modificados + ~8 nuevos** | **~1,600** | **Alta** | |

> **Nota para el orchestrator**: El total estimado (~1,600 líneas) excede el review budget de 400 líneas. Se requerirán múltiples PRs encadenados o un PR de excepción.

---

## 7. Lista de Archivos Relevantes

| Archivo | Rol en este cambio |
|---------|-------------------|
| `app/layout.tsx` | Debe envolverse con `AuthProvider` |
| `app/page.tsx` | Redirect condicional por auth state |
| `app/[company]/[[...segments]]/page.tsx` | App shell (540 líneas) — debe renderizar Configuración y usar `userRole` |
| `context/CompanyContext.tsx` | Extender con `userRole` |
| `components/Sidebar.tsx` | Filtrar empresas por usuario, agregar Configuración, logout |
| `components/Sidepanel.tsx` | 2149 líneas — sin cambios directos, pero afectado por reglas |
| `lib/firebase.ts` | Agregar `getAuth` |
| `lib/firestore.ts` | Nuevas funciones: userCompanies, invitations, companyUsers |
| `lib/types.ts` | Agregar UsuarioEmpresa, Invitacion, UserRole |
| `firestore.rules` | Reescritura completa |
| `package.json` | Sin cambios — `firebase/auth` ya incluido |
| `openspec/specs/company-selection/spec.md` | Especificación existente — referencia |

### Archivos nuevos a crear
- `lib/auth.ts`
- `context/AuthContext.tsx`
- `app/login/page.tsx`
- `app/register/page.tsx`
- `app/onboarding/page.tsx`
- `app/select-company/page.tsx`
- `app/[company]/layout.tsx` (no existe actualmente)
- `app/api/invitations/accept/route.ts`
- `components/Configuracion.tsx`
