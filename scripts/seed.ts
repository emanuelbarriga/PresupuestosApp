import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

// Override with a real Firebase Auth UID for your admin user:
//   npx tsx scripts/seed.ts --adminUid=abc123
const ADMIN_UID = process.argv.find(a => a.startsWith('--adminUid='))?.split('=')[1] ?? 'placeholder-admin-uid';

const serviceAccountPath = path.resolve(
  __dirname, '..',
  'planningsaman-3cf7e-firebase-adminsdk-fbsvc-2ddc38ebca.json',
);
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const companyIds = ['pacora', 'saman'];

const companies = [
  { id: 'pacora', name: 'Pácora' },
  { id: 'saman', name: 'Samán' },
];

const clients = [
  'Borondo', 'Riccardo', 'Nonstop Colombia', 'Nonstop México', 'Soncora',
];

const projects = [
  { name: 'DDTL', client: 'Borondo', estado: 'Cerrado' },
  { name: 'PCF', client: 'Riccardo', estado: 'En ejecución' },
  { name: 'MQM', client: 'Nonstop Colombia', estado: 'Cerrado' },
  { name: 'IPYD', client: 'Nonstop México', estado: 'En ejecución' },
  { name: 'HTLR', client: 'Nonstop México', estado: 'Negociación' },
  { name: 'PALF', client: 'Nonstop México', estado: 'Negociación' },
  { name: 'ASV', client: 'Nonstop México', estado: 'Negociación' },
  { name: 'Gastos Administrativos Samán', client: 'Interno', estado: 'Activo' },
  { name: 'Coordinación Pácora', client: 'Nonstop México', estado: 'Cerrado' },
  { name: 'D+I', client: 'Interno', estado: 'Activo' },
];

const providers = [
  'Giovanny Sabogal', 'Claudia Hurtado', 'Serge Ercey',
  'Luis Moreira', 'Juan Francisco', 'Juan Martín Rincón', 'Alexis Loaiza',
];

const transactions = [
  { descripcion: 'Anticipo Fase 1', proyectoAsignado: 'DDTL', clienteOProveedor: 'Borondo', tipo: 'ingreso', montoPresupuestado: 50000000, mesPresupuestado: 'Febrero', fechaPresupuestado: '2026-02', estadoProyecto: 'Activo', ejecuciones: [{ fechaEjecutado: '2026-02-15', montoEjecutado: 40000000 }, { fechaEjecutado: '2026-02-28', montoEjecutado: 2955658 }] },
  { descripcion: 'Pago Fase 2', proyectoAsignado: 'DDTL', clienteOProveedor: 'Borondo', tipo: 'ingreso', montoPresupuestado: 45000000, mesPresupuestado: 'Mayo', fechaPresupuestado: '2026-05', estadoProyecto: 'Activo', ejecuciones: [{ fechaEjecutado: '2026-05-10', montoEjecutado: 46658570 }] },
  { descripcion: 'Costos Operativos Q1', proyectoAsignado: 'Gastos Administrativos Samán', clienteOProveedor: 'Interno', tipo: 'egreso', montoPresupuestado: 20000000, mesPresupuestado: 'Enero', fechaPresupuestado: '2026-01', estadoProyecto: 'Activo', ejecuciones: [{ fechaEjecutado: '2026-01-15', montoEjecutado: 10000000 }, { fechaEjecutado: '2026-01-30', montoEjecutado: 10500000 }] },
  { descripcion: 'Producción Audiovisual', proyectoAsignado: 'Coordinación Pácora', clienteOProveedor: 'Nonstop México', tipo: 'ingreso', montoPresupuestado: 120000000, mesPresupuestado: 'Marzo', fechaPresupuestado: '2026-03', estadoProyecto: 'Cerrado', ejecuciones: [{ fechaEjecutado: '2026-03-05', montoEjecutado: 60000000 }, { fechaEjecutado: '2026-03-25', montoEjecutado: 60000000 }] },
  { descripcion: 'Licencias Software', proyectoAsignado: 'D+I', clienteOProveedor: 'Interno', tipo: 'egreso', montoPresupuestado: 15000000, mesPresupuestado: 'Abril', fechaPresupuestado: '2026-04', estadoProyecto: 'Negociación', ejecuciones: [] },
  { descripcion: 'Consultoría Estratégica', proyectoAsignado: 'PCF', clienteOProveedor: 'Borondo', tipo: 'egreso', montoPresupuestado: 30000000, mesPresupuestado: 'Febrero', fechaPresupuestado: '2026-02', estadoProyecto: 'Activo', ejecuciones: [{ fechaEjecutado: '2026-02-20', montoEjecutado: 28000000 }] },
  { descripcion: 'Implementación CRM', proyectoAsignado: 'HTLR', clienteOProveedor: 'Nonstop México', tipo: 'ingreso', montoPresupuestado: 85000000, mesPresupuestado: 'Julio', fechaPresupuestado: '2026-07', estadoProyecto: 'Negociación', ejecuciones: [{ fechaEjecutado: '2026-07-10', montoEjecutado: 20000000 }] },
  { descripcion: 'Soporte TI Anual', proyectoAsignado: 'D+I', clienteOProveedor: 'Interno', tipo: 'egreso', montoPresupuestado: 5000000, mesPresupuestado: 'Enero', fechaPresupuestado: '2026-01', estadoProyecto: 'Activo', ejecuciones: [{ fechaEjecutado: '2026-01-05', montoEjecutado: 5000000 }] },
];

