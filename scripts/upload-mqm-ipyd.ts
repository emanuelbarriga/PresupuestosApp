import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

const serviceAccountPath = path.resolve(
  __dirname, '..',
  'planningsaman-3cf7e-firebase-adminsdk-fbsvc-2ddc38ebca.json',
);
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const COMPANY_ID = 'saman';

const budgets = [
  // === MQM ===
  { descripcion: 'Ingreso MQM Junio', proyectoAsignado: 'MQM', clienteOProveedor: 'Nonstop Colombia', tipo: 'ingreso', montoPresupuestado: 8000000, mesPresupuestado: 'Junio', fechaPresupuestado: '2026-06', estadoProyecto: 'Abierto' },
  { descripcion: 'Gasto Sabo Junio', proyectoAsignado: 'MQM', clienteOProveedor: 'Giovanny Sabogal', tipo: 'egreso', montoPresupuestado: 1050000, mesPresupuestado: 'Junio', fechaPresupuestado: '2026-06', estadoProyecto: 'Abierto' },
  { descripcion: 'Gasto EvoLink Abril', proyectoAsignado: 'MQM', clienteOProveedor: 'EvoLink', tipo: 'egreso', montoPresupuestado: 35000, mesPresupuestado: 'Abril', fechaPresupuestado: '2026-04', estadoProyecto: 'Abierto' },
  { descripcion: 'Gasto EvoLink Mayo', proyectoAsignado: 'MQM', clienteOProveedor: 'EvoLink', tipo: 'egreso', montoPresupuestado: 210000, mesPresupuestado: 'Mayo', fechaPresupuestado: '2026-05', estadoProyecto: 'Abierto' },
  // === IPYD ===
  { descripcion: 'Ingreso IPYD Julio', proyectoAsignado: 'IPYD', clienteOProveedor: 'Nonstop México', tipo: 'ingreso', montoPresupuestado: 15000000, mesPresupuestado: 'Julio', fechaPresupuestado: '2026-07', estadoProyecto: 'Activo' },
  { descripcion: 'Gasto Claudia Hurtado Julio', proyectoAsignado: 'IPYD', clienteOProveedor: 'Claudia Hurtado', tipo: 'egreso', montoPresupuestado: 1500000, mesPresupuestado: 'Julio', fechaPresupuestado: '2026-07', estadoProyecto: 'Activo' },
  { descripcion: 'Gasto Serge Ercey Agosto', proyectoAsignado: 'IPYD', clienteOProveedor: 'Serge Ercey', tipo: 'egreso', montoPresupuestado: 600000, mesPresupuestado: 'Agosto', fechaPresupuestado: '2026-08', estadoProyecto: 'Activo' },
];

const ejecuciones = [
  // === MQM ===
  { descripcion: 'Gasto ejecutado Sabo Junio', proyectoAsignado: 'MQM', clienteOProveedor: 'Giovanny Sabogal', tipo: 'egreso', montoEjecutado: 1050000, fechaEjecutado: '2026-06-15' },
  { descripcion: 'Gasto ejecutado EvoLink Abril', proyectoAsignado: 'MQM', clienteOProveedor: 'EvoLink', tipo: 'egreso', montoEjecutado: 35000, fechaEjecutado: '2026-04-15' },
  { descripcion: 'Gasto ejecutado EvoLink Mayo', proyectoAsignado: 'MQM', clienteOProveedor: 'EvoLink', tipo: 'egreso', montoEjecutado: 210000, fechaEjecutado: '2026-05-15' },
];

async function upload() {
  console.log('Uploading MQM + IPYD data to Saman...');

  // Add EvoLink provider (not in existing list)
  await db.collection('providers').doc('evolink').set({ name: 'EvoLink' });
  console.log('  ✓ Added provider: EvoLink');

  const budgetsRef = db.collection('companies').doc(COMPANY_ID).collection('budgets');
  for (const b of budgets) {
    await budgetsRef.add({ ...b, createdAt: new Date().toISOString() });
  }
  console.log(`  ✓ ${budgets.length} budgets`);

  const ejecucionesRef = db.collection('companies').doc(COMPANY_ID).collection('ejecuciones');
  for (const e of ejecuciones) {
    await ejecucionesRef.add({ ...e, createdAt: new Date().toISOString() });
  }
  console.log(`  ✓ ${ejecuciones.length} ejecuciones`);

  console.log('\nUpload complete!');
  process.exit(0);
}

upload().catch((err) => { console.error('Upload failed:', err); process.exit(1); });
