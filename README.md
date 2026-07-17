# Gestor de Presupuestos — PlanningSaman

[![Next.js](https://img.shields.io/badge/Next.js-15.4-000000?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Firebase](https://img.shields.io/badge/Firebase-12.15-FFCA28?logo=firebase)](https://firebase.google.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![Vitest](https://img.shields.io/badge/Vitest-4.1-6E9F18?logo=vitest)](https://vitest.dev)
[![Tests](https://img.shields.io/badge/Tests-917-6E9F18)](https://vitest.dev)
[![Playwright](https://img.shields.io/badge/Playwright-1.61-45BA4B?logo=playwright)](https://playwright.dev)
[![License](https://img.shields.io/badge/Licencia-MIT-blue)](LICENSE)

Aplicación empresarial multi-empresa para el control y seguimiento de presupuestos de proyectos. Automatiza la conciliación financiera mediante parseo de extractos bancarios (Bancolombia, Bancoomeva, Global66) y ofrece una matriz de control de Ingresos/Egresos con seguimiento de ejecuciones reales vs. presupuestado.

---

## 📋 Índice

- [Stack tecnológico](#stack-tecnológico)
- [Primeros pasos](#primeros-pasos)
  - [Requisitos](#requisitos)
  - [Instalación](#instalación)
  - [Entorno local](#entorno-local)
- [Configuración (.env)](#configuración-env)
- [Arquitectura](#arquitectura)
  - [Routing](#routing)
  - [Estructura de carpetas](#estructura-de-carpetas)
  - [Sistema de sidepanel unificado](#sistema-de-sidepanel-unificado)
- [Modelo de datos (Firestore)](#modelo-de-datos-firestore)
  - [Árbol de colecciones](#árbol-de-colecciones)
  - [Entidades principales](#entidades-principales)
  - [Reglas de integridad desnormalizada](#reglas-de-integridad-desnormalizada)
- [Pipeline de conciliación bancaria](#pipeline-de-conciliación-bancaria)
  - [Ciclo de vida del extracto](#ciclo-de-vida-del-extracto)
  - [Estrategias por banco](#estrategias-por-banco)
  - [Auditoría y revisión](#auditoría-y-revisión)
- [Multi-tenancy y control de acceso](#multi-tenancy-y-control-de-acceso)
  - [Membresías por empresa](#membresías-por-empresa)
  - [Invitaciones](#invitaciones)
- [Funcionalidades principales](#funcionalidades-principales)
  - [Dashboard presupuestal](#dashboard-presupuestal)
  - [Base de Datos (CRUD)](#base-de-datos-crud)
  - [Sidebar](#sidebar)
- [Suite de pruebas](#suite-de-pruebas)
  - [Pruebas unitarias e integración](#pruebas-unitarias-e-integración)
  - [Pruebas end-to-end (E2E)](#pruebas-end-to-end-e2e)
- [Despliegue](#despliegue)
- [Pendiente](#pendiente)

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| **Framework** | Next.js 15 (App Router) con `output: 'standalone'` |
| **UI** | React 19 + TypeScript 5.9 |
| **Estilos** | Tailwind CSS 4 + `clsx` + `tw-animate-css` |
| **Iconos** | Lucide React |
| **Backend** | Firebase Firestore (client SDK v12) + Admin SDK v14 |
| **Auth** | Firebase Authentication |
| **Serverless** | Cloud Functions 2nd Gen (Node.js 22) |
| **Parseo PDF** | pdfjs-dist + react-pdf |
| **IA/OCR** | Google Gemini API 2.5 Flash (Gemini 3.1 Flash Lite) vía `@google/genai` |
| **Tests unitarios** | Vitest 4 + Testing Library |
| **Tests E2E** | Playwright + Firebase Emulator Suite |
| **Herramientas** | Firebase CLI, ESLint 9 |

### Gentle AI + Engram

| Herramienta | Versión |
|-------------|---------|
| **Gentle AI** | 2.1.3 |
| **Engram** | 1.19.0 |

El proyecto usa [Gentle AI](https://github.com/Gentleman-Programming/gentle-ai) con el flujo SDD (Spec-Driven Development) para desarrollo asistido, y Engram como memoria persistente entre sesiones. Skills específicas del proyecto en `.agents/skills/`.

---

## Primeros pasos

### Requisitos

- **Node.js** >= 18 (recomendado 22)
- **npm** >= 9
- **Firebase CLI** (`npm install -g firebase-tools`)
- **Java JDK** >= 11 (necesario para Firebase Emulator Suite)
- Una cuenta de Firebase con proyecto creado y Firestore habilitado

### Instalación

```bash
git clone <repo-url>
cd gestor-de-presupuestos
npm install
```

### Entorno local

El flujo de desarrollo usa los emuladores de Firebase para no impactar la base de producción.

**1. Inicializar emuladores**

```bash
npm run emulators
```

Esto levanta **Auth** (puerto 9099) y **Firestore** (puerto 8081) localmente.

**2. Sembrar datos de prueba** (en otra terminal)

```bash
npm run seed
```

Puebla los emuladores con empresas, usuarios, presupuestos, ejecuciones, proyectos, terceros y movimientos bancarios de ejemplo. El script usa `firebase-admin` con autenticación automática en modo emulador.

**3. Arrancar Next.js**

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). La app redirige automáticamente a `/saman/dashboard`. Las variables de entorno `NEXT_PUBLIC_EMULATOR_HOST` y `NEXT_PUBLIC_EMULATOR_PORTS` se configuran automáticamente en el script de seed para que el client SDK apunte a los emuladores.

---

## Configuración (.env)

Copiar `.env.example` a `.env.local`:

```env
# Client SDK (NEXT_PUBLIC_* — se inyectan en build time)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

> **Nota sobre Cloud Functions**: Las variables del Admin SDK usan el prefijo `SA_` (en lugar de `FIREBASE_`, que está reservado por Google Cloud Runtime). La clave privada (`SA_PRIVATE_KEY`) se inyecta mediante Firebase Secrets. Ver [`DEPLOY.md`](DEPLOY.md) para más detalles.

---

## Arquitectura

### Routing

```
:company/[dashboard|datos/:tab]
```

Catch-all con segmentos dinámicos. La empresa activa se obtiene del path (`/:company`) y las vistas se resuelven mediante `viewFromSegments()`:

| Ruta | Vista | Descripción |
|------|-------|-------------|
| `/:company/dashboard` | Dashboard | Matriz de control presupuestal |
| `/:company/datos` | Datos | CRUD integral con tabs |
| `/:company/datos/presupuestos` | Datos › Presupuestos | Tab específico |
| `/:company/datos/ejecuciones` | Datos › Ejecuciones | Tab específico |
| `/:company/datos/proyectos` | Datos › Proyectos | Tab específico |
| `/:company/datos/clientes` | Datos › Clientes | Tab específico |
| `/:company/datos/proveedores` | Datos › Proveedores | Tab específico |
| `/:company/media` | Medios | Gestión documental desacoplada (Inbox + clasificación) |
| `/:company/extractos` | Extractos | Gestión bancaria |
| `/:company/configuracion` | Configuración | Settings globales |

**Layout**: Sidebar + Main Content + Sidepanel (panel contextual derecho que se abre al clickear celdas, ver registros, o crear/editar).

### Estructura de carpetas

```
app/
├── [company]/
│   ├── [[...segments]]/      # Página principal con routing dinámico
│   │   └── page.tsx
│   ├── extractos/
│   │   └── page.tsx          # Gestión de extractos bancarios
│   └── configuracion/
│       └── page.tsx          # Settings de categorías globales
├── layout.tsx                # Layout raíz
└── page.tsx                  # Redirect a /saman/dashboard

components/
├── media/                   # Gestión documental (Inbox + upload + sidepanel)
│   ├── MediaPage.tsx         # Dropzone + grilla de documentos
│   └── DocumentoSidepanel.tsx  # Clasificación (8 tipos, periodo, entidades)
├── entities/                 # Componentes de entidad unificados
│   ├── presupuesto/          # Budget*
│   ├── ejecucion/            # Ejecucion*
│   ├── proyecto/             # Project*
│   ├── tercero/              # Tercero (clientes/proveedores)
│   ├── compania/             # Company
│   ├── invitacion/           # Invitacion
│   ├── movimiento/           # Movimiento bancario
│   └── ...                   # convertidor, extracto, cuenta, etc.
├── extractos/                # UI del pipeline bancario
├── Dashboard.tsx             # Matriz de control Ingresos/Egresos
├── Datos.tsx                 # CRUD con tabs, filtros, paginación
├── Sidebar.tsx               # Navegación lateral + selector empresa
├── Sidepanel.tsx             # Panel contextual unificado
└── Configuracion.tsx         # Settings (estados, unidades, tipos)

lib/
├── firebase.ts               # Inicialización Firebase client SDK
├── firebase-admin.ts         # Inicialización Firebase admin SDK
├── firestore.ts              # CRUD + suscripciones en tiempo real (~1100 líneas)
├── types.ts                  # Tipos compartidos (~300 líneas)
├── parsers/                  # Estrategias de parseo bancario
│   ├── bancolombia.ts
│   ├── bancoomeva.ts
│   └── global66.ts
├── utils.ts
└── __tests__/                # Tests unitarios de firestore, parsers, etc.

context/
├── CompanyContext.tsx         # Contexto de empresa activa
└── ThemeContext.tsx

functions/
├── index.js                  # Cloud Function wrapper (2nd Gen)
├── package.json              # Dependencias del server
└── standalone/               # Build de Next.js (generado en deploy)

scripts/
├── seed.ts                   # Seed de datos para emuladores
├── seed-providers.ts         # Seed legacy de proveedores
├── upload-*.ts               # Scripts de carga de datos reales
├── migrate-legacy-comprobantes.ts  # Migración: Ejecucion.comprobantes → /documentos
├── down-migration-media.ts   # Rollback seguro con duplicación Storage server-side
├── garbage-collector-media.ts      # GC: phantom files, drafts abandonados, stale unlinked
└── cleanup-*.ts              # Scripts de limpieza

e2e/
├── seed/
│   └── seed-emulator.ts      # Seed específico para tests E2E
├── *.spec.ts                 # Tests Playwright
└── playwright.config.ts
```

### Sistema de sidepanel unificado

El sidepanel ya no se divide en DataPanel / ViewPanel / FormPanel como componentes separados. En su lugar, usa un **sistema genérico gobernado por entidad**:

**`EntityProps`** — contrato unificado que cualquier entidad implementa:

```ts
interface EntityProps<T> {
  mode: 'create' | 'edit' | 'view';
  data?: T;
  onSubmit: (data: T) => Promise<void>;
  onNavigate?: (screen: NavScreen) => void;
}
```

**`NavScreen`** — stack de navegación interna del sidepanel:

```ts
type NavScreen =
  | { type: 'entity'; entity: EntityType; id?: string }
  | { type: 'entity-list'; entity: EntityType }
  | { type: 'customize' }
  | { type: 'movimiento'; movimientoId: string }
  | { type: 'convertir-movimientos' }
  | ...;
```

Cada entidad (`presupuesto`, `ejecucion`, `tercero`, `proyecto`, `movimiento`, `invitacion`, `colaborador`, `compania`, `settings`) registra sus componentes de create, edit y view en un mapa central. El sidepanel resuelve qué renderizar según el `NavScreen` activo, sin lógica condicional por entidad.

---

## Modelo de datos (Firestore)

### Árbol de colecciones

```
📁 settings                          (1 doc — configuración global)
└── categorias                       ← estados, unidades, tipos de proyecto, comprobantes

📁 users                             (3 docs)
└── {uid}                            ← cada usuario autenticado

📁 invitations                       (invitaciones pendientes)
└── {invitationId}
    ├── email: string
    ├── status: 'pendiente' | 'aceptada'
    ├── invitedBy: string (uid)
    ├── createdAt: string (ISO)
    └── expiresAt: string (ISO)

📁 terceros                          (52 docs — clientes + proveedores unificados)
└── {terceroId}
    ├── name: string
    ├── tipo: 'cliente' | 'proveedor' | 'ambos'
    ├── apodo?: string
    ├── naturaleza?: 'Persona Natural' | 'Persona Jurídica'
    ├── documento?: string
    ├── numeroDocumento?: string
    ├── lugar?: string
    └── createdAt: Timestamp | string (⚠️ tipos mezclados — ver observaciones)

📁 companies                         (2 docs: "saman", "pcora")
└── {companyId}
    ├── name: string
    ├── createdBy: string (uid)
    ├── createdAt: string (ISO)
    │
    ├── 📁 members                   ← miembros de la compañía
    │   └── {userId}
    │       ├── role: 'admin' | 'colaborador'
    │       ├── joinedAt: string (ISO)
    │       └── blocked?: boolean
    │
    ├── 📁 settings                  ← config por compañía (override)
    │   └── categorias
    │
    ├── 📁 projects                  ← proyectos
    │   └── {projectId}
    │       ├── name: string (sigla)
    │       ├── descripcion?: string
    │       ├── clientId / clientName: string
    │       ├── estado: string
    │       ├── tipoProyectos?: string
    │       └── soloEgresos / soloIngresos?: boolean
    │
    ├── 📁 budgets                   ← presupuestos (138 docs)
    │   └── {budgetId}
    │       ├── descripcion: string
    │       ├── projectId / projectName: string
    │       ├── entityId / entityName / entityType: string
    │       ├── tipo: 'ingreso' | 'egreso'
    │       ├── montoPresupuestado: number
    │       ├── mesPresupuestado: Month
    │       ├── fechaPresupuestado: string
    │       ├── estadoProyecto: string
    │       ├── archivado?: boolean
    │       ├── totalEjecutado?: number       ← CAMPO DESNORMALIZADO
    │       └── linkedEjecuciones?: Array<    ← CAMPO DESNORMALIZADO
    │           { ejecucionId: string; monto: number }
    │       >
    │
    ├── 📁 ejecuciones               ← ejecuciones reales
    │   └── {ejecucionId}
    │       ├── descripcion: string
    │       ├── projectId / projectName: string
    │       ├── entityId / entityName / entityType: string
    │       ├── tipo: 'ingreso' | 'egreso'
    │       ├── montoEjecutado: number
    │       ├── fechaEjecutado: string
    │       ├── cuentaId / cuentaName?: string
    │       ├── comprobantes: Comprobante[]
    │       ├── _linkedDocumentos?: Array<     ← CAMPO DESNORMALIZADO
    │       │   { documentoId, tipoDocumento, periodo?, montoTotal? }
    │       ├── _estadoComprobantes?: string  ← CAMPO DESNORMALIZADO
    │       └── archivado?: boolean
    │       │
    │       └── 📁 budgetLinks         ← join presupuesto ↔ ejecución
    │           └── {linkId}
    │               ├── budgetId: string
    │               └── monto: number
    │
    ├── 📁 documentos               ← sistema de medios desacoplado
    │   └── {documentoId}
    │       ├── fileName: string
    │       ├── storagePath: string
    │       ├── url: string
    │       ├── size: number
    │       ├── mimeType: string
    │       ├── status: 'por_clasificar' | 'enlazado'
    │       ├── tipoDocumento?: TipoDocumentoMedio
    │       ├── periodo?: string (YYYY-MM)
    │       ├── terceroId?: string
    │       ├── projectId?: string
    │       ├── ejecucionIds: string[]
    │       ├── _source: 'inbox-upload' | 'ejecucion-form' | 'migration'
    │       ├── metadata?: { proveedorTexto, nit, fechaDocumento, montoTotal }
    │       ├── uploadedAt: string
    │       └── createdBy: string
    │
    └── 📁 cuentasBancarias           ← cuentas bancarias
        └── {cuentaId}
            ├── nombre: string
            ├── banco: string
            ├── tipo: AccountType
            ├── numero: string
            ├── moneda: string
            ├── saldoInicial / saldoActual: number
            │
            └── 📁 extractos           ← extractos bancarios
                └── {extractoId}
                    ├── estado: ExtractoEstado
                    ├── periodo: string
                    ├── archivo: string (Storage URL)
                    │
                    └── 📁 movimientos   ← movimientos individuales
                        └── {movimientoId}
                            ├── fecha: string
                            ├── descripcion: string
                            ├── debito / credito / saldo: number
                            ├── moneda: string
                            ├── bancoOrigen: Banco
                            ├── requiereRevision?: boolean
                            ├── revisionMotivo?: string
                            ├── posibleDuplicado?: boolean
                            ├── convertido?: boolean
                            └── createdAt: Timestamp
```

### Entidades principales

| Tipo | Colección | Propósito |
|------|-----------|-----------|
| **Company** | `companies/{id}` | Empresa multi-tenant. 2 registros: Samán y Pácora. |
| **Tercero** | `terceros/{id}` | Clientes y proveedores unificados. Discriminador: `tipo`. |
| **Project** | `companies/{id}/projects/{id}` | Proyectos asociados a una empresa. |
| **Budget** | `companies/{id}/budgets/{id}` | Presupuesto: monto planeado por proyecto y mes. |
| **Ejecucion** | `companies/{id}/ejecuciones/{id}` | Ejecución real: lo que realmente se gastó/cobró. |
| **EjecucionBudgetLink** | `.../ejecuciones/{id}/budgetLinks/{id}` | Join N:N entre ejecución y presupuesto con monto parcial. |
| **DocumentoMedio** | `companies/{id}/documentos/{id}` | Documento financiero plano (factura, extracto, contrato). Status-driven: `por_clasificar` → `enlazado`. |
| **CuentaBancaria** | `.../cuentasBancarias/{id}` | Cuenta bancaria registrada. |
| **Extracto** | `.../cuentasBancarias/{id}/extractos/{id}` | Extracto bancario subido (PDF parseado). |
| **MovimientoBancario** | `.../extractos/{id}/movimientos/{id}` | Movimiento individual del extracto. |
| **Invitacion** | `invitations/{id}` | Invitación a unirse a una empresa. |
| **CompanyMember** | `companies/{id}/members/{uid}` | Membresía de usuario en una empresa. |

### Reglas de integridad desnormalizada

**⚠️ Importante**: `Budget` tiene dos campos desnormalizados que **deben** mantenerse sincronizados atómicamente:

- **`totalEjecutado`**: suma de todos los `budgetLinks.monto` que referencian este budget. Se actualiza vía `increment()` / `increment(-monto)`.
- **`linkedEjecuciones`**: array de `{ ejecucionId, monto }`. Se actualiza vía `arrayUnion()` / `arrayRemove()`.

**Cada escritura en `budgetLinks` requiere ambas actualizaciones atómicas.** Si se omiten, el dashboard muestra totales incorrectos.

---

## Pipeline de conciliación bancaria

### Ciclo de vida del extracto

```
Pendiente ──→ Parseando ──→ Completado ──→ En revisión ──→ Conciliado
                  │               │
                  ↓               ↓
             Error de parseo   (corrección manual)
```

| Estado | Significado |
|--------|-------------|
| `Pendiente` | PDF subido a Storage, esperando parseo |
| `Parseando` | El motor de parseo está procesando |
| `Completado` | Parseo exitoso, movimientos disponibles |
| `Error de parseo` | El PDF no pudo interpretarse |
| `En revisión` | Usuario revisando movimientos |
| `Conciliado` | Todos los movimientos revisados y cerrados |

### Estrategias por banco

Cada banco tiene su propio parser en `lib/parsers/`:

- **Bancolombia** — Parseo de extracto PDF con formato de tablas. Detecta débitos/créditos, saldos.
- **Bancoomeva** — Formato de extracto diferente, columnas y separadores propios.
- **Global66** — Extractos con moneda internacional, hora original de transacción.

### Auditoría y revisión

Cada `MovimientoBancario` incluye campos de auditoría:

| Campo | Propósito |
|-------|-----------|
| `requiereRevision: boolean` | El parser detectó algo inusual |
| `revisionMotivo: string` | Por qué requiere revisión |
| `posibleDuplicado: boolean` | Coincide con otro movimiento existente |
| `convertido: boolean` | Ya se convirtió a `Ejecucion` |

**Flujo de conversión**: El usuario revisa los movimientos → marca los que corresponden a ejecuciones → el sistema crea una `Ejecucion` en la empresa correspondiente, actualiza `budgetLinks` y sincroniza los campos desnormalizados.

---

## Multi-tenancy y control de acceso

### Membresías por empresa

Cada usuario se vincula a una o más empresas mediante `companies/{id}/members/{uid}`:

```ts
interface CompanyMember {
  role: 'admin' | 'colaborador';
  joinedAt: string;    // ISO
  blocked?: boolean;   // bloqueo explícito
}
```

- Los miembros se consultan globalmente mediante `collectionGroup('members')`, lo que permite buscar en todas las empresas a la vez.
- El flag `blocked` permite desactivar acceso sin borrar el registro.

### Invitaciones

El ciclo de vida de incorporación de un nuevo usuario:

1. Un `admin` crea una `invitation` con email del invitado.
2. La invitación expira a los **7 días** (`expiresAt`).
3. Al aceptar, se crea el `member` en la empresa y se limpia el flag `pendingAssignment` del usuario.
4. Las invitaciones expiradas se muestran como `status: 'pendiente'` vencidas.

---

## Funcionalidades principales

### Dashboard presupuestal

- Matriz de Ingresos y Egresos con filas por proyecto y columnas por mes.
- Vista de 5 meses móviles o año completo.
- Toggle entre **Presupuestado** y **Ejecutado**.
- Click en celda → sidepanel con detalle y diferencia.
- Totales por columna, fila y total general.
- Los montos se obtienen de la suma de `budgets.montoPresupuestado` vs `budgetLinks.monto` agregados.

### Base de Datos (CRUD)

- **Tabs**: Presupuestos, Ejecuciones, Proyectos, Clientes, Proveedores, Configuración.
- **Búsqueda textual** sobre campos descriptivos.
- **Filtros avanzados**:
  - Presupuestos: Tipo, Mes, Monto (min–max).
  - Ejecuciones: Tipo, Fecha (desde–hasta), Monto (min–max).
  - Proyectos: Estado, Presupuesto (min–max).
- **Paginación**: 20, 50, 100, 200 registros.
- **Acciones inline**: editar, ver detalle (sidepanel), crear nuevo.
- Suscripciones Firestore en tiempo real.

### Sistema de medios (Inbox + Archivador)

- **Inbox**: Dropzone drag-and-drop + grilla de documentos pendientes de clasificar.
- **OCR con IA**: Extracción automática de proveedor, NIT, fecha, monto, tipo de documento y descripción mediante Google Gemini 2.5 Flash.
  - **Batch OCR**: Selección múltiple con checkboxes (máx 30), procesamiento 3-en-paralelo, progreso por documento, cancelación vía AbortController, reintento individual de fallidos.
- **Archivador contable**: Clasificación por 8 tipos documentales + período mensual. Pestaña "Todos" por defecto. Vistas Tabla (con subtotales por mes y total general) y Tarjetas. Preferencia de vista persistida en localStorage.
- **DocumentoSidepanel**: Clasificación completa (tipo, período, tercero, proyecto, ejecuciones, metadatos). Undo/redo persistente con history stack en localStorage (Ctrl+Z / Ctrl+Shift+Z). Autocompletado de terceros vía datalist. Indicador visual del período derivado.
- **Explorador por Terceros**: Docs agrupados por proveedor/cliente.

### Sidebar

- Selector de empresa con dropdown (soporta multi-empresa).
- Navegación colapsable con 8 items.
- Algunas vistas marcadas como "En Construcción".

---

## Suite de pruebas

### Pruebas unitarias e integración

Ejecutadas con **Vitest 4** (**917 tests, 72 archivos**):

```bash
npm run test
```

Para las reglas de seguridad de Firestore/Storage (requiere emuladores):

```bash
npm run test:rules
```

Para medir cobertura (incluye `lib/`, `components/`, `context/`, `app/`):

```bash
npm run test:coverage
```

Genera reporte en consola (`text`) y archivo `coverage/lcov.info` para IDE.

Cobertura:

- **Firestore**: Tests de la capa de datos (`lib/__tests__/firestore.test.ts`).
- **Parsers bancarios**: Parseo de extractos de Bancolombia, Bancoomeva, Global66.
- **Tipos y entidades**: Tests de tipos compartidos y helpers de conversión.
- **Configuración**: Tests de `toMillis()` y `fmtDate()` que manejan la dualidad Timestamp / string ISO.
- **Sistema de medios**: Tests de MediaPage, DocumentoSidepanel, InboxTab, ArchivadorTab, mediaLinking, mediaService, scripts de migración y GC.
- **OCR/IA**: Tests de extracción Gemini (`lib/ocr.ts`), batch OCR en InboxTab, route de extracción.
- **Undo/Redo**: Tests del hook `useDocumentHistory` (18 tests) + integración en DocumentoSidepanel (9 tests).

### Pruebas end-to-end (E2E)

Ejecutadas con **Playwright** + **Firebase Emulator Suite**:

```bash
npm run test:e2e
```

Este comando **automatiza todo el ciclo**:

1. Levanta los emuladores de Auth y Firestore.
2. Ejecuta el seed de datos de prueba (`e2e/seed/seed-emulator.ts`).
3. Expone los puertos de los emuladores a Next.js.
4. Arranca el servidor de desarrollo.
5. Corre los specs de Playwright en navegador headless.
6. Mata todos los procesos al finalizar.

Para correr solo los tests sin reiniciar emuladores:

```bash
npm run test:e2e:run
```

Para ver el reporte HTML:

```bash
npm run test:e2e:report
```

---

## Despliegue

La aplicación se despliega a **Firebase Hosting** con **Cloud Functions** (2nd Gen) para SSR. El build usa `output: 'standalone'` de Next.js.

```bash
npm run deploy
```

Este comando:
1. Compila Next.js con `output: 'standalone'`.
2. Copia el build a `functions/standalone/`.
3. Instala dependencias de producción en `functions/`.
4. Despliega a Firebase Hosting + Functions.

Para más detalles (arquitectura de deploy, variables de entorno con prefijo `SA_`, configuración de Cloud Function, canales de hosting), ver [`DEPLOY.md`](DEPLOY.md).

---

## Pendiente

Las siguientes secciones están planificadas:

- Cloud Function para integridad cross-collection de `_estadoComprobantes`.
- Tests E2E de flujo completo de conciliación bancaria.
- UI de administración de miembros por empresa.

---

## ⚠️ Observaciones sobre la base de datos

Durante el análisis del código se detectaron algunas inconsistencias en los tipos de fecha de Firestore:

| Colección | Campo | Problema |
|-----------|-------|----------|
| `terceros` | `createdAt` | **Tipos mezclados**: algunos documentos tienen Timestamp, otros string ISO. |
| `companies` | `createdAt` | Siempre string ISO (debería ser Timestamp para consultas de rango). |
| `users` | `createdAt` | Siempre string ISO. |
| `SettingsCategorias` | `updatedAt` | El tipo TypeScript dice `string`, pero el valor real es Timestamp. |

**Impacto actual**: Ninguno — no hay queries que filtren u ordenen por estos campos. Si en el futuro se agrega un `orderBy('createdAt')`, Firestore lanzará un error por tipos mezclados.
