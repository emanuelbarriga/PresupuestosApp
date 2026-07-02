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
  // Ingresos Proyectados
  { descripcion: 'Ingreso DDTL Febrero', proyectoAsignado: 'DDTL', clienteOProveedor: 'Borondo', tipo: 'ingreso', montoPresupuestado: 40000000, mesPresupuestado: 'Febrero', fechaPresupuestado: '2026-02', estadoProyecto: 'Cerrado' },
  { descripcion: 'Ingreso DDTL Junio', proyectoAsignado: 'DDTL', clienteOProveedor: 'Borondo', tipo: 'ingreso', montoPresupuestado: 40000000, mesPresupuestado: 'Junio', fechaPresupuestado: '2026-06', estadoProyecto: 'Cerrado' },
  { descripcion: 'Ingreso DDTL Julio', proyectoAsignado: 'DDTL', clienteOProveedor: 'Borondo', tipo: 'ingreso', montoPresupuestado: 3000000, mesPresupuestado: 'Julio', fechaPresupuestado: '2026-07', estadoProyecto: 'Cerrado' },
  // Gastos Presupuestados
  { descripcion: 'Gasto Claudia Hurtado Abril', proyectoAsignado: 'DDTL', clienteOProveedor: 'Claudia Hurtado', tipo: 'egreso', montoPresupuestado: 3700000, mesPresupuestado: 'Abril', fechaPresupuestado: '2026-04', estadoProyecto: 'Cerrado' },
  { descripcion: 'Gasto Claudia Hurtado Mayo', proyectoAsignado: 'DDTL', clienteOProveedor: 'Claudia Hurtado', tipo: 'egreso', montoPresupuestado: 4300000, mesPresupuestado: 'Mayo', fechaPresupuestado: '2026-05', estadoProyecto: 'Cerrado' },
  { descripcion: 'Gasto Claudia Hurtado Junio', proyectoAsignado: 'DDTL', clienteOProveedor: 'Claudia Hurtado', tipo: 'egreso', montoPresupuestado: 2200000, mesPresupuestado: 'Junio', fechaPresupuestado: '2026-06', estadoProyecto: 'Cerrado' },
  { descripcion: 'Gasto Serge Ercey Abril', proyectoAsignado: 'DDTL', clienteOProveedor: 'Serge Ercey', tipo: 'egreso', montoPresupuestado: 1500000, mesPresupuestado: 'Abril', fechaPresupuestado: '2026-04', estadoProyecto: 'Cerrado' },
  { descripcion: 'Gasto Serge Ercey Mayo', proyectoAsignado: 'DDTL', clienteOProveedor: 'Serge Ercey', tipo: 'egreso', montoPresupuestado: 900000, mesPresupuestado: 'Mayo', fechaPresupuestado: '2026-05', estadoProyecto: 'Cerrado' },
  { descripcion: 'Gasto Serge Ercey Junio', proyectoAsignado: 'DDTL', clienteOProveedor: 'Serge Ercey', tipo: 'egreso', montoPresupuestado: 3500000, mesPresupuestado: 'Junio', fechaPresupuestado: '2026-06', estadoProyecto: 'Cerrado' },
  { descripcion: 'Gasto Serge Ercey Julio', proyectoAsignado: 'DDTL', clienteOProveedor: 'Serge Ercey', tipo: 'egreso', montoPresupuestado: 2500000, mesPresupuestado: 'Julio', fechaPresupuestado: '2026-07', estadoProyecto: 'Cerrado' },
];

const ejecuciones = [
  // Ingresos Ejecutados
  { descripcion: 'Ingreso ejecutado DDTL Febrero', proyectoAsignado: 'DDTL', clienteOProveedor: 'Borondo', tipo: 'ingreso', montoEjecutado: 42955658, fechaEjecutado: '2026-02-15' },
  { descripcion: 'Ingreso ejecutado DDTL Junio', proyectoAsignado: 'DDTL', clienteOProveedor: 'Borondo', tipo: 'ingreso', montoEjecutado: 46658570, fechaEjecutado: '2026-06-15' },
  // Gastos Ejecutados - Claudia Hurtado
  { descripcion: 'Gasto ejecutado Claudia Hurtado Abril', proyectoAsignado: 'DDTL', clienteOProveedor: 'Claudia Hurtado', tipo: 'egreso', montoEjecutado: 3700000, fechaEjecutado: '2026-04-15' },
  { descripcion: 'Gasto ejecutado Claudia Hurtado Mayo', proyectoAsignado: 'DDTL', clienteOProveedor: 'Claudia Hurtado', tipo: 'egreso', montoEjecutado: 3301984, fechaEjecutado: '2026-05-15' },
  { descripcion: 'Gasto ejecutado Claudia Hurtado Junio', proyectoAsignado: 'DDTL', clienteOProveedor: 'Claudia Hurtado', tipo: 'egreso', montoEjecutado: 1700992, fechaEjecutado: '2026-06-15' },
  { descripcion: 'Gasto ejecutado Claudia Hurtado Abril (2)', proyectoAsignado: 'DDTL', clienteOProveedor: 'Claudia Hurtado', tipo: 'egreso', montoEjecutado: 499008, fechaEjecutado: '2026-04-20' },
  { descripcion: 'Gasto ejecutado Claudia Hurtado Mayo (2)', proyectoAsignado: 'DDTL', clienteOProveedor: 'Claudia Hurtado', tipo: 'egreso', montoEjecutado: 499008, fechaEjecutado: '2026-05-20' },
  { descripcion: 'Gasto ejecutado Claudia Hurtado Junio (2)', proyectoAsignado: 'DDTL', clienteOProveedor: 'Claudia Hurtado', tipo: 'egreso', montoEjecutado: 499008, fechaEjecutado: '2026-06-20' },
  // Gastos Ejecutados - Serge Ercey
  { descripcion: 'Gasto ejecutado Serge Ercey Mayo', proyectoAsignado: 'DDTL', clienteOProveedor: 'Serge Ercey', tipo: 'egreso', montoEjecutado: 1500000, fechaEjecutado: '2026-05-15' },
  { descripcion: 'Gasto ejecutado Serge Ercey Junio', proyectoAsignado: 'DDTL', clienteOProveedor: 'Serge Ercey', tipo: 'egreso', montoEjecutado: 4400000, fechaEjecutado: '2026-06-15' },
];

async function uploadDDTL() {
  console.log('Uploading DDTL data to Saman...');

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

  console.log('\nDDTL upload complete!');
  process.exit(0);
}

uploadDDTL().catch((err) => { console.error('Upload failed:', err); process.exit(1); });
