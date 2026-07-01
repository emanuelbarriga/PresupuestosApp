# Gestor de Presupuestos

Aplicación empresarial multi-empresa para el control y seguimiento de presupuestos de proyectos. Matriz de control de ingresos y egresos con seguimiento de ejecuciones reales vs. presupuestado.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19 + TypeScript |
| Estilos | Tailwind CSS 4 + clsx |
| Backend | Firebase Firestore (client SDK) |
| Admin | Firebase Admin SDK (seed scripts) |
| Iconos | Lucide React |

## Arquitectura

```
:company/[dashboard|datos/:tab]
```

**Routing:** catch-all con segmentos dinámicos. La empresa se obtiene del path (`/:company`) y las vistas se resuelven con `viewFromSegments()`:

| Ruta | Vista | Descripción |
|---|---|---|
| `/saman/dashboard` | Dashboard | Matriz de control presupuestal |
| `/saman/datos` | Datos | CRUD integral de registros |
| `/saman/datos/presupuestos` | Datos > Presupuestos | Tab específico |
| `/saman/datos/ejecuciones` | Datos > Ejecuciones | Tab específico |
| `/saman/proyectos` | Construcción | En desarrollo |
| `/saman/proveedores` | Construcción | En desarrollo |
| `/saman/clientes` | Construcción | En desarrollo |
| `/saman/extractos` | Construcción | En desarrollo |

**Layout:** Sidebar + Main Content + Sidepanel (panel contextual derecho que se abre al clickear celdas, ver registros, o crear/editar).

## Estructura del proyecto

```
app/
  [company]/[[...segments]]/page.tsx  # Página principal con routing
  layout.tsx                           # Layout raíz
  page.tsx                             # Redirect a /saman/dashboard
components/
  Dashboard.tsx    # Matriz de control Ingresos/Egresos
  Datos.tsx        # CRUD con tabs, filtros y paginación
  Sidebar.tsx      # Navegación lateral + selector de empresa
  Sidepanel.tsx    # Panel contextual (detalle, formularios, celda)
  Construction.tsx # Placeholder para vistas no implementadas
context/
  CompanyContext.tsx  # Contexto de empresa seleccionada
lib/
  types.ts         # Tipos compartidos (Budget, Ejecucion, Project, etc.)
  firebase.ts      # Inicialización Firebase client SDK
  firebase-admin.ts # Inicialización Firebase admin SDK
  firestore.ts     # CRUD + suscripciones en tiempo real
  utils.ts         # Utilidad cn() con tailwind-merge
hooks/
  use-mobile.ts    # Detección de viewport mobile
scripts/
  seed.ts          # Script de seeding con Firebase Admin
```

## Firebase — Estructura de datos

```
companies/{companyId}/
  ├── budgets/         # Presupuestos por empresa
  ├── ejecuciones/     # Ejecuciones por empresa
  └── projects/        # Proyectos por empresa

clients/               # Clientes (global)
providers/             # Proveedores (global)
stateProject/          # Estados de proyecto (global)
companies/             # Empresas registradas
```

### Budget
```ts
{ id, descripcion, proyectoAsignado, clienteOProveedor,
  tipo: 'ingreso' | 'egreso', montoPresupuestado: number,
  mesPresupuestado: Month, estadoProyecto: ProjectState }
```

### Ejecucion
```ts
{ id, descripcion, proyectoAsignado, clienteOProveedor,
  tipo: 'ingreso' | 'egreso', montoEjecutado: number,
  fechaEjecutado: string, budgetId?: string }
```

## Primeros pasos

### Prerrequisitos
- Node.js 18+
- Proyecto Firebase con Firestore habilitado
- Service account de Firebase Admin (opcional, para seed)

### Instalación

```bash
npm install
```

### Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). La app redirige automáticamente a `/saman/dashboard`.

### Seed de datos (opcional)

Para poblar Firestore con datos de prueba, usar el service account JSON de Firebase Admin:

```bash
npx tsx scripts/seed.ts
```

### Build

```bash
npm run build
npm start
```

## Funcionalidades principales

### Dashboard Presupuestal
- Matriz de Ingresos y Egresos con filas por proyecto
- Columnas por mes o vista de 5 meses móviles
- Toggle entre **Presupuestado** y **Ejecutado**
- Click en celda abre detalle en el sidepanel con diferencia
- Totales por columna, fila y total general

### Base de Datos
- **6 pestañas:** Presupuestos, Ejecuciones, Proyectos, Clientes, Proveedores, Configuración
- **Búsqueda textual** sobre campos descriptivos
- **Filtros avanzados** por pestaña:
  - Presupuestos: Tipo, Mes, Monto (min–max)
  - Ejecuciones: Tipo, Desde/Hasta fecha, Monto (min–max)
  - Proyectos: Estado, Presupuesto (min–max)
- **Paginación** configurable: 20, 50, 100, 200 registros
- **Acciones inline:** editar, ver detalle (abre sidepanel), crear nuevo
- Suscripciones Firestore en tiempo real en todas las pestañas

### Sidepanel contextual
- **DataPanel:** Detalle de celda del dashboard con presupuestos/ejecuciones y diferencia
- **ViewPanel:** Detalle completo de cualquier registro (presupuesto, ejecución, proyecto, cliente, proveedor)
- **FormPanel:** Formularios de creación y edición con selects buscables y vinculación de ejecuciones a presupuestos

### Sidebar
- Selector de empresa con dropdown (soporta multi-empresa)
- Navegación con 6 items (algunos en construcción)
- Colapsable (toggle con chevron)

## Pendiente

Las siguientes secciones están marcadas como "En Construcción":
- Proyectos (vista independiente)
- Proveedores (vista independiente)
- Clientes (vista independiente)
- Extractos
