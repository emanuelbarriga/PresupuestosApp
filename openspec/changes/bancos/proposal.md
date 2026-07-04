# Proposal: Bancos

## Intent

Agregar gestión de cuentas bancarias y extractos mensuales como un nuevo tab dentro de la vista Datos, permitiendo registrar cuentas, cargar extractos y hacer seguimiento de saldos por empresa.

## Scope

### In Scope
- Tipos `CuentaBancaria`, `ExtractoBancario`, `AccountType`, `ExtractoEstado` en `lib/types.ts`
- Colecciones `cuentasBancarias` y `extractos` en Firestore bajo `companies/{companyId}`
- 6 funciones Firestore (`subscribeCuentasBancarias`, `addCuentaBancaria`, `updateCuentaBancaria`, `subscribeExtractos`, `addExtracto`, `updateExtracto`)
- Tab "Bancos" en componente Datos (junto a Presupuestos, Ejecuciones, Proyectos, Terceros, Settings)
- Vista de lista de cuentas bancarias con tabla (nombre, banco, tipo, número, saldo)
- Al clickear una cuenta, vista de sus extractos asociados (mes/año, saldo inicial/final, estado)
- Botones "Agregar cuenta" y "Agregar extracto" con formularios

### Out of Scope
- Dashboard de resumen financiero consolidado
- Vinculación automática de extractos con presupuestos o ejecuciones
- Conciliación bancaria automatizada
- Reportes o exportación de extractos

## Capabilities

### New Capabilities
- `bank-accounts`: Gestión de cuentas bancarias y extractos — tipos, colecciones Firestore, suscripciones en tiempo real, UI de listado y creación dentro de la vista Datos.

### Modified Capabilities
- None

## Approach

1. Agregar tipos (`AccountType`, `ExtractoEstado`, `CuentaBancaria`, `ExtractoBancario`) en `lib/types.ts`. Usar `accountId` en vez de `cuentaId` para consistencia con `projectId`, `entityId`, `budgetId`.
2. Agregar constantes de colección y 6 funciones siguiendo el patrón exacto de las existentes: `onSnapshot` para suscripciones, `addDoc`/`updateDoc` con `serverTimestamp`.
3. Extender `TabType` en `components/Datos.tsx` para incluir `'Bancos'`. Renderizar vista de cuentas con tabla y botón "Agregar cuenta". Al clickear una fila, mostrar extractos de esa cuenta con botón "Agregar extracto".
4. Formularios integrados via Sidepanel existente, siguiendo patrón de las otras tabs.
5. Firestore rules: permitir lectura/escritura en las nuevas colecciones.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/types.ts` | Modified | +4 tipos/alias |
| `lib/firestore.ts` | Modified | +6 funciones |
| `components/Datos.tsx` | Modified | +1 tab, vistas de cuentas y extractos |
| `firestore.rules` | Modified | Reglas para nuevas colecciones |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Extractos sin cuenta padre | Low | `accountId` es requerido; UI solo permite crear extracto dentro de una cuenta existente |
| Archivos de extracto grandes | Low | Firebase Storage con límite de 10MB; compresión previa |

## Rollback Plan

Revert commits que toquen `lib/types.ts`, `lib/firestore.ts`, `components/Datos.tsx` y `firestore.rules`. Las colecciones nuevas en Firestore no afectan datos existentes y pueden ignorarse si el código se revierte.

## Dependencies

- Ninguna externa. Firebase Storage ya está configurado para comprobantes.

## Success Criteria

- [ ] Se puede crear, listar y editar cuentas bancarias desde la UI
- [ ] Se pueden asociar extractos a una cuenta existente y verlos listados
- [ ] Los datos persisten en Firestore con actualización en tiempo real (onSnapshot)
- [ ] La navegación entre tabs existentes no se ve afectada
- [ ] `npm test` y `npm run lint` pasan sin errores
