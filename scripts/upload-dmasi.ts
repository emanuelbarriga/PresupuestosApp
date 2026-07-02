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
  // Felipe Burbano - cuota principal
  { descripcion: 'Felipe Burbano Cuota Principal Junio', proyectoAsignado: 'D+I', clienteOProveedor: 'Felipe Burbano', tipo: 'egreso', montoPresupuestado: 3500000, mesPresupuestado: 'Junio', fechaPresupuestado: '2026-06', estadoProyecto: 'Activo' },
  { descripcion: 'Felipe Burbano Cuota Principal Julio', proyectoAsignado: 'D+I', clienteOProveedor: 'Felipe Burbano', tipo: 'egreso', montoPresupuestado: 2333333, mesPresupuestado: 'Julio', fechaPresupuestado: '2026-07', estadoProyecto: 'Activo' },
  { descripcion: 'Felipe Burbano Cuota Principal Agosto', proyectoAsignado: 'D+I', clienteOProveedor: 'Felipe Burbano', tipo: 'egreso', montoPresupuestado: 2333333, mesPresupuestado: 'Agosto', fechaPresupuestado: '2026-08', estadoProyecto: 'Activo' },
  { descripcion: 'Felipe Burbano Cuota Principal Septiembre', proyectoAsignado: 'D+I', clienteOProveedor: 'Felipe Burbano', tipo: 'egreso', montoPresupuestado: 2333333, mesPresupuestado: 'Septiembre', fechaPresupuestado: '2026-09', estadoProyecto: 'Activo' },
  { descripcion: 'Felipe Burbano Cuota Principal Octubre', proyectoAsignado: 'D+I', clienteOProveedor: 'Felipe Burbano', tipo: 'egreso', montoPresupuestado: 3500000, mesPresupuestado: 'Octubre', fechaPresupuestado: '2026-10', estadoProyecto: 'Activo' },
  { descripcion: 'Felipe Burbano Cuota Principal Noviembre', proyectoAsignado: 'D+I', clienteOProveedor: 'Felipe Burbano', tipo: 'egreso', montoPresupuestado: 3500000, mesPresupuestado: 'Noviembre', fechaPresupuestado: '2026-11', estadoProyecto: 'Activo' },
  { descripcion: 'Felipe Burbano Cuota Principal Diciembre', proyectoAsignado: 'D+I', clienteOProveedor: 'Felipe Burbano', tipo: 'egreso', montoPresupuestado: 3500000, mesPresupuestado: 'Diciembre', fechaPresupuestado: '2026-12', estadoProyecto: 'Activo' },
  // Felipe Burbano - cuota secundaria
  { descripcion: 'Felipe Burbano Cuota Secundaria Junio', proyectoAsignado: 'D+I', clienteOProveedor: 'Felipe Burbano', tipo: 'egreso', montoPresupuestado: 500000, mesPresupuestado: 'Junio', fechaPresupuestado: '2026-06', estadoProyecto: 'Activo' },
  { descripcion: 'Felipe Burbano Cuota Secundaria Julio', proyectoAsignado: 'D+I', clienteOProveedor: 'Felipe Burbano', tipo: 'egreso', montoPresupuestado: 500000, mesPresupuestado: 'Julio', fechaPresupuestado: '2026-07', estadoProyecto: 'Activo' },
  { descripcion: 'Felipe Burbano Cuota Secundaria Agosto', proyectoAsignado: 'D+I', clienteOProveedor: 'Felipe Burbano', tipo: 'egreso', montoPresupuestado: 500000, mesPresupuestado: 'Agosto', fechaPresupuestado: '2026-08', estadoProyecto: 'Activo' },
  { descripcion: 'Felipe Burbano Cuota Secundaria Septiembre', proyectoAsignado: 'D+I', clienteOProveedor: 'Felipe Burbano', tipo: 'egreso', montoPresupuestado: 500000, mesPresupuestado: 'Septiembre', fechaPresupuestado: '2026-09', estadoProyecto: 'Activo' },
  { descripcion: 'Felipe Burbano Cuota Secundaria Octubre', proyectoAsignado: 'D+I', clienteOProveedor: 'Felipe Burbano', tipo: 'egreso', montoPresupuestado: 500000, mesPresupuestado: 'Octubre', fechaPresupuestado: '2026-10', estadoProyecto: 'Activo' },
  { descripcion: 'Felipe Burbano Cuota Secundaria Noviembre', proyectoAsignado: 'D+I', clienteOProveedor: 'Felipe Burbano', tipo: 'egreso', montoPresupuestado: 500000, mesPresupuestado: 'Noviembre', fechaPresupuestado: '2026-11', estadoProyecto: 'Activo' },
  { descripcion: 'Felipe Burbano Cuota Secundaria Diciembre', proyectoAsignado: 'D+I', clienteOProveedor: 'Felipe Burbano', tipo: 'egreso', montoPresupuestado: 500000, mesPresupuestado: 'Diciembre', fechaPresupuestado: '2026-12', estadoProyecto: 'Activo' },
];

const ejecuciones = [
  { descripcion: 'Gasto ejecutado Felipe Burbano Junio (1)', proyectoAsignado: 'D+I', clienteOProveedor: 'Felipe Burbano', tipo: 'egreso', montoEjecutado: 3500000, fechaEjecutado: '2026-06-15' },
  { descripcion: 'Gasto ejecutado Felipe Burbano Junio (2)', proyectoAsignado: 'D+I', clienteOProveedor: 'Felipe Burbano', tipo: 'egreso', montoEjecutado: 500000, fechaEjecutado: '2026-06-20' },
];

async function upload() {
  console.log('Uploading D+I expenses to Saman...');

  await db.collection('providers').doc('felipe-burbano').set({ name: 'Felipe Burbano' });
  console.log('  ✓ Added provider: Felipe Burbano');

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

  console.log('\nD+I upload complete!');
  process.exit(0);
}

upload().catch((err) => { console.error('Upload failed:', err); process.exit(1); });
