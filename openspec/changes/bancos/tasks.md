# Tasks: Bancos

## Resumen de batches

| Batch | Descripción | Dependencias |
|-------|-------------|-------------|
| **A — Model Layer** | Tipos, funciones Firestore, reglas de seguridad | Ninguna |
| **B — Application Wiring** | Switch en handleFormSubmit para nuevos tipos | Batch A |
| **C — Bancos Tab UI** | Tab, tabla de cuentas, extractos expandibles | Batch A |
| **D — Formularios** | Layouts de formulario en Sidepanel para cuenta/extracto | Batch A, B |

---

## Batch A: Model Layer

### T1: Agregar tipos a `lib/types.ts`

**Archivos**: `lib/types.ts`

**Descripción**: Agregar `AccountType`, `ExtractoEstado`, `CuentaBancaria`, `ExtractoBancario`, extender `FormType` y `ActiveForm`.

**Criterios de aceptación**:
- [ ] `AccountType` es `'Ahorros' | 'Corriente' | 'Tarjeta de Crédito' | 'Caja Menor / Efectivo'`
- [ ] `ExtractoEstado` es `'Pendiente' | 'En revisión' | 'Conciliado'`
- [ ] `CuentaBancaria` tiene `id`, `nombre`, `banco`, `tipo`, `numero`, `moneda`, `saldoInicial`, `saldoActual`
- [ ] `ExtractoBancario` tiene `id`, `accountId`, `mes`, `anio`, `saldoInicial`, `saldoFinal`, `archivo?`, `estado`, `uploadedAt`
- [ ] `FormType` incluye `'cuenta' | 'extracto'`
- [ ] `ActiveForm` incluye `{ mode: 'edit'; type: 'cuenta'; record: CuentaBancaria }` y `{ mode: 'edit'; type: 'extracto'; record: ExtractoBancario }`
- [ ] `npm run lint` pasa sin errores
- [ ] `npm test` pasa sin errores

**Dependencias**: Ninguna

---

### T2: Agregar funciones Firestore en `lib/firestore.ts`

**Archivos**: `lib/firestore.ts`

**Descripción**: Agregar constantes `CUENTAS_BANCARIAS_COLLECTION` y `EXTRACTOS_COLLECTION`. Implementar 6 funciones siguiendo el patrón exacto de las existentes:
- `subscribeCuentasBancarias(companyId, onData, onError?) → Unsubscribe`
- `subscribeExtractos(companyId, onData, onError?) → Unsubscribe`
- `addCuentaBancaria(companyId, data: Omit<CuentaBancaria, 'id'>) → Promise<string>`
- `addExtracto(companyId, data: Omit<ExtractoBancario, 'id'>) → Promise<string>`
- `updateCuentaBancaria(companyId, cuentaId, data: Partial<CuentaBancaria>) → Promise<void>`
- `updateExtracto(companyId, extractoId, data: Partial<ExtractoBancario>) → Promise<void>`

**Criterios de aceptación**:
- [ ] Constantes `CUENTAS_BANCARIAS_COLLECTION = 'cuentasBancarias'` y `EXTRACTOS_COLLECTION = 'extractos'`
- [ ] `subscribeCuentasBancarias` usa `onSnapshot` sobre `companies/{companyId}/cuentasBancarias`
- [ ] `subscribeExtractos` usa `onSnapshot` sobre `companies/{companyId}/extractos`
- [ ] `addCuentaBancaria` usa `addDoc` con `serverTimestamp()` en `createdAt`
- [ ] `addExtracto` usa `addDoc` con `serverTimestamp()` en `createdAt`
- [ ] `updateCuentaBancaria` usa `updateDoc` con `serverTimestamp()` en `updatedAt`
- [ ] `updateExtracto` usa `updateDoc` con `serverTimestamp()` en `updatedAt`
- [ ] Las suscripciones retornan `Unsubscribe`
- [ ] `npm run lint` pasa sin errores

**Dependencias**: T1

---

### T3: Agregar reglas de seguridad Firestore

**Archivos**: `firestore.rules`

**Descripción**: Agregar reglas de acceso para las colecciones nuevas bajo `match /companies/{companyId}`.

