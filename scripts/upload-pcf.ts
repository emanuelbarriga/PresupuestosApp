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
  // Ingresos Presupuestados
  { descripcion: 'Ingreso PCF Junio', proyectoAsignado: 'PCF', clienteOProveedor: 'Riccardo', tipo: 'ingreso', montoPresupuestado: 100000000, mesPresupuestado: 'Junio', fechaPresupuestado: '2026-06', estadoProyecto: 'En ejecución' },
  { descripcion: 'Ingreso PCF Agosto', proyectoAsignado: 'PCF', clienteOProveedor: 'Riccardo', tipo: 'ingreso', montoPresupuestado: 75000000, mesPresupuestado: 'Agosto', fechaPresupuestado: '2026-08', estadoProyecto: 'En ejecución' },
  { descripcion: 'Ingreso PCF Septiembre', proyectoAsignado: 'PCF', clienteOProveedor: 'Riccardo', tipo: 'ingreso', montoPresupuestado: 75000000, mesPresupuestado: 'Septiembre', fechaPresupuestado: '2026-09', estadoProyecto: 'En ejecución' },
  // Gastos Presupuestados - Alexis
  { descripcion: 'Gasto Alexis Mayo', proyectoAsignado: 'PCF', clienteOProveedor: 'Alexis Loaiza', tipo: 'egreso', montoPresupuestado: 2100000, mesPresupuestado: 'Mayo', fechaPresupuestado: '2026-05', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Alexis Junio', proyectoAsignado: 'PCF', clienteOProveedor: 'Alexis Loaiza', tipo: 'egreso', montoPresupuestado: 7000000, mesPresupuestado: 'Junio', fechaPresupuestado: '2026-06', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Alexis Julio', proyectoAsignado: 'PCF', clienteOProveedor: 'Alexis Loaiza', tipo: 'egreso', montoPresupuestado: 7000000, mesPresupuestado: 'Julio', fechaPresupuestado: '2026-07', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Alexis Agosto', proyectoAsignado: 'PCF', clienteOProveedor: 'Alexis Loaiza', tipo: 'egreso', montoPresupuestado: 7000000, mesPresupuestado: 'Agosto', fechaPresupuestado: '2026-08', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Alexis Septiembre', proyectoAsignado: 'PCF', clienteOProveedor: 'Alexis Loaiza', tipo: 'egreso', montoPresupuestado: 7000000, mesPresupuestado: 'Septiembre', fechaPresupuestado: '2026-09', estadoProyecto: 'En ejecución' },
  // Gastos Presupuestados - Sabo
  { descripcion: 'Gasto Sabo Mayo', proyectoAsignado: 'PCF', clienteOProveedor: 'Giovanny Sabogal', tipo: 'egreso', montoPresupuestado: 2625000, mesPresupuestado: 'Mayo', fechaPresupuestado: '2026-05', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Sabo Junio', proyectoAsignado: 'PCF', clienteOProveedor: 'Giovanny Sabogal', tipo: 'egreso', montoPresupuestado: 5250000, mesPresupuestado: 'Junio', fechaPresupuestado: '2026-06', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Sabo Julio', proyectoAsignado: 'PCF', clienteOProveedor: 'Giovanny Sabogal', tipo: 'egreso', montoPresupuestado: 5250000, mesPresupuestado: 'Julio', fechaPresupuestado: '2026-07', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Sabo Agosto', proyectoAsignado: 'PCF', clienteOProveedor: 'Giovanny Sabogal', tipo: 'egreso', montoPresupuestado: 5250000, mesPresupuestado: 'Agosto', fechaPresupuestado: '2026-08', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Sabo Septiembre', proyectoAsignado: 'PCF', clienteOProveedor: 'Giovanny Sabogal', tipo: 'egreso', montoPresupuestado: 5250000, mesPresupuestado: 'Septiembre', fechaPresupuestado: '2026-09', estadoProyecto: 'En ejecución' },
  // Gastos Presupuestados - Claudia Hurtado
  { descripcion: 'Gasto Claudia Hurtado Junio', proyectoAsignado: 'PCF', clienteOProveedor: 'Claudia Hurtado', tipo: 'egreso', montoPresupuestado: 2100000, mesPresupuestado: 'Junio', fechaPresupuestado: '2026-06', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Claudia Hurtado Julio', proyectoAsignado: 'PCF', clienteOProveedor: 'Claudia Hurtado', tipo: 'egreso', montoPresupuestado: 1500000, mesPresupuestado: 'Julio', fechaPresupuestado: '2026-07', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Claudia Hurtado Agosto', proyectoAsignado: 'PCF', clienteOProveedor: 'Claudia Hurtado', tipo: 'egreso', montoPresupuestado: 2500000, mesPresupuestado: 'Agosto', fechaPresupuestado: '2026-08', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Claudia Hurtado Septiembre', proyectoAsignado: 'PCF', clienteOProveedor: 'Claudia Hurtado', tipo: 'egreso', montoPresupuestado: 2500000, mesPresupuestado: 'Septiembre', fechaPresupuestado: '2026-09', estadoProyecto: 'En ejecución' },
  // Gastos Presupuestados - Serge Ercey
  { descripcion: 'Gasto Serge Ercey Julio', proyectoAsignado: 'PCF', clienteOProveedor: 'Serge Ercey', tipo: 'egreso', montoPresupuestado: 1000000, mesPresupuestado: 'Julio', fechaPresupuestado: '2026-07', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Serge Ercey Agosto', proyectoAsignado: 'PCF', clienteOProveedor: 'Serge Ercey', tipo: 'egreso', montoPresupuestado: 2000000, mesPresupuestado: 'Agosto', fechaPresupuestado: '2026-08', estadoProyecto: 'En ejecución' },
  // Gastos Presupuestados - Luis Moreira
  { descripcion: 'Gasto Luis Moreira Mayo', proyectoAsignado: 'PCF', clienteOProveedor: 'Luis Moreira', tipo: 'egreso', montoPresupuestado: 2100000, mesPresupuestado: 'Mayo', fechaPresupuestado: '2026-05', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Luis Moreira Junio', proyectoAsignado: 'PCF', clienteOProveedor: 'Luis Moreira', tipo: 'egreso', montoPresupuestado: 4200000, mesPresupuestado: 'Junio', fechaPresupuestado: '2026-06', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Luis Moreira Julio', proyectoAsignado: 'PCF', clienteOProveedor: 'Luis Moreira', tipo: 'egreso', montoPresupuestado: 4200000, mesPresupuestado: 'Julio', fechaPresupuestado: '2026-07', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Luis Moreira Agosto', proyectoAsignado: 'PCF', clienteOProveedor: 'Luis Moreira', tipo: 'egreso', montoPresupuestado: 4200000, mesPresupuestado: 'Agosto', fechaPresupuestado: '2026-08', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Luis Moreira Septiembre', proyectoAsignado: 'PCF', clienteOProveedor: 'Luis Moreira', tipo: 'egreso', montoPresupuestado: 4200000, mesPresupuestado: 'Septiembre', fechaPresupuestado: '2026-09', estadoProyecto: 'En ejecución' },
  // Gastos Presupuestados - Juan Francisco
  { descripcion: 'Gasto Juan Francisco Mayo', proyectoAsignado: 'PCF', clienteOProveedor: 'Juan Francisco', tipo: 'egreso', montoPresupuestado: 934500, mesPresupuestado: 'Mayo', fechaPresupuestado: '2026-05', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Juan Francisco Junio', proyectoAsignado: 'PCF', clienteOProveedor: 'Juan Francisco', tipo: 'egreso', montoPresupuestado: 2800000, mesPresupuestado: 'Junio', fechaPresupuestado: '2026-06', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Juan Francisco Julio', proyectoAsignado: 'PCF', clienteOProveedor: 'Juan Francisco', tipo: 'egreso', montoPresupuestado: 2800000, mesPresupuestado: 'Julio', fechaPresupuestado: '2026-07', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Juan Francisco Agosto', proyectoAsignado: 'PCF', clienteOProveedor: 'Juan Francisco', tipo: 'egreso', montoPresupuestado: 2800000, mesPresupuestado: 'Agosto', fechaPresupuestado: '2026-08', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Juan Francisco Septiembre', proyectoAsignado: 'PCF', clienteOProveedor: 'Juan Francisco', tipo: 'egreso', montoPresupuestado: 2800000, mesPresupuestado: 'Septiembre', fechaPresupuestado: '2026-09', estadoProyecto: 'En ejecución' },
  // Gastos Presupuestados - Juan Martín
  { descripcion: 'Gasto Juan Martín Junio', proyectoAsignado: 'PCF', clienteOProveedor: 'Juan Martín Rincón', tipo: 'egreso', montoPresupuestado: 1000000, mesPresupuestado: 'Junio', fechaPresupuestado: '2026-06', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Juan Martín Julio', proyectoAsignado: 'PCF', clienteOProveedor: 'Juan Martín Rincón', tipo: 'egreso', montoPresupuestado: 1000000, mesPresupuestado: 'Julio', fechaPresupuestado: '2026-07', estadoProyecto: 'En ejecución' },
  // Gastos Presupuestados - Granja de Render
  { descripcion: 'Gasto Granja de Render Junio', proyectoAsignado: 'PCF', clienteOProveedor: 'Granja de Render', tipo: 'egreso', montoPresupuestado: 700000, mesPresupuestado: 'Junio', fechaPresupuestado: '2026-06', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Granja de Render Agosto', proyectoAsignado: 'PCF', clienteOProveedor: 'Granja de Render', tipo: 'egreso', montoPresupuestado: 700000, mesPresupuestado: 'Agosto', fechaPresupuestado: '2026-08', estadoProyecto: 'En ejecución' },
  { descripcion: 'Gasto Granja de Render Septiembre', proyectoAsignado: 'PCF', clienteOProveedor: 'Granja de Render', tipo: 'egreso', montoPresupuestado: 700000, mesPresupuestado: 'Septiembre', fechaPresupuestado: '2026-09', estadoProyecto: 'En ejecución' },
];

const ejecuciones = [
  // Ingresos Ejecutados
  { descripcion: 'Ingreso ejecutado PCF Junio', proyectoAsignado: 'PCF', clienteOProveedor: 'Riccardo', tipo: 'ingreso', montoEjecutado: 103959000, fechaEjecutado: '2026-06-15' },
  // Gastos Ejecutados - Alexis
  { descripcion: 'Gasto ejecutado Alexis Mayo', proyectoAsignado: 'PCF', clienteOProveedor: 'Alexis Loaiza', tipo: 'egreso', montoEjecutado: 2100000, fechaEjecutado: '2026-05-15' },
  { descripcion: 'Gasto ejecutado Alexis Junio', proyectoAsignado: 'PCF', clienteOProveedor: 'Alexis Loaiza', tipo: 'egreso', montoEjecutado: 1050000, fechaEjecutado: '2026-06-15' },
  { descripcion: 'Gasto ejecutado Alexis Junio (2)', proyectoAsignado: 'PCF', clienteOProveedor: 'Alexis Loaiza', tipo: 'egreso', montoEjecutado: 5789079, fechaEjecutado: '2026-06-20' },
  // Gastos Ejecutados - Sabo
  { descripcion: 'Gasto ejecutado Sabo Mayo', proyectoAsignado: 'PCF', clienteOProveedor: 'Giovanny Sabogal', tipo: 'egreso', montoEjecutado: 2625000, fechaEjecutado: '2026-05-15' },
  { descripcion: 'Gasto ejecutado Sabo Junio', proyectoAsignado: 'PCF', clienteOProveedor: 'Giovanny Sabogal', tipo: 'egreso', montoEjecutado: 5102760, fechaEjecutado: '2026-06-15' },
  // Gastos Ejecutados - Claudia Hurtado
  { descripcion: 'Gasto ejecutado Claudia Hurtado Junio', proyectoAsignado: 'PCF', clienteOProveedor: 'Claudia Hurtado', tipo: 'egreso', montoEjecutado: 2100000, fechaEjecutado: '2026-06-15' },
  // Gastos Ejecutados - Luis Moreira
  { descripcion: 'Gasto ejecutado Luis Moreira Mayo', proyectoAsignado: 'PCF', clienteOProveedor: 'Luis Moreira', tipo: 'egreso', montoEjecutado: 2100000, fechaEjecutado: '2026-05-15' },
  { descripcion: 'Gasto ejecutado Luis Moreira Junio', proyectoAsignado: 'PCF', clienteOProveedor: 'Luis Moreira', tipo: 'egreso', montoEjecutado: 4086409, fechaEjecutado: '2026-06-15' },
  // Gastos Ejecutados - Juan Francisco
  { descripcion: 'Gasto ejecutado Juan Francisco Mayo', proyectoAsignado: 'PCF', clienteOProveedor: 'Juan Francisco', tipo: 'egreso', montoEjecutado: 915634, fechaEjecutado: '2026-05-15' },
  { descripcion: 'Gasto ejecutado Juan Francisco Junio', proyectoAsignado: 'PCF', clienteOProveedor: 'Juan Francisco', tipo: 'egreso', montoEjecutado: 2720432, fechaEjecutado: '2026-06-15' },
  // Gastos Ejecutados - Juan Martín
  { descripcion: 'Gasto ejecutado Juan Martín Junio', proyectoAsignado: 'PCF', clienteOProveedor: 'Juan Martín Rincón', tipo: 'egreso', montoEjecutado: 1000000, fechaEjecutado: '2026-06-15' },
  { descripcion: 'Gasto ejecutado Juan Martín Julio', proyectoAsignado: 'PCF', clienteOProveedor: 'Juan Martín Rincón', tipo: 'egreso', montoEjecutado: 1000000, fechaEjecutado: '2026-07-15' },
  // Gastos Ejecutados - Granja de Render
  { descripcion: 'Gasto ejecutado Granja de Render Junio', proyectoAsignado: 'PCF', clienteOProveedor: 'Granja de Render', tipo: 'egreso', montoEjecutado: 700000, fechaEjecutado: '2026-06-15' },
];

async function uploadPCF() {
  console.log('Uploading PCF data to Saman...');

  // Add missing provider
  await db.collection('providers').doc('granja-de-render').set({ name: 'Granja de Render' });
  console.log('  ✓ Added provider: Granja de Render');

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

  console.log('\nPCF upload complete!');
  process.exit(0);
}

uploadPCF().catch((err) => { console.error('Upload failed:', err); process.exit(1); });
