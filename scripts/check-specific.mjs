import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env');
  try {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[t.slice(0, i).trim()] = process.env[t.slice(0, i).trim()] || v;
    }
  } catch {}
}
loadEnv();

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

async function main() {
  // Find all budgets for Servicios Nube with monto=164700, mes=Marzo
  const snap = await getDocs(collection(db, 'companies', 'saman', 'budgets'));
  const budgets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const target = budgets.find(b =>
    b.projectName === 'Servicios Nube' && b.montoPresupuestado === 164700 && b.mesPresupuestado === 'Marzo'
  );

  if (!target) {
    console.log('❌ No se encontró el presupuesto buscado');
    return;
  }

  console.log('🎯 Presupuesto encontrado:');
  console.log(`   ID: ${target.id}`);
  console.log(`   projectName: "${target.projectName}"`);
  console.log(`   descripcion: "${target.descripcion}"`);
  console.log(`   mesPresupuestado: "${target.mesPresupuestado}"`);
  console.log(`   montoPresupuestado: ${target.montoPresupuestado}`);
  console.log(`   fechaPresupuestado: "${target.fechaPresupuestado}"`);
  console.log(`   archivado: ${target.archivado}`);
  console.log(`   createdAt: ${target.createdAt?.seconds ? new Date(target.createdAt.seconds * 1000).toISOString() : 'unknown'}`);
  console.log(`   entityName: "${target.entityName}"`);
  console.log(`   entityType: "${target.entityType}"`);

  // Check if archivado field is explicitly in Firestore or just defaulted
  const docRef = doc(db, 'companies', 'saman', 'budgets', target.id);
  const docSnap = await getDoc(docRef);
  const data = docSnap.data();
  const hasArchivado = 'archivado' in (data || {});
  console.log(`\n   archivado field exists in Firestore: ${hasArchivado}`);
  console.log(`   Firestore archivado value: ${data?.archivado}`);
  console.log(`\n   All Firestore fields: ${Object.keys(data || {}).join(', ')}`);
}

main().catch(console.error);
