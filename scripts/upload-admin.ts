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

const MONTHS = [
  { name: 'Enero', key: '2026-01' },
  { name: 'Febrero', key: '2026-02' },
  { name: 'Marzo', key: '2026-03' },
  { name: 'Abril', key: '2026-04' },
  { name: 'Mayo', key: '2026-05' },
  { name: 'Junio', key: '2026-06' },
  { name: 'Julio', key: '2026-07' },
  { name: 'Agosto', key: '2026-08' },
  { name: 'Septiembre', key: '2026-09' },
  { name: 'Octubre', key: '2026-10' },
  { name: 'Noviembre', key: '2026-11' },
  { name: 'Diciembre', key: '2026-12' },
];

const expenses = [
  { descripcion: 'Emanuel Salario', clienteOProveedor: 'Emanuel', monto: 3422400 },
  { descripcion: 'Seguridad Social Emanuel', clienteOProveedor: 'Emanuel', monto: 912300 },
  { descripcion: 'Outsourcing Contable', clienteOProveedor: 'Pácora', monto: 750000 },
];

async function upload() {
  console.log('Uploading Gastos Administrativos Samán...');

  const budgetsRef = db.collection('companies').doc(COMPANY_ID).collection('budgets');
  const ejecucionesRef = db.collection('companies').doc(COMPANY_ID).collection('ejecuciones');

  let budgetCount = 0;
  let ejecucionCount = 0;

  for (const exp of expenses) {
    // 12 monthly budgets
    for (const m of MONTHS) {
      await budgetsRef.add({
        descripcion: exp.descripcion,
        proyectoAsignado: 'Gastos Administrativos Samán',
        clienteOProveedor: exp.clienteOProveedor,
        tipo: 'egreso',
        montoPresupuestado: exp.monto,
        mesPresupuestado: m.name,
        fechaPresupuestado: m.key,
        estadoProyecto: 'Activo',
        createdAt: new Date().toISOString(),
      });
      budgetCount++;
    }

    // Ejecutados Enero-Junio
    for (let i = 0; i < 6; i++) {
      await ejecucionesRef.add({
        descripcion: `Gasto ejecutado ${exp.descripcion} ${MONTHS[i].name}`,
        proyectoAsignado: 'Gastos Administrativos Samán',
        clienteOProveedor: exp.clienteOProveedor,
        tipo: 'egreso',
        montoEjecutado: exp.monto,
        fechaEjecutado: `${MONTHS[i].key}-15`,
        createdAt: new Date().toISOString(),
      });
      ejecucionCount++;
    }
  }

  console.log(`  ✓ ${budgetCount} budgets (3 x 12 meses)`);
  console.log(`  ✓ ${ejecucionCount} ejecuciones (3 x 6 meses)`);
  console.log('\nUpload complete!');
  process.exit(0);
}

upload().catch((err) => { console.error('Upload failed:', err); process.exit(1); });