// ── Default settings per company ──
const defaultSettings = {
  stateProject: [
    { name: 'Activo', color: '#22c55e', order: 0 },
    { name: 'Cerrado', color: '#6b7280', order: 1 },
    { name: 'Negociación', color: '#f59e0b', order: 2 },
    { name: 'En ejecución', color: '#3b82f6', order: 3 },
    { name: 'Cancelado', color: '#ef4444', order: 4 },
  ],
  tipoProyectos: [
    { name: 'Fijo', color: '#8b5cf6', order: 0 },
    { name: 'Por horas', color: '#ec4899', order: 1 },
  ],
  unidades: [
    { name: 'Unidad', color: '#6366f1', order: 0 },
    { name: 'Horas', color: '#14b8a6', order: 1 },
    { name: 'Días', color: '#f97316', order: 2 },
    { name: 'Meses', color: '#06b6d4', order: 3 },
  ],
  tipoComprobante: [
    { name: 'Factura', color: '#6366f1', order: 0 },
    { name: 'Recibo', color: '#22c55e', order: 1 },
    { name: 'Transferencia', color: '#f59e0b', order: 2 },
    { name: 'Efectivo', color: '#06b6d4', order: 3 },
  ],
};

async function seed() {
  console.log('Seeding companies...');
  for (const c of companies) {
    await db.collection('companies').doc(c.id).set({ name: c.name, createdAt: new Date().toISOString() });
    console.log(`  ✓ Company "${c.name}" created/updated`);
  }

  for (const cid of companyIds) {
    console.log(`\n${cid}:`);

    // ── Clients ──
    for (const name of clients) {
      await db.collection('companies').doc(cid).collection('clients').doc(name.toLowerCase().replace(/[^a-z0-9]/g, '-')).set({ name });
    }
    console.log(`  ✓ ${clients.length} clients`);

    // ── Projects ──
    for (const p of projects) {
      await db.collection('companies').doc(cid).collection('projects').doc(p.name.toLowerCase().replace(/[^a-z0-9]/g, '-')).set({ name: p.name, clientName: p.client, estado: p.estado });
    }
    console.log(`  ✓ ${projects.length} projects`);

    // ── Providers ──
    for (const name of providers) {
      await db.collection('companies').doc(cid).collection('providers').doc(name.toLowerCase().replace(/[^a-z0-9]/g, '-')).set({ name });
    }
    console.log(`  ✓ ${providers.length} providers`);

    // ── Transactions ──
    for (const tx of transactions) {
      await db.collection('companies').doc(cid).collection('transactions').add({ ...tx, createdAt: new Date().toISOString() });
    }
    console.log(`  ✓ ${transactions.length} transactions`);

    // ── Settings (company-scoped) ──
    await db.collection('companies').doc(cid).collection('settings').doc('categorias').set(defaultSettings);
    console.log(`  ✓ Settings categorias`);

    // ── Admin user (placeholder) ──
    await db.collection('companies').doc(cid).collection('users').doc(ADMIN_UID).set({
      email: 'admin@example.com',
      role: 'admin',
      joinedAt: new Date().toISOString(),
    });
    console.log(`  ✓ Admin user (${ADMIN_UID})`);
  }

  // ── Also keep global settings for backward compatibility during migration ──
  // TODO: Remove after migration to company-scoped settings is complete
  await db.collection('settings').doc('categorias').set(defaultSettings);
  console.log('\n  ✓ Global settings (transitional)');

  console.log('\nSeed complete!');
  process.exit(0);
}

seed().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
