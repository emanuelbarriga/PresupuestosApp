# Design: Bancos

## Technical Approach

Añadir gestión bancaria dentro del componente `Datos` como un nuevo tab, usando el patrón existente de subcolecciones Firestore (`companies/{companyId}/cuentasBancarias/`, `companies/{companyId}/extractos/`) con suscripciones `onSnapshot` en tiempo real. Las cuentas se listan en tabla; los extractos se muestran expandibles al clickear cada cuenta. Formularios via `Sidepanel` siguiendo el mismo mecanismo que presupuestos/ejecuciones.

## Architecture Decisions

### Decision: Expandible inline vs navegación Sidepanel para extractos

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Sidepanel al clickear cuenta | Reutiliza RecordDetail/ViewPanel pero añade profundidad | ❌ |
| Expandible inline dentro del tab | Sin navegación extra; los extractos se ven como parte de la cuenta | ✅ |

**Rationale**: La propuesta explicita expandible, no navegación. Consistente con el comportamiento "click para ver detalle profundo" que ya tienen budgets/ejecuciones, pero acá los extractos son datos planos asociados directamente a una cuenta — no necesitan su propia vista Sidepanel.

### Decision: FormType `'cuenta'` y `'extracto'`

Se añaden al union `FormType` en `lib/types.ts`. Esto permite reutilizar todo el pipeline `handleAddNew` → `pushScreen` → `FormPanel` → `handleFormSubmit` que ya existe para los otros tipos, sin crear componentes de formulario aparte.

### Decision: `accountId` vs `cuentaId` en ExtractoBancario

**Choice**: `accountId` (inglés) como field en el tipo, consistente con `projectId`, `entityId`, `budgetId` del código existente. La colección Firestore se llama `extractos` (español) porque así se muestra en UI.

## Data Flow

```
Datos.tsx (tab "Bancos")
  │
  ├─ subscribeCuentasBancarias(companyId) ──→ onSnapshot ──→ setCuentas[]
  │
  ├─ subscribeExtractos(companyId) ──→ onSnapshot ──→ setExtractos[]
  │                                                    └─ filteredExtractos = extractos.filter(e => e.accountId === selectedCuenta.id)
  │
  ├─ Click "Agregar cuenta"
  │     └─ onAddNew('cuenta')
  │           └─ Sidepanel: FormPanel (form type 'cuenta')
  │                 └─ onSubmit → handleFormSubmit → addCuentaBancaria(companyId, data)
  │
  ├─ Click "Agregar extracto" (dentro de cuenta expandida)
  │     └─ onAddNew('extracto') con defaults: { accountId }
  │           └─ Sidepanel: FormPanel (form type 'extracto')
  │                 └─ onSubmit → handleFormSubmit → addExtracto(companyId, data)
  │
  └─ Click editar en fila de cuenta/extracto
        └─ onEditRecord({ mode: 'edit', type: 'cuenta'|'extracto', record })
              └─ Sidepanel: FormPanel (edit mode)
                    └─ onSubmit → handleFormSubmit → updateCuentaBancaria / updateExtracto
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/types.ts` | Modify | +4 tipos: `AccountType`, `ExtractoEstado`, `CuentaBancaria`, `ExtractoBancario`; extender `FormType`, `ActiveForm` |
| `lib/firestore.ts` | Modify | +2 constantes colección, +6 funciones (`subscribeCuentasBancarias`, `addCuentaBancaria`, `updateCuentaBancaria`, `subscribeExtractos`, `addExtracto`, `updateExtracto`) |
| `components/Datos.tsx` | Modify | +1 tab "Bancos", vista de cuentas con tabla expandible, filtros, botones de acción |
| `components/Sidepanel.tsx` | Modify | +2 form layouts para `'cuenta'` y `'extracto'` |
| `app/[company]/[[...segments]]/page.tsx` | Modify | +casos en `handleFormSubmit` switch para `'cuenta'` y `'extracto'` |
| `firestore.rules` | Modify | +reglas para `cuentasBancarias/{doc}` y `extractos/{doc}` bajo `companies/{companyId}` |

