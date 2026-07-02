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
  // HTLR
  { descripcion: 'Ingreso HTLR Agosto', proyectoAsignado: 'HTLR', clienteOProveedor: 'Nonstop México', tipo: 'ingreso', montoPresupuestado: 100000000, mesPresupuestado: 'Agosto', fechaPresupuestado: '2026-08', estadoProyecto: 'Negociación' },
  { descripcion: 'Ingreso HTLR Noviembre', proyectoAsignado: 'HTLR', clienteOProveedor: 'Nonstop México', tipo: 'ingreso', montoPresupuestado: 75000000, mesPresupuestado: 'Noviembre', fechaPresupuestado: '2026-11', estadoProyecto: 'Negociación' },
  // PALF
  { descripcion: 'Ingreso PALF Septiembre', proyectoAsignado: 'PALF', clienteOProveedor: 'Nonstop México', tipo: 'ingreso', montoPresupuestado: 20000000, mesPresupuestado: 'Septiembre', fechaPresupuestado: '2026-09', estadoProyecto: 'Negociación' },
  { descripcion: 'Ingreso PALF Noviembre', proyectoAsignado: 'PALF', clienteOProveedor: 'Nonstop México', tipo: 'ingreso', montoPresupuestado: 20000000, mesPresupuestado: 'Noviembre', fechaPresupuestado: '2026-11', estadoProyecto: 'Negociación' },
  // ASV
  { descripcion: 'Ingreso ASV Diciembre', proyectoAsignado: 'ASV', clienteOProveedor: 'Nonstop México', tipo: 'ingreso', montoPresupuestado: 30000000, mesPresupuestado: 'Diciembre', fechaPresupuestado: '2026-12', estadoProyecto: 'Negociación' },
];

async function upload() {
  console.log('Uploading HTLR, PALF, ASV incomes to Saman...');

  const budgetsRef = db.collection('companies').doc(COMPANY_ID).collection('budgets');
  for (const b of budgets) {
    await budgetsRef.add({ ...b, createdAt: new Date().toISOString() });
  }
  console.log(`  ✓ ${budgets.length} budgets`);

  console.log('\nUpload complete!');
  process.exit(0);
}

upload().catch((err) => { console.error('Upload failed:', err); process.exit(1); });