**Criterios de aceptación**:
- [ ] `match /cuentasBancarias/{doc}` permite `read, write: if true` bajo `companies/{companyId}`
- [ ] `match /extractos/{doc}` permite `read, write: if true` bajo `companies/{companyId}`
- [ ] Reglas existentes no se modifican

**Dependencias**: Ninguna

---

## Batch B: Application Wiring

### T4: Agregar casos en `handleFormSubmit`

**Archivos**: `app/[company]/[[...segments]]/page.tsx`

**Descripción**: Agregar casos en el switch de `handleFormSubmit` para los modos add/edit de `'cuenta'` y `'extracto'`, invocando las funciones de T2. Importar las 6 funciones nuevas desde `@/lib/firestore`.

**Criterios de aceptación**:
- [ ] `addCuentaBancaria`, `updateCuentaBancaria`, `addExtracto`, `updateExtracto` importadas
- [ ] Caso `'cuenta'` en block `form.mode === 'add'` → `addCuentaBancaria(companyId, data)`
- [ ] Caso `'extracto'` en block `form.mode === 'add'` → `addExtracto(companyId, data)`
- [ ] Caso `'cuenta'` en block `form.mode === 'edit'` → `updateCuentaBancaria(companyId, form.record.id, data)`
- [ ] Caso `'extracto'` en block `form.mode === 'edit'` → `updateExtracto(companyId, form.record.id, data)`
- [ ] `npm run lint` pasa sin errores

**Dependencias**: T1, T2

---

## Batch C: Bancos Tab UI

### T5: Agregar tab "Bancos" al componente Datos

**Archivos**: `components/Datos.tsx`

**Descripción**: Extender `TabType` para incluir `'Bancos'`, agregarlo al array `tabs`, importar tipos y funciones firestore nuevas. Inicializar estado de `cuentas` y `extractos` con suscripciones en el `useEffect` existente. Agregar filtro de búsqueda por nombre/banco para la tab Bancos (similar al searchText de otras tabs).

**Criterios de aceptación**:
- [ ] `TabType` incluye `'Bancos'`
- [ ] `tabs` contiene `'Bancos'`
- [ ] Tipos `CuentaBancaria`, `ExtractoBancario` importados
- [ ] Funciones `subscribeCuentasBancarias`, `subscribeExtractos` importadas
- [ ] `useState<CuentaBancaria[]>` y `useState<ExtractoBancario[]>` declarados
- [ ] Suscripciones se inician en `useEffect` con `companyId` y se limpian al desmontar
- [ ] Tab "Bancos" aparece en la barra de pestañas y es clickeable
- [ ] Al hacer clic, el tab se activa visualmente (subrayado indigo)
- [ ] Otros tabs existentes funcionan exactamente igual

**Dependencias**: T1, T2

---

### T6: Vista de cuentas bancarias con extractos expandibles

**Archivos**: `components/Datos.tsx`

**Descripción**: Renderizar dentro de `activeTab === 'Bancos'`:
1. Tabla con columnas: Nombre, Banco, Tipo, Número, Saldo Actual, Acción (editar)
2. Botón "Agregar cuenta" al pie de la tabla (reutilizando `AddBtn`)
3. Cada fila es clickeable y expande/contrae los extractos de esa cuenta
4. Al expandir, se muestra sub-tabla de extractos con: Mes, Año, Saldo Inicial, Saldo Final, Estado, Archivo
5. Botón "Agregar extracto" dentro del expandido de cada cuenta
6. Estado vacío: mensaje "No hay cuentas bancarias registradas"
7. Paginación y búsqueda aplican a la tabla de cuentas

