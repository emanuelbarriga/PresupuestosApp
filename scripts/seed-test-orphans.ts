#!/usr/bin/env tsx
/**
 * seed-test-orphans.ts
 *
 * Crea datos de prueba para verificar fix-orphan-movimientos.ts
 *
 * Uso: FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/seed-test-orphans.ts
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';

const app = initializeApp({ projectId: 'planningsaman-3cf7e' }, 'seed-orphan-test');
const db = getFirestore(app);
db.settings({ host: 'localhost:8081', ssl: false });

const COMPANY_ID = 'test-orphan-company';

async function seed() {
  console.log('🧹 Limpiando datos anteriores...');
  // Clean existing
  const existing = await db.collection('companies').doc(COMPANY_ID).collection('ejecuciones').get();
  await Promise.all(existing.docs.map(d => d.ref.delete()));

  // Clean movimientos
  const extractosSnap = await db.collection('companies').doc(COMPANY_ID).collection('cuentas').doc('cuenta-001').collection('extractos').get();
  for (const ext of extractosSnap.docs) {
    const movs = await ext.ref.collection('movimientos').get();
    await Promise.all(movs.docs.map(d => d.ref.delete()));
    await ext.ref.delete();
  }

  // ── Crear extracto con movimientos ──
  console.log('📄 Creando extracto y movimientos...');
  const extractoRef = db
    .collection('companies').doc(COMPANY_ID)
    .collection('cuentas').doc('cuenta-001')
    .collection('extractos').doc('extracto-2025-01');

  await extractoRef.set({
    accountId: 'cuenta-001',
    mes: 'Enero',
    anio: 2025,
    saldoInicial: 1000000,
    saldoFinal: 800000,
    estado: 'Completado',
    uploadedAt: new Date().toISOString(),
  });

  // Movimientos: 2 sin convertir (los "huérfanos") + 1 ya convertido
  const movimientos = [
    {
      fecha: '2025-01-10',
      descripcion: 'Pago proveedor servicios',
      debito: 150000,
      credito: 0,
      saldo: 850000,
      moneda: 'COP',
      ordinal: 1,
      bancoOrigen: 'Bancolombia',
      convertido: true,
      _ejecucionId: 'ejecucion-vieja-001',
    },
    {
      fecha: '2025-01-15',
      descripcion: 'Honorarios consultoría',
      debito: 200000,
      credito: 0,
      saldo: 650000,
      moneda: 'COP',
      ordinal: 2,
      bancoOrigen: 'Bancolombia',
      // SIN convertido — este debería matchear
    },
    {
      fecha: '2025-01-20',
      descripcion: 'Transferencia ingresos',
      debito: 0,
      credito: 500000,
      saldo: 1150000,
      moneda: 'COP',
      ordinal: 3,
      bancoOrigen: 'Bancolombia',
      // SIN convertido — este también debería matchear
    },
  ];

  for (const mov of movimientos) {
    await extractoRef.collection('movimientos').add({
      ...mov,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // ── Crear ejecuciones "huérfanas" (creadas manualmente, sin marcar movimientos) ──
  console.log('📝 Creando ejecuciones huérfanas...');

  const ejecuciones = [
    {
      descripcion: 'Honorarios consultoría',
      projectId: 'proyecto-001',
      projectName: 'Proyecto Alpha',
      entityId: 'tercero-001',
      entityName: 'Carlos Pérez',
      entityType: 'provider',
      tipo: 'egreso',
      montoEjecutado: 200000,
      fechaEjecutado: '2025-01-15',
      cuentaId: 'cuenta-001',
      cuentaName: 'Bancolombia - Cta Corriente',
      comprobantes: [],
    },
    {
      descripcion: 'Transferencia ingresos',
      projectId: 'proyecto-001',
      projectName: 'Proyecto Alpha',
      entityId: 'tercero-002',
      entityName: 'Empresa X',
      entityType: 'client',
      tipo: 'ingreso',
      montoEjecutado: 500000,
      fechaEjecutado: '2025-01-20',
      cuentaId: 'cuenta-001',
      cuentaName: 'Bancolombia - Cta Corriente',
      comprobantes: [],
    },
    {
      descripcion: 'Gasto sin movimiento (no debe matchear)',
      projectId: 'proyecto-002',
      projectName: 'Proyecto Beta',
      entityId: '',
      entityName: 'Interno',
      entityType: 'interno',
      tipo: 'egreso',
      montoEjecutado: 999999,
      fechaEjecutado: '2025-02-01',
      cuentaId: 'cuenta-001',
      cuentaName: 'Bancolombia - Cta Corriente',
      comprobantes: [],
    },
    {
      descripcion: 'Ejecución sin cuenta (no debe procesarse)',
      projectId: 'proyecto-002',
      projectName: 'Proyecto Beta',
      entityId: '',
      entityName: 'Interno',
      entityType: 'interno',
      tipo: 'egreso',
      montoEjecutado: 50000,
      fechaEjecutado: '2025-01-25',
      comprobantes: [],
    },
  ];

  for (const ej of ejecuciones) {
    await db.collection('companies').doc(COMPANY_ID).collection('ejecuciones').add({
      ...ej,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  console.log(`✅ Datos de prueba creados en company: ${COMPANY_ID}`);
  console.log('   - 3 movimientos (1 convertido + 2 sin convertir)');
  console.log('   - 4 ejecuciones (2 deben matchear, 1 sin match, 1 sin cuenta)');
  console.log('');
  console.log('Corré: FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/fix-orphan-movimientos.ts');
}

seed().catch(console.error);