## Interfaces / Contracts

### Nuevos tipos en `lib/types.ts`

```ts
export type AccountType = 'Ahorros' | 'Corriente' | 'Tarjeta de Crédito' | 'Caja Menor / Efectivo';
export type ExtractoEstado = 'Pendiente' | 'En revisión' | 'Conciliado';

export interface CuentaBancaria {
  id: string;
  nombre: string;
  banco: string;
  tipo: AccountType;
  numero: string;
  moneda: string;
  saldoInicial: number;
  saldoActual: number;
}

export interface ExtractoBancario {
  id: string;
  accountId: string;
  mes: Month;
  anio: number;
  saldoInicial: number;
  saldoFinal: number;
  archivo?: { url: string; name: string; uploadedAt: string };
  estado: ExtractoEstado;
  uploadedAt: string;
}
```

### Extensiones de tipos existentes

```ts
// FormType se expande:
export type FormType = 'budget' | 'ejecucion' | 'project' | 'client'
                     | 'provider' | 'tercero' | 'cuenta' | 'extracto';

// ActiveForm se expande:
export type ActiveForm =
  | { mode: 'add'; type: FormType; defaults?: Record<string, string> }
  // ... existing edit cases ...
  | { mode: 'edit'; type: 'cuenta'; record: CuentaBancaria }
  | { mode: 'edit'; type: 'extracto'; record: ExtractoBancario };
```

### Funciones Firestore — mismo patrón que las existentes

```ts
// Suscripciones (onSnapshot)
subscribeCuentasBancarias(companyId, onData, onError?) → Unsubscribe
subscribeExtractos(companyId, onData, onError?) → Unsubscribe

// Mutaciones (addDoc + serverTimestamp)
addCuentaBancaria(companyId, data: Omit<CuentaBancaria, 'id'>) → Promise<string>
addExtracto(companyId, data: Omit<ExtractoBancario, 'id'>) → Promise<string>

// Mutaciones (updateDoc + serverTimestamp)
updateCuentaBancaria(companyId, cuentaId, data: Partial<CuentaBancaria>) → Promise<void>
updateExtracto(companyId, extractoId, data: Partial<ExtractoBancario>) → Promise<void>
```

### Reglas Firestore

```
match /cuentasBancarias/{doc} { allow read, write: if true; }
match /extractos/{doc} { allow read, write: if true; }
```

Ambas bajo `match /companies/{companyId}` (dentro del scope multi-tenant existente).

### TabType en Datos.tsx

```ts
type TabType = 'Presupuestos' | 'Ejecuciones' | 'Proyectos' | 'Terceros' | 'Settings' | 'Bancos';
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Tipos nuevos en TypeScript | Type-checking pasa sin errores |
| Unit | Funciones firestore (`addCuentaBancaria`, `subscribeExtractos`, etc.) | Mock de Firestore `addDoc`/`onSnapshot`/`updateDoc` con `vi.mock` — verificar args y retorno |
| Integration | Tab "Bancos" se renderiza y cambia sin romper otros tabs | Render `Datos` con `activeTab='Bancos'`; verificar que tabla de cuentas se muestra y tabs existentes siguen funcionando |
| Integration | Formularios de cuenta/extracto en Sidepanel | Render `FormPanel` con `form.type='cuenta'` y `form.type='extracto'`, verificar campos y submit |
| Integration | Submit de formulario cuenta → llama `addCuentaBancaria` | Mock `addCuentaBancaria`, llamar `handleFormSubmit` con `{ mode: 'add', type: 'cuenta' }`, verificar args |
| Integration | Submit de formulario extracto → llama `addExtracto` | Mock `addExtracto`, verificar que recibe `accountId` correcto |

## Migration / Rollout

No se requiere migración de datos. Las nuevas colecciones Firestore se crean bajo demanda al primer `addDoc`. Rollback: revertir commits de los 6 archivos modificados y eliminar documentos de prueba.

## Open Questions

- [ ] Confirmar si `saldoActual` de `CuentaBancaria` se actualiza manualmente o se calcula desde extractos — por ahora asumimos actualización manual via formulario de edición.