**Criterios de aceptación**:
- [ ] Tabla de cuentas se renderiza con todas las columnas especificadas
- [ ] `formatCurrency` se usa para montos (saldo actual/inicial)
- [ ] `AccountType` se muestra en badge con color (ej: Ahorros → verde, Tarjeta de Crédito → rojo)
- [ ] Click en fila expande/contrae extractos (toggle con `expandedRows` Set)
- [ ] Extractos filtrados por `accountId` de la cuenta seleccionada
- [ ] Sub-tabla de extractos muestra mes, año, saldo inicial, saldo final, estado y archivo (si tiene)
- [ ] `ExtractoEstado` se muestra con badge de color: Pendiente (ámbar), En revisión (azul), Conciliado (verde)
- [ ] Botón "Agregar cuenta" llama `onAddNew?.('cuenta')`
- [ ] Botón "Agregar extracto" llama `onAddNew?.('extracto')` con defaults `{ accountId }`
- [ ] Botón editar en fila de cuenta llama `edit('cuenta', cuenta)`
- [ ] Botón editar en fila de extracto llama `edit('extracto', extracto)`
- [ ] Estado vacío se muestra cuando no hay cuentas
- [ ] Paginación y búsqueda funcionan en la tabla de cuentas
- [ ] `npm run lint` pasa sin errores

**Dependencias**: T5

---

## Batch D: Formularios

### T7: Formularios para cuenta bancaria y extracto en Sidepanel

**Archivos**: `components/Sidepanel.tsx`

**Descripción**: Agregar dos layouts de formulario completos dentro de `FormPanel`:
- **Formulario 'cuenta'**: Campos: nombre, banco, tipo (select con AccountType), número, moneda (select: COP, USD, EUR), saldoInicial (number con formato miles).
- **Formulario 'extracto'**: Campos: mes (select con MONTHS), año (number), saldoInicial, saldoFinal, estado (select con ExtractoEstado). `accountId` va oculto (se setea desde defaults). Archivo adjunto (opcional) similar a comprobantes.

Actualizar el título generado en `title` para incluir `'cuenta' → 'Cuenta Bancaria'` y `'extracto' → 'Extracto'`.

**Criterios de aceptación**:
- [ ] `ft === 'cuenta'` renderiza formulario con campos nombre, banco, tipo (select), número, moneda (select), saldoInicial
- [ ] `ft === 'extracto'` renderiza formulario con campos mes (select), año, saldoInicial, saldoFinal, estado (select), archivo (opcional)
- [ ] `AccountType` select: Ahorros, Corriente, Tarjeta de Crédito, Caja Menor / Efectivo
- [ ] `ExtractoEstado` select: Pendiente, En revisión, Conciliado
- [ ] `Moneda` select: COP, USD, EUR (con COP como default)
- [ ] En modo edit, los campos se prellenan con los valores existentes
- [ ] En modo add para extracto, `accountId` se setea desde `form.defaults`
- [ ] Título del sidepanel: "Nuevo Cuenta Bancaria" / "Editar Cuenta Bancaria" / "Nuevo Extracto" / "Editar Extracto"
- [ ] `npm run lint` pasa sin errores

**Dependencias**: T1, T4, T6

---

## Review Workload Forecast

### Líneas estimadas por archivo

| Archivo | Cambio | Líneas estimadas |
|---------|--------|-----------------|
| `lib/types.ts` | +4 tipos, extender FormType/ActiveForm | ~25 |
| `lib/firestore.ts` | +2 constantes, +6 funciones | ~80 |
| `firestore.rules` | +2 match blocks | ~4 |
| `app/[company]/[[...segments]]/page.tsx` | +4 switch cases + imports | ~30 |
| `components/Datos.tsx` | TabType, tabs, useState, useEffect, tabla cuentas, extractos expandibles, search, paginación, botones | ~200 |
| `components/Sidepanel.tsx` | +2 form layouts (cuenta + extracto) | ~140 |
| **Total** | | **~479** |

### Recomendación de PRs encadenados

**El total estimado supera las 400 líneas.** Se recomienda dividir en **2 PRs encadenados** para facilitar la revisión:

| PR | Batch | Líneas | Contenido |
|----|-------|--------|-----------|
| **PR 1** | A + B (T1–T4) | ~139 | Model layer + wiring — todo backend/sin UI |
| **PR 2** | C + D (T5–T7) | ~340 | UI completa — tab, tabla, extractos, formularios |

**Razón**: El PR 1 es autónomo (tipos, firestore, rules, handler). El PR 2 depende de que el PR 1 esté mergeado para que los tipos y funciones existan. Esto permite revisar la lógica de datos separada de la interfaz.
