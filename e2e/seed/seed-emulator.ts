/**
 * Seed test data into the Firebase Emulator for E2E tests.
 *
 * Usage: FIRESTORE_EMULATOR_HOST=localhost:8081 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx tsx e2e/seed/seed-emulator.ts
 *
 * Creates:
 * - A test user (test@ejemplo.com / test123)
 * - A test company with test data
 * - 2 projects, 2 terceros (1 cliente + 1 proveedor)
 * - Budgets and ejecuciones for the current year
 * - A bank account
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// ── Config ──

const TEST_COMPANY_ID = 'test-company-001';
const TEST_USER_UID = 'test-user-001';
const TEST_USER_EMAIL = 'test@ejemplo.com';
const CURRENT_YEAR = new Date().getFullYear();
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ── Initialize Admin SDK ──

// For emulator, use environment variable based auth
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';

const adminApp = initializeApp({
  projectId: 'planningsaman-3cf7e',
}, 'e2e-seed');
const db = getFirestore(adminApp);
db.settings({ host: 'localhost:8081', ssl: false });

// ── Helpers ──

const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '-');
const randomId = () => Math.random().toString(36).substring(2, 10);
const formatCOP = (n: number) => n;

async function seed() {
  console.log('🧹 Limpiando datos existentes...');
  // Clean existing data in the test company
  const collections = ['members', 'projects', 'budgets', 'ejecuciones', 'cuentas', 'extractos', 'settings', 'terceros', 'clients', 'providers', 'companies'];
  for (const col of collections) {
    try {
      const snap = await db.collection('companies').doc(TEST_COMPANY_ID).collection(col).get();
      const deletes = snap.docs.map(d => d.ref.delete());
      await Promise.all(deletes);
    } catch {}
  }
  // Also clean root-level companies collection
  const companiesSnap = await db.collection('companies').get();
  if (!companiesSnap.empty) {
    // We'll just clear members subcollection on our test company
  }

  console.log('🌱 Sembrando datos de prueba...\n');

  // ── 1. Create company ──
  const companyRef = db.collection('companies').doc(TEST_COMPANY_ID);
  await companyRef.set({
    name: 'Constructora Test S.A.S.',
    createdAt: new Date().toISOString(),
    createdBy: TEST_USER_UID,
  });

  // ── 2. Member ──
  await companyRef.collection('members').doc(TEST_USER_UID).set({
    email: TEST_USER_EMAIL,
    role: 'admin',
    joinedAt: new Date().toISOString(),
  });

  // ── 3. Settings ──
  await companyRef.collection('settings').doc('categorias').set({
    stateProject: [
      { name: 'Activo', color: '#22c55e', order: 0 },
      { name: 'En pausa', color: '#f59e0b', order: 1 },
      { name: 'Finalizado', color: '#3b82f6', order: 2 },
      { name: 'Cancelado', color: '#ef4444', order: 3 },
    ],
    tipoProyectos: [
      { name: 'Construcción', color: '#6366f1', order: 0 },
      { name: 'Mantenimiento', color: '#8b5cf6', order: 1 },
      { name: 'Consultoría', color: '#ec4899', order: 2 },
    ],
    unidades: [
      { name: 'm²', color: '#14b8a6', order: 0 },
      { name: 'unidad', color: '#f97316', order: 1 },
      { name: 'ml', color: '#06b6d4', order: 2 },
    ],
    tipoComprobante: [
      { name: 'factura', color: '#6366f1', order: 0 },
      { name: 'soporte', color: '#8b5cf6', order: 1 },
      { name: 'pago', color: '#22c55e', order: 2 },
      { name: 'cuenta de cobro', color: '#f59e0b', order: 3 },
    ],
  });

  // ── 4. Terceros ──
  const tercero1Ref = companyRef.collection('terceros').doc(randomId());
  await tercero1Ref.set({
    name: 'María González',
    apodo: 'Mari',
    tipo: 'cliente',
    naturaleza: 'Persona Natural',
    documento: 'CC',
    numeroDocumento: '123456789',
    lugar: 'Bogotá',
  });

  const tercero2Ref = companyRef.collection('terceros').doc(randomId());
  await tercero2Ref.set({
    name: 'Materiales S.A.',
    apodo: '',
    tipo: 'proveedor',
    naturaleza: 'Persona Jurídica',
    documento: 'NIT',
    numeroDocumento: '900123456-7',
    lugar: 'Medellín',
  });

  // ── 5. Projects ──
  const project1Id = normalize('Edificio Plaza Central');
  const project2Id = normalize('Casa Futuro');

  await companyRef.collection('projects').doc(project1Id).set({
    name: project1Id,
    descripcion: 'Edificio Plaza Central',
    clientId: tercero1Ref.id,
    clientName: 'María González',
    tipoProyectos: 'Construcción',
    cantidad: 500,
    unidades: 'm²',
    estado: 'Activo',
    soloEgresos: false,
  });

  await companyRef.collection('projects').doc(project2Id).set({
    name: project2Id,
    descripcion: 'Casa Futuro',
    clientId: tercero1Ref.id,
    clientName: 'María González',
    tipoProyectos: 'Construcción',
    cantidad: 200,
    unidades: 'm²',
    estado: 'En pausa',
    soloEgresos: false,
  });

  // ── 6. Budgets ──
  for (let monthIdx = 0; monthIdx < 3; monthIdx++) {
    // Budget ingreso - Plaza Central
    await companyRef.collection('budgets').add({
      tipo: 'ingreso',
      projectId: project1Id,
      projectName: project1Id,
      entityId: tercero1Ref.id,
      entityName: 'María González',
      entityType: 'client',
      descripcion: `Pago cuota ${monthIdx + 1} - Edificio Plaza Central`,
      montoPresupuestado: 15000000 + (monthIdx * 500000),
      mesPresupuestado: MONTHS[monthIdx],
      fechaPresupuestado: `${CURRENT_YEAR}-${String(monthIdx + 1).padStart(2, '0')}`,
      tipoProyecto: 'Construcción',
      projectDisplay: 'Edificio Plaza Central',
      fechaCreacion: `${CURRENT_YEAR}-${String(monthIdx + 1).padStart(2, '0')}`,
    });

    // Budget egreso - Materiales
    await companyRef.collection('budgets').add({
      tipo: 'egreso',
      projectId: project1Id,
      projectName: project1Id,
      entityId: tercero2Ref.id,
      entityName: 'Materiales S.A.',
      entityType: 'provider',
      descripcion: `Materiales mes ${monthIdx + 1}`,
      montoPresupuestado: 5000000 + (monthIdx * 200000),
      mesPresupuestado: MONTHS[monthIdx],
      fechaPresupuestado: `${CURRENT_YEAR}-${String(monthIdx + 1).padStart(2, '0')}`,
      tipoProyecto: 'Construcción',
      projectDisplay: 'Edificio Plaza Central',
      fechaCreacion: `${CURRENT_YEAR}-${String(monthIdx + 1).padStart(2, '0')}`,
    });
  }

  // ── 7. Ejecuciones (for the first budget) ──
  const budgetsSnap = await companyRef.collection('budgets').limit(2).get();
  const budgetDocs = budgetsSnap.docs;

  if (budgetDocs.length >= 1) {
    const ejecucionRef = await companyRef.collection('ejecuciones').add({
      tipo: 'ingreso',
      projectId: project1Id,
      projectName: project1Id,
      entityId: tercero1Ref.id,
      entityName: 'María González',
      entityType: 'client',
      descripcion: 'Pago recibido Enero',
      montoEjecutado: 15000000,
      fechaEjecutado: `${CURRENT_YEAR}-01-15`,
      cuentaId: '',
      cuentaName: '',
      comprobantes: [],
    });

    // Link to budget
    await budgetDocs[0].ref.update({
      totalEjecutado: 15000000,
      linkedEjecuciones: [{ ejecucionId: ejecucionRef.id, monto: 15000000 }],
    });
  }

  // ── 8. Cuenta bancaria ──
  await companyRef.collection('cuentas').add({
    nombre: 'Corriente Principal',
    banco: 'Bancolombia',
    tipo: 'Corriente',
    numero: '123-456789-01',
    moneda: 'COP',
    saldoInicial: 50000000,
    saldoActual: 50000000,
  });

  console.log('✅ Seed completado.');
  console.log(`   Empresa: ${TEST_COMPANY_ID}`);
  console.log(`   Proyectos: ${project1Id}, ${project2Id}`);
  console.log(`   3 budgets de ingreso, 3 budgets de egreso`);
  console.log(`   1 ejecución vinculada`);
  console.log(`   1 cuenta bancaria`);
  console.log(`   2 terceros (1 cliente + 1 proveedor)`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error seeding:', err);
    process.exit(1);
  });
